/**
 * Shared SMS / email delivery for outreach and drip automation.
 * Customer sends: client's connected mailbox (Gmail / Outlook / SMTP) + plan email quota.
 * Platform auth mail: Resend (preferred) / SendGrid / SES without consuming customer quota.
 * Never send customer outreach From the platform noreply / SES_FROM address.
 */
import { trackedFetch } from './apiUsage.js';
import { BRAND_NOREPLY } from '../config/brand.js';
import { isSesConfigured, sendViaSes } from './email/sesClient.js';
import { consumeEmailQuota, refundEmailQuota, logEmailSend } from './email/emailQuota.js';
import { sendUserEmail } from './email/sendUserEmail.js';
import { isEmailOptedOut, optedOutError } from './compliance/optOut.js';
import { buildMarketingEmailExtras } from './compliance/emailCompliance.js';

/** Sources that are commercial/marketing mail and need opt-out checks + unsubscribe footer. */
export const MARKETING_EMAIL_SOURCES = new Set(['outreach', 'drip', 'marketing']);

function isKeyValid(key) {
  return Boolean(
    key && String(key).trim() !== '' && !String(key).toLowerCase().includes('your_'),
  );
}

/** Simulated platform email is only allowed outside production when explicitly opted in. */
export function allowEmailSimulation() {
  if (process.env.NODE_ENV === 'production') return false;
  const v = String(process.env.ALLOW_EMAIL_SIMULATION || '').trim().toLowerCase();
  return v === '1' || v === 'true';
}

export function getPlatformEmailProvider() {
  if (isKeyValid(process.env.RESEND_API_KEY)) return 'resend';
  if (isKeyValid(process.env.SENDGRID_API_KEY)) return 'sendgrid';
  if (isSesConfigured()) return 'ses';
  return null;
}

export function isPlatformEmailConfigured() {
  return getPlatformEmailProvider() != null;
}

function emailNotConfiguredError() {
  const err = new Error(
    'Email delivery is not configured. Set RESEND_API_KEY (preferred) or SENDGRID_API_KEY / Amazon SES.',
  );
  err.code = 'EMAIL_NOT_CONFIGURED';
  return err;
}

export async function sendTwilioSms(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!isKeyValid(sid) || !isKeyValid(token) || !isKeyValid(from)) {
    return { ok: false, simulated: true, sid: `sim_${Date.now()}` };
  }

  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const response = await trackedFetch('twilio', `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Twilio SMS failed');
  }
  return { ok: true, sid: data.sid, simulated: false };
}

async function sendViaResendOrSendGrid(to, subject, body, html) {
  const apiKey = process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY;
  const from = process.env.OUTREACH_FROM_EMAIL || BRAND_NOREPLY;

  if (!isKeyValid(apiKey)) {
    if (!allowEmailSimulation()) throw emailNotConfiguredError();
    return { ok: false, simulated: true, id: `sim_email_${Date.now()}`, provider: 'none' };
  }

  if (process.env.RESEND_API_KEY && isKeyValid(process.env.RESEND_API_KEY)) {
    const payload = { from, to: [to], subject, text: body };
    if (html) payload.html = html;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Email send failed');
    return { ok: true, id: data.id, simulated: false, provider: 'resend' };
  }

  const content = [{ type: 'text/plain', value: body }];
  if (html) content.push({ type: 'text/html', value: html });
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject,
      content,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'SendGrid failed');
  }
  return {
    ok: true,
    id: response.headers.get('x-message-id') || `sg_${Date.now()}`,
    simulated: false,
    provider: 'sendgrid',
  };
}

/** Platform transport: Resend preferred, then SendGrid, then SES; else simulate (non-prod only). */
async function sendPlatformTransport({ to, subject, body, html, replyTo }) {
  const provider = getPlatformEmailProvider();
  if (provider === 'resend' || provider === 'sendgrid') {
    return sendViaResendOrSendGrid(to, subject, body, html);
  }
  if (provider === 'ses') {
    return sendViaSes({ to, subject, body, html, replyTo });
  }
  if (!allowEmailSimulation()) {
    throw emailNotConfiguredError();
  }
  return sendViaResendOrSendGrid(to, subject, body, html);
}

/** Platform transactional mail (auth verify, password reset) — no customer quota. */
export async function sendPlatformEmail(to, subject, body, html) {
  return sendPlatformTransport({ to, subject, body, html });
}

/**
 * Customer / product email — sends From the client's connected mailbox.
 * Consumes plan monthly email quota (shared pool for outreach, drip, meetings).
 */
export async function sendEmail({
  userId,
  to,
  subject,
  body,
  html,
  source = 'other',
  userRole = null,
  skipQuota = false,
  leadId = null,
  marketing = MARKETING_EMAIL_SOURCES.has(source),
}) {
  if (!userId) {
    const err = new Error('userId required to send plan emails');
    err.code = 'EMAIL_USER_REQUIRED';
    throw err;
  }

  // html is accepted for API compatibility; connected providers send plain body today
  void html;

  let headers = null;
  if (marketing) {
    if (await isEmailOptedOut(to)) throw optedOutError('email_unsubscribed');
    const extras = await buildMarketingEmailExtras({ userId, to, leadId });
    body = `${body}\n${extras.footer}`;
    headers = extras.headers;
  }

  let reserved = false;
  if (!skipQuota) {
    await consumeEmailQuota(userId, 1, userRole);
    reserved = true;
  }

  try {
    const result = await sendUserEmail(userId, { to, subject, body, headers });

    await logEmailSend({
      userId,
      to,
      subject,
      source,
      status: result.simulated ? 'simulated' : 'sent',
      sesMessageId: result.id || null,
    });

    return result;
  } catch (err) {
    if (reserved) {
      await refundEmailQuota(userId, 1, userRole);
    }
    await logEmailSend({
      userId,
      to,
      subject,
      source,
      status: 'failed',
      errorMessage: err.message,
    });
    throw err;
  }
}

/** @deprecated Use sendPlatformEmail for auth mail. Kept for ai-calling duplicate. */
export { sendPlatformEmail as sendEmailLegacy };
