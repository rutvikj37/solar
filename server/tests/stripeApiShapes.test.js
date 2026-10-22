import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import db from '../db.js';
import {
  getStripeId,
  getInvoiceSubscriptionId,
  getSubscriptionPeriod,
} from '../services/stripeBilling.js';
import {
  handleCheckoutCompleted,
  handleInvoicePaid,
  handleInvoicePaymentFailed,
  handleSubscriptionUpdated,
} from '../routes/billing.js';

const START = 1790000000;
const END = 1792592000;

// Pre-basil shapes (API <= 2025-02-24.acacia)
const legacySubscription = {
  id: 'sub_legacy',
  object: 'subscription',
  customer: 'cus_legacy',
  status: 'active',
  cancel_at_period_end: false,
  current_period_start: START,
  current_period_end: END,
  metadata: { userId: '7', packageId: 'Pro', credits: '100' },
  items: { object: 'list', data: [{ id: 'si_1', price: { id: 'price_1' } }] },
};

const legacyInvoice = {
  id: 'in_legacy',
  object: 'invoice',
  status: 'paid',
  customer: 'cus_legacy',
  subscription: 'sub_legacy',
  payment_intent: 'pi_legacy',
  amount_paid: 4900,
  billing_reason: 'subscription_cycle',
  lines: { data: [{ subscription: 'sub_legacy', period: { start: START, end: END } }] },
};

// 2026-08-26.dahlia snapshot shapes
const dahliaSubscription = {
  id: 'sub_dahlia',
  object: 'subscription',
  customer: 'cus_dahlia',
  status: 'active',
  cancel_at_period_end: false,
  billing_cycle_anchor: START,
  metadata: { userId: '7', packageId: 'Pro', credits: '100' },
  items: {
    object: 'list',
    data: [
      {
        id: 'si_2',
        object: 'subscription_item',
        current_period_start: START,
        current_period_end: END,
        price: { id: 'price_1' },
      },
    ],
  },
};

const dahliaInvoice = {
  id: 'in_dahlia',
  object: 'invoice',
  status: 'paid',
  customer: 'cus_dahlia',
  amount_paid: 4900,
  billing_reason: 'subscription_cycle',
  parent: {
    type: 'subscription_details',
    quote_details: null,
    subscription_details: { subscription: 'sub_dahlia', metadata: { userId: '7', packageId: 'Pro' } },
  },
  lines: {
    data: [
      {
        id: 'il_1',
        parent: {
          type: 'subscription_item_details',
          subscription_item_details: { subscription: 'sub_dahlia', subscription_item: 'si_2' },
        },
        pricing: { price_details: { price: 'price_1', product: 'prod_1' } },
        period: { start: START, end: END },
      },
    ],
  },
};

describe('getStripeId', () => {
  it('handles strings, expanded objects and empties', () => {
    assert.equal(getStripeId('sub_1'), 'sub_1');
    assert.equal(getStripeId({ id: 'sub_2', object: 'subscription' }), 'sub_2');
    assert.equal(getStripeId(null), null);
    assert.equal(getStripeId({}), null);
  });
});

describe('getInvoiceSubscriptionId', () => {
  it('reads legacy invoice.subscription', () => {
    assert.equal(getInvoiceSubscriptionId(legacyInvoice), 'sub_legacy');
  });

  it('reads dahlia invoice.parent.subscription_details.subscription', () => {
    assert.equal(getInvoiceSubscriptionId(dahliaInvoice), 'sub_dahlia');
  });

  it('accepts an expanded subscription object in parent', () => {
    const inv = {
      parent: { type: 'subscription_details', subscription_details: { subscription: { id: 'sub_x' } } },
    };
    assert.equal(getInvoiceSubscriptionId(inv), 'sub_x');
  });

  it('falls back to line item parents', () => {
    const inv = { ...dahliaInvoice, parent: null };
    assert.equal(getInvoiceSubscriptionId(inv), 'sub_dahlia');
  });

  it('returns null for non-subscription invoices', () => {
    assert.equal(getInvoiceSubscriptionId({ id: 'in_1', parent: null, lines: { data: [] } }), null);
    assert.equal(getInvoiceSubscriptionId(null), null);
  });
});

