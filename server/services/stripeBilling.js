import Stripe from 'stripe';

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
  const v = String(value || '').toLowerCase();
  return !v || v.includes('your_') || v.includes('changeme') || v.includes('placeholder');
}

export function getStripeSecretKey() {
  return cleanEnv(process.env.STRIPE_SECRET_KEY);
}

export function getStripe() {
  const key = getStripeSecretKey();
  if (isPlaceholderSecret(key)) return null;
  return new Stripe(key);
}

export function isStripeConfigured() {
  return Boolean(getStripe());
}

/** Sole payment provider — Stripe when configured, otherwise null (dev checkout may apply). */
export function getActivePaymentProvider() {
  return isStripeConfigured() ? 'stripe' : null;
}

export function getBillingCurrency() {
  return cleanEnv(process.env.STRIPE_CURRENCY) || 'usd';
}

export function getBillingCurrencySymbol() {
  const currency = getBillingCurrency().toUpperCase();
  if (currency === 'INR') return '₹';
  if (currency === 'EUR') return '€';
  if (currency === 'GBP') return '£';
  return '$';
}

export function getStripeWebhookSecret() {
  return cleanEnv(process.env.STRIPE_WEBHOOK_SECRET);
}

export function isStripeWebhookSecretConfigured() {
  const secret = getStripeWebhookSecret();
  return Boolean(secret && !isPlaceholderSecret(secret));
}

/**
 * Verify Stripe webhook signature. In production (or whenever a secret is set),
 * unsigned payloads are rejected.
 */
export function constructStripeWebhookEvent(stripe, rawBody, signature) {
  const secretOk = isStripeWebhookSecretConfigured();
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && !secretOk) {
    const err = new Error('STRIPE_WEBHOOK_SECRET missing or placeholder');
    err.status = 500;
    err.code = 'webhook_not_configured';
    throw err;
  }

  if (secretOk) {
    if (!signature) {
      const err = new Error('Missing Stripe signature');
      err.status = 400;
      throw err;
    }
    const bodyForStripe = Buffer.isBuffer(rawBody)
      ? rawBody
      : typeof rawBody === 'string'
        ? rawBody
        : JSON.stringify(rawBody);
    return stripe.webhooks.constructEvent(bodyForStripe, signature, getStripeWebhookSecret());
  }

  // Local/dev only when secret unset
  console.warn('[Stripe Webhook] Accepting unsigned webhooks in development (set STRIPE_WEBHOOK_SECRET)');
  if (typeof rawBody === 'string' || Buffer.isBuffer(rawBody)) {
    return JSON.parse(rawBody.toString());
  }
  return rawBody;
}

/** Assert Checkout Session belongs to the authenticated user. */
export function assertSessionBelongsToUser(session, userId) {
  const metaUser = Number(session?.metadata?.userId);
  const clientRef = Number(session?.client_reference_id);
  const uid = Number(userId);
  if (metaUser && metaUser !== uid) {
    const err = new Error('Session does not belong to this user');
    err.status = 403;
    throw err;
  }
  if (clientRef && clientRef !== uid) {
    const err = new Error('Session does not belong to this user');
    err.status = 403;
    throw err;
  }
  if (!metaUser && !clientRef) {
    const err = new Error('Session missing user binding');
    err.status = 400;
    throw err;
  }
}
