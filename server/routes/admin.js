import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { authenticateToken, adminAuth, JWT_SECRET } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { getUsageSummary } from '../services/apiUsage.js';
import { createRazorpayPlan, isRazorpayConfigured } from '../services/razorpayBilling.js';
import {
  listUserInvoices,
  recordInvoice,
  setSubscriptionCredits,
  upsertUserSubscription
} from './billing.js';

import {
  getAdminCrmOAuthSettings,
  saveAdminCrmOAuthSettings,
  ensurePlatformCrmSettingsLoaded,
} from '../services/crm/platformCrmSettings.js';
import { getCrmSetupStatus } from '../services/crm/crmConnections.js';
import {
  getAdminEmailOAuthSettings,
  saveAdminEmailOAuthSettings,
  ensurePlatformEmailSettingsLoaded,
} from '../services/email/platformEmailSettings.js';
import { getEmailSetupStatus } from '../services/email/userEmailConnections.js';

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

const adminChain = adminAuth;

function packageLabel(pkg) {
  if (!pkg) return 'None';
  return pkg.name || pkg.id || 'None';
}

async function loadPackageById(packageId) {
  if (!packageId) return null;
  const [rows] = await db.query('SELECT * FROM packages WHERE id = ? LIMIT 1', [packageId]);
  return rows[0] || null;
}

async function loadUserPlanContext(userId) {
  const [users] = await db.query('SELECT id, email, name, account_status FROM users WHERE id = ?', [userId]);
  if (!users.length) return null;
  const [packages] = await db.query(
    `SELECT p.package_id, p.remaining_leads, pkg.name AS package_name, pkg.lead_limit, pkg.price
     FROM user_packages p
     LEFT JOIN packages pkg ON pkg.id = p.package_id
     WHERE p.user_id = ? AND p.status = 'active'
     ORDER BY p.id DESC LIMIT 1`,
    [userId]
  );
  const [subs] = await db.query('SELECT * FROM user_subscriptions WHERE user_id = ? LIMIT 1', [userId]);
  return {
    user: users[0],
    packageRow: packages[0] || null,
    subscription: subs[0] || null,
    currentPlanId: packages[0]?.package_id || 'Free',
    currentPlanName: packages[0]?.package_name || packages[0]?.package_id || 'Free',
    credits: packages[0]?.remaining_leads ?? 0
  };
}

async function recordAdminInvoice({
  userId,
  adminId,
  packageId,
  credits = 0,
  amountCents = 0,
  billingReason,
  description,
  note,
  status = 'adjusted',
  method = 'admin'
}) {
  const extra = (note || '').toString().trim().slice(0, 400);
  const fullDescription = extra ? `${description} — ${extra}` : description;
  return recordInvoice({
    userId,
    packageId: packageId || 'Free',
    amountCents: Math.max(0, Number(amountCents) || 0),
    credits: Number(credits) || 0,
    status,
    method,
    billingReason,
    description: fullDescription.slice(0, 500),
    adminId
  });
}

function formatUsd(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '$0.00';
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PLAN_GRANT_LOCK_SECONDS = 10;
const PLAN_GRANT_IDEM_SECONDS = 30;

async function assignUserPlan({
  userId,
  pkg,
  keepCredits = false,
  subscriptionStatus = 'active',
  cancelAtPeriodEnd = false
}) {
  const existing = await loadUserPlanContext(userId);
  const previousCredits = existing?.credits ?? 0;
  const nextCredits = keepCredits
    ? previousCredits
    : Math.max(0, Number(pkg.lead_limit) || 0);

  await setSubscriptionCredits(userId, pkg.id, nextCredits);

  const [subRows] = await db.query('SELECT * FROM user_subscriptions WHERE user_id = ? LIMIT 1', [userId]);
  const existingSub = subRows[0] || null;

  if (pkg.id === 'Free') {
    if (existingSub) {
      await db.query('DELETE FROM user_subscriptions WHERE user_id = ?', [userId]);
    }
  } else {
    const periodStart = existingSub?.current_period_start || new Date();
    const periodEnd = existingSub?.current_period_end || (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      return d;
    })();
    await upsertUserSubscription({
      userId,
      packageId: pkg.id,
      paymentProvider: existingSub?.payment_provider || 'admin',
      stripeCustomerId: existingSub?.stripe_customer_id || null,
      stripeSubscriptionId: existingSub?.stripe_subscription_id || null,
      razorpaySubscriptionId: existingSub?.razorpay_subscription_id || null,
      status: subscriptionStatus,
      periodStart,
      periodEnd,
      cancelAtPeriodEnd
    });
  }

  return { previousCredits, credits: nextCredits, previousPlanId: existing?.currentPlanId || 'Free', previousPlanName: existing?.currentPlanName || 'Free' };
}

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

    const invoices = await listUserInvoices(userId, 25);

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
      creditHistory,
      invoices
    });
  } catch (error) {
    console.error('Admin user detail error:', error);
    res.status(500).json({ error: 'Failed to load user profile' });
  }
});

