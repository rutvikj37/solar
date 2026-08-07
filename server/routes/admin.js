import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { authenticateToken, requireAdmin, JWT_SECRET } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import { getUsageSummary } from '../services/apiUsage.js';
import { createRazorpayPlan, isRazorpayConfigured } from '../services/razorpayBilling.js';

const router = express.Router();

/** Matches RegisterPage minLength={8} */
const MIN_PASSWORD_LENGTH = 8;

function generateTemporaryPassword(length = 12) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

async function attachRole(req, res, next) {
  try {
    const [users] = await db.query('SELECT id, email, name, role, account_status FROM users WHERE id = ?', [
      req.user.id
    ]);
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });
    req.user.role = users[0].role;
    req.user.account_status = users[0].account_status;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Failed to verify admin role' });
  }
}

const adminChain = [authenticateToken, attachRole, requireAdmin];

router.get('/stats', ...adminChain, async (_req, res) => {
  try {
    const [[userCount]] = await db.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN account_status = 'active' OR account_status IS NULL THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS new_7d
       FROM users`
    );
    const [[leadCount]] = await db.query('SELECT COUNT(*) AS total FROM leads');
    const [[creditSum]] = await db.query(
      `SELECT COALESCE(SUM(remaining_leads), 0) AS remaining FROM user_packages WHERE status = 'active'`
    );
    const [[revenue]] = await db.query(
      `SELECT COALESCE(SUM(amount_cents), 0) AS cents,
              COUNT(*) AS paid_orders
       FROM invoices WHERE status = 'paid'`
    );
    const [[subs]] = await db.query(
      `SELECT COUNT(*) AS active_subs
       FROM user_packages
       WHERE status = 'active' AND package_id != 'Free' AND remaining_leads > 0`
    );
    const [[openTickets]] = await db.query(
      `SELECT COUNT(*) AS open_count FROM support_tickets WHERE status IN ('open','in_progress')`
    );

    res.json({
      totalUsers: userCount.total,
      activeUsers: userCount.active,
      newUsers7d: userCount.new_7d,
      totalLeads: leadCount.total,
      remainingCredits: creditSum.remaining,
      revenueCents: revenue.cents,
      paidOrders: revenue.paid_orders,
      mrrEstimate: Math.round(revenue.cents / 100),
      activeSubscriptions: subs.active_subs,
      openTickets: openTickets.open_count
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to load admin stats' });
  }
});

router.get('/users', ...adminChain, async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  try {
    let sql = `
      SELECT u.id, u.name, u.email, u.company_name, u.role, u.account_status, u.created_at,
             COALESCE(p.package_id, 'None') AS plan,
             COALESCE(p.remaining_leads, 0) AS credits,
             COALESCE(p.purchased_leads, 0) AS purchased_leads
      FROM users u
      LEFT JOIN user_packages p ON p.user_id = u.id AND p.status = 'active'
    `;
    const params = [];
    if (q) {
      sql += ` WHERE u.name LIKE ? OR u.email LIKE ? OR u.company_name LIKE ?`;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    sql += ' ORDER BY u.created_at DESC LIMIT 200';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

router.get('/users/:id', ...adminChain, async (req, res) => {
  const userId = req.params.id;
  try {
    const [users] = await db.query(
      `SELECT id, name, email, company_name, phone, role, account_status, created_at, stripe_customer_id
       FROM users WHERE id = ?`,
      [userId]
    );
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });

    const [packages] = await db.query(
      `SELECT p.id, p.package_id, p.remaining_leads, p.purchased_leads, p.status,
              pkg.name AS package_name, pkg.price, pkg.lead_limit
       FROM user_packages p
       LEFT JOIN packages pkg ON pkg.id = p.package_id
       WHERE p.user_id = ? AND p.status = 'active'
       ORDER BY p.id DESC LIMIT 1`,
      [userId]
    );

    const [subs] = await db.query(
      `SELECT s.package_id, s.status, s.current_period_start, s.current_period_end,
              s.cancel_at_period_end, s.payment_provider, s.stripe_subscription_id,
              s.razorpay_subscription_id, pkg.name AS package_name, pkg.lead_limit
       FROM user_subscriptions s
       LEFT JOIN packages pkg ON pkg.id = s.package_id
       WHERE s.user_id = ?
       LIMIT 1`,
      [userId]
    );

    const [leadCounts] = await db.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS last_7d
       FROM leads WHERE user_id = ?`,
      [userId]
    );

    const [leadByStatus] = await db.query(
      'SELECT status, COUNT(*) AS count FROM leads WHERE user_id = ? GROUP BY status',
      [userId]
    );

    const [recentActivity] = await db.query(
      `SELECT la.id, la.type, la.content, la.created_at, la.lead_id, l.address AS lead_address
       FROM lead_activities la
       LEFT JOIN leads l ON l.id = la.lead_id
       WHERE la.user_id = ?
       ORDER BY la.created_at DESC
       LIMIT 15`,
      [userId]
    );

    const [creditHistory] = await db.query(
      `SELECT a.id, a.amount, a.balance_after, a.mode, a.note, a.created_at,
              u.name AS admin_name
       FROM admin_credit_adjustments a
       LEFT JOIN users u ON u.id = a.admin_id
       WHERE a.user_id = ?
       ORDER BY a.created_at DESC
       LIMIT 10`,
      [userId]
    );

    const [ticketCount] = await db.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status IN ('open','in_progress') THEN 1 ELSE 0 END) AS open_count
       FROM support_tickets WHERE user_id = ?`,
      [userId]
    );

    const pkg = packages[0] || null;
    const sub = subs[0] || null;

    res.json({
      user: users[0],
      package: pkg
        ? {
            packageId: pkg.package_id,
            packageName: pkg.package_name || pkg.package_id,
            remainingLeads: pkg.remaining_leads,
            purchasedLeads: pkg.purchased_leads,
            status: pkg.status,
            price: pkg.price,
            leadLimit: pkg.lead_limit
          }
        : null,
      credits: pkg?.remaining_leads ?? 0,
      subscription: sub
        ? {
            packageId: sub.package_id,
            packageName: sub.package_name,
            status: sub.status,
            leadLimit: sub.lead_limit,
            currentPeriodStart: sub.current_period_start,
            currentPeriodEnd: sub.current_period_end,
            cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
            paymentProvider: sub.payment_provider,
            stripeSubscriptionId: sub.stripe_subscription_id,
            razorpaySubscriptionId: sub.razorpay_subscription_id
          }
        : null,
      leads: {
        total: leadCounts[0]?.total ?? 0,
        last7d: leadCounts[0]?.last_7d ?? 0,
        byStatus: Object.fromEntries(leadByStatus.map((r) => [r.status || 'unknown', r.count]))
      },
      tickets: {
        total: ticketCount[0]?.total ?? 0,
        open: ticketCount[0]?.open_count ?? 0
      },
      recentActivity,
      creditHistory
    });
  } catch (error) {
    console.error('Admin user detail error:', error);
    res.status(500).json({ error: 'Failed to load user profile' });
  }
});

router.get('/users/:id/invoices', ...adminChain, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
      [req.params.id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load invoices' });
  }
});

router.get('/subscriptions', ...adminChain, async (_req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.id AS user_id, u.name, u.email, u.company_name, u.account_status,
             p.package_id, p.remaining_leads, p.purchased_leads, p.status AS package_status,
             pkg.name AS package_name, pkg.price
      FROM user_packages p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN packages pkg ON pkg.id = p.package_id
      WHERE p.status = 'active'
      ORDER BY p.remaining_leads DESC
      LIMIT 300
    `);
    res.json(rows);
  } catch (error) {
    console.error('Admin subscriptions error:', error);
    res.status(500).json({ error: 'Failed to list subscriptions' });
  }
});

