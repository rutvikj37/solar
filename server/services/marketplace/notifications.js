import db from '../../db.js';
import { sendPlatformEmail } from '../outreachDelivery.js';

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
