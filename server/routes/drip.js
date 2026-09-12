import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import {
  enrollLeadInActiveCampaigns,
  enrollLeadInCampaign,
  leadEligibleForEnrollment,
  getCampaignStats,
  getCampaignFunnel,
  computeInitialNextRun,
} from '../services/drip/dripEngine.js';
import { DEFAULT_DRIP_STEPS } from '../services/drip/dripTemplates.js';

const router = express.Router();

export { enrollLeadInActiveCampaigns };

function mapStep(s) {
  return {
    id: s.id,
    order: s.step_order,
    delayDays: s.delay_days,
    delayHours: s.delay_hours || 0,
    actionType: s.action_type,
    subject: s.subject,
    templateContent: s.template_content,
  };
}

function mapCampaign(c) {
  return {
    id: c.id,
    name: c.name,
    description: c.description || '',
    status: c.status,
    triggerMinScore: c.trigger_min_score,
    enrollmentMode: c.enrollment_mode || 'score_gated',
    timezone: c.timezone || 'America/New_York',
    quietHoursStart: c.quiet_hours_start || '09:00:00',
    quietHoursEnd: c.quiet_hours_end || '20:00:00',
    stopOnReply: Boolean(c.stop_on_reply),
    stopOnStatuses: (() => {
      if (!c.stop_on_statuses) return ['won', 'lost', 'appointment'];
      if (typeof c.stop_on_statuses === 'object') return c.stop_on_statuses;
      try { return JSON.parse(c.stop_on_statuses); } catch { return ['won', 'lost', 'appointment']; }
    })(),
    createdAt: c.created_at,
  };
}

async function getOwnedCampaign(id, userId) {
  const [rows] = await db.query(
    'SELECT * FROM drip_campaigns WHERE id = ? AND user_id = ?',
    [id, userId]
  );
  return rows[0] || null;
}

router.get('/campaigns', authenticateToken, asyncHandler(async (req, res) => {
  const [campaigns] = await db.query(
    'SELECT * FROM drip_campaigns WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id]
  );

  const result = [];
  for (const c of campaigns) {
    const [steps] = await db.query(
      'SELECT * FROM drip_steps WHERE campaign_id = ? ORDER BY step_order ASC',
      [c.id]
    );
    const stats = await getCampaignStats(c.id, req.user.id);
    result.push({
      ...mapCampaign(c),
      activeEnrollments: stats.activeEnrollments,
      stats,
      steps: steps.map(mapStep),
    });
  }

  res.json(result);
}));

router.get('/campaigns/:id', authenticateToken, asyncHandler(async (req, res) => {
  const campaign = await getOwnedCampaign(req.params.id, req.user.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const [steps] = await db.query(
    'SELECT * FROM drip_steps WHERE campaign_id = ? ORDER BY step_order ASC',
    [campaign.id]
  );
  const [triggers] = await db.query(
    'SELECT * FROM drip_triggers WHERE campaign_id = ?',
    [campaign.id]
  );
  const stats = await getCampaignStats(campaign.id, req.user.id);
  const funnel = await getCampaignFunnel(campaign.id, req.user.id);

  res.json({
    ...mapCampaign(campaign),
    stats,
    funnel,
    steps: steps.map(mapStep),
    triggers: triggers.map((t) => ({
      id: t.id,
      triggerType: t.trigger_type,
      triggerConfig: t.trigger_config ? JSON.parse(t.trigger_config) : {},
    })),
  });
}));

router.post('/campaigns', authenticateToken, asyncHandler(async (req, res) => {
  const {
    name,
    description = '',
    triggerMinScore = 70,
    enrollmentMode = 'score_gated',
    steps = [],
    timezone = 'America/New_York',
    quietHoursStart = '09:00:00',
    quietHoursEnd = '20:00:00',
    stopOnReply = true,
    stopOnStatuses = ['won', 'lost', 'appointment'],
  } = req.body;

  if (!name) return res.status(400).json({ error: 'Campaign name is required' });

  const [cRes] = await db.query(
    `INSERT INTO drip_campaigns
     (user_id, name, description, trigger_min_score, enrollment_mode, status, timezone,
      quiet_hours_start, quiet_hours_end, stop_on_reply, stop_on_statuses)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
    [
      req.user.id,
      name,
      description,
      triggerMinScore,
      enrollmentMode,
      timezone,
      quietHoursStart,
      quietHoursEnd,
      stopOnReply ? 1 : 0,
      JSON.stringify(stopOnStatuses),
    ]
  );
  const campaignId = cRes.insertId;

  const stepList = steps.length > 0 ? steps : DEFAULT_DRIP_STEPS;
  for (const s of stepList) {
    // Drip is email-only — coerce any legacy sms/ai_call to email.
    const actionType = 'email';
    await db.query(
      `INSERT INTO drip_steps (campaign_id, step_order, delay_days, delay_hours, action_type, subject, template_content)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        campaignId,
        s.order,
        s.delayDays || 0,
        s.delayHours || 0,
        actionType,
        s.subject || '',
        s.templateContent,
      ]
    );
  }

  if (enrollmentMode !== 'manual') {
    const [userLeads] = await db.query('SELECT * FROM leads WHERE user_id = ?', [req.user.id]);
    const campaign = {
      enrollment_mode: enrollmentMode,
      trigger_min_score: triggerMinScore,
    };
    for (const l of userLeads) {
      if (!leadEligibleForEnrollment(l, campaign)) continue;
      try {
        const nextRun = await computeInitialNextRun(campaignId);
        await db.query(
          `INSERT INTO drip_enrollments (user_id, campaign_id, lead_id, current_step, next_run_at, status)
           VALUES (?, ?, ?, 1, ?, 'active')`,
          [req.user.id, campaignId, l.id, nextRun]
        );
      } catch {
        /* duplicate enrollment */
      }
    }
  }

  res.status(201).json({ id: campaignId, name, message: 'Drip campaign created' });
}));

