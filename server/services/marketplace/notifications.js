import db from '../../db.js';
import { sendPlatformEmail } from '../outreachDelivery.js';
import { signReportAccess, buildHomeownerReportPageUrl } from '../../utils/signedReportAccess.js';
import { BRAND_DISPLAY } from '../../config/brand.js';

/**
 * Best-effort marketplace notifications (email when platform SMTP is configured).
 */
export async function notifyInstallerWonBid({ installerUserId, lead }) {
  if (!installerUserId || !lead) return { sent: false, reason: 'missing_data' };
  try {
    const [users] = await db.query('SELECT name, email FROM users WHERE id = ?', [installerUserId]);
    const user = users[0];
    if (!user?.email) return { sent: false, reason: 'no_email' };

    const subject = `You won marketplace lead ${lead.lead_code}`;
    const body = `Hi ${user.name || 'Installer'},\n\nYou won the bid for marketplace lead ${lead.lead_code}.\nAmount: $${Number(lead.winning_amount || lead.min_bid || 0).toFixed(2)}\n\nView the lead in your SpaceToRoof Marketplace dashboard.\n`;

    const result = await sendPlatformEmail(user.email, subject, body);
    return { sent: Boolean(result?.ok || result?.simulated), simulated: Boolean(result?.simulated) };
  } catch (err) {
    console.error('[Marketplace] notifyInstallerWonBid failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

export async function notifyHomeownerListed({ lead }) {
  if (!lead?.email) return { sent: false, reason: 'no_email' };
  try {
    const subject = `Your solar inquiry ${lead.lead_code} is in our installer marketplace`;
    const body = `Hi ${lead.homeowner_name || 'there'},\n\nYour solar inquiry has been qualified and is now visible to verified installers in our marketplace.\n\nLead reference: ${lead.lead_code}\n\nInstallers may contact you if they win your lead.\n`;

    const result = await sendPlatformEmail(lead.email, subject, body);
    return { sent: Boolean(result?.ok || result?.simulated), simulated: Boolean(result?.simulated) };
  } catch (err) {
    console.error('[Marketplace] notifyHomeownerListed failed:', err.message);
    return { sent: false, reason: err.message };
  }
}

/**
 * Email a signed solar-report link to the homeowner (e.g. duplicate inquiry).
 * Never put bare lead codes in API responses — only in this email to the address on file.
 */
export async function notifyHomeownerReportLink({ email, name, leadCode }) {
  if (!email || !leadCode) return { sent: false, reason: 'missing_data' };
  try {
    const access = signReportAccess(leadCode);
    if (!access) return { sent: false, reason: 'signing_unavailable' };

    const link = buildHomeownerReportPageUrl(leadCode, access);
    const subject = `Your ${BRAND_DISPLAY} solar report link`;
    const body = `Hi ${name || 'there'},\n\nWe received another inquiry matching your recent solar request. Here is a secure link to view your report (expires in 7 days):\n\n${link}\n\nIf you did not submit this request, you can ignore this email.\n`;

    const result = await sendPlatformEmail(email, subject, body);
    return {
      sent: Boolean(result?.ok || result?.simulated),
      simulated: Boolean(result?.simulated),
    };
  } catch (err) {
    console.error('[Marketplace] notifyHomeownerReportLink failed:', err.message);
    return { sent: false, reason: err.message };
  }
}
