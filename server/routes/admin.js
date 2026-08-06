import express from 'express';
import db from '../db.js';
import { authenticateToken, requireAdmin, JWT_SECRET } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import { getUsageSummary } from '../services/apiUsage.js';
import { createRazorpayPlan, isRazorpayConfigured } from '../services/razorpayBilling.js';

const router = express.Router();

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
  const amount = Number(req.body.amount || 0);
  if (!amount || Number.isNaN(amount)) {
    return res.status(400).json({ error: 'amount required' });
  }
  try {
    const userId = req.params.id;
    const [packages] = await db.query(
      'SELECT id, remaining_leads FROM user_packages WHERE user_id = ? AND status = "active" ORDER BY id DESC LIMIT 1',
      [userId]
    );
    if (packages.length === 0) {
      await db.query(
        `INSERT INTO user_packages (user_id, package_id, remaining_leads, purchased_leads, status)
         VALUES (?, 'Free', ?, ?, 'active')`,
        [userId, Math.max(0, amount), Math.max(0, amount)]
      );
    } else {
      const next = Math.max(0, packages[0].remaining_leads + amount);
      await db.query('UPDATE user_packages SET remaining_leads = ? WHERE id = ?', [next, packages[0].id]);
    }
    const [updated] = await db.query(
      'SELECT remaining_leads FROM user_packages WHERE user_id = ? AND status = "active" ORDER BY id DESC LIMIT 1',
      [userId]
    );
    res.json({ success: true, credits: updated[0]?.remaining_leads || 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to adjust credits' });
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
