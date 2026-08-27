import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import db from "../db.js";
import {
  authenticateToken,
  JWT_SECRET,
  isAdminRole,
} from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { getEmailQuota } from "../services/email/emailQuota.js";
import { checkLeadCreditAccess } from "./billing.js";
import { getFirebaseAdmin, isFirebaseAdminConfigured } from "../firebase.js";
import {
  getFirebaseWebConfig,
  loadFirebaseWebConfig,
} from "../services/firebaseWebConfig.js";
import {
  issueEmailVerification,
  verifyEmailToken,
  issuePasswordReset,
  consumePasswordResetToken,
} from "../services/authEmailService.js";

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MIN_PASSWORD_LENGTH = 8;
/** Used for timing-safe login when email is unknown */
const DUMMY_PASSWORD_HASH =
  "$2a$12$VUg0SW3Zf6naJEmkY4kw7O0avF/KvAE2nAAUY9KwId7RV0H1Vn2eq";

function setAuthNoStore(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

function signUserToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || "solar_company",
    },
    JWT_SECRET,
    { algorithm: "HS256", expiresIn: "24h" },
  );
}

function maskApiKey(key) {
  if (!key) return null;
  const s = String(key);
  if (s.length <= 12) return "••••••••";
  return `${s.slice(0, 8)}••••${s.slice(-4)}`;
}

function generateDeveloperApiKey() {
  return `sv_live_${crypto.randomBytes(24).toString("hex")}`;
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
    phone: user.phone || null,
    apiKeyMasked: maskApiKey(user.developer_api_key),
    hasApiKey: Boolean(user.developer_api_key),
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
    if (!EMAIL_RE.test(String(email).trim())) {
      return res.status(400).json({ error: "Invalid email address" });
    }
    if (String(password).length < MIN_PASSWORD_LENGTH) {
      return res
        .status(400)
        .json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [
      email,
    ]);
    if (existing.length > 0) {
      return res.status(400).json({ error: "Unable to register with this email" });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const [result] = await db.query(
      "INSERT INTO users (name, email, password_hash, company_name, email_verified) VALUES (?, ?, ?, ?, 0)",
      [name, email, passwordHash, company || null],
    );
    const userId = result.insertId;

    // Free tier: always 5 credits on signup
    const initialCredits = 5;
    await db.query(
      "INSERT INTO user_packages (user_id, package_id, remaining_leads, purchased_leads, status) VALUES (?, ?, ?, ?, ?)",
      [userId, "Free", initialCredits, initialCredits, "active"],
    );

    await issueEmailVerification(userId, email, name);

    setAuthNoStore(res);
    res.status(201).json({
      message: "Account created. Check your email to verify before signing in.",
      emailVerificationRequired: true,
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
    const user = users[0];

    if (!user || !user.password_hash) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      return res.status(400).json({ error: "Invalid email or password" });
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

    if (Number(user.email_verified) === 0 && !user.firebase_uid) {
      return res.status(403).json({
        error: "Please verify your email before signing in. Check your inbox or request a new link.",
        code: "email_unverified",
      });
    }

    setAuthNoStore(res);
    res.json({
      token: signUserToken(user),
      user: publicUser(user),
    });
  }),
);

// Verify email (public link from email)
router.post(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const token = req.body?.token || req.query?.token;
    const result = await verifyEmailToken(token);
    if (!result.ok) return res.status(400).json({ error: result.error });
    setAuthNoStore(res);
    res.json({ message: "Email verified. You can sign in now.", email: result.email });
  }),
);

router.post(
  "/resend-verification",
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || "").trim();
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Valid email required" });
    }
    const [users] = await db.query("SELECT id, name, email_verified FROM users WHERE email = ?", [email]);
    if (!users.length || Number(users[0].email_verified) === 1) {
      return res.json({ message: "If an unverified account exists, a new link was sent." });
    }
    await issueEmailVerification(users[0].id, email, users[0].name);
    res.json({ message: "If an unverified account exists, a new link was sent." });
  }),
);

router.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || "").trim();
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "Valid email required" });
    }
    await issuePasswordReset(email);
    res.json({ message: "If an account exists for that email, a reset link was sent." });
  }),
);

router.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return res.status(400).json({ error: "Token and new password required" });
    }
    if (String(password).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }
    const consumed = await consumePasswordResetToken(token);
    if (!consumed.ok) return res.status(400).json({ error: consumed.error });
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    await db.query(
      `UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL, email_verified = 1 WHERE id = ?`,
      [passwordHash, consumed.userId],
    );
    setAuthNoStore(res);
    res.json({ message: "Password updated. You can sign in now." });
  }),
);

