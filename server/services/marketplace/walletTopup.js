import Stripe from 'stripe';
import db from '../../db.js';
import { adjustWallet, getWalletBalance } from './wallet.js';
import {
  getRazorpay,
  getRazorpayKeyId,
  getBillingCurrency,
  getBillingCurrencySymbol,
  verifyRazorpayPaymentSignature,
  createRazorpayOrder,
} from '../razorpayBilling.js';

export const MARKETPLACE_WALLET_PACKS = [
  { id: 'mkt_50', credits: 50, price: 50, label: '$50 wallet' },
  { id: 'mkt_100', credits: 100, price: 100, label: '$100 wallet' },
  { id: 'mkt_250', credits: 250, price: 250, label: '$250 wallet' },
  { id: 'mkt_500', credits: 500, price: 500, label: '$500 wallet' },
];

const KIND = 'marketplace_wallet';

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.trim() === '' || key.toLowerCase().includes('your_')) return null;
  return new Stripe(key);
}

export function isMarketplaceRazorpayConfigured() {
  return Boolean(getRazorpay());
}

/** Marketplace wallet payment metadata (Razorpay-only, no secrets). */
export function getMarketplaceWalletPaymentInfo() {
  return {
    currency: getBillingCurrency(),
    currencySymbol: getBillingCurrencySymbol(),
    razorpayAvailable: Boolean(getRazorpay()),
    paymentProvider: 'razorpay',
  };
}

function frontendBase() {
  const raw = process.env.FRONTEND_URL || 'http://localhost:5200';
  return raw.split(',')[0].trim();
}

function allowDevCheckout() {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.ALLOW_DEV_CHECKOUT === '1' || process.env.ALLOW_DEV_CHECKOUT === 'true';
}

export function resolveWalletPack({ packId, amount } = {}) {
  if (packId) {
    const pack = MARKETPLACE_WALLET_PACKS.find((p) => p.id === packId);
    if (pack) return pack;
  }
  const dollars = Number(amount);
  if (!Number.isFinite(dollars) || dollars < 25 || dollars > 5000) return null;
  const credits = Math.round(dollars);
  return {
    id: `mkt_custom_${credits}`,
    credits,
    price: credits,
    label: `$${credits}`,
  };
}

async function insertPendingInvoice({
  userId,
  packId,
  credits,
  amountCents,
  method,
  stripeSessionId = null,
  description = 'Marketplace wallet top-up',
}) {
  const [inv] = await db.query(
    `INSERT INTO invoices
     (user_id, stripe_session_id, package_id, amount_cents, credits, status, method,
      billing_reason, description)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, 'marketplace_wallet', ?)`,
    [userId, stripeSessionId, String(packId).slice(0, 50), amountCents, credits, method, description],
  );
  return inv.insertId;
}

/**
 * Credit marketplace_wallets (not map-unlock remaining_leads). Idempotent.
 */
export async function fulfillMarketplaceWalletTopup({
  userId,
  credits,
  packId,
  amountCents = 0,
  orderId = null,
  paymentId = null,
  stripeSessionId = null,
  method = 'razorpay_marketplace',
}) {
  const creditsNum = Number(credits);
  if (!userId || !Number.isFinite(creditsNum) || creditsNum <= 0) {
    return { skipped: true };
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    let invoice = null;
    if (paymentId) {
      const [rows] = await conn.query(
        `SELECT * FROM invoices WHERE razorpay_payment_id = ? FOR UPDATE`,
        [paymentId],
      );
      invoice = rows[0] || null;
    }
    if (!invoice) {
      const sessionKey = stripeSessionId || orderId;
      if (sessionKey) {
        const [rows] = await conn.query(
          `SELECT * FROM invoices WHERE stripe_session_id = ? FOR UPDATE`,
          [sessionKey],
        );
        invoice = rows[0] || null;
      }
    }

    if (invoice?.status === 'paid') {
      await conn.commit();
      return { alreadyPaid: true, balance: await getWalletBalance(userId), credits: creditsNum };
    }

    const result = await adjustWallet({
      userId,
      entryType: 'top_up',
      amount: creditsNum,
      note: `Wallet top-up (${packId || 'custom'})`,
      conn,
    });

    if (invoice) {
      await conn.query(
        `UPDATE invoices SET status = 'paid', credits = ?,
           razorpay_payment_id = COALESCE(?, razorpay_payment_id)
         WHERE id = ?`,
        [creditsNum, paymentId, invoice.id],
      );
    } else {
      await conn.query(
        `INSERT INTO invoices
         (user_id, stripe_session_id, razorpay_payment_id, package_id, amount_cents, credits,
          status, method, billing_reason, description)
         VALUES (?, ?, ?, ?, ?, ?, 'paid', ?, 'marketplace_wallet', ?)`,
        [
          userId,
          stripeSessionId || orderId,
          paymentId,
          String(packId || 'mkt_custom').slice(0, 50),
          amountCents,
          creditsNum,
          method,
          'Marketplace wallet top-up',
        ],
      );
    }

    await conn.commit();
    return { alreadyPaid: false, balance: result.balance, credits: creditsNum };
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    conn.release();
  }
}

