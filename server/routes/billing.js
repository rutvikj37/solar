import express from 'express';
import db from '../db.js';
import { authenticateToken, isAdminRole, optionalAuthenticateToken } from '../middleware/auth.js';
import { invoicePdfFilename, renderInvoicePdf } from '../utils/invoicePdf.js';
import { logApiCall } from '../services/apiUsage.js';
import {
  getStripe,
  getActivePaymentProvider,
  getBillingCurrency,
  constructStripeWebhookEvent,
  assertSessionBelongsToUser,
} from '../services/stripeBilling.js';
import { fulfillMarketplaceWalletFromStripeSession } from '../services/marketplace/walletTopup.js';
import { getLedger, getWalletBalance, ensureWallet } from '../services/marketplace/wallet.js';
import { clientErrorMessage } from '../utils/clientError.js';

const router = express.Router();

function allowDevCheckout() {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.ALLOW_DEV_CHECKOUT === '1' || process.env.ALLOW_DEV_CHECKOUT === 'true';
}

function isSubscriptionPackage(pkg) {
  return Number(pkg.is_subscription) === 1 || pkg.billing_interval === 'month';
}

function frontendBase() {
  const raw = process.env.FRONTEND_URL || 'http://localhost:5200';
  return raw.split(',')[0].trim();
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
export async function grantCredits(userId, packageId, credits, conn = db) {
  if (String(packageId || '').startsWith('mkt_')) {
    throw new Error('Marketplace wallet packs must not grant map lead credits');
  }
  // FOR UPDATE only helps inside an explicit transaction (connection !== pool).
  const lockSuffix = conn !== db ? ' FOR UPDATE' : '';
  const [packages] = await conn.query(
    `SELECT id FROM user_packages WHERE user_id = ? AND status = "active" ORDER BY id DESC LIMIT 1${lockSuffix}`,
    [userId]
  );

  if (packages.length > 0) {
    await conn.query(
      `UPDATE user_packages
       SET remaining_leads = remaining_leads + ?, purchased_leads = purchased_leads + ?, package_id = ?
       WHERE id = ?`,
      [credits, credits, packageId, packages[0].id]
    );
  } else {
    await conn.query(
      `INSERT INTO user_packages (user_id, package_id, remaining_leads, purchased_leads, status)
       VALUES (?, ?, ?, ?, 'active')`,
      [userId, packageId, credits, credits]
    );
  }
}

/**
 * Idempotent one-time Stripe credit fulfillment (confirm + webhook).
 * Locks the invoice row so concurrent callers cannot double-grant.
 */
export async function fulfillStripeOneTimeCredits({
  sessionId,
  userId,
  packageId,
  credits,
  amountCents = 0,
  expectedUserId = null,
}) {
  if (!sessionId) return { skipped: true };

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [invoices] = await conn.query(
      `SELECT * FROM invoices WHERE stripe_session_id = ? FOR UPDATE`,
      [sessionId],
    );
    let invoice = invoices[0] || null;

    if (expectedUserId && invoice && Number(invoice.user_id) !== Number(expectedUserId)) {
      await conn.rollback();
      const err = new Error('Invoice does not belong to this user');
      err.status = 403;
      throw err;
    }

    if (invoice?.status === 'paid') {
      await conn.commit();
      return { alreadyPaid: true, invoice };
    }

    const grantUserId = Number(invoice?.user_id || userId);
    const grantPackageId = invoice?.package_id || packageId;
    const grantCreditsAmt = Number(invoice?.credits ?? credits) || 0;

    if (!grantUserId || !grantPackageId || grantCreditsAmt <= 0) {
      await conn.rollback();
      return { skipped: true };
    }

    await grantCredits(grantUserId, grantPackageId, grantCreditsAmt, conn);

    if (invoice) {
      const [upd] = await conn.query(
        `UPDATE invoices SET status = 'paid' WHERE id = ? AND status <> 'paid'`,
        [invoice.id],
      );
      if (upd.affectedRows === 0) {
        await conn.rollback();
        return { alreadyPaid: true, invoice };
      }
    } else {
      await conn.query(
        `INSERT INTO invoices
         (user_id, stripe_session_id, package_id, amount_cents, credits, status, method, billing_reason)
         VALUES (?, ?, ?, ?, ?, 'paid', 'stripe', 'initial')`,
        [grantUserId, sessionId, grantPackageId, amountCents, grantCreditsAmt],
      );
    }

    await conn.commit();
    return {
      alreadyPaid: false,
      credits: grantCreditsAmt,
      packageId: grantPackageId,
      userId: grantUserId,
    };
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    // Concurrent insert of the same stripe_session_id — treat as already fulfilled.
    if (err && (err.code === 'ER_DUP_ENTRY' || String(err.message || '').includes('Duplicate'))) {
      return { alreadyPaid: true };
    }
    throw err;
  } finally {
    conn.release();
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

export async function upsertUserSubscription({
  userId,
  packageId,
  paymentProvider = 'stripe',
  stripeCustomerId,
  stripeSubscriptionId,
  razorpaySubscriptionId = null,
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
         razorpay_subscription_id = COALESCE(?, razorpay_subscription_id), status = ?,
         current_period_start = ?, current_period_end = ?, cancel_at_period_end = ?
       WHERE user_id = ?`,
      [
        packageId,
        paymentProvider,
        stripeCustomerId || null,
        stripeSubscriptionId || null,
        razorpaySubscriptionId,
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

/** Prefer DB package lead_limit over Checkout metadata (metadata is set server-side but package is source of truth). */
async function resolvePackageCredits(packageId, metadataCredits, fallbackCredits = 0) {
  const pkg = packageId ? await loadActivePackage(packageId) : null;
  if (pkg && Number(pkg.lead_limit) > 0) return Number(pkg.lead_limit);
  const fromMeta = Number(metadataCredits);
  if (Number.isFinite(fromMeta) && fromMeta > 0) return fromMeta;
  return Number(fallbackCredits) || 0;
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

export async function recordInvoice({
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
  billingReason = 'initial',
  description = null,
  adminId = null
}) {
  const [inv] = await db.query(
    `INSERT INTO invoices
     (user_id, stripe_session_id, stripe_subscription_id, stripe_invoice_id, razorpay_payment_id,
      package_id, amount_cents, credits, status, method, billing_reason, description, admin_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      billingReason,
      description,
      adminId
    ]
  );
  return inv.insertId;
}

const INVOICE_DETAIL_SELECT = `
  SELECT i.*, admin_user.name AS admin_name, admin_user.email AS admin_email,
         pkg.name AS package_name, pkg.price AS package_price
  FROM invoices i
  LEFT JOIN users admin_user ON admin_user.id = i.admin_id
  LEFT JOIN packages pkg ON pkg.id = i.package_id
`;

export async function listUserInvoices(userId, limit = 50) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const [rows] = await db.query(
    `${INVOICE_DETAIL_SELECT}
     WHERE i.user_id = ?
     ORDER BY i.created_at DESC
     LIMIT ${safeLimit}`,
    [userId]
  );
  return rows;
}

export async function getInvoiceById(invoiceId) {
  const [rows] = await db.query(
    `${INVOICE_DETAIL_SELECT}
     WHERE i.id = ?
     LIMIT 1`,
    [invoiceId]
  );
  return rows[0] || null;
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
    currency: getBillingCurrency().toUpperCase(),
  });
});

