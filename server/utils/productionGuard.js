import { logger } from './logger.js';

const REQUIRED_IN_PRODUCTION = [
  'JWT_SECRET',
  'DB_PASSWORD',
  'FRONTEND_URL',
  'PUBLIC_URL',
];

const FORBIDDEN_IN_PRODUCTION = [
  { key: 'ALLOW_DEV_CHECKOUT', values: ['1', 'true'] },
  { key: 'ALLOW_ADMIN_BOOTSTRAP', values: ['1', 'true'] },
];

export function validateProductionSecurityConfig() {
  if (process.env.NODE_ENV !== 'production') return;

  const missing = REQUIRED_IN_PRODUCTION.filter((key) => !String(process.env[key] || '').trim());
  if (missing.length) {
    logger.error('Missing required production env vars', { missing });
    process.exit(1);
  }

  for (const { key, values } of FORBIDDEN_IN_PRODUCTION) {
    const val = String(process.env[key] || '').trim().toLowerCase();
    if (values.includes(val)) {
      logger.error(`Forbidden production env: ${key} must not be enabled`);
      process.exit(1);
    }
  }

  const webhookSecrets = [
    ['RAZORPAY_WEBHOOK_SECRET', process.env.RAZORPAY_WEBHOOK_SECRET],
    ['STRIPE_WEBHOOK_SECRET', process.env.STRIPE_WEBHOOK_SECRET],
  ];
  for (const [name, value] of webhookSecrets) {
    const v = String(value || '').trim().toLowerCase();
    if (!v || v.includes('your_')) {
      logger.warn(`Production warning: ${name} is missing or placeholder — payment webhooks will reject unsigned payloads`);
    }
  }

  if (!process.env.TWILIO_AUTH_TOKEN || String(process.env.TWILIO_AUTH_TOKEN).toLowerCase().includes('your_')) {
    logger.warn('Production warning: TWILIO_AUTH_TOKEN missing — Twilio webhooks will be rejected');
  }
}
