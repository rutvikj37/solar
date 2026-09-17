import './loadEnv.js';
import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import db from './db.js';
import { migrateSchema } from './schema.js';
import { ensurePlatformCrmSettingsLoaded } from './services/crm/platformCrmSettings.js';
import { ensurePlatformEmailSettingsLoaded } from './services/email/platformEmailSettings.js';
import { errorHandler } from './middleware/errorHandler.js';
import { coopHeadersMiddleware, COOP_ALLOW_POPUPS } from './middleware/coopHeaders.js';
import { mountFirebaseAuthProxy } from './routes/firebaseAuthProxy.js';
import { handleMediaStreamConnection } from './services/ai-calling/realtimeVoiceAgent.js';

import authRoutes from './routes/auth.js';
import propertyRoutes from './routes/properties.js';
import leadRoutes from './routes/leads.js';
import crmRoutes from './routes/crm.js';
import crmIntegrationsRoutes from './routes/crmIntegrations.js';
import emailIntegrationsRoutes from './routes/emailIntegrations.js';
import emailUsageRoutes from './routes/emailUsage.js';
import billingRoutes from './routes/billing.js';
import outreachRoutes from './routes/outreach.js';
import appointmentRoutes from './routes/appointments.js';
import adminRoutes from './routes/admin.js';
import ticketRoutes from './routes/tickets.js';
import marketingRoutes from './routes/marketing.js';

import presetRoutes from './routes/presets.js';
import dripRoutes from './routes/drip.js';
import teamRoutes from './routes/team.js';
import aiCallingRoutes from './routes/ai-calling.js';
import proposalRoutes from './routes/proposals.js';
import pipelineRoutes from './routes/pipeline.js';
import marketplaceRoutes from './routes/marketplace.js';
import marketplaceAdminRoutes from './routes/marketplace-admin.js';
import { startDialerWorker, stopDialerWorker } from './services/ai-calling/dialerWorker.js';
import { startDripWorker, stopDripWorker } from './services/drip/dripWorker.js';
import {
  startMarketplaceWorker,
  stopMarketplaceWorker,
} from './services/marketplace/marketplaceWorker.js';
import { BRAND_LOG_PREFIX } from './config/brand.js';
import { loadFirebaseWebConfig } from './services/firebaseWebConfig.js';
import { isFirebaseAdminConfigured } from './firebase.js';
import { validateProductionSecurityConfig } from './utils/productionGuard.js';
import { logger } from './utils/logger.js';

validateProductionSecurityConfig();

const isProd = process.env.NODE_ENV === 'production';

if (
  !process.env.FIREBASE_PROJECT_ID ||
  !process.env.FIREBASE_CLIENT_EMAIL ||
  !process.env.FIREBASE_PRIVATE_KEY
) {
  console.warn(
    '[Firebase] Admin credentials missing (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY). Social login is disabled.',
  );
}

const app = express();
const PORT = process.env.PORT || 5002;
const BIND_HOST = process.env.BIND_HOST || '0.0.0.0';

// Trust a fixed number of proxy hops so req.ip / express-rate-limit honor X-Forwarded-For
// behind nginx. Prefer hop count (e.g. 1) over `true` to avoid client IP spoofing.
// TRUST_PROXY: unset → 1 in production, false in dev; or 0/false/off, true→1, or integer hops.
function resolveTrustProxy() {
  const raw = process.env.TRUST_PROXY;
  if (raw === undefined || String(raw).trim() === '') {
    if (isProd) return 1;
    const publicUrl = String(process.env.PUBLIC_URL || '').trim();
    if (publicUrl.startsWith('https://')) return 1;
    return false;
  }
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === 'false' || normalized === '0' || normalized === 'off') {
    return false;
  }
  if (normalized === 'true') {
    return 1;
  }
  const hops = Number(raw);
  if (Number.isInteger(hops) && hops >= 0) {
    return hops;
  }
  return isProd ? 1 : false;
}
const trustProxy = resolveTrustProxy();
if (trustProxy !== false) {
  app.set('trust proxy', trustProxy);
}

