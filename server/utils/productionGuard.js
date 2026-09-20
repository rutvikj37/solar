import { logger } from './logger.js';
import { isPlatformEmailConfigured } from '../services/outreachDelivery.js';
import { resolveFrontendBaseUrl, parseFrontendOrigins } from './frontendUrl.js';

const REQUIRED_IN_PRODUCTION = [
  'JWT_SECRET',
  'DB_PASSWORD',
  'FRONTEND_URL',
  'PUBLIC_URL',
];

const FORBIDDEN_IN_PRODUCTION = [
  { key: 'ALLOW_DEV_CHECKOUT', values: ['1', 'true'] },
  { key: 'ALLOW_ADMIN_BOOTSTRAP', values: ['1', 'true'] },
  { key: 'ALLOW_BOOTSTRAP_SUPER_ADMIN', values: ['1', 'true'] },
  { key: 'ALLOW_EMAIL_SIMULATION', values: ['1', 'true'] },
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
    ['STRIPE_WEBHOOK_SECRET', process.env.STRIPE_WEBHOOK_SECRET],
  ];
  for (const [name, value] of webhookSecrets) {
    const v = String(value || '').trim().toLowerCase();
    if (!v || v.includes('your_')) {
      logger.warn(`Production warning: ${name} is missing or placeholder — Stripe webhooks will reject unsigned payloads`);
    }
  }

  const stripeKey = String(process.env.STRIPE_SECRET_KEY || '').trim().toLowerCase();
  if (!stripeKey || stripeKey.includes('your_')) {
    logger.warn('Production warning: STRIPE_SECRET_KEY is missing or placeholder — payments will be unavailable');
  }

  if (!process.env.TWILIO_AUTH_TOKEN || String(process.env.TWILIO_AUTH_TOKEN).toLowerCase().includes('your_')) {
    logger.warn('Production warning: TWILIO_AUTH_TOKEN missing — Twilio webhooks will be rejected');
  }

  if (!isPlatformEmailConfigured()) {
    logger.warn(
      'Production warning: platform email is not configured — signup / verify / forgot-password will fail closed until SES or Resend/SendGrid is set',
    );
  }

  const origins = parseFrontendOrigins();
  const hasLocalhost = origins.some((o) => /localhost|127\.0\.0\.1/i.test(o));
  if (hasLocalhost) {
    logger.warn(
      'Production warning: FRONTEND_URL includes localhost — auth email links will use a non-local origin when possible',
      { resolvedEmailLinkBase: resolveFrontendBaseUrl() },
    );
  }
}
