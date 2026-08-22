import crypto from 'crypto';
import db from '../db.js';
import { sendPlatformEmail } from './outreachDelivery.js';
import { logger } from '../utils/logger.js';

function frontendBase() {
  const raw = process.env.FRONTEND_URL || 'http://localhost:5200';
  return raw.split(',')[0].trim().replace(/\/$/, '');
}

function tokenExpiry(hours = 24) {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d;
}

export async function issueEmailVerification(userId, email, name) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = tokenExpiry(48);
  await db.query(
    `UPDATE users SET email_verification_token = ?, email_verification_expires = ? WHERE id = ?`,
    [token, expires, userId],
  );
  const link = `${frontendBase()}/verify-email?token=${encodeURIComponent(token)}`;
  const body = `Hi ${name || 'there'},\n\nVerify your SolarX.live account:\n${link}\n\nThis link expires in 48 hours.`;
  const result = await sendPlatformEmail(email, 'Verify your SolarX.live account', body);
  if (result.simulated) {
    logger.info('Email verification link (simulated — configure RESEND_API_KEY or SENDGRID_API_KEY)', {
      userId,
      email,
      link,
    });
  }
  return { token, link, simulated: result.simulated };
}

export async function verifyEmailToken(token) {
  if (!token) return { ok: false, error: 'Token required' };
  const [rows] = await db.query(
    `SELECT id, email FROM users
     WHERE email_verification_token = ? AND email_verification_expires > NOW() LIMIT 1`,
    [token],
  );
  if (!rows.length) return { ok: false, error: 'Invalid or expired verification link' };
  await db.query(
    `UPDATE users SET email_verified = 1, email_verification_token = NULL, email_verification_expires = NULL WHERE id = ?`,
    [rows[0].id],
  );
  return { ok: true, userId: rows[0].id, email: rows[0].email };
}

export async function issuePasswordReset(email) {
  const [users] = await db.query('SELECT id, name FROM users WHERE email = ? LIMIT 1', [email]);
  if (!users.length) return { ok: true, sent: false };
  const user = users[0];
  const token = crypto.randomBytes(32).toString('hex');
  const expires = tokenExpiry(2);
  await db.query(
    `UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?`,
    [token, expires, user.id],
  );
  const link = `${frontendBase()}/reset-password?token=${encodeURIComponent(token)}`;
  const body = `Hi ${user.name || 'there'},\n\nReset your SolarX.live password:\n${link}\n\nThis link expires in 2 hours. If you did not request this, ignore this email.`;
  const result = await sendPlatformEmail(email, 'Reset your SolarX.live password', body);
  if (result.simulated) {
    logger.info('Password reset link (simulated — configure RESEND_API_KEY or SENDGRID_API_KEY)', {
      userId: user.id,
      email,
      link,
    });
  }
  return { ok: true, sent: true, simulated: result.simulated };
}

export async function consumePasswordResetToken(token) {
  const [rows] = await db.query(
    `SELECT id FROM users WHERE password_reset_token = ? AND password_reset_expires > NOW() LIMIT 1`,
    [token],
  );
  if (!rows.length) return { ok: false, error: 'Invalid or expired reset link' };
  return { ok: true, userId: rows[0].id };
}