const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.length === 0) return !isProd;
  if (allowedOrigins.includes(origin)) return true;
  // Allow www ↔ apex for configured FRONTEND_URL hosts
  try {
    const incoming = new URL(origin);
    for (const allowed of allowedOrigins) {
      try {
        const a = new URL(allowed);
        const inHost = incoming.hostname.replace(/^www\./, '');
        const aHost = a.hostname.replace(/^www\./, '');
        if (incoming.protocol === a.protocol && inHost === aHost) return true;
      } catch {
        /* ignore bad FRONTEND_URL entry */
      }
    }
  } catch {
    return false;
  }
  // Local Vite ports change often (5173, 5176, 5200, …)
  if (!isProd) {
    try {
      const url = new URL(origin);
      if (
        (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
        (url.protocol === 'http:' || url.protocol === 'https:')
      ) {
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
}

app.use(
  helmet({
    contentSecurityPolicy: isProd
      ? {
          useDefaults: true,
          directives: {
            defaultSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'none'"],
          },
        }
      : false,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: isProd
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    // same-origin logs COOP errors on Google redirect return (window.closed).
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(coopHeadersMiddleware);
app.use((_req, res, next) => {
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=*, usb=()'
  );
  next();
});

// Firebase /__/auth/* proxy must run before express.json() (no body parsing).
mountFirebaseAuthProxy(app);

app.use(
  cors({
    origin(origin, cb) {
      if (isAllowedOrigin(origin)) return cb(null, true);
      // false (not Error) so preflight still gets CORS headers / clean deny
      return cb(null, false);
    },
    credentials: false,
  })
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use('/api/', globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/firebase', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth/resend-verification', authLimiter);

app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => {
    if (
      req.originalUrl.startsWith('/api/billing/webhook')
    ) {
      req.rawBody = buf;
    }
  },
}));
app.use(express.urlencoded({ extended: true }));

app.get('/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    logger.error('Health check DB failure', { error: err.message });
    res.status(503).json({
      status: 'degraded',
      db: 'unavailable',
      ...(isProd ? {} : { error: err.message }),
    });
  }
});

// Browser Maps key — restrict GOOGLE_MAPS_API_KEY in Google Cloud Console to HTTP referrers
// (your FRONTEND_URL hosts only). Prefer a separate browser key from server geocoding keys.
// In production, only return the key when Origin/Referer matches FRONTEND_URL (homeowner forms
// are same-site; authenticated app also sends Origin). Never log this value.
function canExposeMapsBrowserKey(req) {
  if (process.env.NODE_ENV !== 'production') return true;
  const allowed = String(process.env.FRONTEND_URL || '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (!allowed.length) return false;
  const origin = String(req.get('origin') || '').replace(/\/$/, '');
  const referer = String(req.get('referer') || '');
  return allowed.some(
    (base) => origin === base || referer === base || referer.startsWith(`${base}/`),
  );
}

app.get('/api/config', (req, res) => {
  const key = String(
    process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '',
  ).trim();
  const configured =
    key && !key.toLowerCase().includes('your_') ? key : '';
  const googleMapsApiKey =
    configured && canExposeMapsBrowserKey(req) ? configured : '';
  res.json({ googleMapsApiKey });
});

// Mounted Modular Routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/presets', presetRoutes);
app.use('/api/drip', dripRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/crm/integrations', crmIntegrationsRoutes);
app.use('/api/email/integrations', emailIntegrationsRoutes);
app.use('/api/email', emailUsageRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/outreach', outreachRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/ai-calling', aiCallingRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/pipeline', pipelineRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/marketplace/admin', marketplaceAdminRoutes);

// Optional bundled frontend (Docker / single-process deploy). Helmet above sets COOP for HTML/JS.
const staticFrontendDir = String(process.env.STATIC_FRONTEND_DIR || '').trim();
if (staticFrontendDir && fs.existsSync(staticFrontendDir)) {
  app.use(
    express.static(staticFrontendDir, {
      index: false,
      setHeaders(res) {
        res.setHeader('Cross-Origin-Opener-Policy', COOP_ALLOW_POPUPS);
      },
    }),
  );
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') return next();
    res.sendFile(path.join(staticFrontendDir, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
  console.log(`${BRAND_LOG_PREFIX} Serving static frontend from ${staticFrontendDir}`);
}

// Centralized Error Handling Middleware
app.use(errorHandler);

// ═══════════════════════════════════════════════════════════════════
// HTTP Server + WebSocket Server for Twilio Media Streams
// ═══════════════════════════════════════════════════════════════════
const server = createServer(app);

const wss = new WebSocketServer({ server, path: '/media-stream' });

wss.on('connection', (ws, _req) => {
  if (!isProd) {
    console.log('[WebSocket] New Twilio Media Stream connection');
  }
  handleMediaStreamConnection(ws);
});

wss.on('error', (err) => {
  console.error('[WebSocket] Server error:', err.message);
});

function startBackgroundWorkers() {
  startDialerWorker({ intervalMs: 15000 });
  startDripWorker({ intervalMs: 60000 });
  startMarketplaceWorker({ intervalMs: 30000 });
  console.log(
    BRAND_LOG_PREFIX + ' Background workers started: drip (60s), AI dialer (15s), marketplace (30s), appointment reminders (5m)',
  );
}

function stopBackgroundWorkers() {
  stopDialerWorker();
  stopDripWorker();
  stopMarketplaceWorker();
}

async function startServer() {
  try {
    await migrateSchema();
    await ensurePlatformCrmSettingsLoaded();
    await ensurePlatformEmailSettingsLoaded();
  } catch (err) {
    console.error('[Schema] Migration failed; API will still start and workers will retry:', err.message);
  }

  if (isFirebaseAdminConfigured()) {
    loadFirebaseWebConfig()
      .then((cfg) => {
        if (cfg) {
          console.log('[Firebase] Web SDK config loaded for social login');
        }
      })
      .catch(() => {});
  }

  server.on('error', (err) => {
    console.error(`${BRAND_LOG_PREFIX} Failed to bind HTTP server:`, err.message);
    process.exit(1);
  });

  server.listen(PORT, BIND_HOST, () => {
    if (isProd) {
      console.log(`${BRAND_LOG_PREFIX} API listening on port ${PORT}`);
    } else {
      console.log(`${BRAND_LOG_PREFIX} API running on http://localhost:${PORT}`);
      console.log(`[WebSocket] Media Stream endpoint ready at ws://localhost:${PORT}/media-stream`);
    }
    startBackgroundWorkers();
  });
}

function shutdown(signal) {
  console.log(`${BRAND_LOG_PREFIX} ${signal} received, stopping workers`);
  stopBackgroundWorkers();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer();
