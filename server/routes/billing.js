import express from 'express';
import Stripe from 'stripe';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { logApiCall } from '../services/apiUsage.js';
import {
  cancelRazorpaySubscription,
  createRazorpaySubscription,
  fetchRazorpaySubscription,
  getActivePaymentProvider,
  getRazorpay,
  mapRazorpayStatus,
  razorpayPeriodDates,
  verifyRazorpayWebhookSignature
} from '../services/razorpayBilling.js';

const router = express.Router();

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.trim() === '' || key.toLowerCase().includes('your_')) return null;
  return new Stripe(key);
}

function allowDevCheckout() {
  return process.env.ALLOW_DEV_CHECKOUT === '1' || process.env.ALLOW_DEV_CHECKOUT === 'true';
}

function isSubscriptionPackage(pkg) {
  return Number(pkg.is_subscription) === 1 || pkg.billing_interval === 'month';
}

/** Reset credits to monthly plan allowance (subscription refresh). */
export async function setSubscriptionCredits(userId, packageId, credits) {
  const amount = Math.max(0, Number(credits) || 0);
  const [packages] = await db.query(
    'SELECT id FROM user_packages WHERE user_id = ? AND status = "active" ORDER BY id DESC LIMIT 1',
    [userId]
  );

  if (packages.length > 0) {
    await db.query(
      `UPDATE user_packages
       SET remaining_leads = ?, purchased_leads = ?, package_id = ?
       WHERE id = ?`,
      [amount, amount, packageId, packages[0].id]
    );
  } else {
    await db.query(
      `INSERT INTO user_packages (user_id, package_id, remaining_leads, purchased_leads, status)
       VALUES (?, ?, ?, ?, 'active')`,
      [userId, packageId, amount, amount]
    );
  }
}

/** Legacy one-time credit add (non-subscription packs). */
export async function grantCredits(userId, packageId, credits) {
  const [packages] = await db.query(
    'SELECT id FROM user_packages WHERE user_id = ? AND status = "active" ORDER BY id DESC LIMIT 1',
    [userId]
  );

  if (packages.length > 0) {
    await db.query(
      `UPDATE user_packages
       SET remaining_leads = remaining_leads + ?, purchased_leads = purchased_leads + ?, package_id = ?
       WHERE id = ?`,
      [credits, credits, packageId, packages[0].id]
    );
  } else {
    await db.query(
      `INSERT INTO user_packages (user_id, package_id, remaining_leads, purchased_leads, status)
       VALUES (?, ?, ?, ?, 'active')`,
      [userId, packageId, credits, credits]
    );
  }
}

export async function refreshSubscriptionCredits(userId, packageId, credits) {
  await setSubscriptionCredits(userId, packageId, credits);
}

async function getUserStripeCustomerId(userId) {
  const [rows] = await db.query('SELECT stripe_customer_id, email, name FROM users WHERE id = ?', [userId]);
  return rows[0] || null;
}

async function ensureStripeCustomer(stripe, userId) {
  const user = await getUserStripeCustomerId(userId);
  if (!user) return null;
  if (user.stripe_customer_id) return user.stripe_customer_id;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: String(userId) }
  });
  await db.query('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [customer.id, userId]);
  return customer.id;
}