router.get('/users/:id/invoices', ...adminChain, async (req, res) => {
  try {
    const rows = await listUserInvoices(req.params.id, 100);
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
  if (!['active', 'suspended', 'restricted'].includes(status)) {
    return res.status(400).json({ error: 'status must be active, restricted, or suspended' });
  }
  try {
    await db.query('UPDATE users SET account_status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, id: Number(req.params.id), status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

router.post('/users/:id/plan', ...adminChain, async (req, res) => {
  const packageId = (req.body.packageId || req.body.package_id || '').toString().trim();
  const note = (req.body.note || '').toString().trim().slice(0, 500) || null;
  const keepCredits = Boolean(req.body.keepCredits);
  const invoiceReasonRaw = (req.body.invoiceReason || req.body.reason || '').toString().trim().toLowerCase();
  const complimentary = Boolean(
    req.body.complimentary ||
      req.body.comp ||
      invoiceReasonRaw === 'comp' ||
      invoiceReasonRaw === 'complimentary'
  );
  const invoiceReason =
    complimentary
      ? 'comp'
      : invoiceReasonRaw === 'paid offline' || invoiceReasonRaw === 'offline'
        ? 'paid offline'
        : invoiceReasonRaw || 'manual grant';

  if (!packageId) {
    return res.status(400).json({ error: 'packageId required' });
  }

  const userId = req.params.id;
  const lockName = `admin_plan_grant_${userId}`;
  const conn = await db.getConnection();
  let lockHeld = false;

  try {
    const [lockRows] = await conn.query('SELECT GET_LOCK(?, ?) AS got', [lockName, PLAN_GRANT_LOCK_SECONDS]);
    if (!Number(lockRows[0]?.got)) {
      return res.status(409).json({ error: 'Plan grant already in progress. Try again.' });
    }
    lockHeld = true;

    const ctx = await loadUserPlanContext(userId);
    if (!ctx) return res.status(404).json({ error: 'User not found' });

    const pkg = await loadPackageById(packageId);
    if (!pkg) return res.status(400).json({ error: 'Invalid package id' });

    const [recentRows] = await db.query(
      `SELECT id, amount_cents, credits, description
       FROM invoices
       WHERE user_id = ? AND package_id = ?
         AND billing_reason = 'admin_plan_grant'
         AND created_at >= DATE_SUB(NOW(), INTERVAL ${PLAN_GRANT_IDEM_SECONDS} SECOND)
       ORDER BY id DESC
       LIMIT 1`,
      [userId, pkg.id]
    );

    if (recentRows.length) {
      const recent = recentRows[0];
      return res.json({
        success: true,
        idempotent: true,
        packageId: pkg.id,
        packageName: packageLabel(pkg),
        previousPackageId: ctx.currentPlanId,
        previousPackageName: ctx.currentPlanName,
        credits: ctx.credits,
        amountCents: recent.amount_cents,
        complimentary,
        invoiceReason,
        invoiceId: recent.id,
        description: recent.description
      });
    }

    const fromLabel = ctx.currentPlanName;
    const toLabel = packageLabel(pkg);
    const planPrice = Number(pkg.price) || 0;
    const amountCents = complimentary ? 0 : Math.round(planPrice * 100);

    const assigned = await assignUserPlan({
      userId,
      pkg,
      keepCredits,
      subscriptionStatus: 'active',
      cancelAtPeriodEnd: false
    });

    if (ctx.user.account_status === 'restricted' && pkg.id !== 'Free') {
      await db.query(`UPDATE users SET account_status = 'active' WHERE id = ?`, [userId]);
    }

    const changePart =
      fromLabel === toLabel ? `Admin plan grant: ${toLabel}` : `Admin plan change: ${fromLabel} → ${toLabel}`;
    const pricePart = complimentary || amountCents === 0 ? 'comp' : formatUsd(amountCents / 100);
    const description = `${changePart} (${pricePart})`;
    const invoiceNote = note || invoiceReason;

    const invoiceId = await recordAdminInvoice({
      userId,
      adminId: req.user.id,
      packageId: pkg.id,
      credits: assigned.credits,
      amountCents,
      billingReason: 'admin_plan_grant',
      description,
      note: invoiceNote,
      status: 'paid',
      method: complimentary ? 'admin_comp' : invoiceReason === 'paid offline' ? 'admin_offline' : 'admin'
    });

    res.json({
      success: true,
      packageId: pkg.id,
      packageName: toLabel,
      previousPackageId: assigned.previousPlanId,
      previousPackageName: fromLabel,
      credits: assigned.credits,
      amountCents,
      complimentary,
      invoiceReason,
      invoiceId,
      description
    });
  } catch (error) {
    console.error('Admin plan change error:', error);
    res.status(500).json({ error: 'Failed to change user plan' });
  } finally {
    if (lockHeld) {
      try {
        await conn.query('SELECT RELEASE_LOCK(?)', [lockName]);
      } catch (releaseErr) {
        console.error('Failed to release plan grant lock:', releaseErr);
      }
    }
    conn.release();
  }
});

router.post('/users/:id/restrict-plan', ...adminChain, async (req, res) => {
  const restrict = req.body.restrict !== false && req.body.restrict !== 0 && req.body.restrict !== '0';
  const note = (req.body.note || '').toString().trim().slice(0, 500) || null;
  const requestedPackageId = (req.body.packageId || req.body.package_id || '').toString().trim();

  try {
    const userId = req.params.id;
    const ctx = await loadUserPlanContext(userId);
    if (!ctx) return res.status(404).json({ error: 'User not found' });

    if (!restrict) {
      await db.query(`UPDATE users SET account_status = 'active' WHERE id = ?`, [userId]);
      const description = `Admin plan restriction lifted (${ctx.currentPlanName})`;
      const invoiceId = await recordAdminInvoice({
        userId,
        adminId: req.user.id,
        packageId: ctx.currentPlanId,
        credits: ctx.credits,
        amountCents: 0,
        billingReason: 'admin_plan_unrestrict',
        description,
        note
      });
      return res.json({
        success: true,
        restricted: false,
        accountStatus: 'active',
        packageId: ctx.currentPlanId,
        credits: ctx.credits,
        invoiceId,
        description
      });
    }

    const targetId = requestedPackageId || 'Free';
    const pkg = await loadPackageById(targetId);
    if (!pkg) return res.status(400).json({ error: 'Invalid package id' });

    const fromLabel = ctx.currentPlanName;
    const toLabel = packageLabel(pkg);
    const assigned = await assignUserPlan({
      userId,
      pkg,
      keepCredits: false,
      subscriptionStatus: pkg.id === 'Free' ? 'canceled' : 'active',
      cancelAtPeriodEnd: true
    });

    await db.query(`UPDATE users SET account_status = 'restricted' WHERE id = ?`, [userId]);

    const description = `Admin plan restrict: ${fromLabel} → ${toLabel}`;
    const invoiceId = await recordAdminInvoice({
      userId,
      adminId: req.user.id,
      packageId: pkg.id,
      credits: assigned.credits,
      amountCents: 0,
      billingReason: 'admin_plan_restrict',
      description,
      note
    });

    res.json({
      success: true,
      restricted: true,
      accountStatus: 'restricted',
      packageId: pkg.id,
      packageName: toLabel,
      previousPackageId: assigned.previousPlanId,
      credits: assigned.credits,
      invoiceId,
      description
    });
  } catch (error) {
    console.error('Admin restrict plan error:', error);
    res.status(500).json({ error: 'Failed to restrict user plan' });
  }
});

router.post('/users/:id/credits', ...adminChain, async (req, res) => {
  const rawAmount = req.body.amount;
  const amount = Number(rawAmount);
  const requestedMode = (req.body.mode || 'add').toString().toLowerCase();
  const note = (req.body.note || '').toString().trim().slice(0, 500) || null;

  let mode = 'add';
  if (requestedMode === 'set') mode = 'set';
  else if (requestedMode === 'subtract' || requestedMode === 'minus' || requestedMode === 'remove') mode = 'subtract';
  else mode = 'add';

  if (rawAmount === undefined || rawAmount === null || rawAmount === '' || Number.isNaN(amount)) {
    return res.status(400).json({ error: 'amount required' });
  }
  if (mode === 'set' && amount < 0) {
    return res.status(400).json({ error: 'balance cannot be negative' });
  }
  if (mode === 'subtract' && amount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number to subtract' });
  }
  if (mode === 'add' && amount === 0) {
    return res.status(400).json({ error: 'amount must be non-zero' });
  }

  try {
    const userId = req.params.id;
    const ctx = await loadUserPlanContext(userId);
    if (!ctx) return res.status(404).json({ error: 'User not found' });

    const [packages] = await db.query(
      'SELECT id, remaining_leads, purchased_leads, package_id FROM user_packages WHERE user_id = ? AND status = "active" ORDER BY id DESC LIMIT 1',
      [userId]
    );

    const currentBalance = packages[0]?.remaining_leads ?? 0;
    let delta;
    let balanceAfter;
    let clamped = false;
    let applied = 0;

    if (mode === 'set') {
      delta = amount - currentBalance;
      applied = delta;
      balanceAfter = amount;
    } else if (mode === 'subtract') {
      applied = Math.min(amount, currentBalance);
      clamped = amount > currentBalance;
      delta = -applied;
      balanceAfter = Math.max(0, currentBalance - applied);
    } else if (amount < 0) {
      // backward-compat: add mode with a negative number
      applied = Math.min(Math.abs(amount), currentBalance);
      clamped = Math.abs(amount) > currentBalance;
      delta = -applied;
      balanceAfter = Math.max(0, currentBalance - applied);
      mode = 'subtract';
    } else {
      delta = amount;
      applied = amount;
      balanceAfter = currentBalance + amount;
    }

    if (packages.length === 0) {
      await db.query(
        `INSERT INTO user_packages (user_id, package_id, remaining_leads, purchased_leads, status)
         VALUES (?, 'Free', ?, ?, 'active')`,
        [userId, balanceAfter, Math.max(0, delta > 0 ? delta : 0)]
      );
    } else {
      const purchasedBump = delta > 0 ? delta : 0;
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
      [userId, req.user.id, delta, balanceAfter, mode, note]
    );

    const signed = delta > 0 ? `+${delta}` : String(delta);
    const description =
      mode === 'set'
        ? `Admin credit adjustment: set to ${balanceAfter} (${signed})`
        : `Admin credit adjustment: ${signed}`;

    const invoiceId = await recordAdminInvoice({
      userId,
      adminId: req.user.id,
      packageId: packages[0]?.package_id || ctx.currentPlanId || 'Free',
      credits: delta,
      amountCents: 0,
      billingReason: 'admin_credit_adjustment',
      description,
      note
    });

    let message = `Credits updated — new balance: ${balanceAfter}`;
    if (clamped) {
      message = `Subtracted ${applied} (balance floored at 0; requested ${amount})`;
    }

    res.json({
      success: true,
      credits: balanceAfter,
      mode,
      amount: delta,
      applied,
      clamped,
      invoiceId,
      description,
      message
    });
  } catch (error) {
    console.error('Admin credit adjust error:', error);
    res.status(500).json({ error: 'Failed to adjust credits' });
  }
});

router.post('/users/:id/reset-password', ...adminChain, async (req, res) => {
  const userId = req.params.id;
  const generate = Boolean(req.body.generate);
  let password = (req.body.password ?? req.body.newPassword ?? req.body.new_password ?? '').toString();

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

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);

    logger.info(`Admin password reset for user ${userId}`, { adminId: req.user.id, generated: generate });

    const payload = {
      success: true,
      userId: Number(userId),
      email: users[0].email,
      generated: generate,
      message: generate
        ? 'Temporary password generated. Share it through a secure channel (not returned in API response).'
        : 'Password updated.',
    };
    if (generate && process.env.NODE_ENV !== 'production') {
      payload.temporaryPasswordDevOnly = password;
    }
    res.json(payload);
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
    let pkg = rows[0];

    if (
      Number(pkg.is_subscription) === 1 &&
      !pkg.razorpay_plan_id &&
      isRazorpayConfigured() &&
      Number(pkg.price) > 0 &&
      pkg.is_active
    ) {
      try {
        const planId = await createRazorpayPlan({
          name: pkg.name,
          amountUsd: Number(pkg.price),
          description: pkg.description || `${pkg.lead_limit} leads/month`,
        });
        await db.query('UPDATE packages SET razorpay_plan_id = ? WHERE id = ?', [planId, pkg.id]);
        pkg.razorpay_plan_id = planId;
      } catch (rzErr) {
        console.warn('[Admin] Razorpay plan auto-create on update failed:', rzErr.message);
      }
    }

    res.json(pkg);
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

router.post('/plans/sync-razorpay', ...adminChain, async (_req, res) => {
  try {
    if (!isRazorpayConfigured()) {
      return res.status(400).json({ error: 'Razorpay is not configured' });
    }
    const [packages] = await db.query(
      `SELECT * FROM packages WHERE is_active = 1 AND is_subscription = 1 AND (razorpay_plan_id IS NULL OR razorpay_plan_id = '')`,
    );
    const synced = [];
    for (const pkg of packages) {
      if (!Number(pkg.price)) continue;
      try {
        const planId = await createRazorpayPlan({
          name: pkg.name,
          amountUsd: Number(pkg.price),
          description: pkg.description || `${pkg.lead_limit} leads/month`,
        });
        await db.query('UPDATE packages SET razorpay_plan_id = ? WHERE id = ?', [planId, pkg.id]);
        synced.push({ id: pkg.id, razorpay_plan_id: planId });
      } catch (err) {
        synced.push({ id: pkg.id, error: err.message });
      }
    }
    res.json({ ok: true, synced, count: synced.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to sync Razorpay plans' });
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

router.get('/crm-oauth-settings', ...adminChain, async (_req, res) => {
  try {
    await ensurePlatformCrmSettingsLoaded();
    const settings = await getAdminCrmOAuthSettings();
    const setup = getCrmSetupStatus(true);
    res.json({ ...settings, ...setup });
  } catch (error) {
    console.error('Admin CRM OAuth settings GET error:', error);
    res.status(500).json({ error: 'Failed to load CRM OAuth settings' });
  }
});

router.put('/crm-oauth-settings', ...adminChain, async (req, res) => {
  try {
    const settings = await saveAdminCrmOAuthSettings(req.body || {});
    const setup = getCrmSetupStatus(true);
    res.json({ ...settings, ...setup });
  } catch (error) {
    console.error('Admin CRM OAuth settings PUT error:', error);
    res.status(500).json({ error: 'Failed to save CRM OAuth settings' });
  }
});

router.get('/email-oauth-settings', ...adminChain, async (_req, res) => {
  try {
    await ensurePlatformEmailSettingsLoaded();
    const settings = await getAdminEmailOAuthSettings();
    const setup = getEmailSetupStatus(true);
    res.json({ ...settings, ...setup });
  } catch (error) {
    console.error('Admin email OAuth settings GET error:', error);
    res.status(500).json({ error: 'Failed to load email OAuth settings' });
  }
});

router.put('/email-oauth-settings', ...adminChain, async (req, res) => {
  try {
    const settings = await saveAdminEmailOAuthSettings(req.body || {});
    const setup = getEmailSetupStatus(true);
    res.json({ ...settings, ...setup });
  } catch (error) {
    console.error('Admin email OAuth settings PUT error:', error);
    res.status(500).json({ error: 'Failed to save email OAuth settings' });
  }
});

router.post('/bootstrap', authenticateToken, async (req, res) => {
  if (process.env.ALLOW_ADMIN_BOOTSTRAP !== '1') {
    return res.status(403).json({ error: 'Admin bootstrap is disabled' });
  }
  const expectedSecret = String(process.env.ADMIN_BOOTSTRAP_SECRET || '').trim();
  const providedSecret = String(req.body?.bootstrapSecret || req.headers['x-bootstrap-secret'] || '').trim();
  if (!expectedSecret || expectedSecret.length < 16) {
    return res.status(403).json({ error: 'ADMIN_BOOTSTRAP_SECRET must be set (≥16 chars) to use bootstrap' });
  }
  if (providedSecret !== expectedSecret) {
    return res.status(403).json({ error: 'Invalid bootstrap secret' });
  }
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
      { algorithm: 'HS256', expiresIn: '24h' }
    );
    res.json({ success: true, token, role: 'admin' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to bootstrap admin' });
  }
});

export default router;
