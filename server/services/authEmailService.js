import crypto from 'crypto';
import db from '../db.js';
import { sendPlatformEmail } from './outreachDelivery.js';
import { logger } from '../utils/logger.js';
import { resolveFrontendBaseUrl } from '../utils/frontendUrl.js';
import {
  buildEmailVerificationEmail,
  buildPasswordResetEmail,
  buildTeamInvitationEmail,
} from './email/authEmailTemplates.js';

/** Never use HTTP 502 for app-level email failures — browsers/proxies label it Bad Gateway. */
const EMAIL_FAIL_STATUS = 503;

function frontendBase() {
  try {
    return resolveFrontendBaseUrl();
  } catch (err) {
    logger.error('resolveFrontendBaseUrl failed; using brand fallback', {
      message: err?.message,
    });
    return 'https://spacetoroof.com';
  }
}

/** Expiry as UTC MySQL DATETIME string (compared with UTC_TIMESTAMP()). */
function tokenExpiryUtc(hours = 24) {
  const ms = Date.now() + hours * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

function maskEmail(email) {
  const s = String(email || '');
  const at = s.indexOf('@');
  if (at < 1) return '[redacted]';
  return `${s[0]}***${s.slice(at)}`;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function wrapEmailSendError(err, fallbackMessage) {
  const notConfigured =
    err?.code === 'EMAIL_NOT_CONFIGURED' || err?.code === 'SES_NOT_CONFIGURED';
  const wrapped = new Error(
    notConfigured
      ? err.message ||
        'Email delivery is not configured. Set RESEND_API_KEY (preferred) or SENDGRID_API_KEY / Amazon SES.'
      : fallbackMessage,
  );
  wrapped.code = notConfigured ? 'EMAIL_NOT_CONFIGURED' : err?.code || 'EMAIL_SEND_FAILED';
  wrapped.status = EMAIL_FAIL_STATUS;
  return wrapped;
}

export async function issueEmailVerification(userId, email, name) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = tokenExpiryUtc(48);
  await db.query(
    `UPDATE users SET email_verification_token = ?, email_verification_expires = ? WHERE id = ?`,
    [token, expires, userId],
  );
  const link = `${frontendBase()}/verify-email?token=${encodeURIComponent(token)}`;
  const { subject, text, html } = buildEmailVerificationEmail({ name, verifyUrl: link });
  try {
    const result = await sendPlatformEmail(email, subject, text, html);
    if (result.simulated) {
      logger.info('Email verification link simulated (ALLOW_EMAIL_SIMULATION; configure RESEND_API_KEY)', {
        userId,
        email: maskEmail(email),
        link,
      });
    }
    return { ok: true, token, simulated: Boolean(result.simulated) };
  } catch (err) {
    try {
      await db.query(
        `UPDATE users SET email_verification_token = NULL, email_verification_expires = NULL WHERE id = ?`,
        [userId],
      );
    } catch {
      /* ignore cleanup */
    }
    logger.error('Email verification send failed', {
      userId,
      email: maskEmail(email),
      code: err.code || null,
      message: err.message,
    });
    throw wrapEmailSendError(
      err,
      'Unable to send verification email. Please try again later or contact support.',
    );
  }
}

export async function verifyEmailToken(token) {
  if (!token) return { ok: false, error: 'Token required' };
  const [result] = await db.query(
    `UPDATE users
     SET email_verified = 1, email_verification_token = NULL, email_verification_expires = NULL,
         id = LAST_INSERT_ID(id)
     WHERE email_verification_token = ? AND email_verification_expires > UTC_TIMESTAMP()
     LIMIT 1`,
    [token],
  );
  if (result.affectedRows !== 1 || !result.insertId) {
    return { ok: false, error: 'Invalid or expired verification link' };
  }
  const [rows] = await db.query('SELECT id, email FROM users WHERE id = ?', [result.insertId]);
  return { ok: true, userId: result.insertId, email: rows[0]?.email || null };
}

export async function issuePasswordReset(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return { ok: true, sent: false };

  let userIdForCleanup = null;
  try {
    const [users] = await db.query(
      'SELECT id, name, email FROM users WHERE LOWER(email) = ? LIMIT 1',
      [normalized],
    );
    if (!users.length) return { ok: true, sent: false, found: false };

    const user = users[0];
    userIdForCleanup = user.id;
    const toAddress = user.email || normalized;
    const token = crypto.randomBytes(32).toString('hex');
    const expires = tokenExpiryUtc(2);
    await db.query(
      `UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?`,
      [token, expires, user.id],
    );
    const link = `${frontendBase()}/reset-password?token=${encodeURIComponent(token)}`;
    const { subject, text, html } = buildPasswordResetEmail({
      name: user.name,
      resetUrl: link,
    });
    try {
      const result = await sendPlatformEmail(toAddress, subject, text, html);
      if (result.simulated) {
        logger.info(
          'Password reset link simulated (ALLOW_EMAIL_SIMULATION; configure RESEND_API_KEY)',
          {
            userId: user.id,
            email: maskEmail(toAddress),
            link,
          },
        );
      }
      return { ok: true, sent: true, simulated: Boolean(result.simulated) };
    } catch (err) {
      try {
        await db.query(
          `UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?`,
          [user.id],
        );
      } catch {
        /* ignore cleanup */
      }
      userIdForCleanup = null;
      logger.error('Password reset send failed', {
        userId: user.id,
        email: maskEmail(toAddress),
        code: err.code || null,
        message: err.message,
      });
      throw wrapEmailSendError(
        err,
        'Unable to send password reset email. Please try again later.',
      );
    }
  } catch (err) {
    if (err?.status === EMAIL_FAIL_STATUS || err?.code === 'EMAIL_NOT_CONFIGURED' || err?.code === 'EMAIL_SEND_FAILED') {
      throw err;
    }
    if (userIdForCleanup) {
      try {
        await db.query(
          `UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?`,
          [userIdForCleanup],
        );
      } catch {
        /* ignore cleanup */
      }
    }
    logger.error('Password reset request failed', {
      email: maskEmail(normalized),
      code: err?.code || null,
      message: err?.message,
    });
    const wrapped = new Error(
      'Unable to process password reset request. Please try again later.',
    );
    wrapped.code = 'PASSWORD_RESET_FAILED';
    wrapped.status = EMAIL_FAIL_STATUS;
    throw wrapped;
  }
}

export async function consumePasswordResetToken(token) {
  if (!token) return { ok: false, error: 'Invalid or expired reset link' };
  // Single conditional UPDATE so concurrent requests cannot both consume the token;
  // LAST_INSERT_ID(id) exposes the matched user id via insertId on this statement.
  const [result] = await db.query(
    `UPDATE users
     SET password_reset_token = NULL, password_reset_expires = NULL, id = LAST_INSERT_ID(id)
     WHERE password_reset_token = ? AND password_reset_expires > UTC_TIMESTAMP()
     LIMIT 1`,
    [token],
  );
  if (result.affectedRows !== 1 || !result.insertId) {
    return { ok: false, error: 'Invalid or expired reset link' };
  }
  return { ok: true, userId: result.insertId };
}

export async function issueTeamInvitationEmail({
  email,
  name,
  inviterName,
  companyName,
  roleName,
  token,
}) {
  const normalized = normalizeEmail(email);
  const acceptUrl = `${frontendBase()}/accept-invite?token=${encodeURIComponent(token)}`;
  const { subject, text, html } = buildTeamInvitationEmail({
    name,
    email: normalized,
    inviterName,
    companyName,
    roleName,
    acceptUrl,
  });

  try {
    const result = await sendPlatformEmail(normalized, subject, text, html);
    if (result.simulated) {
      logger.info('Team invitation email simulated (ALLOW_EMAIL_SIMULATION or key missing)', {
        email: maskEmail(normalized),
        acceptUrl,
      });
    }
    return { ok: true, acceptUrl, simulated: Boolean(result.simulated), provider: result.provider };
  } catch (err) {
    logger.error('Team invitation email send failed', {
      email: maskEmail(normalized),
      code: err.code || null,
      message: err.message,
    });
    // Re-throw so caller can decide or wrap
    throw wrapEmailSendError(
      err,
      'Unable to send team invitation email via Resend. Check API key or use the invitation link directly.',
    );
  }
}

