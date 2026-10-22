/**
 * Two-way email: pull lead replies from the user's connected Gmail / Outlook mailbox.
 * Replies are stored as outreach_messages (channel=email, direction=inbound) so lead history,
 * drip stop-on-reply and funnels see them. SMTP connections are send-only.
 */

import db from '../../db.js';
import { resolveWorkspaceContext } from '../../utils/workspaceContext.js';
import { getUserEmailConnection, isInboxSyncEnabled } from './userEmailConnections.js';
import { ensureGmailAccessToken, GMAIL_READ_SCOPE } from './gmailService.js';
import { ensureOutlookAccessToken } from './outlookService.js';

const LOOKBACK_DAYS = Number(process.env.EMAIL_INBOX_LOOKBACK_DAYS) || 14;
const MAX_MESSAGES_PER_SYNC = Number(process.env.EMAIL_INBOX_MAX_PER_SYNC) || 200;
const MANUAL_MIN_INTERVAL_MS = 30_000;
const OVERLAP_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;

const inflight = new Map();

class InboxSyncError extends Error {
  constructor(message, status = 'error') {
    super(message);
    this.status = status;
  }
}

export function normalizeEmailAddress(value) {
  const s = String(value || '').trim().toLowerCase();
  const m = s.match(/<([^>]+)>/);
  const addr = (m ? m[1] : s).trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr) ? addr : null;
}

export function normalizeSubject(subject) {
  return String(subject || '')
    .replace(/^\s*((re|fw|fwd|aw|sv)\s*(\[\d+\])?\s*:\s*)+/i, '')
    .trim()
    .toLowerCase();
}