async function upsertUserSubscription({
  userId,
  packageId,
  paymentProvider = 'stripe',
  stripeCustomerId,
  stripeSubscriptionId,
  razorpaySubscriptionId,
  status,
  periodStart,
  periodEnd,
  cancelAtPeriodEnd = false
}) {
  const [existing] = await db.query('SELECT id FROM user_subscriptions WHERE user_id = ?', [userId]);
  if (existing.length > 0) {
    await db.query(
      `UPDATE user_subscriptions SET
         package_id = ?, payment_provider = ?, stripe_customer_id = ?, stripe_subscription_id = ?,
         razorpay_subscription_id = ?, status = ?, current_period_start = ?, current_period_end = ?,
         cancel_at_period_end = ?
       WHERE user_id = ?`,
      [
        packageId,
        paymentProvider,
        stripeCustomerId || null,
        stripeSubscriptionId || null,
        razorpaySubscriptionId || null,
        status,
        periodStart || null,
        periodEnd || null,
        cancelAtPeriodEnd ? 1 : 0,
        userId
      ]
    );
  } else {
    await db.query(
      `INSERT INTO user_subscriptions
       (user_id, package_id, payment_provider, stripe_customer_id, stripe_subscription_id,
        razorpay_subscription_id, status, current_period_start, current_period_end, cancel_at_period_end)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        packageId,
        paymentProvider,
        stripeCustomerId || null,
        stripeSubscriptionId || null,
        razorpaySubscriptionId || null,
        status,
        periodStart || null,
        periodEnd || null,
        cancelAtPeriodEnd ? 1 : 0
      ]
    );
  }
}

async function invoiceAlreadyProcessed(externalId) {
  if (!externalId) return false;
  const [rows] = await db.query(
    `SELECT id FROM invoices
     WHERE stripe_invoice_id = ? OR razorpay_payment_id = ? OR stripe_session_id = ?
     LIMIT 1`,
    [externalId, externalId, externalId]
  );
  return rows.length > 0;
}

async function recordInvoice({
  userId,
  packageId,
  amountCents,
  credits,
  status,
  method,
  stripeSessionId = null,
  stripeSubscriptionId = null,
  stripeInvoiceId = null,
  razorpayPaymentId = null,
  billingReason = 'initial'
}) {
  const [inv] = await db.query(
    `INSERT INTO invoices
     (user_id, stripe_session_id, stripe_subscription_id, stripe_invoice_id, razorpay_payment_id,
      package_id, amount_cents, credits, status, method, billing_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      stripeSessionId,
      stripeSubscriptionId,
      stripeInvoiceId,
      razorpayPaymentId,
      packageId,
      amountCents,
      credits,
      status,
      method,
      billingReason
    ]
  );
  return inv.insertId;
}

/** Check whether user can generate leads (credits + subscription state). */
export async function checkLeadCreditAccess(userId) {
  const [packages] = await db.query(
    'SELECT id, remaining_leads FROM user_packages WHERE user_id = ? AND status = "active" ORDER BY id DESC LIMIT 1',
    [userId]
  );
  const credits = packages.length > 0 ? packages[0].remaining_leads : 0;
  const packageRecord = packages[0] || null;

  const [subs] = await db.query('SELECT * FROM user_subscriptions WHERE user_id = ? LIMIT 1', [userId]);
  const sub = subs[0] || null;

  if (sub?.status === 'past_due') {
    return {
      allowed: false,
      credits,
      packageRecord,
      upgradeRequired: true,
      reason: 'payment_failed',
      error: 'Payment failed. Update your billing details to continue generating leads.'
    };
  }

  if (sub?.status === 'canceled' && sub.current_period_end) {
    const periodEnd = new Date(sub.current_period_end);
    if (periodEnd < new Date() && credits <= 0) {
      return {
        allowed: false,
        credits,
        packageRecord,
        upgradeRequired: true,
        reason: 'subscription_ended',
        error: 'Your subscription has ended. Subscribe to a monthly plan to generate leads.'
      };
    }
  }

  if (credits <= 0) {
    return {
      allowed: false,
      credits: 0,
      packageRecord,
      upgradeRequired: true,
      reason: 'no_credits',
      error: 'Insufficient lead credits. Please subscribe to a monthly plan.'
    };
  }

  return { allowed: true, credits, packageRecord, upgradeRequired: false };
}

async function loadActivePackage(packageId) {
  const [rows] = await db.query(
    `SELECT * FROM packages WHERE id = ? AND (is_active = 1 OR id = ?) LIMIT 1`,
    [packageId, packageId]
  );
  return rows[0] || null;
}

async function activateDevSubscription(userId, pkg) {
  const credits = Number(pkg.lead_limit) || 0;
  const amountCents = Math.round(Number(pkg.price) * 100);
  const periodStart = new Date();
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await setSubscriptionCredits(userId, pkg.id, credits);
  await upsertUserSubscription({
    userId,
    packageId: pkg.id,
    paymentProvider: 'dev',
    stripeCustomerId: `dev_cus_${userId}`,
    stripeSubscriptionId: `dev_sub_${userId}_${Date.now()}`,
    status: 'active',
    periodStart,
    periodEnd,
    cancelAtPeriodEnd: false
  });
  await recordInvoice({
    userId,
    packageId: pkg.id,
    amountCents,
    credits,
    status: 'paid',
    method: 'dev_subscription',
    billingReason: 'initial'
  });
}

router.get('/provider', (_req, res) => {
  res.json({
    provider: getActivePaymentProvider() || 'dev',
    currency: process.env.RAZORPAY_CURRENCY || 'USD'
  });
});

// Public/active packages for purchase UI (exclude Free)
router.get('/packages', async (req, res) => {
  try {
    const adminAll = req.query.all === '1';
    const sql = adminAll
      ? 'SELECT * FROM packages ORDER BY price ASC'
      : `SELECT * FROM packages WHERE is_active = 1 AND id != 'Free' AND price > 0 ORDER BY price ASC`;
    const [rows] = await db.query(sql);
    res.json(rows);
  } catch (error) {
    console.error('Packages list error:', error);
    res.status(500).json({ error: 'Server error listing packages' });
  }
});

router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    const [subs] = await db.query(
      `SELECT s.*, p.name AS package_name, p.lead_limit, p.price, p.billing_interval
       FROM user_subscriptions s
       LEFT JOIN packages p ON p.id = s.package_id
       WHERE s.user_id = ?
       LIMIT 1`,
      [req.user.id]
    );
    const [packages] = await db.query(
      'SELECT remaining_leads, package_id FROM user_packages WHERE user_id = ? AND status = "active" ORDER BY id DESC LIMIT 1',
      [req.user.id]
    );
    const sub = subs[0] || null;
    res.json({
      subscription: sub
        ? {
            packageId: sub.package_id,
            packageName: sub.package_name,
            status: sub.status,
            leadLimit: sub.lead_limit,
            price: sub.price,
            billingInterval: sub.billing_interval || 'month',
            currentPeriodStart: sub.current_period_start,
            currentPeriodEnd: sub.current_period_end,
            cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
            paymentProvider: sub.payment_provider || 'stripe',
            stripeSubscriptionId: sub.stripe_subscription_id,
            razorpaySubscriptionId: sub.razorpay_subscription_id
          }
        : null,
      credits: packages[0]?.remaining_leads ?? 0,
      activePackage: packages[0]?.package_id ?? 'Free'
    });
  } catch (error) {
    console.error('Subscription fetch error:', error);
    res.status(500).json({ error: 'Server error fetching subscription' });
  }
});