router.put('/campaigns/:id', authenticateToken, asyncHandler(async (req, res) => {
  const campaign = await getOwnedCampaign(req.params.id, req.user.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const {
    name,
    description,
    triggerMinScore,
    enrollmentMode,
    timezone,
    quietHoursStart,
    quietHoursEnd,
    stopOnReply,
    stopOnStatuses,
  } = req.body;

  await db.query(
    `UPDATE drip_campaigns SET
       name = COALESCE(?, name),
       description = COALESCE(?, description),
       trigger_min_score = COALESCE(?, trigger_min_score),
       enrollment_mode = COALESCE(?, enrollment_mode),
       timezone = COALESCE(?, timezone),
       quiet_hours_start = COALESCE(?, quiet_hours_start),
       quiet_hours_end = COALESCE(?, quiet_hours_end),
       stop_on_reply = COALESCE(?, stop_on_reply),
       stop_on_statuses = COALESCE(?, stop_on_statuses)
     WHERE id = ? AND user_id = ?`,
    [
      name ?? null,
      description ?? null,
      triggerMinScore ?? null,
      enrollmentMode ?? null,
      timezone ?? null,
      quietHoursStart ?? null,
      quietHoursEnd ?? null,
      stopOnReply !== undefined ? (stopOnReply ? 1 : 0) : null,
      stopOnStatuses ? JSON.stringify(stopOnStatuses) : null,
      req.params.id,
      req.user.id,
    ]
  );

  res.json({ success: true });
}));

router.put('/campaigns/:id/steps', authenticateToken, asyncHandler(async (req, res) => {
  const campaign = await getOwnedCampaign(req.params.id, req.user.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const { steps = [] } = req.body;
  if (!Array.isArray(steps) || steps.length === 0) {
    return res.status(400).json({ error: 'At least one step is required' });
  }

  await db.query('DELETE FROM drip_steps WHERE campaign_id = ?', [campaign.id]);
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    // Drip is email-only — coerce any legacy sms/ai_call to email.
    const actionType = 'email';
    await db.query(
      `INSERT INTO drip_steps (campaign_id, step_order, delay_days, delay_hours, action_type, subject, template_content)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        campaign.id,
        i + 1,
        s.delayDays || 0,
        s.delayHours || 0,
        actionType,
        s.subject || '',
        s.templateContent || '',
      ]
    );
  }

  res.json({ success: true, stepCount: steps.length });
}));

router.put('/campaigns/:id/triggers', authenticateToken, asyncHandler(async (req, res) => {
  const campaign = await getOwnedCampaign(req.params.id, req.user.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const { triggers = [] } = req.body;
  await db.query('DELETE FROM drip_triggers WHERE campaign_id = ?', [campaign.id]);
  for (const t of triggers) {
    await db.query(
      'INSERT INTO drip_triggers (campaign_id, trigger_type, trigger_config) VALUES (?, ?, ?)',
      [campaign.id, t.triggerType, JSON.stringify(t.triggerConfig || {})]
    );
  }
  res.json({ success: true });
}));

router.patch('/campaigns/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['active', 'paused'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

  await db.query(
    'UPDATE drip_campaigns SET status = ? WHERE id = ? AND user_id = ?',
    [status, req.params.id, req.user.id]
  );
  res.json({ success: true, status });
}));

router.delete('/campaigns/:id', authenticateToken, asyncHandler(async (req, res) => {
  const campaign = await getOwnedCampaign(req.params.id, req.user.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  await db.query('DELETE FROM drip_step_executions WHERE enrollment_id IN (SELECT id FROM drip_enrollments WHERE campaign_id = ?)', [campaign.id]);
  await db.query('DELETE FROM drip_enrollments WHERE campaign_id = ?', [campaign.id]);
  await db.query('DELETE FROM drip_triggers WHERE campaign_id = ?', [campaign.id]);
  await db.query('DELETE FROM drip_steps WHERE campaign_id = ?', [campaign.id]);
  await db.query('DELETE FROM drip_campaigns WHERE id = ?', [campaign.id]);
  res.json({ success: true });
}));

router.get('/campaigns/:id/enrollments', authenticateToken, asyncHandler(async (req, res) => {
  const campaign = await getOwnedCampaign(req.params.id, req.user.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const offset = (page - 1) * limit;

  const [rows] = await db.query(
    `SELECT e.*, l.owner_name, l.phone, l.email, l.address, l.lead_score, l.status AS lead_status
     FROM drip_enrollments e
     JOIN leads l ON l.id = e.lead_id
     WHERE e.campaign_id = ? AND e.user_id = ?
     ORDER BY e.created_at DESC
     LIMIT ? OFFSET ?`,
    [campaign.id, req.user.id, limit, offset]
  );

  const [countRows] = await db.query(
    'SELECT COUNT(*) AS cnt FROM drip_enrollments WHERE campaign_id = ? AND user_id = ?',
    [campaign.id, req.user.id]
  );

  res.json({
    enrollments: rows.map((e) => ({
      id: e.id,
      leadId: e.lead_id,
      ownerName: e.owner_name,
      phone: e.phone,
      email: e.email,
      address: e.address,
      leadScore: e.lead_score,
      leadStatus: e.lead_status,
      currentStep: e.current_step,
      nextRunAt: e.next_run_at,
      status: e.status,
      createdAt: e.created_at,
    })),
    total: countRows[0]?.cnt || 0,
    page,
    limit,
  });
}));

router.post('/campaigns/:id/enroll', authenticateToken, asyncHandler(async (req, res) => {
  const campaign = await getOwnedCampaign(req.params.id, req.user.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const { leadIds = [], minScore } = req.body;
  let enrolled = 0;
  let skipped = 0;

  if (leadIds.length > 0) {
    for (const leadId of leadIds) {
      const result = await enrollLeadInCampaign(req.user.id, campaign.id, leadId, { skipRules: false });
      if (result.enrolled) enrolled += 1;
      else skipped += 1;
    }
  } else {
    let query = 'SELECT * FROM leads WHERE user_id = ?';
    const params = [req.user.id];
    if (minScore !== undefined) {
      query += ' AND lead_score >= ?';
      params.push(minScore);
    }
    const [leads] = await db.query(query, params);
    for (const l of leads) {
      const result = await enrollLeadInCampaign(req.user.id, campaign.id, l.id, { skipRules: false });
      if (result.enrolled) enrolled += 1;
      else skipped += 1;
    }
  }

  res.json({ success: true, enrolled, skipped });
}));

router.patch('/enrollments/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['active', 'cancelled', 'paused'].includes(status)) {
    return res.status(400).json({ error: 'Invalid enrollment status' });
  }

  const mapped = status === 'paused' ? 'cancelled' : status;
  const [result] = await db.query(
    'UPDATE drip_enrollments SET status = ? WHERE id = ? AND user_id = ?',
    [mapped, req.params.id, req.user.id]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Enrollment not found' });
  res.json({ success: true, status: mapped });
}));

router.get('/campaigns/:id/stats', authenticateToken, asyncHandler(async (req, res) => {
  const campaign = await getOwnedCampaign(req.params.id, req.user.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  const stats = await getCampaignStats(campaign.id, req.user.id);
  res.json(stats);
}));

router.get('/campaigns/:id/funnel', authenticateToken, asyncHandler(async (req, res) => {
  const campaign = await getOwnedCampaign(req.params.id, req.user.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  const funnel = await getCampaignFunnel(campaign.id, req.user.id);
  res.json(funnel);
}));

router.get('/leads/:leadId/enrollments', authenticateToken, asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    `SELECT e.*, c.name AS campaign_name, c.status AS campaign_status
     FROM drip_enrollments e
     JOIN drip_campaigns c ON c.id = e.campaign_id
     WHERE e.lead_id = ? AND e.user_id = ? AND e.status = 'active'
     ORDER BY e.created_at DESC`,
    [req.params.leadId, req.user.id]
  );
  res.json(rows.map((e) => ({
    id: e.id,
    campaignId: e.campaign_id,
    campaignName: e.campaign_name,
    campaignStatus: e.campaign_status,
    currentStep: e.current_step,
    nextRunAt: e.next_run_at,
    status: e.status,
  })));
}));

export default router;
