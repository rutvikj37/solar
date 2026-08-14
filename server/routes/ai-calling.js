/**
 * AI Calling Automation — REST API Routes
 * All endpoints mounted at /api/ai-calling
 */
import express from 'express';
import db from '../db.js';
import { adminAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import * as campaignEngine from '../services/ai-calling/campaignEngine.js';
import * as callFlowManager from '../services/ai-calling/callFlowManager.js';
import * as elevenLabsService from '../services/ai-calling/elevenLabsService.js';
import { getActiveSessions, injectCoachWhisper } from '../services/ai-calling/realtimeVoiceAgent.js';
import { runDialerOnce } from '../services/ai-calling/dialerWorker.js';
import { buildRealtimeSystemPrompt } from '../services/ai-calling/aiOrchestrator.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VM_CACHE_DIR = path.resolve(__dirname, '../uploads/voicemail-cache');

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD & ANALYTICS
// ═══════════════════════════════════════════════════════════════════

router.get('/dashboard', ...adminAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const [todayStats] = await db.query(
    `SELECT
       COUNT(*) as total_calls,
       SUM(CASE WHEN status = 'in_progress' OR status = 'ringing' THEN 1 ELSE 0 END) as in_progress,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
       SUM(CASE WHEN status IN ('completed','in_progress') AND duration_seconds > 0 THEN 1 ELSE 0 END) as answered,
       SUM(CASE WHEN status = 'no_answer' THEN 1 ELSE 0 END) as no_answer,
       SUM(CASE WHEN disposition = 'voicemail_left' THEN 1 ELSE 0 END) as voicemail,
       SUM(CASE WHEN disposition = 'appointment_booked' THEN 1 ELSE 0 END) as appointments_booked,
       SUM(CASE WHEN disposition = 'qualified' OR disposition = 'appointment_booked' THEN 1 ELSE 0 END) as interested,
       SUM(CASE WHEN disposition = 'not_interested' THEN 1 ELSE 0 END) as not_interested,
       SUM(CASE WHEN disposition = 'callback' THEN 1 ELSE 0 END) as callback_requested,
       AVG(CASE WHEN duration_seconds > 0 THEN duration_seconds ELSE NULL END) as avg_duration,
       SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END) as positive_sentiment
     FROM ai_call_records
     WHERE user_id = ? AND created_at >= ?`,
    [userId, todayStart]
  );

  const stats = todayStats[0] || {};
  const answeredCount = Number(stats.answered) || 0;
  const totalCalls = Number(stats.total_calls) || 0;

  res.json({
    today: {
      totalCalls,
      inProgress: Number(stats.in_progress) || 0,
      completed: Number(stats.completed) || 0,
      answered: answeredCount,
      noAnswer: Number(stats.no_answer) || 0,
      voicemail: Number(stats.voicemail) || 0,
      appointmentsBooked: Number(stats.appointments_booked) || 0,
      interested: Number(stats.interested) || 0,
      notInterested: Number(stats.not_interested) || 0,
      callbackRequested: Number(stats.callback_requested) || 0,
      avgDuration: Math.round(Number(stats.avg_duration) || 0),
      aiSuccessRate: totalCalls > 0 ? Math.round((answeredCount / totalCalls) * 100) : 0,
      bookingRate: answeredCount > 0 ? Math.round(((Number(stats.appointments_booked) || 0) / answeredCount) * 100) : 0,
    },
  });
}));

router.get('/analytics', ...adminAuth, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { startDate, endDate } = req.query;
  const start = startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const end = endDate || new Date().toISOString().split('T')[0];

  const [daily] = await db.query(
    `SELECT
       DATE(created_at) as date,
       COUNT(*) as calls,
       SUM(CASE WHEN disposition = 'appointment_booked' THEN 1 ELSE 0 END) as bookings,
       SUM(CASE WHEN duration_seconds > 0 THEN 1 ELSE 0 END) as answered,
       AVG(CASE WHEN duration_seconds > 0 THEN duration_seconds ELSE NULL END) as avg_duration
     FROM ai_call_records
     WHERE user_id = ? AND DATE(created_at) BETWEEN ? AND ?
     GROUP BY DATE(created_at) ORDER BY date`,
    [userId, start, end]
  );

  const [campaignStats] = await db.query(
    `SELECT c.id, c.name, c.status,
       COUNT(r.id) as total_calls,
       SUM(CASE WHEN r.disposition = 'appointment_booked' THEN 1 ELSE 0 END) as bookings,
       AVG(CASE WHEN r.duration_seconds > 0 THEN r.duration_seconds ELSE NULL END) as avg_duration
     FROM ai_calling_campaigns c
     LEFT JOIN ai_call_records r ON r.campaign_id = c.id
     WHERE c.user_id = ?
     GROUP BY c.id ORDER BY c.created_at DESC`,
    [userId]
  );

  res.json({ daily, campaigns: campaignStats });
}));

