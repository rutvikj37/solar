import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { authenticateToken, JWT_SECRET, isAdminRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

// Register
router.post('/register', asyncHandler(async (req, res) => {
  const { name, company, email, password } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Missing credentials' });
  }

  const [existing] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  if (existing.length > 0) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const [result] = await db.query(
    'INSERT INTO users (name, email, password_hash, company_name) VALUES (?, ?, ?, ?)',
    [name, email, passwordHash, company || null]
  );
  const userId = result.insertId;

  // Free tier: always 5 credits on signup
  const initialCredits = 5;
  await db.query(
    'INSERT INTO user_packages (user_id, package_id, remaining_leads, purchased_leads, status) VALUES (?, ?, ?, ?, ?)',
    [userId, 'Free', initialCredits, initialCredits, 'active']
  );

  const token = jwt.sign({ id: userId, email, name, role: 'solar_company' }, JWT_SECRET, { expiresIn: '24h' });
  res.status(201).json({
    token,
    credits: initialCredits,
    user: { id: userId, name, email, company, role: 'solar_company' }
  });
}));

// Login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  if (users.length === 0) {
    return res.status(400).json({ error: 'Invalid email or password' });
  }

  const user = users[0];
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return res.status(400).json({ error: 'Invalid email or password' });
  }

  if (user.account_status === 'suspended') {
    return res.status(403).json({ error: 'Account suspended. Contact support.' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role || 'solar_company' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      company: user.company_name,
      role: user.role || 'solar_company'
    }
  });
}));

// Get Profile & Credit Balance
router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
  const [users] = await db.query(
    'SELECT id, name, email, company_name as company, phone, role, account_status FROM users WHERE id = ?',
    [req.user.id]
  );
  if (users.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  const user = users[0];

  const [packages] = await db.query(
    'SELECT package_id, remaining_leads FROM user_packages WHERE user_id = ? AND status = "active"',
    [user.id]
  );
  const credits = packages.length > 0 ? packages[0].remaining_leads : 0;
  const activePackage = packages.length > 0 ? packages[0].package_id : 'Free';
  const unlimitedCredits = isAdminRole(user.role);

  const [subs] = await db.query(
    `SELECT s.package_id, s.status, s.current_period_end, s.cancel_at_period_end, p.name AS package_name, p.lead_limit
     FROM user_subscriptions s
     LEFT JOIN packages p ON p.id = s.package_id
     WHERE s.user_id = ?
     LIMIT 1`,
    [user.id]
  );
  const sub = subs[0] || null;

  res.json({
    user,
    credits: unlimitedCredits ? Math.max(credits, 9999) : credits,
    activePackage: unlimitedCredits ? 'Admin' : activePackage,
    unlimitedCredits,
    subscription: sub
      ? {
          packageId: sub.package_id,
          packageName: sub.package_name,
          status: sub.status,
          leadLimit: sub.lead_limit,
          currentPeriodEnd: sub.current_period_end,
          cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end)
        }
      : null
  });
}));

export default router;
