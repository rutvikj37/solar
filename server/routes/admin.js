import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { authenticateToken, adminAuth, JWT_SECRET } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { getUsageSummary } from '../services/apiUsage.js';
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
import { writeAdminAudit, clientIp } from '../utils/adminAudit.js';
import { isAdminRole } from '../middleware/auth.js';
import {
  getPlatformEmailProvider,
  isPlatformEmailConfigured,
} from '../services/outreachDelivery.js';

const router = express.Router();

const ASSIGNABLE_ROLES = ['solar_company', 'admin', 'platform_admin', 'super_admin'];

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

/**
 * Role hierarchy for account-level admin actions: only a super_admin may modify admin-level accounts.
 * Responds and returns null when the actor may not act on the target; otherwise returns the target row.
 */
async function loadGuardedTargetUser(req, res, targetId) {
  const userId = Number(targetId);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ error: 'Invalid user id' });
    return null;
  }
  const [rows] = await db.query('SELECT id, email, name, role, account_status FROM users WHERE id = ? LIMIT 1', [userId]);
  if (!rows.length) {
    res.status(404).json({ error: 'User not found' });
    return null;
  }
  const target = rows[0];
  if (isAdminRole(target.role) && req.user.role !== 'super_admin' && Number(target.id) !== Number(req.user.id)) {
    res.status(403).json({ error: 'Only a super_admin can modify an admin account' });
    return null;
  }
  return target;
}

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

router.get('/audit-log', ...adminChain, async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  try {
    const [rows] = await db.query(
      `SELECT a.id, a.admin_id, a.action, a.target_type, a.target_id, a.details, a.ip_address, a.created_at,
              u.name AS admin_name, u.email AS admin_email
       FROM admin_audit_log a
       LEFT JOIN users u ON u.id = a.admin_id
       ORDER BY a.created_at DESC
       LIMIT ?`,
      [limit],
    );
    const entries = rows.map((r) => {
      let details = r.details;
      if (typeof details === 'string') {
        try {
          details = JSON.parse(details);
        } catch {
          /* keep string */
        }
      }
      return { ...r, details };
    });
    res.json({ entries });
  } catch (error) {
    console.error('Admin audit log error:', error);
    res.status(500).json({ error: 'Failed to load audit log' });
  }
});

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
    const [[mrrRow]] = await db.query(
      `SELECT COALESCE(SUM(p.price), 0) AS mrr
       FROM user_subscriptions us
       JOIN packages p ON p.id = us.package_id
       WHERE us.status = 'active'
         AND COALESCE(p.billing_interval, 'month') = 'month'`
    );
    const [[subs]] = await db.query(
      `SELECT COUNT(*) AS active_subs
       FROM user_packages
       WHERE status = 'active' AND package_id != 'Free' AND remaining_leads > 0`
    );
    const [[openTickets]] = await db.query(
      `SELECT COUNT(*) AS open_count FROM support_tickets WHERE status IN ('open','in_progress')`
    );
    const [[inquiryCount]] = await db.query(
      `SELECT COUNT(*) AS total FROM marketing_inquiries`
    );
    let pendingMarketplace = 0;
    let pendingDisputes = 0;
    try {
      const [[mkt]] = await db.query(
        `SELECT COUNT(*) AS pending
         FROM marketplace_leads
         WHERE status IN ('new', 'ai_qualified', 'pending_admin')`
      );
      pendingMarketplace = Number(mkt?.pending || 0);
      const [[disp]] = await db.query(
        `SELECT COUNT(*) AS pending FROM marketplace_disputes WHERE status = 'pending'`
      );
      pendingDisputes = Number(disp?.pending || 0);
    } catch {
      /* marketplace tables may be absent in older envs */
    }

    const mrrUsd = Math.round(Number(mrrRow?.mrr || 0));
    res.json({
      totalUsers: userCount.total,
      activeUsers: userCount.active,
      newUsers7d: userCount.new_7d,
      totalLeads: leadCount.total,
      remainingCredits: creditSum.remaining,
      revenueCents: revenue.cents,
      paidOrders: revenue.paid_orders,
      mrrUsd,
      /** @deprecated use mrrUsd — kept for older clients */
      mrrEstimate: mrrUsd,
      activeSubscriptions: subs.active_subs,
      openTickets: openTickets.open_count,
      inquiryCount: inquiryCount.total,
      pendingMarketplace,
      pendingDisputes,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to load admin stats' });
  }
});