// Public Firebase web SDK config (browser-safe; used when VITE_FIREBASE_* is unset)
router.get(
  "/firebase-config",
  asyncHandler(async (req, res) => {
    setAuthNoStore(res);
    const cfg = getFirebaseWebConfig() || (await loadFirebaseWebConfig());
    if (!cfg) {
      return res.json({ configured: false });
    }
    return res.json({
      configured: true,
      apiKey: cfg.apiKey,
      authDomain: cfg.authDomain,
      projectId: cfg.projectId,
      storageBucket: cfg.storageBucket,
      messagingSenderId: cfg.messagingSenderId,
      appId: cfg.appId,
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
      decoded = await firebaseAdmin.auth().verifyIdToken(idToken, true);
    } catch {
      return res
        .status(401)
        .json({ error: "Invalid or expired Firebase token" });
    }

    if (!decoded.email_verified) {
      return res.status(403).json({
        error: "Please verify your email with your social provider before signing in.",
      });
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
        if (user.password_hash && user.firebase_uid && user.firebase_uid !== firebaseUid) {
          return res.status(409).json({
            error:
              "An account with this email already exists. Sign in with your password first.",
          });
        }
        if (user.password_hash && !user.firebase_uid) {
          return res.status(409).json({
            error:
              "An account with this email already exists. Sign in with your password first.",
          });
        }
        await db.query(
          "UPDATE users SET firebase_uid = ?, auth_provider = COALESCE(auth_provider, ?), email_verified = 1 WHERE id = ?",
          [firebaseUid, authProvider, user.id],
        );
        user.firebase_uid = firebaseUid;
        user.auth_provider = user.auth_provider || authProvider;
      } else {
        const [result] = await db.query(
          `INSERT INTO users (name, email, password_hash, company_name, firebase_uid, auth_provider, email_verified)
         VALUES (?, ?, NULL, NULL, ?, ?, 1)`,
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

    setAuthNoStore(res);
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

    setAuthNoStore(res);
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
            job_title, lead_volume, developer_api_key
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
      'SELECT package_id, remaining_leads, purchased_leads FROM user_packages WHERE user_id = ? AND status = "active" ORDER BY id DESC LIMIT 1',
      [user.id],
    );
    const creditCheck = await checkLeadCreditAccess(user.id);
    const credits = creditCheck.credits ?? 0;
    const purchasedLeads = packages.length > 0 ? packages[0].purchased_leads : 0;
    const activePackage = packages.length > 0 ? packages[0].package_id : "Free";
    const unlimitedCredits = isAdminRole(user.role);

    const [usedTodayRows] = await db.query(
      `SELECT COUNT(*) AS cnt FROM leads
     WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
      [user.id],
    );
    const creditsUsedToday = Number(usedTodayRows[0]?.cnt) || 0;

    const [subs] = await db.query(
      `SELECT s.package_id, s.status, s.current_period_end, s.cancel_at_period_end, p.name AS package_name, p.lead_limit, p.email_limit
     FROM user_subscriptions s
     LEFT JOIN packages p ON p.id = s.package_id
     WHERE s.user_id = ?
     LIMIT 1`,
      [user.id],
    );
    const sub = subs[0] || null;

    const emailQuota = await getEmailQuota(user.id, user.role);

    setAuthNoStore(res);
    res.json({
      user,
      needsOnboarding: !user.company,
      credits: unlimitedCredits ? Math.max(credits, 9999) : credits,
      creditsUsedToday,
      canUnlockLeads: unlimitedCredits || creditCheck.allowed,
      creditBlockReason: unlimitedCredits ? null : creditCheck.reason || null,
      creditBlockMessage: unlimitedCredits ? null : creditCheck.error || null,
      creditCostPerUnlock: 1,
      scanQuota: {
        usedToday: creditsUsedToday,
        remaining: unlimitedCredits ? 9999 : credits,
        total: unlimitedCredits ? 9999 : Math.max(purchasedLeads, credits + creditsUsedToday),
      },
      emailQuota: {
        unlimited: !!emailQuota.unlimited,
        packageId: emailQuota.packageId,
        packageName: emailQuota.packageName,
        limit: emailQuota.unlimited ? null : emailQuota.limit,
        used: emailQuota.used,
        remaining: emailQuota.unlimited ? null : emailQuota.remaining,
        periodEnd: emailQuota.periodEnd,
      },
      activePackage: unlimitedCredits ? "Admin" : activePackage,
      unlimitedCredits,
      subscription: sub
        ? {
            packageId: sub.package_id,
            packageName: sub.package_name,
            status: sub.status,
            leadLimit: sub.lead_limit,
            emailLimit: sub.email_limit,
            currentPeriodEnd: sub.current_period_end,
            cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          }
        : null,
    });
  }),
);

// Update profile fields
router.patch(
  "/profile",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { name, phone, jobTitle } = req.body || {};
    const updates = [];
    const params = [];

    if (name != null && String(name).trim()) {
      updates.push("name = ?");
      params.push(String(name).trim());
    }
    if (phone != null) {
      updates.push("phone = ?");
      params.push(String(phone).trim() || null);
    }
    if (jobTitle != null) {
      updates.push("job_title = ?");
      params.push(String(jobTitle).trim() || null);
    }

    if (!updates.length) {
      return res.status(400).json({ error: "No profile fields to update" });
    }

    params.push(req.user.id);
    await db.query(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);

    const [users] = await db.query(
      `SELECT id, name, email, company_name as company, phone, role, job_title, lead_volume, developer_api_key
       FROM users WHERE id = ?`,
      [req.user.id],
    );
    setAuthNoStore(res);
    res.json({ user: publicUser(users[0]) });
  }),
);

// Regenerate developer API key
router.post(
  "/regenerate-api-key",
  authenticateToken,
  asyncHandler(async (req, res) => {
    const apiKey = generateDeveloperApiKey();
    await db.query(`UPDATE users SET developer_api_key = ? WHERE id = ?`, [
      apiKey,
      req.user.id,
    ]);
    setAuthNoStore(res);
    res.json({ apiKey, apiKeyMasked: maskApiKey(apiKey) });
  }),
);

export default router;
