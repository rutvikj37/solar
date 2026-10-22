/**
 * Central opt-out registry (platform-wide, keyed by normalized email / phone).
 *
 * Channels: 'email' | 'sms' | 'call' | 'all'.
 * An SMS STOP is stored as phone/'all' so it also blocks automated calls (FCC revocation rules).
 * Lead-level leads.outreach_opt_out (manual "do not contact") is enforced alongside the registry.
 */
import db from '../../db.js';

export const OPT_OUT_KEYWORDS = new Set([
  'STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'OPTOUT', 'REVOKE',
]);
export const OPT_IN_KEYWORDS = new Set(['START', 'UNSTOP', 'YES']);
export const HELP_KEYWORDS = new Set(['HELP', 'INFO']);

export function normalizeEmail(email) {
  const s = String(email || '').trim().toLowerCase();
  if (!s || s === 'not available' || !s.includes('@')) return null;
  return s.slice(0, 255);
}

/** Digits only; US numbers collapse to the 10-digit national number. */
export function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 7) return null;
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits.slice(-15);
}

export function classifySmsKeyword(body) {
  const word = String(body || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
  if (OPT_OUT_KEYWORDS.has(word)) return 'stop';
  if (OPT_IN_KEYWORDS.has(word)) return 'start';
  if (HELP_KEYWORDS.has(word)) return 'help';
  return null;
}

function channelsCovering(channel) {
  if (channel === 'all') return ['all', 'email', 'sms', 'call'];
  return [channel, 'all'];
}

async function logEvent({ contactType, contactValue, channel, action, source, userId, leadId, detail }) {
  try {
    await db.query(
      `INSERT INTO contact_opt_out_events
        (contact_type, contact_value, channel, action, source, user_id, lead_id, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [contactType, contactValue, channel, action, source, userId || null, leadId || null, detail || null],
    );
  } catch (err) {
    console.error('[OptOut] event log failed:', err.message);
  }
}

/**
 * Record an opt-out. Idempotent per (contact, channel).
 * @param {{ email?: string, phone?: string, channel: string, source: string, userId?: number, leadId?: number, detail?: string }} p
 */
export async function recordOptOut({ email, phone, channel, source, userId = null, leadId = null, detail = null }) {
  const entries = [];
  const e = normalizeEmail(email);
  const p = normalizePhone(phone);
  if (e) entries.push(['email', e]);
  if (p) entries.push(['phone', p]);
  for (const [contactType, contactValue] of entries) {
    await db.query(
      `INSERT INTO contact_opt_outs (contact_type, contact_value, channel, source, user_id, lead_id, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE source = VALUES(source), detail = VALUES(detail), updated_at = CURRENT_TIMESTAMP`,
      [contactType, contactValue, channel, source, userId, leadId, detail],
    );
    await logEvent({ contactType, contactValue, channel, action: 'opt_out', source, userId, leadId, detail });
  }
  return entries.length;
}

/** Remove opt-outs for a contact (e.g. SMS START). channel 'all' clears every channel. */
export async function revokeOptOut({ email, phone, channel = 'all', source, userId = null, detail = null }) {
  const entries = [];
  const e = normalizeEmail(email);
  const p = normalizePhone(phone);
  if (e) entries.push(['email', e]);
  if (p) entries.push(['phone', p]);
  let removed = 0;
  for (const [contactType, contactValue] of entries) {
    const chans = channelsCovering(channel);
    const [res] = await db.query(
      `DELETE FROM contact_opt_outs WHERE contact_type = ? AND contact_value = ? AND channel IN (?)`,
      [contactType, contactValue, chans],
    );
    removed += res.affectedRows || 0;
    await logEvent({ contactType, contactValue, channel, action: 'opt_in', source, userId, detail });
  }
  return removed;
}

/** Registry rows for an email / phone. */
export async function getOptOutRows({ email, phone }) {
  const e = normalizeEmail(email);
  const p = normalizePhone(phone);
  const clauses = [];
  const params = [];
  if (e) {
    clauses.push(`(contact_type = 'email' AND contact_value = ?)`);
    params.push(e);
  }
  if (p) {
    clauses.push(`(contact_type = 'phone' AND contact_value = ?)`);
    params.push(p);
  }
  if (!clauses.length) return [];
  const [rows] = await db.query(
    `SELECT contact_type, contact_value, channel, source, created_at
     FROM contact_opt_outs WHERE ${clauses.join(' OR ')}`,
    params,
  );
  return rows;
}

export async function isEmailOptedOut(email) {
  const e = normalizeEmail(email);
  if (!e) return false;
  const [rows] = await db.query(
    `SELECT id FROM contact_opt_outs
     WHERE contact_type = 'email' AND contact_value = ? AND channel IN ('email','all') LIMIT 1`,
    [e],
  );
  return rows.length > 0;
}

export async function isPhoneOptedOut(phone, channel = 'sms') {
  const p = normalizePhone(phone);
  if (!p) return false;
  const [rows] = await db.query(
    `SELECT id FROM contact_opt_outs
     WHERE contact_type = 'phone' AND contact_value = ? AND channel IN (?, 'all') LIMIT 1`,
    [p, channel],
  );
  return rows.length > 0;
}

/**
 * Can we contact this lead on this channel?
 * @returns {Promise<{ allowed: boolean, reason: string|null }>}
 */
export async function checkLeadContactable(lead, channel) {
  if (!lead) return { allowed: false, reason: 'lead_not_found' };
  if (Number(lead.outreach_opt_out) === 1 || lead.outreach_opt_out === true) {
    return { allowed: false, reason: 'lead_opted_out' };
  }
  if (channel === 'call' && lead.status === 'do_not_call') {
    return { allowed: false, reason: 'do_not_call' };
  }
  if (channel === 'email') {
    if (await isEmailOptedOut(lead.email)) return { allowed: false, reason: 'email_unsubscribed' };
  } else if (channel === 'sms' || channel === 'call') {
    if (await isPhoneOptedOut(lead.phone, channel)) return { allowed: false, reason: 'phone_opted_out' };
  }
  return { allowed: true, reason: null };
}

export function optedOutError(reason) {
  const messages = {
    lead_opted_out: 'This lead is marked do-not-contact.',
    do_not_call: 'This lead is on the do-not-call list.',
    email_unsubscribed: 'This contact unsubscribed from emails.',
    phone_opted_out: 'This phone number opted out (replied STOP).',
  };
  const err = new Error(messages[reason] || 'This contact has opted out.');
  err.code = 'OPTED_OUT';
  err.reason = reason;
  return err;
}

/** Opt-out summary for CRM badges. */
export async function getLeadOptOutStatus(lead) {
  const rows = await getOptOutRows({ email: lead?.email, phone: lead?.phone });
  const has = (type, chans) => rows.some((r) => r.contact_type === type && chans.includes(r.channel));
  const manual = Number(lead?.outreach_opt_out) === 1;
  const email = manual || has('email', ['email', 'all']);
  const sms = manual || has('phone', ['sms', 'all']);
  const call = manual || lead?.status === 'do_not_call' || has('phone', ['call', 'all']);
  return {
    manual,
    email,
    sms,
    call,
    any: email || sms || call,
    entries: rows.map((r) => ({
      type: r.contact_type,
      channel: r.channel,
      source: r.source,
      at: r.created_at,
    })),
  };
}
