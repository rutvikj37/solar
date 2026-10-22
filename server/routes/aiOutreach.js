import express from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken } from '../middleware/auth.js';
import { requireWorkspacePermission } from '../middleware/workspacePermissions.js';
import { fetchLeadForUser } from '../utils/leadAccess.js';
import { checkLeadContactable, optedOutError } from '../services/compliance/optOut.js';
import {
  OUTREACH_INTENTS,
  OUTREACH_TONES,
  draftEmail,
  draftSms,
  isAiWritingConfigured,
  loadSender,
  suggestReplies,
} from '../services/ai/outreachWriter.js';

const router = express.Router();

const WINDOW_MIN = Number(process.env.AI_OUTREACH_RATE_WINDOW_MIN) || 60;
const MAX_PER_WINDOW = Number(process.env.AI_OUTREACH_MAX_PER_WINDOW) || 40;

const aiLimiter = rateLimit({
  windowMs: WINDOW_MIN * 60 * 1000,
  max: MAX_PER_WINDOW,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `ai-outreach:${req.user?.id || 'anon'}`,
  handler: (req, res) =>
    res.status(429).json({
      error: `AI writing limit reached (${MAX_PER_WINDOW} drafts per ${WINDOW_MIN} min). Try again later.`,
      code: 'AI_RATE_LIMITED',
    }),
});

function requireAiConfigured(req, res, next) {
  if (isAiWritingConfigured()) return next();
  return res.status(503).json({
    error: 'AI writing is not configured. Ask your platform admin to set OPENAI_API_KEY on the server.',
    code: 'AI_NOT_CONFIGURED',
  });
}

function sendAiError(res, err, label) {
  if (err.code === 'AI_NOT_CONFIGURED') return res.status(503).json({ error: err.message, code: err.code });
  if (err.code === 'NO_INBOUND_MESSAGE') return res.status(404).json({ error: err.message, code: err.code });
  if (err.code === 'AI_PROVIDER_ERROR' || err.name === 'AbortError') {
    return res.status(502).json({ error: err.name === 'AbortError' ? 'AI writing timed out. Try again.' : err.message, code: 'AI_PROVIDER_ERROR' });
  }
  console.error(`[AI Outreach] ${label} failed:`, err);
  return res.status(500).json({ error: 'AI writing failed' });
}

const guard = [authenticateToken, requireWorkspacePermission('outreach_send'), requireAiConfigured, aiLimiter];

router.get('/status', authenticateToken, (req, res) => {
  res.json({
    configured: isAiWritingConfigured(),
    intents: Object.keys(OUTREACH_INTENTS),
    tones: OUTREACH_TONES,
    limit: { max: MAX_PER_WINDOW, windowMinutes: WINDOW_MIN },
  });
});

/** POST { leadId, channel: 'email'|'sms', intent, tone, instructions } -> { subject?, body } */
router.post('/draft', ...guard, async (req, res) => {
  try {
    const { leadId, channel = 'email', intent = 'follow_up', tone = 'friendly', instructions = '' } = req.body || {};
    if (!['email', 'sms'].includes(channel)) return res.status(400).json({ error: 'channel must be email or sms' });
    if (!OUTREACH_INTENTS[intent]) return res.status(400).json({ error: 'Unknown intent' });
    const lead = leadId ? await fetchLeadForUser(Number(leadId), req.user.id, req.user.role) : null;
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const contactable = await checkLeadContactable(lead, channel);
    if (!contactable.allowed) {
      return res.status(409).json({ error: optedOutError(contactable.reason).message, code: 'OPTED_OUT', reason: contactable.reason });
    }

    const sender = await loadSender(req.user.id);
    const draft =
      channel === 'sms'
        ? await draftSms({ lead, sender, intent, tone, instructions })
        : await draftEmail({ lead, sender, intent, tone, instructions });
    res.json({ channel, ...draft, generated: true });
  } catch (err) {
    sendAiError(res, err, 'draft');
  }
});

/** POST { leadId, messageId? } -> { inReplyTo, suggestions: [{ label, subject, body }] } */
router.post('/reply-suggestions', ...guard, async (req, res) => {
  try {
    const { leadId, messageId } = req.body || {};
    const lead = leadId ? await fetchLeadForUser(Number(leadId), req.user.id, req.user.role) : null;
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    const contactable = await checkLeadContactable(lead, 'email');
    if (!contactable.allowed) {
      return res.status(409).json({ error: optedOutError(contactable.reason).message, code: 'OPTED_OUT', reason: contactable.reason });
    }
    const sender = await loadSender(req.user.id);
    res.json(await suggestReplies({ lead, sender, messageId: messageId ? Number(messageId) : null }));
  } catch (err) {
    sendAiError(res, err, 'reply suggestions');
  }
});

export default router;