// Public/active packages for purchase UI (exclude Free); ?all=1 requires admin
router.get('/packages', optionalAuthenticateToken, async (req, res) => {
  try {
    const adminAll = req.query.all === '1';
    if (adminAll && (!req.user || !isAdminRole(req.user.role))) {
      return res.status(403).json({ error: 'Admin access required' });
    }
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
  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe is not configured' });
  }
  try {
    const customerId = await ensureStripeCustomer(stripe, req.user.id);
    if (!customerId) {
      return res.status(400).json({ error: 'Unable to resolve billing customer' });
    }
    const frontendUrl = frontendBase();
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

    if (sub.stripe_subscription_id && getStripe()) {
      const stripe = getStripe();
      await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: true });
      await db.query('UPDATE user_subscriptions SET cancel_at_period_end = 1 WHERE user_id = ?', [req.user.id]);
      return res.json({ message: 'Subscription will cancel at end of billing period.' });
    }

    res.status(400).json({ error: 'Subscription cannot be canceled via API. Use Manage billing to open the Stripe portal.' });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

router.post('/checkout', authenticateToken, async (req, res) => {
  const { packageId } = req.body;
  const pkg = await loadActivePackage(packageId);
  if (!pkg || pkg.id === 'Free' || Number(pkg.price) <= 0 || Number(pkg.is_active) === 0) {
    return res.status(400).json({ error: 'Invalid or inactive package' });
  }

  const [accountRows] = await db.query('SELECT account_status FROM users WHERE id = ?', [req.user.id]);
  if (accountRows[0]?.account_status === 'restricted') {
    return res.status(403).json({
      error: 'Your plan is restricted. Contact support to change or upgrade your plan.'
    });
  }

  const credits = Number(pkg.lead_limit) || 0;
  const amountCents = Math.round(Number(pkg.price) * 100);
  const frontendUrl = frontendBase();
  const stripe = getStripe();
  const started = Date.now();
  const subscriptionMode = isSubscriptionPackage(pkg);
  const currency = getBillingCurrency();

  try {
    if (!stripe) {
      if (!allowDevCheckout()) {
        return res.status(503).json({
          error: 'Payment not configured. Set STRIPE_SECRET_KEY or ALLOW_DEV_CHECKOUT=1 for local testing.'
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
    const userMeta = {
      userId: String(req.user.id),
      packageId: pkg.id,
      credits: String(credits),
    };

    if (subscriptionMode) {
      if (!pkg.stripe_price_id) {
        return res.status(400).json({
          error: 'This plan requires a Stripe recurring Price ID. Ask an admin to configure stripe_price_id.'
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        client_reference_id: String(req.user.id),
        payment_method_types: ['card'],
        line_items: [{ price: pkg.stripe_price_id, quantity: 1 }],
        metadata: userMeta,
        subscription_data: {
          metadata: userMeta,
        },
        success_url: `${frontendUrl}/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/billing?canceled=1#plans`
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
            currency,
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
      client_reference_id: String(req.user.id),
      payment_method_types: ['card'],
      line_items: [lineItem],
      metadata: userMeta,
      success_url: `${frontendUrl}/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/billing?canceled=1#plans`
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
    res.status(error.status || 500).json({
      error: clientErrorMessage(error, 'Server error creating checkout'),
    });
  }
});

router.post('/confirm', authenticateToken, async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId || typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) {
    return res.status(400).json({ error: 'Valid Stripe sessionId required' });
  }

  const stripe = getStripe();
  if (!stripe) return res.status(400).json({ error: 'Stripe not configured' });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    assertSessionBelongsToUser(session, req.user.id);

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

    const packageId = session.metadata?.packageId || invoice.package_id;
    const credits = await resolvePackageCredits(packageId, session.metadata?.credits, invoice.credits);

    if (session.mode === 'subscription' && session.subscription) {
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      const periodStart = new Date(subscription.current_period_start * 1000);
      const periodEnd = new Date(subscription.current_period_end * 1000);

      await setSubscriptionCredits(req.user.id, packageId, credits);
      await upsertUserSubscription({
        userId: req.user.id,
        packageId,
        paymentProvider: 'stripe',
        stripeCustomerId: session.customer,
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
        periodStart,
        periodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      });
      await db.query(
        `UPDATE invoices SET status = 'paid', stripe_subscription_id = ?, credits = ?, billing_reason = 'initial' WHERE id = ? AND status <> 'paid'`,
        [subscription.id, credits, invoice.id]
      );
      return res.json({ message: 'Credits granted', credits, packageId });
    }

    const fulfilled = await fulfillStripeOneTimeCredits({
      sessionId,
      userId: req.user.id,
      packageId,
      credits,
      expectedUserId: req.user.id,
    });
    if (fulfilled.alreadyPaid) {
      return res.json({ message: 'Already fulfilled', invoice });
    }
    res.json({
      message: 'Credits granted',
      credits: fulfilled.credits ?? credits,
      packageId: fulfilled.packageId ?? packageId,
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(error.status || 500).json({
      error: error.status === 403 || error.status === 400 ? error.message : 'Server error confirming payment',
    });
  }
});

async function handleCheckoutCompleted(stripe, session) {
  if (await fulfillMarketplaceWalletFromStripeSession(session)) {
    console.log(`[Stripe Webhook] Marketplace wallet topped up for user ${session.metadata?.userId}`);
    return;
  }

  const userId = Number(session.metadata?.userId);
  const packageId = session.metadata?.packageId;
  if (!userId || !packageId) return;

  const credits = await resolvePackageCredits(packageId, session.metadata?.credits);

  if (session.mode === 'subscription' && session.subscription) {
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    const periodStart = new Date(subscription.current_period_start * 1000);
    const periodEnd = new Date(subscription.current_period_end * 1000);

    await setSubscriptionCredits(userId, packageId, credits);
    await upsertUserSubscription({
      userId,
      packageId,
      paymentProvider: 'stripe',
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
        `UPDATE invoices SET status = 'paid', stripe_subscription_id = ?, credits = ?, billing_reason = 'initial' WHERE id = ?`,
        [subscription.id, credits, invoices[0].id]
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
  if (invoices.length > 0 || (userId && packageId)) {
    const result = await fulfillStripeOneTimeCredits({
      sessionId: session.id,
      userId,
      packageId,
      credits,
      amountCents: session.amount_total || 0,
      expectedUserId: userId,
    });
    if (!result.skipped && !result.alreadyPaid) {
      console.log(`[Stripe Webhook] Fulfilled one-time credits for user ${result.userId}`);
    }
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

  const credits = await resolvePackageCredits(packageId, subscription.metadata?.credits);
  const billingReason = invoice.billing_reason === 'subscription_create' ? 'initial' : 'renewal';

  await refreshSubscriptionCredits(userId, packageId, credits);
  await upsertUserSubscription({
    userId,
    packageId,
    paymentProvider: 'stripe',
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
    paymentProvider: 'stripe',
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

router.post('/webhook', async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(200).json({ received: true, skipped: true });

  const sig = req.headers['stripe-signature'];
  const rawBody = req.rawBody || req.body;

  let event;
  try {
    event = constructStripeWebhookEvent(stripe, rawBody, sig);
  } catch (err) {
    console.error('[Stripe Webhook] signature error:', err.message);
    return res.status(err.status || 400).json({
      error: err.code === 'webhook_not_configured' ? 'Webhook not configured' : 'Webhook signature verification failed',
    });
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
    const rows = await listUserInvoices(req.user.id, 50);
    res.json(rows);
  } catch (error) {
    console.error('Invoices fetch error:', error);
    res.status(500).json({ error: 'Server error fetching invoices' });
  }
});

router.get('/marketplace-wallet', authenticateToken, async (req, res) => {
  try {
    await ensureWallet(req.user.id);
    const balance = await getWalletBalance(req.user.id);
    const ledger = await getLedger(req.user.id, { limit: 50 });
    res.json({ balance, ledger });
  } catch (error) {
    console.error('Marketplace wallet billing fetch error:', error);
    res.status(500).json({ error: 'Server error fetching bid wallet history' });
  }
});

router.get('/invoices/:id', authenticateToken, async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      return res.status(400).json({ error: 'Invalid invoice id' });
    }
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const isOwner = Number(invoice.user_id) === Number(req.user.id);
    if (!isOwner && !isAdminRole(req.user.role)) {
      return res.status(403).json({ error: 'Not allowed to view this invoice' });
    }
    res.json(invoice);
  } catch (error) {
    console.error('Invoice fetch error:', error);
    res.status(500).json({ error: 'Server error fetching invoice' });
  }
});

router.get('/invoices/:id/pdf', authenticateToken, async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      return res.status(400).json({ error: 'Invalid invoice id' });
    }
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const isOwner = Number(invoice.user_id) === Number(req.user.id);
    if (!isOwner && !isAdminRole(req.user.role)) {
      return res.status(403).json({ error: 'Not allowed to view this invoice' });
    }

    const [users] = await db.query(
      'SELECT name, email, company_name FROM users WHERE id = ? LIMIT 1',
      [invoice.user_id]
    );

    const download = req.query.download === '1' || String(req.query.download).toLowerCase() === 'true';
    const buffer = await renderInvoicePdf(invoice, users[0] || {});
    const filename = invoicePdfFilename(invoice.id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  } catch (error) {
    console.error('Invoice PDF error:', error);
    res.status(500).json({ error: 'Server error generating invoice PDF' });
  }
});

export default router;
