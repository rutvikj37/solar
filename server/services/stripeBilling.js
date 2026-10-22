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
  return new Stripe(key, { apiVersion: '2026-07-29.dahlia' });
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

/** Unsigned webhooks only with an explicit opt-in, and never in production. */
function allowUnsignedStripeWebhooks() {
  return process.env.ALLOW_UNSIGNED_STRIPE_WEBHOOKS === '1' && process.env.NODE_ENV !== 'production';
}

/**
 * Verify Stripe webhook signature. Payloads are rejected whenever STRIPE_WEBHOOK_SECRET is missing,
 * unless ALLOW_UNSIGNED_STRIPE_WEBHOOKS=1 on a non-production host.
 */
export function constructStripeWebhookEvent(stripe, rawBody, signature) {
  const secretOk = isStripeWebhookSecretConfigured();

  if (!secretOk && !allowUnsignedStripeWebhooks()) {
    const err = new Error('STRIPE_WEBHOOK_SECRET missing or placeholder');
    err.status = 503;
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

  console.warn(
    '[Stripe Webhook] WARNING: accepting an UNSIGNED webhook because ALLOW_UNSIGNED_STRIPE_WEBHOOKS=1. ' +
      'Anyone can forge billing events. Never enable this on a public host; set STRIPE_WEBHOOK_SECRET instead.'
  );
  if (typeof rawBody === 'string' || Buffer.isBuffer(rawBody)) {
    return JSON.parse(rawBody.toString());
  }
  return rawBody;
}

/** ID from a Stripe field that may be a string ID or an expanded object. */
export function getStripeId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return typeof value.id === 'string' ? value.id : null;
}

/**
 * Subscription ID of an invoice across API versions:
 * pre-basil `invoice.subscription`; basil+ (incl. dahlia) `invoice.parent.subscription_details.subscription`,
 * with line-item parents as a last resort.
 */
export function getInvoiceSubscriptionId(invoice) {
  if (!invoice) return null;
  const direct =
    getStripeId(invoice.parent?.subscription_details?.subscription) || getStripeId(invoice.subscription);
  if (direct) return direct;
  for (const line of invoice.lines?.data || []) {
    const fromLine =
      getStripeId(line?.parent?.subscription_item_details?.subscription) || getStripeId(line?.subscription);
    if (fromLine) return fromLine;
  }
  return null;
}

function unixToDate(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000);
}

/**
 * Current billing period of a subscription across API versions:
 * pre-basil top-level `current_period_start/end`; basil+ per item `items.data[].current_period_start/end`.
 * Returns nulls (never Invalid Date) when absent.
 */
export function getSubscriptionPeriod(subscription) {
  if (!subscription) return { start: null, end: null };
  let start = unixToDate(subscription.current_period_start);
  let end = unixToDate(subscription.current_period_end);
  if (!start || !end) {
    const item = (subscription.items?.data || []).find((i) => i?.current_period_start && i?.current_period_end);
    if (item) {
      start = start || unixToDate(item.current_period_start);
      end = end || unixToDate(item.current_period_end);
    }
  }
  return { start, end };
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
