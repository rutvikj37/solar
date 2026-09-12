import crypto from 'crypto';
import db from '../db.js';
import { sendPlatformEmail } from './outreachDelivery.js';
import { logger } from '../utils/logger.js';
import { BRAND_DISPLAY } from '../config/brand.js';

function frontendBase() {
  const raw = process.env.FRONTEND_URL || 'http://localhost:5200';
  return raw.split(',')[0].trim().replace(/\/$/, '');
}

function tokenExpiry(hours = 24) {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d;
}

function maskEmail(email) {
  const s = String(email || '');
  const at = s.indexOf('@');
  if (at < 1) return '[redacted]';
  return `${s[0]}***${s.slice(at)}`;
}

export async function issueEmailVerification(userId, email, name) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = tokenExpiry(48);
  await db.query(
    `UPDATE users SET email_verification_token = ?, email_verification_expires = ? WHERE id = ?`,
    [token, expires, userId],
  );
  const link = `${frontendBase()}/verify-email?token=${encodeURIComponent(token)}`;
  const body = `Hi ${name || 'there'},\n\nVerify your ${BRAND_DISPLAY} account:\n${link}\n\nThis link expires in 48 hours.`;
  try {
    const result = await sendPlatformEmail(email, `Verify your ${BRAND_DISPLAY} account`, body);
    if (result.simulated) {
      logger.info('Email verification link simulated (ALLOW_EMAIL_SIMULATION; configure SES/Resend/SendGrid)', {
        userId,
        email: maskEmail(email),
      });
    }
    return { ok: true, token, simulated: Boolean(result.simulated) };
  } catch (err) {
    logger.error('Email verification send failed', {
      userId,
      email: maskEmail(email),
      code: err.code || null,
      message: err.message,
    });
    const wrapped = new Error(
      err.code === 'EMAIL_NOT_CONFIGURED'
        ? err.message
        : 'Unable to send verification email. Please try again later or contact support.',
    );
    wrapped.code = err.code || 'EMAIL_SEND_FAILED';
    wrapped.status = err.code === 'EMAIL_NOT_CONFIGURED' ? 503 : 502;
    throw wrapped;
  }
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
  const body = `Hi ${user.name || 'there'},\n\nReset your ${BRAND_DISPLAY} password:\n${link}\n\nThis link expires in 2 hours. If you did not request this, ignore this email.`;
  try {
    const result = await sendPlatformEmail(email, `Reset your ${BRAND_DISPLAY} password`, body);
    if (result.simulated) {
      logger.info('Password reset link simulated (ALLOW_EMAIL_SIMULATION; configure SES/Resend/SendGrid)', {
        userId: user.id,
        email: maskEmail(email),
      });
    }
    return { ok: true, sent: true, simulated: Boolean(result.simulated) };
  } catch (err) {
    logger.error('Password reset send failed', {
      userId: user.id,
      email: maskEmail(email),
      code: err.code || null,
      message: err.message,
    });
    const wrapped = new Error(
      err.code === 'EMAIL_NOT_CONFIGURED'
        ? err.message
        : 'Unable to send password reset email. Please try again later.',
    );
    wrapped.code = err.code || 'EMAIL_SEND_FAILED';
    wrapped.status = err.code === 'EMAIL_NOT_CONFIGURED' ? 503 : 502;
    throw wrapped;
  }
}

export async function consumePasswordResetToken(token) {
  const [rows] = await db.query(
    `SELECT id FROM users WHERE password_reset_token = ? AND password_reset_expires > NOW() LIMIT 1`,
    [token],
  );
  if (!rows.length) return { ok: false, error: 'Invalid or expired reset link' };
  return { ok: true, userId: rows[0].id };
}
