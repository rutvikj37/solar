import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../db.js";
import {
  authenticateToken,
  JWT_SECRET,
  isAdminRole,
} from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { getFirebaseAdmin, isFirebaseAdminConfigured } from "../firebase.js";

const router = express.Router();

function signUserToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || "solar_company",
    },
    JWT_SECRET,
    { expiresIn: "24h" },
  );
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    company: user.company_name || user.company || null,
    role: user.role || "solar_company",
    jobTitle: user.job_title || null,
    leadVolume: user.lead_volume || null,
  };
}

function needsOnboarding(user) {
  return !user.company_name && !user.company;
}

// Register
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { name, company, email, password } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Missing credentials" });
    }

    const [existing] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    if (existing.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [result] = await db.query(
      "INSERT INTO users (name, email, password_hash, company_name) VALUES (?, ?, ?, ?)",
      [name, email, passwordHash, company || null],
    );
    const userId = result.insertId;

    // Free tier: always 5 credits on signup
    const initialCredits = 5;
    await db.query(
      "INSERT INTO user_packages (user_id, package_id, remaining_leads, purchased_leads, status) VALUES (?, ?, ?, ?, ?)",
      [userId, "Free", initialCredits, initialCredits, "active"],
    );

    const token = jwt.sign(
      { id: userId, email, name, role: "solar_company" },
      JWT_SECRET,
      { expiresIn: "24h" },
    );
    res.status(201).json({
      token,
      credits: initialCredits,
      user: { id: userId, name, email, company, role: "solar_company" },
    });
  }),
);

// Login
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }

    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    if (users.length === 0) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const user = users[0];
    if (!user.password_hash) {
      return res.status(400).json({
        error: "This account uses Google sign-in. Please continue with Google.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    if (user.account_status === "suspended") {
      return res
        .status(403)
        .json({ error: "Account suspended. Contact support." });
    }

    res.json({
      token: signUserToken(user),
      user: publicUser(user),
    });
  }),
);

// Firebase social login (Google / Microsoft)
router.post(
  "/firebase",
  asyncHandler(async (req, res) => {
    if (!isFirebaseAdminConfigured()) {
      return res.status(503).json({
        error:
          "Social login is not configured on the server. Add Firebase Admin credentials.",
      });
    }

    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: "Missing Firebase ID token" });
    }

    const firebaseAdmin = getFirebaseAdmin();
    if (!firebaseAdmin) {
      return res
        .status(503)
        .json({ error: "Firebase Admin failed to initialize" });
    }

    let decoded;
    try {
      decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
    } catch {
      return res
        .status(401)
        .json({ error: "Invalid or expired Firebase token" });
    }

    const firebaseUid = decoded.uid;
    const email = decoded.email;
    if (!email) {
      return res.status(400).json({
        error: "Your social account did not provide an email address.",
      });
    }

    const name = decoded.name || email.split("@")[0];
    const signInProvider = decoded.firebase?.sign_in_provider || "firebase";
    const authProvider = String(signInProvider).replace(/\.com$/, "");

    let [users] = await db.query("SELECT * FROM users WHERE firebase_uid = ?", [
      firebaseUid,
    ]);
    let user = users[0];
    let isNewUser = false;

    if (!user) {
      [users] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
      user = users[0];

      if (user) {
        await db.query(
          "UPDATE users SET firebase_uid = ?, auth_provider = COALESCE(auth_provider, ?) WHERE id = ?",
          [firebaseUid, authProvider, user.id],
        );
        user.firebase_uid = firebaseUid;
        user.auth_provider = user.auth_provider || authProvider;
      } else {
        const [result] = await db.query(
          `INSERT INTO users (name, email, password_hash, company_name, firebase_uid, auth_provider)
         VALUES (?, ?, NULL, NULL, ?, ?)`,
          [name, email, firebaseUid, authProvider],
        );
        const userId = result.insertId;
        const initialCredits = 5;
        await db.query(
          "INSERT INTO user_packages (user_id, package_id, remaining_leads, purchased_leads, status) VALUES (?, ?, ?, ?, ?)",
          [userId, "Free", initialCredits, initialCredits, "active"],
        );
        user = {
          id: userId,
          name,
          email,
          company_name: null,
          role: "solar_company",
          account_status: "active",
          firebase_uid: firebaseUid,
          auth_provider: authProvider,
        };
        isNewUser = true;
      }
    }

    if (user.account_status === "suspended") {
      return res
        .status(403)
        .json({ error: "Account suspended. Contact support." });
    }

    res.status(isNewUser ? 201 : 200).json({
      token: signUserToken(user),
      user: publicUser(user),
      isNewUser,
      needsOnboarding: needsOnboarding(user),
    });
  }),
);

// Complete profile after Google sign-in
router.patch(
  "/onboarding",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { company, leadVolume, jobTitle } = req.body;
    if (!company || !String(company).trim()) {
      return res.status(400).json({ error: "Company name is required" });
    }
    if (!leadVolume || !String(leadVolume).trim()) {
      return res.status(400).json({ error: "Lead volume is required" });
    }
    if (!jobTitle || !String(jobTitle).trim()) {
      return res.status(400).json({ error: "Role in company is required" });
    }

    await db.query(
      `UPDATE users
     SET company_name = ?, lead_volume = ?, job_title = ?
     WHERE id = ?`,
      [
        String(company).trim(),
        String(leadVolume).trim(),
        String(jobTitle).trim(),
        req.user.id,
      ],
    );

    const [users] = await db.query("SELECT * FROM users WHERE id = ?", [
      req.user.id,
    ]);
    const user = users[0];
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: publicUser(user),
      needsOnboarding: false,
    });
  }),
);

// Get Profile & Credit Balance
router.get(
  "/me",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const [users] = await db.query(
      `SELECT id, name, email, company_name as company, phone, role, account_status,
            job_title, lead_volume
     FROM users WHERE id = ?`,
      [req.user.id],
    );
    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const row = users[0];
    const user = {
      ...row,
      jobTitle: row.job_title || null,
      leadVolume: row.lead_volume || null,
    };

    const [packages] = await db.query(
      'SELECT package_id, remaining_leads FROM user_packages WHERE user_id = ? AND status = "active"',
      [user.id],
    );
    const credits = packages.length > 0 ? packages[0].remaining_leads : 0;
    const activePackage = packages.length > 0 ? packages[0].package_id : "Free";
    const unlimitedCredits = isAdminRole(user.role);

    const [usedTodayRows] = await db.query(
      `SELECT COUNT(*) AS cnt FROM leads
     WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
      [user.id],
    );
    const creditsUsedToday = Number(usedTodayRows[0]?.cnt) || 0;

    const [subs] = await db.query(
      `SELECT s.package_id, s.status, s.current_period_end, s.cancel_at_period_end, p.name AS package_name, p.lead_limit
     FROM user_subscriptions s
     LEFT JOIN packages p ON p.id = s.package_id
     WHERE s.user_id = ?
     LIMIT 1`,
      [user.id],
    );
    const sub = subs[0] || null;

    res.json({
      user,
      needsOnboarding: !user.company,
      credits: unlimitedCredits ? Math.max(credits, 9999) : credits,
      creditsUsedToday,
      creditCostPerUnlock: 1,
      activePackage: unlimitedCredits ? "Admin" : activePackage,
      unlimitedCredits,
      subscription: sub
        ? {
            packageId: sub.package_id,
            packageName: sub.package_name,
            status: sub.status,
            leadLimit: sub.lead_limit,
            currentPeriodEnd: sub.current_period_end,
            cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          }
        : null,
    });
  }),
);

export default router;
