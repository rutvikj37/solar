/**
 * CAN-SPAM / RFC 8058 helpers for marketing email (outreach + drip):
 * signed unsubscribe links, List-Unsubscribe headers, sender identity footer.
 */
import crypto from 'crypto';
import db from '../../db.js';
import { BRAND_COMPANY_DEFAULT } from '../../config/brand.js';
import { resolveFrontendBaseUrl } from '../../utils/frontendUrl.js';
import { getEmailOAuthPublicBase } from '../email/userEmailConnections.js';
import { resolveWorkspaceContext } from '../../utils/workspaceContext.js';
import { normalizeEmail } from './optOut.js';

function unsubscribeSecret() {
  return process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || '';
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s) {
  return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function sign(payload) {
  return crypto.createHmac('sha256', unsubscribeSecret()).update(`unsub:${payload}`).digest('hex').slice(0, 40);
}

/** Non-expiring signed token (unsubscribe links must keep working long after send). */
export function signUnsubscribeToken({ email, userId = null, leadId = null }) {
  const e = normalizeEmail(email);
  if (!e || !unsubscribeSecret()) return null;
  const payload = b64url(JSON.stringify({ e, u: userId || null, l: leadId || null }));
  return `${payload}.${sign(payload)}`;
}

export function verifyUnsubscribeToken(token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig || !unsubscribeSecret()) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(fromB64url(payload));
    const email = normalizeEmail(data.e);
    if (!email) return null;
    return { email, userId: data.u || null, leadId: data.l || null };
  } catch {
    return null;
  }
}

export function buildUnsubscribeUrls(token) {
  const t = encodeURIComponent(token);
  return {
    pageUrl: `${resolveFrontendBaseUrl()}/unsubscribe?t=${t}`,
    oneClickUrl: `${getEmailOAuthPublicBase()}/api/compliance/unsubscribe?t=${t}`,
  };
}

/** Workspace sender identity (company name + postal address) for the sending user. */
export async function getSenderIdentity(userId) {
  let ownerId = Number(userId);
  try {
    const ws = await resolveWorkspaceContext(userId);
    ownerId = ws.ownerUserId;
  } catch {
    /* fall back to the actor */
  }
  let row = null;
  try {
    const [rows] = await db.query(
      `SELECT u.company_name, u.company_postal_address, u.name, ip.company_name AS installer_company
       FROM users u LEFT JOIN installer_profiles ip ON ip.user_id = u.id
       WHERE u.id = ?`,
      [ownerId],
    );
    row = rows[0] || null;
  } catch (err) {
    console.error('[EmailCompliance] sender identity lookup failed:', err.message);
  }
  const companyName =
    String(row?.company_name || row?.installer_company || '').trim() || BRAND_COMPANY_DEFAULT;
  const postalAddress =
    String(row?.company_postal_address || '').trim() ||
    String(process.env.COMPANY_POSTAL_ADDRESS || '').trim() ||
    null;
  return { ownerUserId: ownerId, companyName, postalAddress };
}

const warnedMissingAddress = new Set();

/**
 * Footer + headers for a marketing email.
 * @returns {Promise<{ footer: string, headers: Record<string,string>, identity: object }>}
 */
export async function buildMarketingEmailExtras({ userId, to, leadId = null }) {
  const identity = await getSenderIdentity(userId);
  const token = signUnsubscribeToken({ email: to, userId: identity.ownerUserId, leadId });
  const headers = {};
  const lines = ['', '--', identity.companyName];
  if (identity.postalAddress) {
    lines.push(identity.postalAddress);
  } else if (!warnedMissingAddress.has(identity.ownerUserId)) {
    warnedMissingAddress.add(identity.ownerUserId);
    console.warn(
      `[EmailCompliance] No postal address for workspace ${identity.ownerUserId}; set it in Profile (CAN-SPAM) or COMPANY_POSTAL_ADDRESS.`,
    );
  }
  if (token) {
    const { pageUrl, oneClickUrl } = buildUnsubscribeUrls(token);
    lines.push(`Don't want these emails? Unsubscribe: ${pageUrl}`);
    headers['List-Unsubscribe'] = `<${oneClickUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }
  return { footer: lines.join('\n'), headers, identity };
}
