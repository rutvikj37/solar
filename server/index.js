import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { migrateSchema } from './schema.js';
import { errorHandler } from './middleware/errorHandler.js';
import { handleMediaStreamConnection } from './services/ai-calling/realtimeVoiceAgent.js';

import authRoutes from './routes/auth.js';
import propertyRoutes from './routes/properties.js';
import leadRoutes from './routes/leads.js';
import crmRoutes from './routes/crm.js';
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
import { startDialerWorker, stopDialerWorker } from './services/ai-calling/dialerWorker.js';
import { startDripWorker, stopDripWorker } from './services/drip/dripWorker.js';

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
    return isProd ? 1 : false;
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
    contentSecurityPolicy: false,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: isProd
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    crossOriginEmbedderPolicy: false,
  })
);
app.use((_req, res, next) => {
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  );
  next();
});

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public config — no secrets (Maps key comes from VITE_GOOGLE_MAPS_API_KEY on the client)
app.get('/api/config', (req, res) => {
  res.json({
    googleMapsApiKey: '',
  });
});

// Mounted Modular Routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/presets', presetRoutes);
app.use('/api/drip', dripRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/outreach', outreachRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/ai-calling', aiCallingRoutes);
app.use('/api/proposals', proposalRoutes);

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
  console.log('[SolarX.live] Background workers started: drip (60s), AI dialer (15s), appointment reminders (5m)');
}

function stopBackgroundWorkers() {
  stopDialerWorker();
  stopDripWorker();
}

async function startServer() {
  try {
    await migrateSchema();
  } catch (err) {
    console.error('[Schema] Migration failed; API will still start and workers will retry:', err.message);
  }

  server.on('error', (err) => {
    console.error('[SolarX.live] Failed to bind HTTP server:', err.message);
    process.exit(1);
  });

  server.listen(PORT, BIND_HOST, () => {
    if (isProd) {
      console.log(`[SolarX.live] API listening on port ${PORT}`);
    } else {
      console.log(`[SolarX.live] API running on http://localhost:${PORT}`);
      console.log(`[WebSocket] Media Stream endpoint ready at ws://localhost:${PORT}/media-stream`);
    }
    startBackgroundWorkers();
  });
}

function shutdown(signal) {
  console.log(`[SolarX.live] ${signal} received, stopping workers`);
  stopBackgroundWorkers();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer();