router.get('/system-health', ...adminChain, async (_req, res) => {
  try {
    let dbOk = false;
    try {
      await db.query('SELECT 1');
      dbOk = true;
    } catch {
      dbOk = false;
    }

    const isKeyValid = (key) =>
      Boolean(key && String(key).trim() !== '' && !String(key).toLowerCase().includes('your_'));

    const emailConfigured = isPlatformEmailConfigured();
    const emailProvider = getPlatformEmailProvider();

    res.json({
      ok: dbOk,
      db: { configured: dbOk },
      email: {
        configured: emailConfigured,
        provider: emailProvider,
      },
      maps: {
        googleMaps: isKeyValid(process.env.GOOGLE_MAPS_API_KEY) || isKeyValid(process.env.VITE_GOOGLE_MAPS_API_KEY),
        googleSolar: isKeyValid(process.env.GOOGLE_SOLAR_API_KEY),
      },
      rentcast: {
        configured: isKeyValid(process.env.RENTCAST_API_KEY) || isKeyValid(process.env.ATTOM_API_KEY),
      },
      stripe: {
        configured: isKeyValid(process.env.STRIPE_SECRET_KEY),
      },
    });
  } catch (error) {
    console.error('Admin system-health error:', error);
    res.status(500).json({ error: 'Failed to load system health' });
  }
});