// ═══════════════════════════════════════════════════════════════════
// PERSONAL LIVE TEST CALL
// ═══════════════════════════════════════════════════════════════════

router.post('/test-call', ...adminAuth, asyncHandler(async (req, res) => {
  const { phoneNumber, callerName, businessName } = req.body;
  if (!phoneNumber) return res.status(400).json({ error: 'Phone number is required for test call' });

  // 1. Create temporary mock test lead or fetch existing test lead
  const [leadResult] = await db.query(
    `INSERT INTO leads (user_id, owner_name, phone, address, status, estimated_savings)
     VALUES (?, 'Personal Test Lead', ?, '123 Solar Test Way, Beverly Hills, CA 90210', 'test', 28500)`,
    [req.user.id, phoneNumber]
  );
  const testLeadId = leadResult.insertId;

  // 2. Initiate AI Call immediately
  const callResult = await callFlowManager.initiateAICall({
    campaignId: null,
    queueId: null,
    leadId: testLeadId,
    userId: req.user.id,
    phoneNumber,
    campaign: {
      caller_name: callerName || 'Emily',
      business_name: businessName || 'Solar Velocity (Test Call)',
      twilio_number: process.env.TWILIO_PHONE_NUMBER,
    },
  });

  res.json({
    ok: true,
    message: `Test call initiated to ${phoneNumber}`,
    callRecordId: callResult.callRecordId,
    callSid: callResult.callSid,
    simulated: callResult.simulated,
  });
}));

// ═══════════════════════════════════════════════════════════════════
// CAMPAIGNS
// ═══════════════════════════════════════════════════════════════════

router.get('/campaigns', ...adminAuth, asyncHandler(async (req, res) => {
  const [campaigns] = await db.query(
    `SELECT c.*,
       (SELECT COUNT(*) FROM ai_calling_queue q WHERE q.campaign_id = c.id) as queue_total,
       (SELECT COUNT(*) FROM ai_calling_queue q WHERE q.campaign_id = c.id AND q.status IN ('completed','answered')) as queue_done
     FROM ai_calling_campaigns c WHERE c.user_id = ? ORDER BY c.created_at DESC`,
    [req.user.id]
  );
  res.json(campaigns);
}));

