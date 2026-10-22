import db from '../../db.js';
import { adjustWallet, getWalletBalance } from './wallet.js';
import { resolveFrontendBaseUrl } from '../../utils/frontendUrl.js';
import {
  getStripe,
  getBillingCurrency,
  getBillingCurrencySymbol,
  assertSessionBelongsToUser,
} from '../stripeBilling.js';

export const MARKETPLACE_WALLET_PACKS = [
  { id: 'mkt_50', credits: 50, price: 50, label: '$50 wallet' },
  { id: 'mkt_100', credits: 100, price: 100, label: '$100 wallet' },
  { id: 'mkt_250', credits: 250, price: 250, label: '$250 wallet' },
  { id: 'mkt_500', credits: 500, price: 500, label: '$500 wallet' },
];

const KIND = 'marketplace_wallet';

/** Marketplace wallet payment metadata (no secrets). */
export function getMarketplaceWalletPaymentInfo() {
  return {
    currency: getBillingCurrency().toUpperCase(),
    currencySymbol: getBillingCurrencySymbol(),
    paymentProvider: getStripe() ? 'stripe' : 'dev',
  };
}

function frontendBase() {
  return resolveFrontendBaseUrl();
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
  stripeSessionId = null,
  method = 'stripe_marketplace',
}) {
  const creditsNum = Number(credits);
  if (!userId || !Number.isFinite(creditsNum) || creditsNum <= 0) {
    return { skipped: true };
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    let invoice = null;
    if (stripeSessionId) {
      const [rows] = await conn.query(
        `SELECT * FROM invoices WHERE stripe_session_id = ? FOR UPDATE`,
        [stripeSessionId],
      );
      invoice = rows[0] || null;
    }

    if (invoice?.status === 'paid') {
      await conn.commit();
      return { alreadyPaid: true, balance: await getWalletBalance(userId), credits: creditsNum };
    }

    if (invoice && Number(invoice.user_id) !== Number(userId)) {
      await conn.rollback();
      const err = new Error('Invoice does not belong to this user');
      err.status = 403;
      throw err;
    }

    // Prefer credits stored on the pending invoice (server-created) over session metadata.
    const grantCredits = Number(invoice?.credits) > 0 ? Number(invoice.credits) : creditsNum;
    const grantPackId = invoice?.package_id || packId;
    const grantAmountCents =
      Number(invoice?.amount_cents) > 0 ? Number(invoice.amount_cents) : amountCents;

    const result = await adjustWallet({
      userId,
      entryType: 'top_up',
      amount: grantCredits,
      note: `Wallet top-up (${grantPackId || 'custom'})`,
      conn,
    });

    if (invoice) {
      await conn.query(
        `UPDATE invoices SET status = 'paid', credits = ? WHERE id = ? AND status <> 'paid'`,
        [grantCredits, invoice.id],
      );
    } else {
      await conn.query(
        `INSERT INTO invoices
         (user_id, stripe_session_id, package_id, amount_cents, credits,
          status, method, billing_reason, description)
         VALUES (?, ?, ?, ?, ?, 'paid', ?, 'marketplace_wallet', ?)`,
        [
          userId,
          stripeSessionId,
          String(grantPackId || 'mkt_custom').slice(0, 50),
          grantAmountCents,
          grantCredits,
          method,
          'Marketplace wallet top-up',
        ],
      );
    }

    await conn.commit();
    return { alreadyPaid: false, balance: result.balance, credits: grantCredits };
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    if (err && (err.code === 'ER_DUP_ENTRY' || String(err.message || '').includes('Duplicate'))) {
      return { alreadyPaid: true, balance: await getWalletBalance(userId), credits: creditsNum };
    }
    throw err;
  } finally {
    conn.release();
  }
}

export async function fulfillMarketplaceWalletFromStripeSession(session) {
  if (session?.metadata?.kind !== KIND) return false;
  const userId = Number(session.metadata.userId);
  if (!userId) return false;

  // Credits come from the pending invoice when present; metadata is fallback only.
  const credits = Number(session.metadata.credits);
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

export async function createMarketplaceWalletCheckout({ userId, userEmail, userName, packId, amount }) {
  const pack = resolveWalletPack({ packId, amount });
  if (!pack) {
    const err = new Error('Choose a credit pack or an amount between $25 and $5,000');
    err.status = 400;
    throw err;
  }

  const amountCents = Math.round(Number(pack.price) * 100);
  const stripe = getStripe();
  const successUrl = `${frontendBase()}/marketplace?wallet=1`;
  const cancelUrl = `${frontendBase()}/marketplace?wallet=canceled`;
  const currency = getBillingCurrency();

  if (stripe) {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: userEmail || undefined,
      client_reference_id: String(userId),
      line_items: [
        {
          price_data: {
            currency,
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
    const sessionId = `dev_mkt_${userId}_${Date.now()}`;
    await insertPendingInvoice({
      userId,
      packId: pack.id,
      credits: pack.credits,
      amountCents,
      method: 'dev_marketplace',
      stripeSessionId: sessionId,
    });
    const result = await fulfillMarketplaceWalletTopup({
      userId,
      credits: pack.credits,
      packId: pack.id,
      amountCents,
      stripeSessionId: sessionId,
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
    'Stripe not configured. Set STRIPE_SECRET_KEY in server/.env. Marketplace credits are added only after a successful payment.',
  );
  err.status = 503;
  err.code = 'payment_provider';
  throw err;
}

export async function confirmStripeWalletPayment({ userId, sessionId }) {
  const stripe = getStripe();
  if (!stripe) {
    const err = new Error('Stripe not configured');
    err.status = 400;
    throw err;
  }
  if (!sessionId || typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) {
    const err = new Error('Invalid sessionId');
    err.status = 400;
    throw err;
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  assertSessionBelongsToUser(session, userId);

  if (session.metadata?.kind !== KIND) {
    const err = new Error('Not a marketplace wallet checkout session');
    err.status = 400;
    throw err;
  }
  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    const err = new Error('Payment not completed');
    err.status = 400;
    throw err;
  }

  const result = await fulfillMarketplaceWalletFromStripeSession(session);
  if (!result) {
    const err = new Error('Could not fulfill wallet top-up');
    err.status = 400;
    throw err;
  }

  const [invoices] = await db.query(
    `SELECT credits FROM invoices WHERE stripe_session_id = ? AND user_id = ? LIMIT 1`,
    [sessionId, userId],
  );
  const balance = await getWalletBalance(userId);
  return {
    ok: true,
    credits: Number(invoices[0]?.credits) || Number(session.metadata?.credits) || 0,
    balance,
    walletBalance: balance,
  };
}