router.patch('/users/:id/status', ...adminChain, async (req, res) => {
  const { status } = req.body;
  if (!['active', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'status must be active or suspended' });
  }
  try {
    await db.query('UPDATE users SET account_status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, id: Number(req.params.id), status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

router.post('/users/:id/credits', ...adminChain, async (req, res) => {
  const rawAmount = req.body.amount;
  const amount = Number(rawAmount);
  const mode = req.body.mode === 'set' ? 'set' : 'add';
  const note = (req.body.note || '').toString().trim().slice(0, 500) || null;

  if (rawAmount === undefined || rawAmount === null || rawAmount === '' || Number.isNaN(amount)) {
    return res.status(400).json({ error: 'amount required' });
  }
  if (mode === 'add' && amount === 0) {
    return res.status(400).json({ error: 'amount must be non-zero for add mode' });
  }
  if (mode === 'set' && amount < 0) {
    return res.status(400).json({ error: 'balance cannot be negative' });
  }

  try {
    const userId = req.params.id;
    const [userRows] = await db.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });

    const [packages] = await db.query(
      'SELECT id, remaining_leads, purchased_leads FROM user_packages WHERE user_id = ? AND status = "active" ORDER BY id DESC LIMIT 1',
      [userId]
    );

    let balanceAfter;
    const delta = mode === 'set' ? amount - (packages[0]?.remaining_leads ?? 0) : amount;

    if (packages.length === 0) {
      balanceAfter = mode === 'set' ? amount : Math.max(0, amount);
      await db.query(
        `INSERT INTO user_packages (user_id, package_id, remaining_leads, purchased_leads, status)
         VALUES (?, 'Free', ?, ?, 'active')`,
        [userId, balanceAfter, Math.max(0, delta > 0 ? delta : 0)]
      );
    } else if (mode === 'set') {
      balanceAfter = amount;
      const purchasedBump = Math.max(0, amount - packages[0].remaining_leads);
      await db.query(
        `UPDATE user_packages
         SET remaining_leads = ?,
             purchased_leads = purchased_leads + ?
         WHERE id = ?`,
        [balanceAfter, purchasedBump, packages[0].id]
      );
    } else {
      balanceAfter = Math.max(0, packages[0].remaining_leads + amount);
      const purchasedBump = amount > 0 ? amount : 0;
      await db.query(
        `UPDATE user_packages
         SET remaining_leads = ?,
             purchased_leads = purchased_leads + ?
         WHERE id = ?`,
        [balanceAfter, purchasedBump, packages[0].id]
      );
    }

    await db.query(
      `INSERT INTO admin_credit_adjustments (user_id, admin_id, amount, balance_after, mode, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, req.user.id, mode === 'set' ? delta : amount, balanceAfter, mode, note]
    );

    res.json({ success: true, credits: balanceAfter, mode, amount: mode === 'set' ? delta : amount });
  } catch (error) {
    console.error('Admin credit adjust error:', error);
    res.status(500).json({ error: 'Failed to adjust credits' });
  }
});

router.post('/users/:id/reset-password', ...adminChain, async (req, res) => {
  const userId = req.params.id;
  const generate = Boolean(req.body.generate);
  let password = (req.body.password ?? '').toString();

  if (generate) {
    password = generateTemporaryPassword(12);
  }

  if (!password) {
    return res.status(400).json({ error: 'password required, or set generate: true' });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
    });
  }

  try {
    const [users] = await db.query('SELECT id, email FROM users WHERE id = ?', [userId]);
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);

    console.log(
      `[admin] password reset for user ${userId} (${users[0].email}) by admin ${req.user.id}`
    );

    res.json({
      success: true,
      userId: Number(userId),
      email: users[0].email,
      temporaryPassword: password,
      generated: generate,
      note: `Password reset by admin ${req.user.id}`
    });
  } catch (error) {
    console.error('Admin password reset error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// --- Dynamic plans CRUD ---
router.get('/plans', ...adminChain, async (_req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM packages ORDER BY price ASC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list plans' });
  }
});

router.post('/plans', ...adminChain, async (req, res) => {
  const {
    id,
    name,
    lead_limit,
    price,
    description,
    features,
    is_active,
    stripe_price_id,
    razorpay_plan_id,
    billing_interval,
    is_subscription
  } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id and name required' });
  const planId = String(id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);
  if (!planId) return res.status(400).json({ error: 'Invalid plan id' });

  const subFlag =
    is_subscription === false || is_subscription === 0 || is_subscription === '0' ? 0 : 1;
  const interval = billing_interval === 'one_time' ? 'one_time' : 'month';

  if (subFlag === 1 && is_active !== false && is_active !== 0 && is_active !== '0') {
    if (isRazorpayConfigured()) {
      if (!razorpay_plan_id) {
        // allow create — may auto-generate below
      }
    } else if (!stripe_price_id) {
      return res.status(400).json({
        error: 'Monthly subscription plans require stripe_price_id (or configure Razorpay keys)'
      });
    }
  }

  try {
    let resolvedRazorpayPlanId = razorpay_plan_id || null;
    if (subFlag === 1 && isRazorpayConfigured() && !resolvedRazorpayPlanId && Number(price) > 0) {
      try {
        resolvedRazorpayPlanId = await createRazorpayPlan({
          name,
          amountUsd: Number(price),
          description: description || `${lead_limit} leads/month`
        });
      } catch (rzErr) {
        console.warn('[Admin] Razorpay plan auto-create failed:', rzErr.message);
      }
    }

    const featuresJson =
      typeof features === 'string' ? features : JSON.stringify(features || []);
    await db.query(
      `INSERT INTO packages (id, name, lead_limit, price, description, features, is_active, stripe_price_id, razorpay_plan_id, billing_interval, is_subscription)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        planId,
        name,
        Number(lead_limit) || 0,
        Number(price) || 0,
        description || '',
        featuresJson,
        is_active === false || is_active === 0 || is_active === '0' ? 0 : 1,
        stripe_price_id || null,
        resolvedRazorpayPlanId,
        interval,
        subFlag
      ]
    );
    const [rows] = await db.query('SELECT * FROM packages WHERE id = ?', [planId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ error: error.code === 'ER_DUP_ENTRY' ? 'Plan id already exists' : 'Failed to create plan' });
  }
});

