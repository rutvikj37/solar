import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSessionBelongsToUser,
  getActivePaymentProvider,
  isStripeConfigured,
} from '../services/stripeBilling.js';
import { assertSafeOutboundUrl } from '../utils/safeOutboundUrl.js';

describe('assertSessionBelongsToUser', () => {
  it('accepts matching metadata.userId', () => {
    assert.doesNotThrow(() =>
      assertSessionBelongsToUser({ metadata: { userId: '42' } }, 42),
    );
  });

  it('rejects mismatched metadata.userId', () => {
    assert.throws(
      () => assertSessionBelongsToUser({ metadata: { userId: '1' } }, 42),
      /does not belong/,
    );
  });

  it('rejects session with no user binding', () => {
    assert.throws(
      () => assertSessionBelongsToUser({ metadata: {} }, 42),
      /missing user binding/,
    );
  });
});

describe('getActivePaymentProvider', () => {
  const originalEnv = process.env;

  it('returns null when Stripe is not configured', () => {
    process.env = { ...originalEnv, STRIPE_SECRET_KEY: '' };
    assert.equal(isStripeConfigured(), false);
    assert.equal(getActivePaymentProvider(), null);
    process.env = originalEnv;
  });

  it('returns stripe when secret key is set', () => {
    process.env = { ...originalEnv, STRIPE_SECRET_KEY: 'sk_test_valid_looking_key_12345' };
    assert.equal(getActivePaymentProvider(), 'stripe');
    process.env = originalEnv;
  });
});

describe('assertSafeOutboundUrl', () => {
  it('rejects non-HTTPS URLs', async () => {
    await assert.rejects(() => assertSafeOutboundUrl('http://example.com/hook'), /HTTPS/);
  });

  it('rejects localhost', async () => {
    await assert.rejects(() => assertSafeOutboundUrl('https://localhost/hook'), /not allowed/);
  });

  it('accepts public HTTPS URLs without private DNS resolution', async () => {
    const url = await assertSafeOutboundUrl('https://8.8.8.8/hook');
    assert.equal(url.protocol, 'https:');
  });
});
