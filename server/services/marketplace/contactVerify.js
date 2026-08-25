import crypto from 'crypto';
import { BRAND_DISPLAY } from '../../config/brand.js';
import {
  validateEmailWithVerifalia,
  lookupPhoneWithTwilio,
  formatPhoneNumber,
} from '../contactEnrichmentService.js';
import { sendTwilioSms } from '../outreachDelivery.js';

/** In-memory OTP store (single PM2 fork). Keys are normalized phones. */
const phoneOtps = new Map();

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 45 * 1000;

function isKeyValid(key) {
  return key && String(key).trim() !== '' && !String(key).toLowerCase().includes('your_');
}

export function normalizeUsPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (String(phone || '').trim().startsWith('+') && digits.length >= 10) {
    return `+${digits}`;
  }
  return null;
}

function hashOtp(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function pruneExpiredOtps() {
  const now = Date.now();
  for (const [key, row] of phoneOtps.entries()) {
    if (!row?.expiresAt || row.expiresAt <= now) phoneOtps.delete(key);
  }
}

/**
 * Verifalia deliverability check for homeowner form email.
 */
export async function verifyHomeownerEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return {
      ok: false,
      email: normalized,
      classification: 'Invalid',
      error: 'Enter a valid email address.',
    };
  }

  const classification = await validateEmailWithVerifalia(normalized);
  const lower = String(classification || '').toLowerCase();

  // Verifalia returns Deliverable / Risky / Undeliverable; syntax fallback includes those words.
  if (lower.includes('undeliverable') || lower.includes('invalid')) {
    return {
      ok: false,
      email: normalized,
      classification,
      provider: isKeyValid(process.env.VERIFALIA_USERNAME) ? 'verifalia' : 'syntax',
      error: 'This email could not be verified. Please use a different email address.',
    };
  }

  return {
    ok: true,
    email: normalized,
    classification,
    provider: isKeyValid(process.env.VERIFALIA_USERNAME) ? 'verifalia' : 'syntax',
  };
}

/**
 * Twilio Lookup — ensure the number looks like a reachable mobile/landline.
 */
export async function verifyHomeownerPhoneLookup(phone) {
  const e164 = normalizeUsPhone(phone);
  if (!e164) {
    return {
      ok: false,
      phone: String(phone || '').trim(),
      error: 'Enter a valid US mobile number (10 digits).',
    };
  }

  const lineType = await lookupPhoneWithTwilio(e164);
  const type = String(lineType || '').toUpperCase();

  if (type.includes('INVALID') || type === 'NOT AVAILABLE') {
    return {
      ok: false,
      phone: e164,
      lineType,
      error: 'This phone number could not be verified.',
    };
  }

  // Block obvious non-phone types when Lookup returns them
  if (/(VOIP|TOLL.?FREE|PREMIUM|SHARED)/i.test(type) && !/MOBILE|LANDLINE|FIXED/i.test(type)) {
    return {
      ok: false,
      phone: e164,
      lineType,
      error: 'Please use a personal mobile number.',
      formatted: formatPhoneNumber(e164),
    };
  }

  return {
    ok: true,
    phone: e164,
    lineType,
    formatted: formatPhoneNumber(e164),
    provider: isKeyValid(process.env.TWILIO_ACCOUNT_SID) ? 'twilio_lookup' : 'syntax',
  };
}

/**
 * Send a 6-digit SMS OTP via Twilio Messages API.
 */
export async function sendHomeownerPhoneOtp(phone) {
  pruneExpiredOtps();

  const lookup = await verifyHomeownerPhoneLookup(phone);
  if (!lookup.ok) return lookup;

  const e164 = lookup.phone;
  const existing = phoneOtps.get(e164);
  if (existing?.sentAt && Date.now() - existing.sentAt < RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - existing.sentAt)) / 1000);
    return {
      ok: false,
      phone: e164,
      error: `Please wait ${waitSec}s before requesting another code.`,
      retryAfterSec: waitSec,
    };
  }

  if (!isKeyValid(process.env.TWILIO_ACCOUNT_SID) || !isKeyValid(process.env.TWILIO_AUTH_TOKEN)) {
    return {
      ok: false,
      phone: e164,
      error: 'Phone verification is not configured on the server.',
    };
  }

  if (!isKeyValid(process.env.TWILIO_PHONE_NUMBER)) {
    return {
      ok: false,
      phone: e164,
      error: 'Twilio sender number is not configured.',
    };
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  phoneOtps.set(e164, {
    hash: hashOtp(code),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    sentAt: Date.now(),
    verified: false,
  });

  try {
    await sendTwilioSms(
      e164,
      `Your ${BRAND_DISPLAY} verification code is ${code}. It expires in 10 minutes.`,
    );
  } catch (err) {
    phoneOtps.delete(e164);
    console.error('[contactVerify] Twilio SMS failed:', err);
    return {
      ok: false,
      phone: e164,
      error: err.message || 'Failed to send verification SMS. Please try again.',
    };
  }

  return {
    ok: true,
    phone: e164,
    formatted: lookup.formatted,
    lineType: lookup.lineType,
    message: 'Verification code sent by SMS.',
    expiresInSec: Math.floor(OTP_TTL_MS / 1000),
  };
}

/**
 * Confirm SMS OTP for homeowner phone.
 */
export function confirmHomeownerPhoneOtp(phone, code) {
  pruneExpiredOtps();

  const e164 = normalizeUsPhone(phone);
  if (!e164) {
    return { ok: false, error: 'Enter a valid US mobile number.' };
  }

  const row = phoneOtps.get(e164);
  if (!row) {
    return { ok: false, error: 'No verification code found. Please request a new code.' };
  }
  if (row.expiresAt <= Date.now()) {
    phoneOtps.delete(e164);
    return { ok: false, error: 'Verification code expired. Please request a new code.' };
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    phoneOtps.delete(e164);
    return { ok: false, error: 'Too many incorrect attempts. Please request a new code.' };
  }

  const incoming = String(code || '').trim();
  if (!/^\d{6}$/.test(incoming)) {
    row.attempts += 1;
    return { ok: false, error: 'Enter the 6-digit code from your SMS.' };
  }

  if (hashOtp(incoming) !== row.hash) {
    row.attempts += 1;
    const left = OTP_MAX_ATTEMPTS - row.attempts;
    return {
      ok: false,
      error: left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Incorrect code.',
    };
  }

  row.verified = true;
  row.verifiedAt = Date.now();
  // Keep brief window so inquiry submit can optionally re-check
  row.expiresAt = Date.now() + 30 * 60 * 1000;

  return {
    ok: true,
    phone: e164,
    formatted: formatPhoneNumber(e164),
    verified: true,
  };
}

export function isHomeownerPhoneVerified(phone) {
  pruneExpiredOtps();
  const e164 = normalizeUsPhone(phone);
  if (!e164) return false;
  const row = phoneOtps.get(e164);
  return Boolean(row?.verified && row.expiresAt > Date.now());
}