router.get('/users', ...adminChain, async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const roleFilter = (req.query.role || '').toString().trim();
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
    const where = [];
    if (q) {
      where.push('(u.name LIKE ? OR u.email LIKE ? OR u.company_name LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (roleFilter && ASSIGNABLE_ROLES.includes(roleFilter)) {
      where.push('u.role = ?');
      params.push(roleFilter);
    }
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
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

router.patch('/users/:id/role', ...adminChain, async (req, res) => {
  const userId = Number(req.params.id);
  const nextRole = (req.body?.role || '').toString().trim();
  if (!ASSIGNABLE_ROLES.includes(nextRole)) {
    return res.status(400).json({
      error: `role must be one of: ${ASSIGNABLE_ROLES.join(', ')}`,
    });
  }
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  try {
    const [users] = await db.query(
      'SELECT id, email, name, role FROM users WHERE id = ? LIMIT 1',
      [userId],
    );
    if (!users.length) return res.status(404).json({ error: 'User not found' });

    const previousRole = users[0].role || 'solar_company';
    if (previousRole === nextRole) {
      return res.json({ success: true, userId, role: nextRole, unchanged: true });
    }

    const actorRole = req.user.role;
    if (nextRole === 'super_admin' && actorRole !== 'super_admin') {
      return res.status(403).json({ error: 'Only a super_admin can grant super_admin' });
    }
    if (previousRole === 'super_admin' && actorRole !== 'super_admin') {
      return res.status(403).json({ error: 'Only a super_admin can change a super_admin' });
    }
    if ((isAdminRole(previousRole) || isAdminRole(nextRole)) && actorRole !== 'super_admin') {
      return res.status(403).json({ error: 'Only a super_admin can grant or change admin roles' });
    }

    if (previousRole === 'super_admin' && nextRole !== 'super_admin') {
      const [[{ cnt }]] = await db.query(
        `SELECT COUNT(*) AS cnt FROM users WHERE role = 'super_admin'`,
      );
      if (Number(cnt) <= 1) {
        return res.status(400).json({ error: 'Cannot demote the last super_admin' });
      }
    }

    if (userId === req.user.id && isAdminRole(previousRole) && !isAdminRole(nextRole)) {
      return res.status(400).json({ error: 'Cannot remove your own admin access' });
    }

    await db.query('UPDATE users SET role = ?, token_version = token_version + 1 WHERE id = ?', [nextRole, userId]);
    await writeAdminAudit({
      adminId: req.user.id,
      action: 'user.role_change',
      targetType: 'user',
      targetId: userId,
      details: {
        email: users[0].email,
        previousRole,
        nextRole,
      },
      ip: clientIp(req),
    });

    res.json({
      success: true,
      userId,
      role: nextRole,
      previousRole,
      message: `Role updated to ${nextRole}`,
    });
  } catch (error) {
    console.error('Admin role update error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

router.patch('/users/:id/status', ...adminChain, async (req, res) => {
  const { status } = req.body;
  if (!['active', 'suspended', 'restricted'].includes(status)) {
    return res.status(400).json({ error: 'status must be active, restricted, or suspended' });
  }
  try {
    const target = await loadGuardedTargetUser(req, res, req.params.id);
    if (!target) return;
    if (Number(target.id) === Number(req.user.id) && status !== 'active') {
      return res.status(400).json({ error: 'You cannot suspend or restrict your own account' });
    }
    if (target.role === 'super_admin' && status !== 'active') {
      const [[{ cnt }]] = await db.query(
        `SELECT COUNT(*) AS cnt FROM users WHERE role = 'super_admin' AND account_status = 'active' AND id <> ?`,
        [target.id],
      );
      if (Number(cnt) === 0) {
        return res.status(400).json({ error: 'Cannot deactivate the last active super_admin' });
      }
    }
    if (status === 'suspended') {
      await db.query(
        'UPDATE users SET account_status = ?, token_version = token_version + 1 WHERE id = ?',
        [status, target.id],
      );
    } else {
      await db.query('UPDATE users SET account_status = ? WHERE id = ?', [status, target.id]);
    }
    await writeAdminAudit({
      adminId: req.user.id,
      action: 'user.status_change',
      targetType: 'user',
      targetId: Number(target.id),
      details: { email: target.email, previousStatus: target.account_status, nextStatus: status },
      ip: clientIp(req),
    });
    res.json({ success: true, id: Number(target.id), status });
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
    const target = await loadGuardedTargetUser(req, res, userId);
    if (!target) return;
    if (restrict && Number(target.id) === Number(req.user.id)) {
      return res.status(400).json({ error: 'You cannot restrict your own account' });
    }
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

    // Lock the package row so concurrent unlocks/scans cannot be overwritten by this adjustment.
    const conn = await db.getConnection();
    let packages;
    let delta;
    let balanceAfter;
    let clamped = false;
    let applied = 0;
    try {
      await conn.beginTransaction();
      [packages] = await conn.query(
        'SELECT id, remaining_leads, purchased_leads, package_id FROM user_packages WHERE user_id = ? AND status = "active" ORDER BY id DESC LIMIT 1 FOR UPDATE',
        [userId]
      );

      const currentBalance = packages[0]?.remaining_leads ?? 0;

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
        await conn.query(
          `INSERT INTO user_packages (user_id, package_id, remaining_leads, purchased_leads, status)
           VALUES (?, 'Free', ?, ?, 'active')`,
          [userId, balanceAfter, Math.max(0, delta > 0 ? delta : 0)]
        );
      } else {
        const purchasedBump = delta > 0 ? delta : 0;
        await conn.query(
          `UPDATE user_packages
           SET remaining_leads = GREATEST(0, remaining_leads + ?),
               purchased_leads = purchased_leads + ?
           WHERE id = ?`,
          [delta, purchasedBump, packages[0].id]
        );
      }

      await conn.query(
        `INSERT INTO admin_credit_adjustments (user_id, admin_id, amount, balance_after, mode, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, req.user.id, delta, balanceAfter, mode, note]
      );
      await conn.commit();
    } catch (txErr) {
      await conn.rollback().catch(() => null);
      throw txErr;
    } finally {
      conn.release();
    }

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

    await writeAdminAudit({
      adminId: req.user.id,
      action: 'user.credit_adjust',
      targetType: 'user',
      targetId: Number(userId),
      details: {
        mode,
        delta,
        balanceAfter,
        note: note || null,
        invoiceId,
      },
      ip: clientIp(req),
    });

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
    const target = await loadGuardedTargetUser(req, res, userId);
    if (!target) return;
    const users = [target];

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    await db.query(
      'UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?',
      [passwordHash, target.id],
    );

    logger.info(`Admin password reset for user ${userId}`, { adminId: req.user.id, generated: generate });

    await writeAdminAudit({
      adminId: req.user.id,
      action: generate ? 'user.password_generate' : 'user.password_reset',
      targetType: 'user',
      targetId: Number(userId),
      details: { email: users[0].email, generated: generate },
      ip: clientIp(req),
    });

    const payload = {
      success: true,
      userId: Number(userId),
      email: users[0].email,
      generated: generate,
      message: generate
        ? 'Temporary password generated. Copy it now — it is shown only once.'
        : 'Password updated.',
    };
    // One-time reveal to the authenticated admin UI (secure channel). Also set legacy key for older clients.
    if (generate) {
      payload.temporaryPassword = password;
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
    const [rows] = await db.query(
      'SELECT * FROM packages ORDER BY sort_order ASC, price ASC',
    );
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
    email_limit,
    whatsapp_limit,
    crm_user_limit,
    email_automation_limit,
    price,
    price_1mo,
    price_6mo,
    price_12mo,
    sort_order,
    description,
    features,
    is_active,
    stripe_price_id,
    stripe_price_id_6mo,
    stripe_price_id_12mo,
    billing_interval,
    is_subscription,
  } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id and name required' });
  const planId = String(id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);
  if (!planId) return res.status(400).json({ error: 'Invalid plan id' });

  const subFlag =
    is_subscription === false || is_subscription === 0 || is_subscription === '0' ? 0 : 1;
  const interval = billing_interval === 'one_time' ? 'one_time' : 'month';
  const price1 = Number(price_1mo ?? price) || 0;

  try {
    const featuresJson =
      typeof features === 'string' ? features : JSON.stringify(features || []);
    await db.query(
      `INSERT INTO packages
       (id, name, lead_limit, email_limit, whatsapp_limit, crm_user_limit, email_automation_limit,
        price, price_1mo, price_6mo, price_12mo, sort_order, description, features,
        is_active, stripe_price_id, stripe_price_id_6mo, stripe_price_id_12mo,
        billing_interval, is_subscription)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        planId,
        name,
        Number(lead_limit) || 0,
        Number(email_limit) || 0,
        Number(whatsapp_limit) || 0,
        Number(crm_user_limit) || 0,
        Number(email_automation_limit) || 0,
        price1,
        price1,
        price_6mo !== undefined && price_6mo !== '' ? Number(price_6mo) : null,
        price_12mo !== undefined && price_12mo !== '' ? Number(price_12mo) : null,
        Number(sort_order) || 100,
        description || '',
        featuresJson,
        is_active === false || is_active === 0 || is_active === '0' ? 0 : 1,
        stripe_price_id || null,
        stripe_price_id_6mo || null,
        stripe_price_id_12mo || null,
        interval,
        subFlag,
      ],
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
    email_limit,
    whatsapp_limit,
    crm_user_limit,
    email_automation_limit,
    price,
    price_1mo,
    price_6mo,
    price_12mo,
    sort_order,
    description,
    features,
    is_active,
    stripe_price_id,
    stripe_price_id_6mo,
    stripe_price_id_12mo,
    billing_interval,
    is_subscription,
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

    const resolvedPrice1 =
      price_1mo !== undefined
        ? Number(price_1mo)
        : price !== undefined
          ? Number(price)
          : null;

    await db.query(
      `UPDATE packages SET
         name = COALESCE(?, name),
         lead_limit = COALESCE(?, lead_limit),
         email_limit = COALESCE(?, email_limit),
         whatsapp_limit = COALESCE(?, whatsapp_limit),
         crm_user_limit = COALESCE(?, crm_user_limit),
         email_automation_limit = COALESCE(?, email_automation_limit),
         price = COALESCE(?, price),
         price_1mo = COALESCE(?, price_1mo),
         price_6mo = COALESCE(?, price_6mo),
         price_12mo = COALESCE(?, price_12mo),
         sort_order = COALESCE(?, sort_order),
         description = COALESCE(?, description),
         features = COALESCE(?, features),
         is_active = COALESCE(?, is_active),
         stripe_price_id = COALESCE(?, stripe_price_id),
         stripe_price_id_6mo = COALESCE(?, stripe_price_id_6mo),
         stripe_price_id_12mo = COALESCE(?, stripe_price_id_12mo),
         billing_interval = COALESCE(?, billing_interval),
         is_subscription = COALESCE(?, is_subscription)
       WHERE id = ?`,
      [
        name ?? null,
        lead_limit !== undefined ? Number(lead_limit) : null,
        email_limit !== undefined ? Number(email_limit) : null,
        whatsapp_limit !== undefined ? Number(whatsapp_limit) : null,
        crm_user_limit !== undefined ? Number(crm_user_limit) : null,
        email_automation_limit !== undefined ? Number(email_automation_limit) : null,
        resolvedPrice1,
        resolvedPrice1,
        price_6mo !== undefined ? (price_6mo === '' || price_6mo === null ? null : Number(price_6mo)) : null,
        price_12mo !== undefined ? (price_12mo === '' || price_12mo === null ? null : Number(price_12mo)) : null,
        sort_order !== undefined ? Number(sort_order) : null,
        description ?? null,
        featuresJson,
        is_active === undefined ? null : is_active === false || is_active === 0 || is_active === '0' ? 0 : 1,
        stripe_price_id === undefined ? null : stripe_price_id,
        stripe_price_id_6mo === undefined ? null : stripe_price_id_6mo,
        stripe_price_id_12mo === undefined ? null : stripe_price_id_12mo,
        interval,
        subFlag,
        req.params.id,
      ],
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
      { id: req.user.id, email: req.user.email, name: req.user.name, role: 'admin', tv: Number(req.user.tv) || 0 },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '24h' }
    );
    res.json({ success: true, token, role: 'admin' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to bootstrap admin' });
  }
});

export default router;