export async function fulfillMarketplaceWalletFromStripeSession(session) {
  if (session?.metadata?.kind !== KIND) return false;
  const userId = Number(session.metadata.userId);
  const credits = Number(session.metadata.credits);
  if (!userId || !credits) return false;
  await fulfillMarketplaceWalletTopup({
    userId,
    credits,
    packId: session.metadata.packId,
    amountCents: session.amount_total || Math.round(credits * 100),
    stripeSessionId: session.id,
    method: 'stripe_marketplace',
  });
  return true;
}

export async function fulfillMarketplaceWalletFromRazorpayPayment(payment) {
  if (!payment) return false;
  let notes = payment.notes || {};
  if (notes.kind !== KIND && payment.order_id) {
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
  if (notes.kind !== KIND && notes.kind !== 'marketplace_wallet') return false;
  const userId = Number(notes.userId);
  const credits = Number(notes.credits);
  if (!userId || !credits) return false;
  await fulfillMarketplaceWalletTopup({
    userId,
    credits,
    packId: notes.packId,
    amountCents: payment.amount,
    orderId: payment.order_id,
    paymentId: payment.id,
    method: 'razorpay_marketplace',
  });
  return true;
}

export async function createMarketplaceWalletCheckout({ userId, userEmail, userName, packId, amount }) {
  const pack = resolveWalletPack({ packId, amount });
  if (!pack) {
    const err = new Error('Choose a credit pack or an amount between $25 and $5,000');
    err.status = 400;
    throw err;
  }

  const amountCents = Math.round(Number(pack.price) * 100);
  const razorpay = getRazorpay();
  const stripe = getStripe();
  const successUrl = `${frontendBase()}/marketplace?wallet=1`;
  const cancelUrl = `${frontendBase()}/marketplace?wallet=canceled`;

  // Never credit marketplace_wallets here. Credits are applied only after
  // verified Razorpay signature confirm or webhook.
  if (razorpay) {
    const order = await createRazorpayOrder({
      amount: amountCents,
      currency: getBillingCurrency(),
      receipt: `mktw_${userId}_${Date.now()}`.slice(0, 40),
      notes: {
        kind: KIND,
        userId: String(userId),
        packId: pack.id,
        credits: String(pack.credits),
      },
    });
    await insertPendingInvoice({
      userId,
      packId: pack.id,
      credits: pack.credits,
      amountCents,
      method: 'razorpay_marketplace',
      stripeSessionId: order.id,
    });
    return {
      mode: 'razorpay',
      orderId: order.id,
      amount: amountCents,
      currency: getBillingCurrency(),
      currencySymbol: getBillingCurrencySymbol(),
      keyId: getRazorpayKeyId(),
      pack,
      prefill: { email: userEmail || '', name: userName || '' },
    };
  }

  if (stripe) {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: userEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `SpaceToRoof marketplace credits (${pack.credits})`,
              description: 'Adds bid balance to your marketplace wallet (not map unlock credits).',
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        kind: KIND,
        userId: String(userId),
        packId: pack.id,
        credits: String(pack.credits),
      },
      success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
    });
    await insertPendingInvoice({
      userId,
      packId: pack.id,
      credits: pack.credits,
      amountCents,
      method: 'stripe_marketplace',
      stripeSessionId: session.id,
    });
    return { mode: 'stripe', sessionId: session.id, url: session.url, pack };
  }

  if (allowDevCheckout()) {
    await insertPendingInvoice({
      userId,
      packId: pack.id,
      credits: pack.credits,
      amountCents,
      method: 'dev_marketplace',
      stripeSessionId: `dev_mkt_${userId}_${Date.now()}`,
    });
    const result = await fulfillMarketplaceWalletTopup({
      userId,
      credits: pack.credits,
      packId: pack.id,
      amountCents,
      method: 'dev_marketplace',
    });
    return {
      mode: 'dev',
      pack,
      balance: result.balance,
      credits: pack.credits,
    };
  }

  const err = new Error(
    'Razorpay not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env. Marketplace credits are added only after a successful payment.',
  );
  err.status = 400;
  throw err;
}

export async function confirmRazorpayWalletPayment({
  userId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) {
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    const err = new Error('Missing Razorpay payment fields');
    err.status = 400;
    throw err;
  }
  if (!verifyRazorpayPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
    const err = new Error('Invalid payment signature');
    err.status = 400;
    throw err;
  }

  const [invoices] = await db.query(
    `SELECT * FROM invoices WHERE stripe_session_id = ? AND user_id = ?`,
    [razorpayOrderId, userId],
  );
  const invoice = invoices[0];
  if (!invoice) {
    const err = new Error('Wallet order not found');
    err.status = 404;
    throw err;
  }

  return fulfillMarketplaceWalletTopup({
    userId,
    credits: invoice.credits,
    packId: invoice.package_id,
    amountCents: invoice.amount_cents,
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    method: 'razorpay_marketplace',
  });
}

export async function confirmStripeWalletPayment({ userId, sessionId }) {
  const stripe = getStripe();
  if (!stripe) {
    const err = new Error('Stripe not configured');
    err.status = 400;
    throw err;
  }
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (Number(session.metadata?.userId) !== Number(userId)) {
    const err = new Error('Session does not belong to this user');
    err.status = 403;
    throw err;
  }
  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    const err = new Error('Payment not completed');
    err.status = 400;
    throw err;
  }
  await fulfillMarketplaceWalletFromStripeSession(session);
  return { ok: true, credits: Number(session.metadata?.credits) || 0 };
}
