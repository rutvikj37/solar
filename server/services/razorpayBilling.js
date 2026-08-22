import Razorpay from 'razorpay';
import crypto from 'crypto';

function cleanEnv(value) {
  if (value == null) return '';
  return String(value)
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r/g, '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .trim();
}

function isPlaceholderSecret(value) {
  const v = value.toLowerCase();
  return !v || v.includes('your_') || v.includes('changeme') || v.includes('placeholder');
}

export function getRazorpayKeyId() {
  return cleanEnv(process.env.RAZORPAY_KEY_ID);
}

export function getRazorpay() {
  const keyId = getRazorpayKeyId();
  const keySecret = cleanEnv(process.env.RAZORPAY_KEY_SECRET);
  if (isPlaceholderSecret(keyId) || isPlaceholderSecret(keySecret)) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

/** Razorpay's SDK throws a plain object `{ statusCode, error }`, not an Error. */
export function mapRazorpayError(err) {
  const description =
    err?.error?.description || err?.message || 'Razorpay request failed';
  const statusCode = Number(err?.statusCode || err?.status) || 0;
  const authFailed = /authentication failed/i.test(description) || statusCode === 401;
  const mapped = new Error(
    authFailed
      ? 'Razorpay authentication failed — check test keys'
      : description,
  );
  // Never use HTTP 401 here — that is reserved for missing/invalid solar_token.
  mapped.status = authFailed ? 502 : statusCode >= 400 && statusCode < 600 ? statusCode : 502;
  mapped.authFailed = authFailed;
  mapped.code = authFailed ? 'payment_provider_auth' : 'payment_provider';
  mapped.provider = 'razorpay';
  if (authFailed) {
    console.error(
      '[Razorpay] API authentication failed (provider 401). Check RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in server/.env — not a user session error.',
    );
  }
  return mapped;
}

/**
 * One-time orders (marketplace wallet). Same client as package subscriptions.
 */
export async function createRazorpayOrder({ amount, currency, receipt, notes } = {}) {
  const razorpay = getRazorpay();
  if (!razorpay) {
    const err = new Error('Razorpay not configured');
    err.status = 400;
    err.code = 'payment_provider';
    throw err;
  }
  try {
    return await razorpay.orders.create({
      amount,
      currency: currency || getBillingCurrency(),
      receipt: String(receipt || `ord_${Date.now()}`).slice(0, 40),
      notes: notes || {},
    });
  } catch (rzpErr) {
    throw mapRazorpayError(rzpErr);
  }
}

export function isRazorpayConfigured() {
  return Boolean(getRazorpay());
}

export function getBillingCurrency() {
  return cleanEnv(process.env.RAZORPAY_CURRENCY) || 'USD';
}

export function getBillingCurrencySymbol() {
  const currency = getBillingCurrency();
  if (currency === 'INR') return '₹';
  if (currency === 'EUR') return '€';
  if (currency === 'GBP') return '£';
  return '$';
}

/** Prefer Razorpay when configured (Indian merchants). */
export function getActivePaymentProvider() {
  if (isRazorpayConfigured()) return 'razorpay';
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey && stripeKey.trim() && !stripeKey.toLowerCase().includes('your_')) return 'stripe';
  return null;
}

export function verifyRazorpayWebhookSignature(body, signature) {
  const secret = cleanEnv(process.env.RAZORPAY_WEBHOOK_SECRET);
  const isProd = process.env.NODE_ENV === 'production';
  const secretOk = secret && !isPlaceholderSecret(secret);

  if (!secretOk) {
    if (isProd) {
      console.error('[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET missing or placeholder in production');
      return false;
    }
    console.warn('[Razorpay Webhook] Accepting unsigned webhooks in development (set RAZORPAY_WEBHOOK_SECRET)');
    return true;
  }
  if (!signature) return false;

  const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body ?? ''), 'utf8');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(String(signature), 'utf8'));
  } catch {
    return false;
  }
}

function timingSafeHexEqual(a, b) {
  try {
    return crypto.timingSafeEqual(Buffer.from(String(a), 'utf8'), Buffer.from(String(b), 'utf8'));
  } catch {
    return false;
  }
}

export function verifyRazorpayPaymentSignature(orderId, paymentId, signature) {
  const secret = cleanEnv(process.env.RAZORPAY_KEY_SECRET);
  if (!secret || !orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return timingSafeHexEqual(expected, signature);
}

export function verifyRazorpaySubscriptionSignature(subscriptionId, paymentId, signature) {
  const secret = cleanEnv(process.env.RAZORPAY_KEY_SECRET);
  if (!secret || !subscriptionId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${paymentId}|${subscriptionId}`)
    .digest('hex');
  return timingSafeHexEqual(expected, signature);
}

export async function createRazorpayPlan({ name, amountUsd, description, interval = 'monthly' }) {
  const razorpay = getRazorpay();
  if (!razorpay) throw new Error('Razorpay not configured');
  const currency = getBillingCurrency();
  const amount = Math.round(Number(amountUsd) * 100);
  try {
    const plan = await razorpay.plans.create({
      period: interval === 'yearly' ? 'yearly' : 'monthly',
      interval: 1,
      item: {
        name: name.slice(0, 100),
        amount,
        currency,
        description: (description || name).slice(0, 255)
      }
    });
    return plan.id;
  } catch (rzpErr) {
    throw mapRazorpayError(rzpErr);
  }
}

export async function createRazorpaySubscription({ planId, userId, packageId, credits, totalCount = 120 }) {
  const razorpay = getRazorpay();
  if (!razorpay) throw new Error('Razorpay not configured');

  try {
    return await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: totalCount,
      quantity: 1,
      customer_notify: 1,
      notes: {
        userId: String(userId),
        packageId: String(packageId),
        credits: String(credits)
      }
    });
  } catch (rzpErr) {
    throw mapRazorpayError(rzpErr);
  }
}

export async function fetchRazorpaySubscription(subscriptionId) {
  const razorpay = getRazorpay();
  if (!razorpay) throw new Error('Razorpay not configured');
  return razorpay.subscriptions.fetch(subscriptionId);
}

export async function cancelRazorpaySubscription(subscriptionId, cancelAtCycleEnd = true) {
  const razorpay = getRazorpay();
  if (!razorpay) throw new Error('Razorpay not configured');
  return razorpay.subscriptions.cancel(subscriptionId, cancelAtCycleEnd);
}

export function mapRazorpayStatus(status) {
  const map = {
    created: 'pending',
    authenticated: 'pending',
    active: 'active',
    pending: 'pending',
    halted: 'past_due',
    cancelled: 'canceled',
    completed: 'canceled',
    expired: 'canceled'
  };
  return map[status] || status;
}

export function razorpayPeriodDates(subscription) {
  const periodStart = subscription.current_start
    ? new Date(subscription.current_start * 1000)
    : subscription.start_at
      ? new Date(subscription.start_at * 1000)
      : new Date();
  const periodEnd = subscription.current_end
    ? new Date(subscription.current_end * 1000)
    : subscription.charge_at
      ? new Date(subscription.charge_at * 1000)
      : new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000);
  return { periodStart, periodEnd };
}