/** Drop quoted history ("On … wrote:", "> …", Outlook "From:" blocks) from a reply body. */
export function stripQuotedReply(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^On .+wrote:\s*$/i.test(line.trim())) break;
    if (/^On .+$/i.test(line.trim()) && /wrote:\s*$/i.test(String(lines[i + 1] || '').trim())) break;
    if (/^-{2,}\s*Original Message\s*-{2,}/i.test(line.trim())) break;
    if (/^_{8,}$/.test(line.trim())) break;
    if (/^From:\s.+/i.test(line.trim()) && out.length > 0 && /^(Sent|Date):\s/i.test(String(lines[i + 1] || '').trim())) break;
    if (/^>/.test(line.trim())) continue;
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function fetchJson(url, accessToken, extraHeaders = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, ...extraHeaders },
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403) {
      const msg = data?.error?.message || data?.error?.code || `HTTP ${res.status}`;
      throw new InboxSyncError(
        `Mailbox did not allow reading replies (${msg}). Reconnect your email in Integrations to grant read access.`,
        'needs_reconnect',
      );
    }
    if (!res.ok) throw new InboxSyncError(data?.error?.message || `Mailbox API error (HTTP ${res.status})`);
    return data;
  } catch (err) {
    if (err.name === 'AbortError') throw new InboxSyncError('Mailbox API timed out');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function decodeBase64Url(data) {
  if (!data) return '';
  return Buffer.from(String(data).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function htmlToText(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function gmailBodyText(payload) {
  if (!payload) return '';
  const stack = [payload];
  let html = '';
  while (stack.length) {
    const part = stack.shift();
    if (part.mimeType === 'text/plain' && part.body?.data) return decodeBase64Url(part.body.data);
    if (part.mimeType === 'text/html' && part.body?.data && !html) html = decodeBase64Url(part.body.data);
    if (Array.isArray(part.parts)) stack.push(...part.parts);
  }
  return html ? htmlToText(html) : '';
}

function headerValue(headers = [], name) {
  const h = headers.find((x) => String(x.name).toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

/** Leads whose replies this mailbox may see: workspace pool, the user's own, or assigned to them. */
async function loadLeadEmailMap(userId) {
  const ws = await resolveWorkspaceContext(userId);
  const [rows] = await db.query(
    `SELECT id, email, status FROM leads
     WHERE (user_id = ? OR user_id = ? OR assigned_to = ?)
       AND email IS NOT NULL AND email <> '' AND email <> 'Not Available'`,
    [ws.ownerUserId, userId, userId],
  );
  const map = new Map();
  for (const r of rows) {
    const addr = normalizeEmailAddress(r.email);
    if (addr && !map.has(addr)) map.set(addr, r);
  }
  return map;
}

async function listGmailReplies(conn, userId, since, leadMap) {
  const accessToken = await ensureGmailAccessToken({ ...conn, user_id: userId });
  const afterSec = Math.floor(since.getTime() / 1000);
  const own = normalizeEmailAddress(conn.from_email);
  const addresses = [...leadMap.keys()];
  const q =
    addresses.length > 0 && addresses.length <= 40
      ? `after:${afterSec} from:(${addresses.join(' OR ')})`
      : `in:inbox after:${afterSec}`;

  const ids = [];
  let pageToken = null;
  do {
    const params = new URLSearchParams({ q, maxResults: '100' });
    if (pageToken) params.set('pageToken', pageToken);
    const data = await fetchJson(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
      accessToken,
    );
    for (const m of data.messages || []) ids.push(m);
    pageToken = data.nextPageToken || null;
  } while (pageToken && ids.length < MAX_MESSAGES_PER_SYNC);

  const results = [];
  for (const { id } of ids.slice(0, MAX_MESSAGES_PER_SYNC)) {
    const meta = await fetchJson(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
      accessToken,
    );
    const from = normalizeEmailAddress(headerValue(meta.payload?.headers, 'From'));
    if (!from || from === own || !leadMap.has(from)) continue;
    const full = await fetchJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, accessToken);
    const headers = full.payload?.headers || [];
    results.push({
      providerId: id,
      threadKey: full.threadId ? `gmail:${full.threadId}` : null,
      from,
      fromName: String(headerValue(headers, 'From')).replace(/<[^>]+>/, '').replace(/"/g, '').trim() || null,
      subject: headerValue(headers, 'Subject') || '(no subject)',
      body: gmailBodyText(full.payload) || full.snippet || '',
      receivedAt: full.internalDate ? new Date(Number(full.internalDate)) : new Date(),
    });
  }
  return results;
}

async function listOutlookReplies(conn, userId, since, leadMap) {
  const accessToken = await ensureOutlookAccessToken({ ...conn, user_id: userId });
  const own = normalizeEmailAddress(conn.from_email);
  const params = new URLSearchParams({
    $filter: `receivedDateTime ge ${since.toISOString()}`,
    $select: 'id,subject,from,receivedDateTime,body,bodyPreview,conversationId',
    $orderby: 'receivedDateTime desc',
    $top: '50',
  });
  let url = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?${params}`;
  const results = [];
  let scanned = 0;
  while (url && scanned < MAX_MESSAGES_PER_SYNC) {
    const data = await fetchJson(url, accessToken, { Prefer: 'outlook.body-content-type="text"' });
    for (const m of data.value || []) {
      scanned += 1;
      const from = normalizeEmailAddress(m.from?.emailAddress?.address);
      if (!from || from === own || !leadMap.has(from)) continue;
      results.push({
        providerId: m.id,
        threadKey: m.conversationId ? `outlook:${m.conversationId}` : null,
        from,
        fromName: m.from?.emailAddress?.name || null,
        subject: m.subject || '(no subject)',
        body: m.body?.contentType === 'html' ? htmlToText(m.body?.content) : m.body?.content || m.bodyPreview || '',
        receivedAt: m.receivedDateTime ? new Date(m.receivedDateTime) : new Date(),
      });
    }
    url = data['@odata.nextLink'] || null;
  }
  return results;
}

/** Mark drip enrollments for the lead as replied; cancel those whose campaign stops on reply. */
async function applyReplyToDrips(leadId) {
  await db.query(
    `UPDATE drip_enrollments SET replied_at = COALESCE(replied_at, NOW()) WHERE lead_id = ?`,
    [leadId],
  );
  const [res] = await db.query(
    `UPDATE drip_enrollments de
     JOIN drip_campaigns c ON c.id = de.campaign_id
     SET de.status = 'cancelled', de.stop_reason = 'lead_replied'
     WHERE de.lead_id = ? AND de.status = 'active' AND c.stop_on_reply = 1`,
    [leadId],
  );
  return res.affectedRows || 0;
}

async function storeReply(userId, provider, msg, lead) {
  const dedupeKey = `${provider}:${userId}:${msg.providerId}`.slice(0, 191);
  const body = stripQuotedReply(msg.body).slice(0, 20000) || String(msg.body || '').slice(0, 2000);
  const [ins] = await db.query(
    `INSERT IGNORE INTO outreach_messages
       (user_id, lead_id, channel, direction, subject, body, status, external_id,
        thread_key, from_address, received_at, dedupe_key, created_at)
     VALUES (?, ?, 'email', 'inbound', ?, ?, 'received', ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      lead.id,
      String(msg.subject).slice(0, 255),
      body,
      String(msg.providerId).slice(0, 255),
      msg.threadKey,
      msg.from,
      msg.receivedAt,
      dedupeKey,
      msg.receivedAt,
    ],
  );
  if (!ins.affectedRows) return false;

  await db.query(
    'INSERT INTO lead_activities (lead_id, user_id, type, content, meta) VALUES (?, ?, ?, ?, ?)',
    [
      lead.id,
      userId,
      'email_reply',
      body.slice(0, 1000) || '(empty reply)',
      JSON.stringify({ subject: msg.subject, from: msg.from, messageId: ins.insertId, provider }),
    ],
  );
  const cancelled = await applyReplyToDrips(lead.id);
  if (cancelled) console.log(`[InboxSync] Lead ${lead.id} replied — stopped ${cancelled} drip enrollment(s)`);
  return true;
}

/** Store provider-normalized replies ({ providerId, threadKey, from, subject, body, receivedAt }). */
export async function ingestReplies(userId, provider, replies, leadMap = null) {
  const map = leadMap || (await loadLeadEmailMap(userId));
  let inserted = 0;
  for (const msg of replies) {
    const lead = map.get(normalizeEmailAddress(msg.from));
    if (lead && (await storeReply(userId, provider, { ...msg, from: normalizeEmailAddress(msg.from) }, lead))) {
      inserted += 1;
    }
  }
  return inserted;
}

async function recordSyncState(userId, { status, error = null, syncedAt = null }) {
  await db.query(
    `UPDATE user_email_connections
     SET inbox_sync_status = ?, inbox_sync_error = ?, inbox_sync_at = COALESCE(?, inbox_sync_at)
     WHERE user_id = ?`,
    [status, error ? String(error).slice(0, 500) : null, syncedAt, userId],
  );
}

function hasReadScope(conn) {
  if (!conn.granted_scopes) return null;
  const s = String(conn.granted_scopes);
  if (conn.provider === 'gmail') return s.includes(GMAIL_READ_SCOPE) || s.includes('mail.google.com');
  if (conn.provider === 'outlook') return /Mail\.Read\b/i.test(s);
  return false;
}

/**
 * Sync one user's mailbox. Returns { ok, status, provider, scanned, matched, inserted, message }.
 * status: ok | not_enabled | not_connected | unsupported | needs_reconnect | throttled | error
 */
export async function syncUserInbox(userId, { manual = false } = {}) {
  if (!isInboxSyncEnabled()) {
    return { ok: false, status: 'not_enabled', message: 'Inbox sync is disabled on this server (EMAIL_INBOX_SYNC=0).' };
  }
  const conn = await getUserEmailConnection(userId);
  if (!conn) {
    return { ok: false, status: 'not_connected', message: 'Connect Gmail or Outlook in Integrations to pull replies.' };
  }
  if (conn.provider !== 'gmail' && conn.provider !== 'outlook') {
    return {
      ok: false,
      status: 'unsupported',
      provider: conn.provider,
      message: 'SMTP mailboxes are send-only. Connect Gmail or Outlook to see replies here.',
    };
  }
  if (hasReadScope(conn) === false) {
    const message = 'Your mailbox was connected without read access. Reconnect it in Integrations to pull replies.';
    await recordSyncState(userId, { status: 'needs_reconnect', error: message });
    return { ok: false, status: 'needs_reconnect', provider: conn.provider, message };
  }
  if (manual && conn.inbox_sync_at && Date.now() - new Date(conn.inbox_sync_at).getTime() < MANUAL_MIN_INTERVAL_MS) {
    return { ok: true, status: 'throttled', provider: conn.provider, message: 'Synced moments ago.', inserted: 0 };
  }
  if (inflight.has(userId)) return inflight.get(userId);

  const run = (async () => {
    const startedAt = new Date();
    const since = conn.inbox_sync_at
      ? new Date(new Date(conn.inbox_sync_at).getTime() - OVERLAP_MS)
      : new Date(Date.now() - LOOKBACK_DAYS * 86400_000);
    try {
      const leadMap = await loadLeadEmailMap(userId);
      if (leadMap.size === 0) {
        await recordSyncState(userId, { status: 'ok', syncedAt: startedAt });
        return { ok: true, status: 'ok', provider: conn.provider, scanned: 0, matched: 0, inserted: 0 };
      }
      const replies =
        conn.provider === 'gmail'
          ? await listGmailReplies(conn, userId, since, leadMap)
          : await listOutlookReplies(conn, userId, since, leadMap);
      const inserted = await ingestReplies(userId, conn.provider, replies, leadMap);
      await recordSyncState(userId, { status: 'ok', syncedAt: startedAt });
      return { ok: true, status: 'ok', provider: conn.provider, matched: replies.length, inserted };
    } catch (err) {
      const status = err instanceof InboxSyncError ? err.status : 'error';
      const message = err.message || 'Inbox sync failed';
      await recordSyncState(userId, { status, error: message }).catch(() => {});
      return { ok: false, status, provider: conn.provider, message };
    }
  })();
  inflight.set(userId, run);
  try {
    return await run;
  } finally {
    inflight.delete(userId);
  }
}

/** Worker pass: every Gmail/Outlook connection not waiting on a reconnect. */
export async function syncAllInboxes({ limit = 25 } = {}) {
  if (!isInboxSyncEnabled()) return { users: 0 };
  const [rows] = await db.query(
    `SELECT user_id FROM user_email_connections
     WHERE provider IN ('gmail','outlook')
       AND (inbox_sync_status IS NULL OR inbox_sync_status <> 'needs_reconnect')
     ORDER BY COALESCE(inbox_sync_at, '1970-01-01') ASC
     LIMIT ?`,
    [limit],
  );
  let inserted = 0;
  for (const r of rows) {
    const result = await syncUserInbox(r.user_id);
    inserted += result.inserted || 0;
  }
  return { users: rows.length, inserted };
}

/** Email thread(s) with a lead: outbound + inbound, grouped by provider thread or normalized subject. */
export async function getLeadEmailThreads(leadId) {
  const [rows] = await db.query(
    `SELECT om.id, om.user_id, om.direction, om.subject, om.body, om.status, om.thread_key, om.from_address,
            COALESCE(om.received_at, om.created_at) AS at, u.name AS user_name
     FROM outreach_messages om
     LEFT JOIN users u ON u.id = om.user_id
     WHERE om.lead_id = ? AND om.channel = 'email'
     ORDER BY at ASC, om.id ASC
     LIMIT 500`,
    [leadId],
  );
  const threads = new Map();
  for (const r of rows) {
    const subjectKey = `subject:${normalizeSubject(r.subject)}`;
    const key =
      (r.thread_key && threads.has(r.thread_key) && r.thread_key) ||
      (threads.has(subjectKey) && subjectKey) ||
      r.thread_key ||
      subjectKey;
    if (!threads.has(key)) {
      threads.set(key, { key, subject: r.subject || '(no subject)', messages: [], lastAt: null, hasReply: false });
    }
    const t = threads.get(key);
    if (r.thread_key && key !== r.thread_key && !threads.has(r.thread_key)) threads.set(r.thread_key, t);
    if (!threads.has(subjectKey)) threads.set(subjectKey, t);
    t.messages.push({
      id: r.id,
      direction: r.direction,
      subject: r.subject,
      body: r.body,
      status: r.status,
      from: r.direction === 'inbound' ? r.from_address : r.user_name || 'You',
      at: r.at,
    });
    t.lastAt = r.at;
    if (r.direction === 'inbound') t.hasReply = true;
  }
  const unique = [...new Set(threads.values())];
  unique.sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
  return unique;
}
