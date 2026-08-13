import './loadEnv.js';
import express from 'express';
import cors from 'cors';
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

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public config API
app.get('/api/config', (req, res) => {
  res.json({
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
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

wss.on('connection', (ws, req) => {
  console.log('[WebSocket] New Twilio Media Stream connection from', req.socket.remoteAddress);
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

// Schema migrate + HTTP listen + workers all belong to this process (not the Vite client).
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

  server.listen(PORT, () => {
    console.log(`[SolarX.live] API running on http://localhost:${PORT}`);
    console.log(`[WebSocket] Media Stream endpoint ready at ws://localhost:${PORT}/media-stream`);
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

