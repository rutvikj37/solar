/**
 * Execute drip step delivery via Resend (email only).
 */
import db from '../../db.js';
import { sendEmail } from '../outreachDelivery.js';
import { logActivity } from '../../routes/crm.js';
import { renderDripTemplate } from './dripTemplates.js';

function hasEmail(email) {
  return email && email !== 'Not Available';
}

export async function executeDripStep({ step, enrollment, lead, campaignName, userId }) {
  const body = renderDripTemplate(step.template_content, lead, { companyName: 'Solar Velocity' });
  const channel = step.action_type;

  // Drip is email-only; skip legacy SMS / AI-call steps without sending.
  if (channel === 'sms' || channel === 'ai_call') {
    return {
      status: 'skipped',
      channel,
      errorMessage: 'Drip campaigns are email-only; this step was skipped',
      externalId: null,
    };
  }

  if (channel === 'email') {
    if (!hasEmail(lead.email)) {
      return { status: 'skipped', channel: 'email', errorMessage: 'No email on file', externalId: null };
    }
    const subject = renderDripTemplate(
      step.subject || `Solar Proposal for ${lead.address || 'your home'}`,
      lead
    );
    try {
      const result = await sendEmail({
        userId,
        to: lead.email,
        subject,
        body,
        source: 'drip',
      });
      const status = result.simulated ? 'simulated' : 'sent';
      const [ins] = await db.query(
        `INSERT INTO outreach_messages (user_id, lead_id, channel, subject, body, status, external_id)
         VALUES (?, ?, 'email', ?, ?, ?, ?)`,
        [userId, lead.id, subject, body, status, result.id || null]
      );
      await logActivity(lead.id, userId, 'drip_email', body, { subject, campaign: campaignName, drip: true });
      if (lead.status === 'new' || lead.status === 'qualified') {
        await db.query('UPDATE leads SET status = ? WHERE id = ?', ['contacted', lead.id]);
      }
      return {
        status: result.simulated ? 'simulated' : result.ok ? 'sent' : 'failed',
        channel: 'email',
        externalId: result.id,
        outreachId: ins.insertId,
      };
    } catch (err) {
      return { status: 'failed', channel: 'email', errorMessage: err.message, externalId: null };
    }
  }

  return { status: 'skipped', channel: channel || 'unknown', errorMessage: 'Unknown action type', externalId: null };
}