describe('getSubscriptionPeriod', () => {
  it('reads legacy top-level current_period_*', () => {
    const p = getSubscriptionPeriod(legacySubscription);
    assert.equal(p.start.getTime(), START * 1000);
    assert.equal(p.end.getTime(), END * 1000);
  });

  it('reads dahlia items.data[].current_period_*', () => {
    const p = getSubscriptionPeriod(dahliaSubscription);
    assert.equal(p.start.getTime(), START * 1000);
    assert.equal(p.end.getTime(), END * 1000);
  });

  it('returns nulls instead of Invalid Date when absent', () => {
    assert.deepEqual(getSubscriptionPeriod({ id: 'sub', items: { data: [] } }), { start: null, end: null });
    assert.deepEqual(getSubscriptionPeriod(null), { start: null, end: null });
  });
});

describe('webhook handlers with mocked db (legacy + dahlia payloads)', () => {
  let calls;
  let origQuery;

  beforeEach(() => {
    calls = [];
    origQuery = db.query;
    db.query = async (sql, params = []) => {
      calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      if (/^SELECT user_id FROM user_subscriptions WHERE stripe_subscription_id/.test(calls.at(-1).sql)) {
        return [[{ user_id: 7 }], []];
      }
      if (/^SELECT/i.test(calls.at(-1).sql)) return [[], []];
      return [{ insertId: 101, affectedRows: 1 }, []];
    };
  });

  afterEach(() => {
    db.query = origQuery;
  });

  const stripeFor = (sub) => ({
    subscriptions: {
      retrieve: async (id) => {
        assert.equal(id, sub.id);
        return sub;
      },
    },
  });

  const subscriptionInsert = () => calls.find((c) => c.sql.startsWith('INSERT INTO user_subscriptions'));

  for (const [label, invoice, sub] of [
    ['legacy', legacyInvoice, legacySubscription],
    ['dahlia', dahliaInvoice, dahliaSubscription],
  ]) {
    it(`invoice.paid (${label}) records renewal and stores valid period dates`, async () => {
      await handleInvoicePaid(stripeFor(sub), invoice);

      const invInsert = calls.find((c) => c.sql.startsWith('INSERT INTO invoices'));
      assert.ok(invInsert, 'invoice row inserted');
      assert.equal(invInsert.params[2], sub.id);
      assert.equal(invInsert.params[3], invoice.id);

      const ins = subscriptionInsert();
      assert.ok(ins, 'user_subscriptions upserted');
      assert.equal(ins.params[3], sub.customer);
      assert.equal(ins.params[4], sub.id);
      assert.equal(ins.params[7].getTime(), START * 1000);
      assert.equal(ins.params[8].getTime(), END * 1000);
    });

    it(`invoice.payment_failed (${label}) marks past_due`, async () => {
      await handleInvoicePaymentFailed(invoice);
      const upd = calls.find((c) => c.sql.includes('past_due'));
      assert.ok(upd, 'past_due update issued');
      assert.deepEqual(upd.params, [sub.id]);
    });

    it(`customer.subscription.updated (${label}) stores valid period dates`, async () => {
      await handleSubscriptionUpdated(sub);
      const ins = subscriptionInsert();
      assert.ok(ins);
      assert.equal(ins.params[7].getTime(), START * 1000);
      assert.equal(ins.params[8].getTime(), END * 1000);
    });

    it(`checkout.session.completed (${label}) activates subscription with valid period`, async () => {
      const session = {
        id: `cs_${label}`,
        object: 'checkout.session',
        mode: 'subscription',
        customer: sub.customer,
        subscription: sub.id,
        amount_total: 4900,
        metadata: { userId: '7', packageId: 'Pro', credits: '100' },
      };
      await handleCheckoutCompleted(stripeFor(sub), session);
      const ins = subscriptionInsert();
      assert.ok(ins);
      assert.equal(ins.params[7].getTime(), START * 1000);
      assert.equal(ins.params[8].getTime(), END * 1000);
    });
  }

  it('invoice.paid ignores a dahlia one-off invoice with no subscription parent', async () => {
    await handleInvoicePaid(stripeFor(dahliaSubscription), {
      ...dahliaInvoice,
      id: 'in_oneoff',
      parent: null,
      lines: { data: [] },
    });
    assert.equal(calls.filter((c) => c.sql.startsWith('INSERT')).length, 0);
  });
});
