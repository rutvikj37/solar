import nodemailer from 'nodemailer';
import { encryptSecret, decryptSecret } from '../../utils/secretCrypto.js';
import { getUserEmailConnection, upsertUserEmailConnection } from './userEmailConnections.js';

function buildTransport(conn) {
  const password = decryptSecret(conn.smtp_password_encrypted);
  if (!password) throw new Error('SMTP password missing — reconnect in Integrations');
  return nodemailer.createTransport({
    host: conn.smtp_host,
    port: conn.smtp_port || 587,
    secure: Boolean(conn.smtp_secure),
    auth: {
      user: conn.smtp_username,
      pass: password,
    },
  });
}

export async function saveSmtpConnection(userId, settings) {
  const {
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUsername,
    smtpPassword,
    fromEmail,
    fromName,
  } = settings;

  if (!smtpHost || !smtpUsername || !fromEmail) {
    throw new Error('SMTP host, username, and from email are required');
  }

  const existing = await getUserEmailConnection(userId);
  let encrypted = existing?.smtp_password_encrypted;
  if (smtpPassword && String(smtpPassword).trim()) {
    encrypted = encryptSecret(String(smtpPassword).trim());
  }
  if (!encrypted) throw new Error('SMTP password is required');

  const testConn = {
    smtp_host: smtpHost.trim(),
    smtp_port: Number(smtpPort) || 587,
    smtp_secure: smtpSecure ? 1 : 0,
    smtp_username: smtpUsername.trim(),
    smtp_password_encrypted: encrypted,
  };
  const transport = buildTransport(testConn);
  await transport.verify();

  await upsertUserEmailConnection(userId, {
    provider: 'smtp',
    smtpHost: testConn.smtp_host,
    smtpPort: testConn.smtp_port,
    smtpSecure: Boolean(testConn.smtp_secure),
    smtpUsername: testConn.smtp_username,
    smtpPasswordEncrypted: encrypted,
    fromEmail: fromEmail.trim(),
    fromName: (fromName || fromEmail).trim(),
  });

  return { fromEmail: fromEmail.trim() };
}

export async function sendViaSmtp(userId, { to, subject, body }) {
  const conn = await getUserEmailConnection(userId);
  if (!conn || conn.provider !== 'smtp') {
    throw new Error('SMTP is not configured — connect in Integrations');
  }
  const transport = buildTransport(conn);
  const info = await transport.sendMail({
    from: conn.from_name ? `"${conn.from_name}" <${conn.from_email}>` : conn.from_email,
    to,
    subject,
    text: body,
  });
  return { ok: true, id: info.messageId || `smtp_${Date.now()}`, from: conn.from_email, simulated: false };
}

export async function sendTestViaConnection(userId, conn, toEmail) {
  if (conn.provider === 'smtp') {
    return sendViaSmtp(userId, {
      to: toEmail,
      subject: 'SolarX.live — email test',
      body: 'Your email integration is working. You can now send emails to leads from your own address.',
    });
  }
  const { sendViaGmail } = await import('./gmailService.js');
  const { sendViaOutlook } = await import('./outlookService.js');
  const payload = {
    to: toEmail,
    subject: 'SolarX.live — email test',
    body: 'Your email integration is working. You can now send emails to leads from your own address.',
  };
  if (conn.provider === 'gmail') return sendViaGmail(userId, payload);
  if (conn.provider === 'outlook') return sendViaOutlook(userId, payload);
  throw new Error('Unknown email provider');
}