router.post('/portal', authenticateToken, async (req, res) => {
  const provider = getActivePaymentProvider();
  if (provider === 'razorpay') {
    return res.json({
      mode: 'razorpay',
      message: 'Use "Cancel subscription" on this page to manage your Razorpay plan.',
      manageOnBilling: true
    });
  }
  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ error: 'No payment provider configured' });
  }
  try {
    const customerId = await ensureStripeCustomer(stripe, req.user.id);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5200';
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${frontendUrl}/billing`
    });
    res.json({ url: session.url });
  } catch (error) {
    console.error('Portal error:', error);
    res.status(500).json({ error: 'Server error creating billing portal session' });
  }
});

router.post('/cancel-subscription', authenticateToken, async (req, res) => {
  try {
    const [subs] = await db.query('SELECT * FROM user_subscriptions WHERE user_id = ? LIMIT 1', [req.user.id]);
    if (!subs.length) return res.status(404).json({ error: 'No active subscription' });
    const sub = subs[0];

    if (sub.payment_provider === 'razorpay' && sub.razorpay_subscription_id) {
      await cancelRazorpaySubscription(sub.razorpay_subscription_id, true);
      await db.query(
        'UPDATE user_subscriptions SET cancel_at_period_end = 1, status = "active" WHERE user_id = ?',
        [req.user.id]
      );
      return res.json({ message: 'Subscription will cancel at end of billing period.' });
    }

    if (sub.stripe_subscription_id && getStripe()) {
      const stripe = getStripe();
      await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
      await db.query('UPDATE user_subscriptions SET cancel_at_period_end = 1 WHERE user_id = ?', [req.user.id]);
      return res.json({ message: 'Subscription will cancel at end of billing period.' });
    }

    res.status(400).json({ error: 'Subscription cannot be canceled via API' });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel subscription' });
  }
});

router.post('/checkout', authenticateToken, async (req, res) => {
  const { packageId } = req.body;
  const pkg = await loadActivePackage(packageId);
  if (!pkg || pkg.id === 'Free' || Number(pkg.price) <= 0 || Number(pkg.is_active) === 0) {
    return res.status(400).json({ error: 'Invalid or inactive package' });
  }

  const credits = Number(pkg.lead_limit) || 0;
  const amountCents = Math.round(Number(pkg.price) * 100);
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5200';
  const provider = getActivePaymentProvider();
  const stripe = getStripe();
  const started = Date.now();
  const subscriptionMode = isSubscriptionPackage(pkg);

  try {
    if (provider === 'razorpay' && subscriptionMode) {
      if (!pkg.razorpay_plan_id) {
        return res.status(400).json({
          error: 'This plan requires a Razorpay Plan ID. Ask an admin to configure razorpay_plan_id.'
        });
      }

      const subscription = await createRazorpaySubscription({
        planId: pkg.razorpay_plan_id,
        userId: req.user.id,
        packageId: pkg.id,
        credits
      });

      await upsertUserSubscription({
        userId: req.user.id,
        packageId: pkg.id,
        paymentProvider: 'razorpay',
        razorpaySubscriptionId: subscription.id,
        status: mapRazorpayStatus(subscription.status),
        periodStart: subscription.start_at ? new Date(subscription.start_at * 1000) : new Date(),
        periodEnd: subscription.charge_at ? new Date(subscription.charge_at * 1000) : null,
        cancelAtPeriodEnd: false
      });

      await recordInvoice({
        userId: req.user.id,
        packageId: pkg.id,
        amountCents,
        credits,
        status: 'pending',
        method: 'razorpay_subscription',
        stripeSessionId: subscription.id,
        billingReason: 'initial'
      });

      await logApiCall('razorpay', true, Date.now() - started);
      return res.json({
        mode: 'razorpay',
        subscriptionId: subscription.id,
        url: subscription.short_url,
        keyId: process.env.RAZORPAY_KEY_ID
      });
    }

    if (!stripe) {
      if (!allowDevCheckout()) {
        return res.status(503).json({
          error: 'Payment not configured. Set RAZORPAY_KEY_ID/SECRET or ALLOW_DEV_CHECKOUT=1 for local testing.'
        });
      }
      if (subscriptionMode) {
        await activateDevSubscription(req.user.id, pkg);
      } else {
        await grantCredits(req.user.id, packageId, credits);
        await recordInvoice({
          userId: req.user.id,
          packageId,
          amountCents,
          credits,
          status: 'paid',
          method: 'dev_credit',
          billingReason: 'initial'
        });
      }
      await logApiCall('stripe', true, Date.now() - started);
      return res.json({
        mode: 'dev',
        message: subscriptionMode
          ? `Subscribed to ${pkg.name} — ${credits} credits/month (dev)`
          : `Added ${credits} credits (dev checkout)`,
        credits,
        redirectUrl: `${frontendUrl}/billing?success=1&package=${packageId}`
      });
    }

    const customerId = await ensureStripeCustomer(stripe, req.user.id);

    if (subscriptionMode) {
      if (!pkg.stripe_price_id) {
        return res.status(400).json({
          error: 'This plan requires a Stripe recurring Price ID. Ask an admin to configure stripe_price_id.'
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: pkg.stripe_price_id, quantity: 1 }],
        metadata: {
          userId: String(req.user.id),
          packageId: pkg.id,
          credits: String(credits)
        },
        subscription_data: {
          metadata: {
            userId: String(req.user.id),
            packageId: pkg.id,
            credits: String(credits)
          }
        },
        success_url: `${frontendUrl}/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/packages?canceled=1`
      });

      await recordInvoice({
        userId: req.user.id,
        packageId: pkg.id,
        amountCents,
        credits,
        status: 'pending',
        method: 'stripe_subscription',
        stripeSessionId: session.id,
        billingReason: 'initial'
      });

      await logApiCall('stripe', true, Date.now() - started);
      return res.json({ mode: 'stripe', sessionId: session.id, url: session.url });
    }

    const lineItem = pkg.stripe_price_id
      ? { price: pkg.stripe_price_id, quantity: 1 }
      : {
          price_data: {
            currency: 'usd',
            product_data: {
              name: pkg.name,
              description: `${credits} lead credits`
            },
            unit_amount: amountCents
          },
          quantity: 1
        };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [lineItem],
      metadata: {
        userId: String(req.user.id),
        packageId: pkg.id,
        credits: String(credits)
      },
      success_url: `${frontendUrl}/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/packages?canceled=1`
    });

    await recordInvoice({
      userId: req.user.id,
      packageId: pkg.id,
      amountCents,
      credits,
      status: 'pending',
      method: 'stripe',
      stripeSessionId: session.id,
      billingReason: 'initial'
    });

    await logApiCall('stripe', true, Date.now() - started);
    res.json({ mode: 'stripe', sessionId: session.id, url: session.url });
  } catch (error) {
    await logApiCall('stripe', false, Date.now() - started);
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Server error creating checkout' });
  }
});

router.post('/confirm', authenticateToken, async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const stripe = getStripe();
  if (!stripe) return res.status(400).json({ error: 'Stripe not configured' });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    const [invoices] = await db.query(
      'SELECT * FROM invoices WHERE stripe_session_id = ? AND user_id = ?',
      [sessionId, req.user.id]
    );
    if (invoices.length === 0) return res.status(404).json({ error: 'Invoice not found' });

    const invoice = invoices[0];
    if (invoice.status === 'paid') {
      return res.json({ message: 'Already fulfilled', invoice });
    }

    if (session.mode === 'subscription' && session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      const packageId = session.metadata?.packageId || invoice.package_id;
      const credits = Number(session.metadata?.credits) || invoice.credits;
      const periodStart = new Date(subscription.current_period_start * 1000);
      const periodEnd = new Date(subscription.current_period_end * 1000);

      await setSubscriptionCredits(req.user.id, packageId, credits);
      await upsertUserSubscription({
        userId: req.user.id,
        packageId,
        stripeCustomerId: session.customer,
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
        periodStart,
        periodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      });
      await db.query(
        `UPDATE invoices SET status = 'paid', stripe_subscription_id = ?, billing_reason = 'initial' WHERE id = ?`,
        [subscription.id, invoice.id]
      );
    } else {
      await grantCredits(req.user.id, invoice.package_id, invoice.credits);
      await db.query('UPDATE invoices SET status = "paid" WHERE id = ?', [invoice.id]);
    }

    res.json({ message: 'Credits granted', credits: invoice.credits, packageId: invoice.package_id });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ error: 'Server error confirming payment' });
  }
});

async function handleCheckoutCompleted(stripe, session) {
  const userId = Number(session.metadata?.userId);
  const packageId = session.metadata?.packageId;
  if (!userId || !packageId) return;

  const pkg = await loadActivePackage(packageId);
  const credits = Number(session.metadata?.credits) || pkg?.lead_limit || 0;

  if (session.mode === 'subscription' && session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    const periodStart = new Date(subscription.current_period_start * 1000);
    const periodEnd = new Date(subscription.current_period_end * 1000);

    await setSubscriptionCredits(userId, packageId, credits);
    await upsertUserSubscription({
      userId,
      packageId,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: subscription.id,
      status: subscription.status,
      periodStart,
      periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });

    const [invoices] = await db.query('SELECT * FROM invoices WHERE stripe_session_id = ?', [session.id]);
    if (invoices.length > 0 && invoices[0].status !== 'paid') {
      await db.query(
        `UPDATE invoices SET status = 'paid', stripe_subscription_id = ?, billing_reason = 'initial' WHERE id = ?`,
        [subscription.id, invoices[0].id]
      );
    } else if (invoices.length === 0) {
      await recordInvoice({
        userId,
        packageId,
        amountCents: session.amount_total || 0,
        credits,
        status: 'paid',
        method: 'stripe_subscription',
        stripeSessionId: session.id,
        stripeSubscriptionId: subscription.id,
        billingReason: 'initial'
      });
    }
    console.log(`[Stripe Webhook] Subscription activated for user ${userId}, plan ${packageId}`);
    return;
  }

  const [invoices] = await db.query('SELECT * FROM invoices WHERE stripe_session_id = ?', [session.id]);
  if (invoices.length > 0 && invoices[0].status !== 'paid') {
    const inv = invoices[0];
    await grantCredits(inv.user_id, inv.package_id, inv.credits);
    await db.query('UPDATE invoices SET status = "paid" WHERE id = ?', [inv.id]);
    console.log(`[Stripe Webhook] Fulfilled invoice ${inv.id} for user ${inv.user_id}`);
  } else if (invoices.length === 0) {
    await grantCredits(userId, packageId, credits);
    await recordInvoice({
      userId,
      packageId,
      amountCents: session.amount_total || 0,
      credits,
      status: 'paid',
      method: 'stripe',
      stripeSessionId: session.id,
      billingReason: 'initial'
    });
  }
}

async function handleInvoicePaid(stripe, invoice) {
  if (invoice.status !== 'paid') return;
  if (await invoiceAlreadyProcessed(invoice.id)) return;

  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const packageId = subscription.metadata?.packageId;
  const userId = Number(subscription.metadata?.userId);
  if (!userId || !packageId) return;

  const pkg = await loadActivePackage(packageId);
  const credits = Number(subscription.metadata?.credits) || pkg?.lead_limit || 0;
  const billingReason = invoice.billing_reason === 'subscription_create' ? 'initial' : 'renewal';

  await refreshSubscriptionCredits(userId, packageId, credits);
  await upsertUserSubscription({
    userId,
    packageId,
    stripeCustomerId: invoice.customer,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    periodStart: new Date(subscription.current_period_start * 1000),
    periodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end
  });

  await recordInvoice({
    userId,
    packageId,
    amountCents: invoice.amount_paid || 0,
    credits,
    status: 'paid',
    method: 'stripe_subscription',
    stripeSubscriptionId: subscription.id,
    stripeInvoiceId: invoice.id,
    billingReason
  });

  console.log(`[Stripe Webhook] ${billingReason} credits refreshed for user ${userId}, plan ${packageId}`);
}

async function handleInvoicePaymentFailed(invoice) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;
  const [subs] = await db.query('SELECT user_id FROM user_subscriptions WHERE stripe_subscription_id = ?', [subscriptionId]);
  if (subs.length === 0) return;
  await db.query('UPDATE user_subscriptions SET status = "past_due" WHERE stripe_subscription_id = ?', [subscriptionId]);
  console.log(`[Stripe Webhook] Subscription past_due for user ${subs[0].user_id}`);
}

async function handleSubscriptionUpdated(subscription) {
  let targetUserId = Number(subscription.metadata?.userId);
  if (!targetUserId) {
    const [rows] = await db.query(
      'SELECT user_id, package_id FROM user_subscriptions WHERE stripe_subscription_id = ?',
      [subscription.id]
    );
    if (!rows.length) return;
    targetUserId = rows[0].user_id;
  }

  const packageId = subscription.metadata?.packageId;
  const [existing] = await db.query('SELECT package_id FROM user_subscriptions WHERE user_id = ?', [targetUserId]);
  const resolvedPackageId = packageId || existing[0]?.package_id || 'Growth';

  await upsertUserSubscription({
    userId: targetUserId,
    packageId: resolvedPackageId,
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    periodStart: new Date(subscription.current_period_start * 1000),
    periodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end
  });
}

async function handleSubscriptionDeleted(subscription) {
  await db.query(
    `UPDATE user_subscriptions SET status = 'canceled', cancel_at_period_end = 1 WHERE stripe_subscription_id = ?`,
    [subscription.id]
  );
}

async function resolveRazorpaySubscriptionContext(subscriptionEntity) {
  const notes = subscriptionEntity.notes || {};
  let userId = Number(notes.userId);
  let packageId = notes.packageId;
  const razorpaySubId = subscriptionEntity.id;

  if (!userId && razorpaySubId) {
    const [rows] = await db.query(
      'SELECT user_id, package_id FROM user_subscriptions WHERE razorpay_subscription_id = ?',
      [razorpaySubId]
    );
    if (rows.length) {
      userId = rows[0].user_id;
      packageId = packageId || rows[0].package_id;
    }
  }

  if (!packageId && subscriptionEntity.plan_id) {
    const [pkgRows] = await db.query(
      'SELECT id, lead_limit FROM packages WHERE razorpay_plan_id = ? LIMIT 1',
      [subscriptionEntity.plan_id]
    );
    if (pkgRows.length) packageId = pkgRows[0].id;
  }

  const pkg = packageId ? await loadActivePackage(packageId) : null;
  const credits = Number(notes.credits) || pkg?.lead_limit || 0;
  return { userId, packageId, credits, pkg };
}

async function syncRazorpaySubscription(subscription, { refreshCredits = false, billingReason = 'initial', paymentId = null } = {}) {
  const { userId, packageId, credits, pkg } = await resolveRazorpaySubscriptionContext(subscription);
  if (!userId || !packageId) return;

  const { periodStart, periodEnd } = razorpayPeriodDates(subscription);
  const mappedStatus = mapRazorpayStatus(subscription.status);

  if (refreshCredits) {
    await refreshSubscriptionCredits(userId, packageId, credits);
  }

  await upsertUserSubscription({
    userId,
    packageId,
    paymentProvider: 'razorpay',
    razorpaySubscriptionId: subscription.id,
    status: mappedStatus,
    periodStart,
    periodEnd,
    cancelAtPeriodEnd: subscription.status === 'cancelled'
  });

  if (refreshCredits && paymentId && !(await invoiceAlreadyProcessed(paymentId))) {
    await recordInvoice({
      userId,
      packageId,
      amountCents: pkg ? Math.round(Number(pkg.price) * 100) : 0,
      credits,
      status: 'paid',
      method: 'razorpay_subscription',
      razorpayPaymentId: paymentId,
      stripeSubscriptionId: subscription.id,
      billingReason
    });
  }

  console.log(`[Razorpay Webhook] ${billingReason} synced for user ${userId}, plan ${packageId}`);
}

async function handleRazorpayWebhookEvent(event) {
  const eventType = event.event;
  const payload = event.payload || {};

  if (eventType === 'subscription.activated' || eventType === 'subscription.authenticated') {
    const sub = payload.subscription?.entity;
    if (sub) await syncRazorpaySubscription(sub, { refreshCredits: true, billingReason: 'initial' });
    return;
  }

  if (eventType === 'subscription.charged') {
    const sub = payload.subscription?.entity;
    const payment = payload.payment?.entity;
    if (sub) {
      const billingReason = Number(sub.paid_count) > 1 ? 'renewal' : 'initial';
      await syncRazorpaySubscription(sub, {
        refreshCredits: true,
        billingReason,
        paymentId: payment?.id || `${sub.id}_${sub.paid_count}`
      });
    }
    return;
  }

  if (eventType === 'subscription.updated') {
    const sub = payload.subscription?.entity;
    if (sub) await syncRazorpaySubscription(sub, { refreshCredits: false });
    return;
  }

  if (eventType === 'subscription.cancelled' || eventType === 'subscription.completed') {
    const sub = payload.subscription?.entity;
    if (sub) {
      await db.query(
        `UPDATE user_subscriptions SET status = 'canceled', cancel_at_period_end = 1
         WHERE razorpay_subscription_id = ?`,
        [sub.id]
      );
    }
    return;
  }

  if (eventType === 'subscription.halted') {
    const sub = payload.subscription?.entity;
    if (sub) {
      await db.query('UPDATE user_subscriptions SET status = "past_due" WHERE razorpay_subscription_id = ?', [sub.id]);
    }
  }
}

router.post('/razorpay-webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = JSON.stringify(req.body);
    if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }
    await handleRazorpayWebhookEvent(req.body);
    res.json({ received: true });
  } catch (error) {
    console.error('[Razorpay Webhook] handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

router.post('/confirm-razorpay', authenticateToken, async (req, res) => {
  const { subscriptionId } = req.body;
  if (!subscriptionId) return res.status(400).json({ error: 'subscriptionId required' });
  if (!getRazorpay()) return res.status(400).json({ error: 'Razorpay not configured' });

  try {
    const subscription = await fetchRazorpaySubscription(subscriptionId);
    const [owned] = await db.query(
      'SELECT user_id FROM user_subscriptions WHERE razorpay_subscription_id = ? AND user_id = ?',
      [subscriptionId, req.user.id]
    );
    if (!owned.length) {
      return res.status(403).json({ error: 'Subscription not found for this user' });
    }

    const isPaid = ['active', 'authenticated'].includes(subscription.status);
    if (!isPaid && subscription.paid_count === 0) {
      return res.status(400).json({ error: 'Subscription payment not completed yet' });
    }

    await syncRazorpaySubscription(subscription, {
      refreshCredits: true,
      billingReason: Number(subscription.paid_count) > 1 ? 'renewal' : 'initial',
      paymentId: `confirm_${subscription.id}_${subscription.paid_count}`
    });

    const { credits } = await resolveRazorpaySubscriptionContext(subscription);
    res.json({ message: 'Subscription confirmed', credits, packageId: subscription.notes?.packageId });
  } catch (error) {
    console.error('Confirm Razorpay error:', error);
    res.status(500).json({ error: 'Server error confirming subscription' });
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(200).json({ received: true, skipped: true });

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    if (webhookSecret && !webhookSecret.toLowerCase().includes('your_') && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event =
        typeof req.body === 'string' || Buffer.isBuffer(req.body)
          ? JSON.parse(req.body.toString())
          : req.body;
    }
  } catch (err) {
    console.error('[Stripe Webhook] signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripe, event.data.object);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(stripe, event.data.object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        break;
    }
    res.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

router.get('/invoices', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Invoices fetch error:', error);
    res.status(500).json({ error: 'Server error fetching invoices' });
  }
});

export default router;
