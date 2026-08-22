import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyRazorpayWebhookSignature } from '../services/razorpayBilling.js';
import { assertSafeOutboundUrl } from '../utils/safeOutboundUrl.js';

describe('verifyRazorpayWebhookSignature', () => {
  const originalEnv = process.env;

  it('rejects missing signature when secret is configured in production', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      RAZORPAY_WEBHOOK_SECRET: 'prod_webhook_secret_value_1234567890',
    };
    const body = Buffer.from('{"event":"payment.captured"}');
    assert.equal(verifyRazorpayWebhookSignature(body, ''), false);
    process.env = originalEnv;
  });

  it('accepts valid HMAC signature', () => {
    const secret = 'test_webhook_secret_abcdefghijklmnop';
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      RAZORPAY_WEBHOOK_SECRET: secret,
    };
    const body = Buffer.from('{"event":"payment.captured","id":"evt_1"}');
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
    assert.equal(verifyRazorpayWebhookSignature(body, signature), true);
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
