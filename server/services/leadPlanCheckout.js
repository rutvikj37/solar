import db from '../db.js';
import {
  createRazorpayOrder,
  getBillingCurrency,
  getRazorpay,
  verifyRazorpayPaymentSignature,
} from './razorpayBilling.js';

export const LEAD_PLAN_KIND = 'lead_plan';

/** Activate one month of lead credits after Razorpay order payment (not recurring subscription API). */
export async function activateLeadPlanPeriod({
  userId,
  packageId,
  credits,
  orderId = null,
  paymentId = null,
  amountCents = 0,
  invoiceId = null,
}) {
  const periodStart = new Date();
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const [packages] = await db.query(
    'SELECT id FROM user_packages WHERE user_id = ? AND status = "active" ORDER BY id DESC LIMIT 1',
    [userId],
  );
  if (packages.length > 0) {
    await db.query(
      `UPDATE user_packages SET remaining_leads = ?, purchased_leads = ?, package_id = ? WHERE id = ?`,
      [credits, credits, packageId, packages[0].id],
    );
  } else {
    await db.query(
      `INSERT INTO user_packages (user_id, package_id, remaining_leads, purchased_leads, status)
       VALUES (?, ?, ?, ?, 'active')`,
      [userId, packageId, credits, credits],
    );
  }

  const [existingSub] = await db.query('SELECT id FROM user_subscriptions WHERE user_id = ?', [userId]);
  if (existingSub.length) {
    await db.query(
      `UPDATE user_subscriptions SET
         package_id = ?, payment_provider = 'razorpay', razorpay_subscription_id = ?,
         status = 'active', current_period_start = ?, current_period_end = ?, cancel_at_period_end = 0
       WHERE user_id = ?`,
      [packageId, orderId, periodStart, periodEnd, userId],
    );
  } else {
    await db.query(
      `INSERT INTO user_subscriptions
        (user_id, package_id, payment_provider, razorpay_subscription_id, status,
         current_period_start, current_period_end, cancel_at_period_end)
       VALUES (?, ?, 'razorpay', ?, 'active', ?, ?, 0)`,
      [userId, packageId, orderId, periodStart, periodEnd],
    );
  }

  if (invoiceId) {
    await db.query(
      `UPDATE invoices SET status = 'paid', razorpay_payment_id = COALESCE(?, razorpay_payment_id)
       WHERE id = ?`,
      [paymentId, invoiceId],
    );
  } else if (orderId) {
    await db.query(
      `UPDATE invoices SET status = 'paid', razorpay_payment_id = COALESCE(?, razorpay_payment_id)
       WHERE stripe_session_id = ? AND user_id = ?`,
      [paymentId, orderId, userId],
    );
  }

  return { credits, periodEnd };
}

export async function createLeadPlanRazorpayCheckout({ userId, pkg, credits, prefill = {} }) {
  const amountCents = Math.round(Number(pkg.price) * 100);
  const currency = getBillingCurrency();
  const order = await createRazorpayOrder({
    amount: amountCents,
    currency,
    receipt: `plan_${pkg.id}_${userId}_${Date.now()}`.slice(0, 40),
    notes: {
      kind: LEAD_PLAN_KIND,
      userId: String(userId),
      packageId: String(pkg.id),
      credits: String(credits),
    },
  });

  const [inv] = await db.query(
    `INSERT INTO invoices
      (user_id, stripe_session_id, package_id, amount_cents, credits, status, method, billing_reason, description)
     VALUES (?, ?, ?, ?, ?, 'pending', 'razorpay_plan', 'initial', ?)`,
    [
      userId,
      order.id,
      pkg.id,
      amountCents,
      credits,
      `${pkg.name} — ${credits} lead credits / month`,
    ],
  );

  return {
    mode: 'razorpay',
    orderId: order.id,
    amount: order.amount,
    currency: order.currency || currency,
    invoiceId: inv.insertId,
    packName: pkg.name,
    description: `${credits} lead credits / month (USD)`,
    prefill,
  };
}

export async function confirmLeadPlanRazorpayPayment({
  userId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) {
  if (!verifyRazorpayPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
    const err = new Error('Invalid Razorpay payment signature');
    err.status = 400;
    throw err;
  }

  const [existingPayment] = await db.query(
    'SELECT id, user_id, status, credits, package_id FROM invoices WHERE razorpay_payment_id = ? LIMIT 1',
    [razorpayPaymentId],
  );
  if (existingPayment.length) {
    const row = existingPayment[0];
    if (Number(row.user_id) !== Number(userId)) {
      const err = new Error('Payment already recorded for another account');
      err.status = 409;
      throw err;
    }
    if (row.status === 'paid') {
      return { alreadyPaid: true, credits: row.credits, packageId: row.package_id };
    }
  }

  const [rows] = await db.query(
    `SELECT * FROM invoices WHERE stripe_session_id = ? AND user_id = ? LIMIT 1`,
    [razorpayOrderId, userId],
  );
  const invoice = rows[0];
  if (!invoice) {
    const err = new Error('Plan checkout not found');
    err.status = 404;
    throw err;
  }
  if (invoice.status === 'paid') {
    return { alreadyPaid: true, credits: invoice.credits, packageId: invoice.package_id };
  }

  const result = await activateLeadPlanPeriod({
    userId,
    packageId: invoice.package_id,
    credits: Number(invoice.credits),
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    amountCents: invoice.amount_cents,
    invoiceId: invoice.id,
  });

  return {
    alreadyPaid: false,
    message: 'Monthly plan activated — lead credits updated.',
    credits: result.credits,
    packageId: invoice.package_id,
  };
}

export async function fulfillLeadPlanFromRazorpayPayment(payment) {
  if (!payment) return false;
  let notes = payment.notes || {};
  if (notes.kind !== LEAD_PLAN_KIND && payment.order_id) {
    const razorpay = getRazorpay();
    if (razorpay) {
      try {
        const order = await razorpay.orders.fetch(payment.order_id);
        notes = { ...(order.notes || {}), ...notes };
      } catch {
        /* use payment notes only */
      }
    }
  }
  if (notes.kind !== LEAD_PLAN_KIND) return false;

  const userId = Number(notes.userId);
  const packageId = notes.packageId;
  const credits = Number(notes.credits);
  if (!userId || !packageId || !credits) return false;

  const [existingByPayment] = await db.query(
    'SELECT id FROM invoices WHERE razorpay_payment_id = ? LIMIT 1',
    [payment.id],
  );
  if (existingByPayment.length) return true;

  const [paid] = await db.query(
    `SELECT id FROM invoices WHERE stripe_session_id = ? AND user_id = ? AND status = 'paid'`,
    [payment.order_id, userId],
  );
  if (paid.length) return true;

  await activateLeadPlanPeriod({
    userId,
    packageId,
    credits,
    orderId: payment.order_id,
    paymentId: payment.id,
    amountCents: payment.amount,
  });
  return true;
}
