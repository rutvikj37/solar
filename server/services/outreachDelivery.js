/**
 * Shared SMS / email delivery for outreach and drip automation.
 */
import { trackedFetch } from './apiUsage.js';

function isKeyValid(key) {
  return key && key.trim() !== '' && !key.toLowerCase().includes('your_');
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

export async function sendEmail(to, subject, body) {
  const apiKey = process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY;
  const from = process.env.OUTREACH_FROM_EMAIL || 'leads@solarvelocity.app';

  if (!isKeyValid(apiKey)) {
    return { ok: false, simulated: true, id: `sim_email_${Date.now()}` };
  }

  if (process.env.RESEND_API_KEY && isKeyValid(process.env.RESEND_API_KEY)) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, text: body }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Email send failed');
    return { ok: true, id: data.id, simulated: false };
  }

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
      content: [{ type: 'text/plain', value: body }],
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'SendGrid failed');
  }
  return { ok: true, id: response.headers.get('x-message-id') || `sg_${Date.now()}`, simulated: false };
}
