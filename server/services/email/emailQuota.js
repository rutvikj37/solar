/**
 * Plan-based monthly email quota (shared pool: outreach, drip, meetings, marketing).
 */
import db from '../../db.js';
import { isAdminRole } from '../../middleware/auth.js';

function toDateKey(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function calendarMonthKey(now = new Date()) {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Resolve active package email_limit + billing period key for a user.
 */
export async function resolveEmailPlan(userId, userRole = null) {
  if (userRole && isAdminRole(userRole)) {
    return {
      unlimited: true,
      packageId: 'Admin',
      packageName: 'Admin',
      limit: Number.MAX_SAFE_INTEGER,
      periodKey: 'admin',
      periodEnd: null,
    };
  }

  const [subs] = await db.query(
    `SELECT s.id, s.package_id, s.status, s.current_period_start, s.current_period_end,
            p.name AS package_name, p.email_limit
     FROM user_subscriptions s
     LEFT JOIN packages p ON p.id = s.package_id
     WHERE s.user_id = ?
       AND s.status IN ('active', 'trialing', 'past_due')
     LIMIT 1`,
    [userId],
  );

  if (subs.length) {
    const sub = subs[0];
    const periodStartKey = toDateKey(sub.current_period_start);
    const periodKey = periodStartKey
      ? `sub-${sub.id}-${periodStartKey}`
      : `sub-${sub.id}-${calendarMonthKey()}`;
    return {
      unlimited: false,
      packageId: sub.package_id,
      packageName: sub.package_name || sub.package_id,
      limit: Math.max(0, Number(sub.email_limit) || 0),
      periodKey,
      periodEnd: sub.current_period_end || null,
    };
  }

  const [packs] = await db.query(
    `SELECT up.package_id, p.name AS package_name, p.email_limit
     FROM user_packages up
     LEFT JOIN packages p ON p.id = up.package_id
     WHERE up.user_id = ? AND up.status = 'active'
     ORDER BY up.id DESC
     LIMIT 1`,
    [userId],
  );

  if (packs.length) {
    const row = packs[0];
    return {
      unlimited: false,
      packageId: row.package_id,
      packageName: row.package_name || row.package_id,
      limit: Math.max(0, Number(row.email_limit) || 0),
      periodKey: calendarMonthKey(),
      periodEnd: null,
    };
  }

  const [freeRows] = await db.query(
    `SELECT id, name, email_limit FROM packages WHERE id = 'Free' LIMIT 1`,
  );
  const free = freeRows[0];
  return {
    unlimited: false,
    packageId: 'Free',
    packageName: free?.name || 'Free',
    limit: Math.max(0, Number(free?.email_limit) || 100),
    periodKey: calendarMonthKey(),
    periodEnd: null,
  };
}

export async function getEmailQuota(userId, userRole = null) {
  const plan = await resolveEmailPlan(userId, userRole);
  if (plan.unlimited) {
    return {
      ...plan,
      used: 0,
      remaining: Number.MAX_SAFE_INTEGER,
    };
  }

  const [rows] = await db.query(
    `SELECT sent_count FROM email_usage_monthly
     WHERE user_id = ? AND period_key = ?
     LIMIT 1`,
    [userId, plan.periodKey],
  );
  const used = Number(rows[0]?.sent_count) || 0;
  const remaining = Math.max(0, plan.limit - used);
  return {
    ...plan,
    used,
    remaining,
  };
}

/**
 * Atomically reserve/consume email quota. Throws EMAIL_QUOTA_EXCEEDED when over limit.
 */
export async function consumeEmailQuota(userId, count = 1, userRole = null) {
  const n = Math.max(1, Number(count) || 1);
  const plan = await resolveEmailPlan(userId, userRole);
  if (plan.unlimited) {
    return { ...plan, used: 0, remaining: Number.MAX_SAFE_INTEGER, consumed: n };
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT sent_count FROM email_usage_monthly
       WHERE user_id = ? AND period_key = ?
       LIMIT 1
       FOR UPDATE`,
      [userId, plan.periodKey],
    );

    let used = Number(rows[0]?.sent_count) || 0;
    if (used + n > plan.limit) {
      const err = new Error(
        `Monthly email limit reached (${used}/${plan.limit}). Upgrade your plan to send more.`,
      );
      err.code = 'EMAIL_QUOTA_EXCEEDED';
      err.quota = { limit: plan.limit, used, remaining: Math.max(0, plan.limit - used) };
      throw err;
    }

    if (rows.length === 0) {
      await conn.query(
        `INSERT INTO email_usage_monthly (user_id, period_key, sent_count)
         VALUES (?, ?, ?)`,
        [userId, plan.periodKey, n],
      );
      used = n;
    } else {
      await conn.query(
        `UPDATE email_usage_monthly
         SET sent_count = sent_count + ?
         WHERE user_id = ? AND period_key = ?`,
        [n, userId, plan.periodKey],
      );
      used += n;
    }

    await conn.commit();
    return {
      ...plan,
      used,
      remaining: Math.max(0, plan.limit - used),
      consumed: n,
    };
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      /* ignore */
    }
    throw err;
  } finally {
    conn.release();
  }
}

/** Refund reserved quota after a failed send (best-effort). */
export async function refundEmailQuota(userId, count = 1, userRole = null) {
  const n = Math.max(1, Number(count) || 1);
  const plan = await resolveEmailPlan(userId, userRole);
  if (plan.unlimited) return;

  try {
    await db.query(
      `UPDATE email_usage_monthly
       SET sent_count = GREATEST(0, CAST(sent_count AS SIGNED) - ?)
       WHERE user_id = ? AND period_key = ?`,
      [n, userId, plan.periodKey],
    );
  } catch (err) {
    console.warn('[EmailQuota] refund failed:', err.message);
  }
}

export async function logEmailSend({
  userId,
  to,
  subject,
  source = 'other',
  status = 'sent',
  sesMessageId = null,
  errorMessage = null,
}) {
  try {
    await db.query(
      `INSERT INTO email_send_log
        (user_id, to_email, subject, source, status, ses_message_id, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        String(to || '').slice(0, 255),
        subject ? String(subject).slice(0, 500) : null,
        String(source || 'other').slice(0, 40),
        String(status || 'sent').slice(0, 40),
        sesMessageId ? String(sesMessageId).slice(0, 255) : null,
        errorMessage ? String(errorMessage).slice(0, 500) : null,
      ],
    );
  } catch (err) {
    console.warn('[EmailQuota] logEmailSend failed:', err.message);
  }
}