router.put('/plans/:id', ...adminChain, async (req, res) => {
  const {
    name,
    lead_limit,
    price,
    description,
    features,
    is_active,
    stripe_price_id,
    razorpay_plan_id,
    billing_interval,
    is_subscription
  } = req.body;
  try {
    const featuresJson =
      features === undefined
        ? null
        : typeof features === 'string'
          ? features
          : JSON.stringify(features || []);

    const subFlag =
      is_subscription === undefined
        ? null
        : is_subscription === false || is_subscription === 0 || is_subscription === '0'
          ? 0
          : 1;
    const interval =
      billing_interval === undefined ? null : billing_interval === 'one_time' ? 'one_time' : 'month';

    await db.query(
      `UPDATE packages SET
         name = COALESCE(?, name),
         lead_limit = COALESCE(?, lead_limit),
         price = COALESCE(?, price),
         description = COALESCE(?, description),
         features = COALESCE(?, features),
         is_active = COALESCE(?, is_active),
         stripe_price_id = COALESCE(?, stripe_price_id),
         razorpay_plan_id = COALESCE(?, razorpay_plan_id),
         billing_interval = COALESCE(?, billing_interval),
         is_subscription = COALESCE(?, is_subscription)
       WHERE id = ?`,
      [
        name ?? null,
        lead_limit !== undefined ? Number(lead_limit) : null,
        price !== undefined ? Number(price) : null,
        description ?? null,
        featuresJson,
        is_active === undefined ? null : is_active === false || is_active === 0 || is_active === '0' ? 0 : 1,
        stripe_price_id === undefined ? null : stripe_price_id,
        razorpay_plan_id === undefined ? null : razorpay_plan_id,
        interval,
        subFlag,
        req.params.id
      ]
    );
    const [rows] = await db.query('SELECT * FROM packages WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Plan not found' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

router.delete('/plans/:id', ...adminChain, async (req, res) => {
  if (req.params.id === 'Free') {
    return res.status(400).json({ error: 'Cannot delete Free plan' });
  }
  try {
    // Soft-delete: deactivate
    await db.query('UPDATE packages SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, id: req.params.id, is_active: 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deactivate plan' });
  }
});

router.get('/apis', ...adminChain, async (req, res) => {
  try {
    const days = Number(req.query.days) || 7;
    const usage = await getUsageSummary(days);
    res.json({ days, providers: usage });
  } catch (error) {
    console.error('Admin APIs error:', error);
    res.status(500).json({ error: 'Failed to load API status' });
  }
});

router.get('/inquiries', ...adminChain, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const [rows] = await db.query(
      `SELECT id, name, company, email, phone, country, intent, message, created_at
       FROM marketing_inquiries
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    );
    res.json(rows);
  } catch (error) {
    console.error('Admin inquiries error:', error);
    res.status(500).json({ error: 'Failed to load inquiries' });
  }
});

router.post('/bootstrap', authenticateToken, async (req, res) => {
  try {
    const [admins] = await db.query(
      `SELECT id FROM users WHERE role IN ('admin', 'platform_admin', 'super_admin') LIMIT 1`
    );
    if (admins.length > 0) {
      return res.status(403).json({ error: 'Admin already exists' });
    }
    await db.query(`UPDATE users SET role = 'admin' WHERE id = ?`, [req.user.id]);
    const token = jwt.sign(
      { id: req.user.id, email: req.user.email, name: req.user.name, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ success: true, token, role: 'admin' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to bootstrap admin' });
  }
});

export default router;
