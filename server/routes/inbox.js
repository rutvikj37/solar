import express from 'express';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { fetchLeadForUser } from '../utils/leadAccess.js';
import { resolveWorkspaceContext } from '../utils/workspaceContext.js';
import { listUserEmailStatus } from '../services/email/userEmailConnections.js';
import { getLeadEmailThreads, syncUserInbox } from '../services/email/inboxSync.js';

const router = express.Router();

const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `inbox-sync:${req.user.id}`,
  message: { error: 'Too many sync requests — try again in a few minutes.' },
});

// GET /api/inbox/status — mailbox + reply-sync state for the current user
router.get('/status', authenticateToken, asyncHandler(async (req, res) => {
  const status = await listUserEmailStatus(req.user.id);
  res.json({
    connected: status.connected,
    provider: status.provider,
    fromEmail: status.fromEmail,
    inbox: status.inbox,
  });
}));

// POST /api/inbox/sync — pull new replies now
router.post('/sync', authenticateToken, syncLimiter, asyncHandler(async (req, res) => {
  const result = await syncUserInbox(req.user.id, { manual: true });
  res.status(result.ok || result.status !== 'error' ? 200 : 502).json(result);
}));

// GET /api/inbox — recent lead replies visible to this user
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const ws = await resolveWorkspaceContext(req.user.id);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const [rows] = await db.query(
    `SELECT om.id, om.lead_id, om.subject, LEFT(om.body, 400) AS preview, om.from_address,
            COALESCE(om.received_at, om.created_at) AS received_at,
            l.owner_name, l.address, l.status AS lead_status
     FROM outreach_messages om
     JOIN leads l ON l.id = om.lead_id
     WHERE om.channel = 'email' AND om.direction = 'inbound'
       AND (l.user_id = ? OR l.user_id = ? OR l.assigned_to = ?)
     ORDER BY received_at DESC
     LIMIT ?`,
    [ws.ownerUserId, req.user.id, req.user.id, limit],
  );
  res.json({ messages: rows });
}));

// GET /api/inbox/leads/:leadId/threads — threaded email conversation with a lead
router.get('/leads/:leadId/threads', authenticateToken, asyncHandler(async (req, res) => {
  const lead = await fetchLeadForUser(req.params.leadId, req.user.id, req.user.role, 'l.id');
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json({ threads: await getLeadEmailThreads(lead.id) });
}));

export default router;