router.post('/campaigns', ...adminAuth, asyncHandler(async (req, res) => {
  const { name, callerName, businessName, twilioNumber, elevenlabsVoiceId, timezone,
    callingWindowStart, callingWindowEnd, callingDays, retryAttempts, retryDelayMinutes,
    maxCallDurationSeconds, appointmentDurationMinutes, systemPrompt, greetingScript,
    qualificationQuestions, objectionResponses, bookingScript, closingScript } = req.body;

  if (!name) return res.status(400).json({ error: 'Campaign name required' });

  const [result] = await db.query(
    `INSERT INTO ai_calling_campaigns (user_id, name, caller_name, business_name, twilio_number,
      elevenlabs_voice_id, timezone, calling_window_start, calling_window_end, calling_days,
      retry_attempts, retry_delay_minutes, max_call_duration_seconds, appointment_duration_minutes,
      system_prompt, greeting_script, qualification_questions, objection_responses,
      booking_script, closing_script)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, name, callerName || null, businessName || null, twilioNumber || null,
      elevenlabsVoiceId || null, timezone || 'America/New_York',
      callingWindowStart || '09:00', callingWindowEnd || '20:00',
      callingDays ? JSON.stringify(callingDays) : JSON.stringify(['Mon','Tue','Wed','Thu','Fri']),
      retryAttempts ?? 3, retryDelayMinutes ?? 60, maxCallDurationSeconds ?? 300,
      appointmentDurationMinutes ?? 30, systemPrompt || null, greetingScript || null,
      qualificationQuestions ? JSON.stringify(qualificationQuestions) : null,
      objectionResponses ? JSON.stringify(objectionResponses) : null,
      bookingScript || null, closingScript || null]
  );

  const [campaign] = await db.query('SELECT * FROM ai_calling_campaigns WHERE id = ?', [result.insertId]);
  res.status(201).json(campaign[0]);
}));

router.get('/campaigns/:id', ...adminAuth, asyncHandler(async (req, res) => {
  const [campaigns] = await db.query(
    'SELECT * FROM ai_calling_campaigns WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );
  if (!campaigns.length) return res.status(404).json({ error: 'Campaign not found' });

  const progress = await campaignEngine.getCampaignProgress(req.params.id);
  res.json({ ...campaigns[0], progress });
}));

router.put('/campaigns/:id', ...adminAuth, asyncHandler(async (req, res) => {
  const fields = ['name', 'caller_name', 'business_name', 'twilio_number', 'elevenlabs_voice_id',
    'timezone', 'calling_window_start', 'calling_window_end', 'retry_attempts',
    'retry_delay_minutes', 'max_call_duration_seconds', 'appointment_duration_minutes',
    'system_prompt', 'greeting_script', 'booking_script', 'closing_script'];

  const setClauses = [];
  const values = [];

  for (const field of fields) {
    const camelKey = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (req.body[camelKey] !== undefined) {
      setClauses.push(`${field} = ?`);
      values.push(req.body[camelKey]);
    }
  }

  // Handle JSON fields separately
  for (const jField of ['calling_days', 'qualification_questions', 'objection_responses']) {
    const camelKey = jField.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (req.body[camelKey] !== undefined) {
      setClauses.push(`${jField} = ?`);
      values.push(JSON.stringify(req.body[camelKey]));
    }
  }

  if (setClauses.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(req.params.id, req.user.id);

  await db.query(
    `UPDATE ai_calling_campaigns SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = ? AND user_id = ?`,
    values
  );

  const [updated] = await db.query('SELECT * FROM ai_calling_campaigns WHERE id = ?', [req.params.id]);
  res.json(updated[0]);
}));

router.delete('/campaigns/:id', ...adminAuth, asyncHandler(async (req, res) => {
  await db.query('DELETE FROM ai_calling_queue WHERE campaign_id = ? AND campaign_id IN (SELECT id FROM ai_calling_campaigns WHERE user_id = ?)', [req.params.id, req.user.id]);
  await db.query('DELETE FROM ai_calling_campaigns WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ ok: true });
}));

// Campaign Actions
router.post('/campaigns/:id/start', ...adminAuth, asyncHandler(async (req, res) => {
  const result = await campaignEngine.startCampaign(Number(req.params.id), req.user.id);

  // Ensure ElevenLabs agent exists for this campaign
  try {
    const [campaigns] = await db.query('SELECT * FROM ai_calling_campaigns WHERE id = ?', [req.params.id]);
    const campaign = campaigns[0];
    if (campaign && elevenLabsService.isElevenLabsLive()) {
      const [settings] = await db.query(
        'SELECT elevenlabs_voice_id, elevenlabs_agent_id FROM ai_calling_settings WHERE user_id = ? LIMIT 1',
        [req.user.id]
      );
      const prompt = buildRealtimeSystemPrompt({}, campaign, [], []);
      await elevenLabsService.ensureCampaignAgent({
        campaignId: campaign.id,
        campaignName: campaign.name,
        voiceId: campaign.elevenlabs_voice_id || settings[0]?.elevenlabs_voice_id,
        systemPrompt: campaign.system_prompt ? `${campaign.system_prompt}\n\n${prompt}` : prompt,
        firstMessage: '',
        existingAgentId: campaign.elevenlabs_agent_id,
        settingsAgentId: settings[0]?.elevenlabs_agent_id,
      });
    }
  } catch (err) {
    console.error('[AI Calling] Agent ensure on start failed:', err.message);
  }

  // Kick dialer immediately
  runDialerOnce().catch(() => {});
  res.json(result);
}));

router.post('/campaigns/:id/pause', ...adminAuth, asyncHandler(async (req, res) => {
  await campaignEngine.pauseCampaign(Number(req.params.id), req.user.id);
  res.json({ ok: true });
}));

router.post('/campaigns/:id/resume', ...adminAuth, asyncHandler(async (req, res) => {
  await campaignEngine.resumeCampaign(Number(req.params.id), req.user.id);
  runDialerOnce().catch(() => {});
  res.json({ ok: true });
}));

router.post('/campaigns/:id/stop', ...adminAuth, asyncHandler(async (req, res) => {
  await campaignEngine.stopCampaign(Number(req.params.id), req.user.id);
  res.json({ ok: true });
}));

// ═══════════════════════════════════════════════════════════════════
// LEAD QUEUE
// ═══════════════════════════════════════════════════════════════════

router.post('/campaigns/:id/leads', ...adminAuth, asyncHandler(async (req, res) => {
  const { leadIds } = req.body;
  if (!Array.isArray(leadIds) || !leadIds.length) return res.status(400).json({ error: 'leadIds array required' });
  const result = await campaignEngine.addLeadsToCampaign(Number(req.params.id), req.user.id, leadIds);
  res.json(result);
}));

router.get('/campaigns/:id/queue', ...adminAuth, asyncHandler(async (req, res) => {
  const [items] = await db.query(
    `SELECT q.*, l.owner_name, l.phone, l.address, l.email, l.estimated_savings, l.property_json, l.mailing_address
     FROM ai_calling_queue q
     JOIN leads l ON l.id = q.lead_id
     WHERE q.campaign_id = ? AND q.user_id = ?
     ORDER BY q.priority DESC, q.created_at ASC`,
    [req.params.id, req.user.id]
  );
  res.json(items);
}));

router.delete('/campaigns/:id/leads/:leadId', ...adminAuth, asyncHandler(async (req, res) => {
  await db.query(
    'DELETE FROM ai_calling_queue WHERE campaign_id = ? AND lead_id = ? AND user_id = ? AND status = ?',
    [req.params.id, req.params.leadId, req.user.id, 'pending']
  );
  res.json({ ok: true });
}));

// ═══════════════════════════════════════════════════════════════════
// CALL RECORDS
// ═══════════════════════════════════════════════════════════════════

router.get('/calls', ...adminAuth, asyncHandler(async (req, res) => {
  const { campaignId, status, disposition, limit: limitRaw, offset: offsetRaw } = req.query;
  const limit = Math.min(100, parseInt(limitRaw, 10) || 50);
  const offset = parseInt(offsetRaw, 10) || 0;

  let where = 'r.user_id = ?';
  const params = [req.user.id];

  if (campaignId) { where += ' AND r.campaign_id = ?'; params.push(campaignId); }
  if (status) { where += ' AND r.status = ?'; params.push(status); }
  if (disposition) { where += ' AND r.disposition = ?'; params.push(disposition); }

  const [rows] = await db.query(
    `SELECT r.*, l.owner_name, l.phone, l.address, c.name as campaign_name
     FROM ai_call_records r
     LEFT JOIN leads l ON l.id = r.lead_id
     LEFT JOIN ai_calling_campaigns c ON c.id = r.campaign_id
     WHERE ${where}
     ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM ai_call_records r WHERE ${where}`, params);
  res.json({ calls: rows, total, limit, offset });
}));

router.get('/calls/:id', ...adminAuth, asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    `SELECT r.*, l.owner_name, l.phone, l.address, l.email, l.estimated_savings,
            c.name as campaign_name
     FROM ai_call_records r
     LEFT JOIN leads l ON l.id = r.lead_id
     LEFT JOIN ai_calling_campaigns c ON c.id = r.campaign_id
     WHERE r.id = ? AND r.user_id = ?`,
    [req.params.id, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Call record not found' });

  // Get linked appointment if any
  const [appts] = await db.query(
    'SELECT * FROM ai_calling_appointments WHERE call_record_id = ?',
    [req.params.id]
  );

  res.json({ ...rows[0], appointment: appts[0] || null });
}));

// ═══════════════════════════════════════════════════════════════════
// KNOWLEDGE BASE
// ═══════════════════════════════════════════════════════════════════

router.get('/knowledge-base', ...adminAuth, asyncHandler(async (req, res) => {
  const [articles] = await db.query(
    'SELECT * FROM ai_knowledge_base WHERE user_id = ? ORDER BY category, sort_order, title',
    [req.user.id]
  );
  res.json(articles);
}));

router.post('/knowledge-base', ...adminAuth, asyncHandler(async (req, res) => {
  const { category, title, content, sortOrder } = req.body;
  if (!category || !title || !content) return res.status(400).json({ error: 'category, title, content required' });

  const [result] = await db.query(
    'INSERT INTO ai_knowledge_base (user_id, category, title, content, sort_order) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, category, title, content, sortOrder || 0]
  );
  const [article] = await db.query('SELECT * FROM ai_knowledge_base WHERE id = ?', [result.insertId]);
  res.status(201).json(article[0]);
}));

router.put('/knowledge-base/:id', ...adminAuth, asyncHandler(async (req, res) => {
  const { category, title, content, sortOrder, isActive } = req.body;
  await db.query(
    `UPDATE ai_knowledge_base SET category = COALESCE(?, category), title = COALESCE(?, title),
     content = COALESCE(?, content), sort_order = COALESCE(?, sort_order),
     is_active = COALESCE(?, is_active) WHERE id = ? AND user_id = ?`,
    [category, title, content, sortOrder, isActive, req.params.id, req.user.id]
  );
  const [article] = await db.query('SELECT * FROM ai_knowledge_base WHERE id = ?', [req.params.id]);
  res.json(article[0]);
}));

router.delete('/knowledge-base/:id', ...adminAuth, asyncHandler(async (req, res) => {
  await db.query('DELETE FROM ai_knowledge_base WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ ok: true });
}));

// ═══════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════

router.get('/settings', ...adminAuth, asyncHandler(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM ai_calling_settings WHERE user_id = ?', [req.user.id]);
  if (!rows.length) {
    // Return defaults
    return res.json({
      twilio_phone_number: process.env.TWILIO_PHONE_NUMBER || '',
      elevenlabs_voice_id: '',
      elevenlabs_agent_id: process.env.ELEVENLABS_AGENT_ID || '',
      openai_model: 'gpt-4o',
      default_business_name: '',
      default_caller_name: '',
      default_timezone: 'America/New_York',
      business_hours_start: '09:00',
      business_hours_end: '20:00',
      daily_call_limit: 100,
      concurrent_call_limit: 5,
    });
  }
  // Mask encrypted keys
  const settings = { ...rows[0] };
  if (settings.elevenlabs_api_key_encrypted) settings.elevenlabs_api_key_encrypted = '••••••••';
  if (settings.openai_api_key_encrypted) settings.openai_api_key_encrypted = '••••••••';
  res.json(settings);
}));

router.put('/settings', ...adminAuth, asyncHandler(async (req, res) => {
  const { twilioPhoneNumber, elevenlabsVoiceId, elevenlabsAgentId, openaiModel,
    defaultBusinessName, defaultCallerName, defaultTimezone,
    businessHoursStart, businessHoursEnd, dailyCallLimit, concurrentCallLimit } = req.body;

  await db.query(
    `INSERT INTO ai_calling_settings (user_id, twilio_phone_number, elevenlabs_voice_id,
      elevenlabs_agent_id, openai_model, default_business_name, default_caller_name,
      default_timezone, business_hours_start, business_hours_end, daily_call_limit, concurrent_call_limit)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       twilio_phone_number = VALUES(twilio_phone_number),
       elevenlabs_voice_id = VALUES(elevenlabs_voice_id),
       elevenlabs_agent_id = VALUES(elevenlabs_agent_id),
       openai_model = VALUES(openai_model),
       default_business_name = VALUES(default_business_name),
       default_caller_name = VALUES(default_caller_name),
       default_timezone = VALUES(default_timezone),
       business_hours_start = VALUES(business_hours_start),
       business_hours_end = VALUES(business_hours_end),
       daily_call_limit = VALUES(daily_call_limit),
       concurrent_call_limit = VALUES(concurrent_call_limit),
       updated_at = NOW()`,
    [req.user.id, twilioPhoneNumber || '', elevenlabsVoiceId || '', elevenlabsAgentId || '',
     openaiModel || 'gpt-4o', defaultBusinessName || '', defaultCallerName || '',
     defaultTimezone || 'America/New_York', businessHoursStart || '09:00',
     businessHoursEnd || '20:00', dailyCallLimit ?? 100, concurrentCallLimit ?? 5]
  );

  res.json({ ok: true });
}));

// ═══════════════════════════════════════════════════════════════════
// VOICES
// ═══════════════════════════════════════════════════════════════════

router.get('/voices', ...adminAuth, asyncHandler(async (req, res) => {
  const voices = await elevenLabsService.listVoices();
  res.json(voices);
}));

// ═══════════════════════════════════════════════════════════════════
// AGENCIES
// ═══════════════════════════════════════════════════════════════════

router.get('/agencies', ...adminAuth, asyncHandler(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM ai_solar_agencies WHERE user_id = ? ORDER BY name', [req.user.id]);
  res.json(rows);
}));

router.post('/agencies', ...adminAuth, asyncHandler(async (req, res) => {
  const { name, zipCodes, states, phone, email, calendarLink } = req.body;
  if (!name) return res.status(400).json({ error: 'Agency name required' });

  const [result] = await db.query(
    'INSERT INTO ai_solar_agencies (user_id, name, zip_codes, states, phone, email, calendar_link) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [req.user.id, name, zipCodes ? JSON.stringify(zipCodes) : null, states ? JSON.stringify(states) : null, phone || null, email || null, calendarLink || null]
  );
  const [agency] = await db.query('SELECT * FROM ai_solar_agencies WHERE id = ?', [result.insertId]);
  res.status(201).json(agency[0]);
}));

router.put('/agencies/:id', ...adminAuth, asyncHandler(async (req, res) => {
  const { name, zipCodes, states, phone, email, calendarLink, isActive } = req.body;
  await db.query(
    `UPDATE ai_solar_agencies SET name = COALESCE(?, name), zip_codes = COALESCE(?, zip_codes),
     states = COALESCE(?, states), phone = COALESCE(?, phone), email = COALESCE(?, email),
     calendar_link = COALESCE(?, calendar_link), is_active = COALESCE(?, is_active)
     WHERE id = ? AND user_id = ?`,
    [name, zipCodes ? JSON.stringify(zipCodes) : null, states ? JSON.stringify(states) : null,
     phone, email, calendarLink, isActive, req.params.id, req.user.id]
  );
  const [agency] = await db.query('SELECT * FROM ai_solar_agencies WHERE id = ?', [req.params.id]);
  res.json(agency[0]);
}));

router.delete('/agencies/:id', ...adminAuth, asyncHandler(async (req, res) => {
  await db.query('DELETE FROM ai_solar_agencies WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ ok: true });
}));

// ═══════════════════════════════════════════════════════════════════
// PROMPTS (per campaign)
// ═══════════════════════════════════════════════════════════════════

router.get('/prompts/:campaignId', ...adminAuth, asyncHandler(async (req, res) => {
  const [campaigns] = await db.query(
    'SELECT system_prompt, greeting_script, qualification_questions, objection_responses, booking_script, closing_script FROM ai_calling_campaigns WHERE id = ? AND user_id = ?',
    [req.params.campaignId, req.user.id]
  );
  if (!campaigns.length) return res.status(404).json({ error: 'Campaign not found' });
  const c = campaigns[0];
  res.json({
    systemPrompt: c.system_prompt || '',
    greetingScript: c.greeting_script || '',
    qualificationQuestions: c.qualification_questions ? (typeof c.qualification_questions === 'string' ? JSON.parse(c.qualification_questions) : c.qualification_questions) : [],
    objectionResponses: c.objection_responses ? (typeof c.objection_responses === 'string' ? JSON.parse(c.objection_responses) : c.objection_responses) : {},
    bookingScript: c.booking_script || '',
    closingScript: c.closing_script || '',
  });
}));

router.put('/prompts/:campaignId', ...adminAuth, asyncHandler(async (req, res) => {
  const { systemPrompt, greetingScript, qualificationQuestions, objectionResponses, bookingScript, closingScript } = req.body;
  await db.query(
    `UPDATE ai_calling_campaigns SET
      system_prompt = ?, greeting_script = ?,
      qualification_questions = ?, objection_responses = ?,
      booking_script = ?, closing_script = ?, updated_at = NOW()
     WHERE id = ? AND user_id = ?`,
    [systemPrompt || null, greetingScript || null,
     qualificationQuestions ? JSON.stringify(qualificationQuestions) : null,
     objectionResponses ? JSON.stringify(objectionResponses) : null,
     bookingScript || null, closingScript || null,
     req.params.campaignId, req.user.id]
  );
  res.json({ ok: true });
}));

// ═══════════════════════════════════════════════════════════════════
// TWILIO WEBHOOKS (no auth — validated by Twilio)
// ═══════════════════════════════════════════════════════════════════

router.post('/webhooks/voice-status', asyncHandler(async (req, res) => {
  const callRecordId = req.query.callRecordId;
  if (!callRecordId) return res.status(400).send('Missing callRecordId');

  await callFlowManager.handleVoiceStatusWebhook(callRecordId, req.body);
  res.status(200).send('OK');
}));

router.post('/webhooks/recording', asyncHandler(async (req, res) => {
  const callRecordId = req.query.callRecordId;
  if (!callRecordId) return res.status(400).send('Missing callRecordId');

  if (req.body.RecordingUrl) {
    await callFlowManager.updateCallRecord(callRecordId, {
      recording_url: req.body.RecordingUrl,
      recording_sid: req.body.RecordingSid,
    });
  }
  res.status(200).send('OK');
}));

router.post('/webhooks/amd', asyncHandler(async (req, res) => {
  const callRecordId = req.query.callRecordId;
  if (!callRecordId) return res.status(400).send('Missing callRecordId');
  await callFlowManager.handleAmdWebhook(callRecordId, req.body);
  res.status(200).send('OK');
}));

// ═══════════════════════════════════════════════════════════════════
// LIVE MONITOR / COACH / TTS
// ═══════════════════════════════════════════════════════════════════

router.get('/live-sessions', ...adminAuth, asyncHandler(async (req, res) => {
  const sessions = getActiveSessions();
  // Scope to user's calls when possible
  const ids = sessions.map((s) => s.callRecordId).filter(Boolean);
  if (!ids.length) return res.json([]);
  const [rows] = await db.query(
    `SELECT id, user_id, lead_id, status, voice_provider, transcript FROM ai_call_records WHERE id IN (?)`,
    [ids]
  );
  const owned = new Set(rows.filter((r) => r.user_id === req.user.id).map((r) => String(r.id)));
  const enriched = sessions
    .filter((s) => owned.has(String(s.callRecordId)))
    .map((s) => {
      const row = rows.find((r) => String(r.id) === String(s.callRecordId));
      return {
        ...s,
        status: row?.status,
        voice_provider: row?.voice_provider || s.provider,
        transcript: row?.transcript || '',
      };
    });
  res.json(enriched);
}));

router.post('/live-sessions/:callRecordId/whisper', ...adminAuth, asyncHandler(async (req, res) => {
  const { note } = req.body;
  if (!note) return res.status(400).json({ error: 'note required' });

  const [rows] = await db.query(
    'SELECT id FROM ai_call_records WHERE id = ? AND user_id = ?',
    [req.params.callRecordId, req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Call not found' });

  const result = injectCoachWhisper(req.params.callRecordId, note);
  res.json(result);
}));

router.get('/tts-audio', ...adminAuth, asyncHandler(async (req, res) => {
  const text = req.query.text || '';
  const voiceId = req.query.voiceId || '21m00Tcm4TlvDq8ikWAM';
  if (!text) return res.status(400).json({ error: 'text required' });
  const audio = await elevenLabsService.synthesizeSpeechAudio(String(text).slice(0, 500), voiceId);
  if (!audio) return res.status(503).json({ error: 'TTS unavailable' });
  res.setHeader('Content-Type', 'audio/mpeg');
  res.send(audio);
}));

router.get('/tts-audio/file/:fileName', asyncHandler(async (req, res) => {
  const safe = path.basename(req.params.fileName);
  const filePath = path.join(VM_CACHE_DIR, safe);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
  res.setHeader('Content-Type', 'audio/mpeg');
  fs.createReadStream(filePath).pipe(res);
}));

router.put('/settings/calendar-tokens', ...adminAuth, asyncHandler(async (req, res) => {
  const { googleCalendarToken, outlookCalendarToken } = req.body;
  await db.query(
    `INSERT INTO ai_calling_settings (user_id, google_calendar_token, outlook_calendar_token)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       google_calendar_token = COALESCE(VALUES(google_calendar_token), google_calendar_token),
       outlook_calendar_token = COALESCE(VALUES(outlook_calendar_token), outlook_calendar_token),
       updated_at = NOW()`,
    [
      req.user.id,
      googleCalendarToken ? JSON.stringify(googleCalendarToken) : null,
      outlookCalendarToken ? JSON.stringify(outlookCalendarToken) : null,
    ]
  );
  res.json({ ok: true });
}));

export default router;

