import Razorpay from 'razorpay';
import crypto from 'crypto';

export function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret || keyId.toLowerCase().includes('your_')) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export function isRazorpayConfigured() {
  return Boolean(getRazorpay());
}

export function getBillingCurrency() {
  return process.env.RAZORPAY_CURRENCY || 'USD';
}

/** Prefer Razorpay when configured (Indian merchants). */
export function getActivePaymentProvider() {
  if (isRazorpayConfigured()) return 'razorpay';
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey && stripeKey.trim() && !stripeKey.toLowerCase().includes('your_')) return 'stripe';
  return null;
}

export function verifyRazorpayWebhookSignature(body, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || secret.toLowerCase().includes('your_')) return true;
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return expected === signature;
}

export async function createRazorpayPlan({ name, amountUsd, description, interval = 'monthly' }) {
  const razorpay = getRazorpay();
  if (!razorpay) throw new Error('Razorpay not configured');
  const currency = getBillingCurrency();
  const amount = Math.round(Number(amountUsd) * 100);
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
}

export async function createRazorpaySubscription({ planId, userId, packageId, credits, totalCount = 120 }) {
  const razorpay = getRazorpay();
  if (!razorpay) throw new Error('Razorpay not configured');

  const subscription = await razorpay.subscriptions.create({
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

  return subscription;
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
