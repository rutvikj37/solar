/**
 * SMS / Email Notification Service for AI Calling module.
 */
import { trackedFetch } from '../apiUsage.js';

const isKeyValid = (k) => k && k.trim() !== '' && !k.toLowerCase().includes('your_');

export async function sendSms(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!isKeyValid(sid) || !isKeyValid(token) || !isKeyValid(from)) {
    console.log(`[SMS-SIM] Simulated SMS to ${to}: ${body.substring(0, 60)}...`);
    return { ok: true, simulated: true, sid: `sim_sms_${Date.now()}` };
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
  return { ok: true, simulated: false, sid: data.sid };
}

export async function sendEmail(to, subject, body) {
  const apiKey = process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY;
  const from = process.env.OUTREACH_FROM_EMAIL || 'leads@solarvelocity.app';

  if (!to) return { ok: false, simulated: true, reason: 'no_email' };
  if (!isKeyValid(apiKey)) {
    console.log(`[EMAIL-SIM] To ${to}: ${subject}`);
    return { ok: true, simulated: true, id: `sim_email_${Date.now()}` };
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

export async function sendAppointmentConfirmation(lead, appointment) {
  const name = lead.owner_name || 'there';
  const dateStr = new Date(appointment.scheduledAt).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const agencyLine = appointment.agencyName ? ` Your specialist is with ${appointment.agencyName}.` : '';
  const linkLine = appointment.inviteLink ? ` Join/details: ${appointment.inviteLink}` : '';
  const body = `Hi ${name}! Your free solar savings consultation is confirmed for ${dateStr} (${appointment.durationMinutes || 30} min).${agencyLine}${linkLine} Reply STOP to opt out.`;

  return sendSms(lead.phone, body);
}

export async function sendAppointmentInviteEmail(lead, appointment) {
  if (!lead?.email) return { ok: false, simulated: true, reason: 'no_email' };
  const dateStr = new Date(appointment.scheduledAt).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const body = `Hi ${lead.owner_name || 'there'},

Your solar consultation is booked for ${dateStr}.
${appointment.agencyName ? `Specialist / agency: ${appointment.agencyName}\n` : ''}${appointment.inviteLink ? `Meeting / calendar link: ${appointment.inviteLink}\n` : ''}
Duration: ${appointment.durationMinutes || 30} minutes.

If you need to reschedule, reply to this email or call us back.

— Solar Velocity`;

  return sendEmail(lead.email, 'Your Solar Consultation is Confirmed', body);
}

export async function sendAppointmentReminder(lead, appointment, windowLabel = 'soon') {
  const name = lead.owner_name || 'there';
  const dateStr = new Date(appointment.scheduledAt).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const link = appointment.inviteLink ? ` Link: ${appointment.inviteLink}` : '';
  const body = `Hi ${name}, reminder: your solar consultation is ${windowLabel} (${dateStr}).${link} See you then!`;
  return sendSms(lead.phone, body);
}

export async function sendCallbackReminder(lead, callbackTime) {
  const name = lead.owner_name || 'there';
  const dateStr = new Date(callbackTime).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const body = `Hi ${name}, just a reminder — we'll be calling you back on ${dateStr} to discuss your solar savings options. Talk soon!`;
  return sendSms(lead.phone, body);
}

export async function notifySalesRep(repPhone, leadName, appointmentDetails) {
  if (!repPhone) return { ok: false, reason: 'no_phone' };
  const dateStr = new Date(appointmentDetails.scheduledAt).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const body = `New AI-booked appointment! Lead: ${leadName}. Scheduled: ${dateStr}. Address: ${appointmentDetails.address || 'TBD'}. Monthly bill: ${appointmentDetails.monthlyBill || 'Unknown'}.`;
  return sendSms(repPhone, body);
}
