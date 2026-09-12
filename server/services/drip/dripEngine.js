/**
 * Drip workflow execution engine.
 */
import db from '../../db.js';
import { executeDripStep } from './dripDelivery.js';
import { stepDelayMs } from './dripTemplates.js';

const TERMINAL_LEAD_STATUSES = new Set(['won', 'lost', 'do_not_call']);
const DEFAULT_STOP_STATUSES = ['won', 'lost', 'appointment'];

function parseJsonArray(val, fallback = []) {
  if (Array.isArray(val)) return val;
  if (!val) return fallback;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function isWithinBusinessHours(campaign) {
  const tz = campaign.timezone || 'America/New_York';
  const start = campaign.quiet_hours_start || '09:00:00';
  const end = campaign.quiet_hours_end || '20:00:00';
  try {
    const nowStr = new Date().toLocaleString('en-US', { timeZone: tz, hour12: false });
    const timePart = nowStr.split(', ')[1] || '12:00:00';
    const [h, m, s] = timePart.split(':').map(Number);
    const currentMins = h * 60 + m;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    return currentMins >= startMins && currentMins <= endMins;
  } catch {
    return true;
  }
}

async function leadHasInboundReply(leadId) {
  const [rows] = await db.query(
    `SELECT id FROM outreach_messages
     WHERE lead_id = ? AND channel = 'sms' AND direction = 'inbound'
     LIMIT 1`,
    [leadId]
  );
  return rows.length > 0;
}

async function shouldStopEnrollment(campaign, lead) {
  if (Number(lead.outreach_opt_out) === 1 || lead.outreach_opt_out === true) {
    return 'outreach_opt_out';
  }
  const stopStatuses = parseJsonArray(campaign.stop_on_statuses, DEFAULT_STOP_STATUSES);
  if (stopStatuses.includes(lead.status)) return 'stop_status';
  if (TERMINAL_LEAD_STATUSES.has(lead.status)) return 'terminal_status';
  if (campaign.stop_on_reply && await leadHasInboundReply(lead.id)) return 'lead_replied';
  return null;
}

export function leadEligibleForEnrollment(lead, campaign) {
  if (!lead) return false;
  if (Number(lead.outreach_opt_out) === 1 || lead.outreach_opt_out === true) return false;
  if (TERMINAL_LEAD_STATUSES.has(lead.status)) return false;

  const mode = campaign.enrollment_mode || 'score_gated';
  if (mode === 'manual') return false;
  if (mode === 'all_leads') return true;

  const minScore = Number(campaign.trigger_min_score ?? 0);
  return (Number(lead.lead_score) || 0) >= minScore;
}

export async function computeInitialNextRun(campaignId) {
  const [steps] = await db.query(
    'SELECT * FROM drip_steps WHERE campaign_id = ? ORDER BY step_order ASC LIMIT 1',
    [campaignId]
  );
  if (!steps.length) return new Date();
  return new Date(Date.now() + stepDelayMs(steps[0]));
}

export async function enrollLeadInCampaign(userId, campaignId, leadId, { skipRules = false } = {}) {
  const [campaigns] = await db.query(
    'SELECT * FROM drip_campaigns WHERE id = ? AND user_id = ? AND status = "active"',
    [campaignId, userId]
  );
  if (!campaigns.length) return { enrolled: false, reason: 'campaign_not_active' };
  const campaign = campaigns[0];

  const [leads] = await db.query('SELECT * FROM leads WHERE id = ? AND user_id = ?', [leadId, userId]);
  if (!leads.length) return { enrolled: false, reason: 'lead_not_found' };
  const lead = leads[0];

  if (!skipRules && !leadEligibleForEnrollment(lead, campaign)) {
    return { enrolled: false, reason: 'rules_not_met' };
  }

  const [existing] = await db.query(
    'SELECT id FROM drip_enrollments WHERE campaign_id = ? AND lead_id = ?',
    [campaignId, leadId]
  );
  if (existing.length) return { enrolled: false, reason: 'already_enrolled' };

  const nextRun = await computeInitialNextRun(campaignId);

  await db.query(
    `INSERT INTO drip_enrollments (user_id, campaign_id, lead_id, current_step, next_run_at, status)
     VALUES (?, ?, ?, 1, ?, 'active')`,
    [userId, campaignId, leadId, nextRun]
  );
  return { enrolled: true };
}

export async function enrollLeadInActiveCampaigns(userId, leadId) {
  try {
    const [campaigns] = await db.query(
      'SELECT * FROM drip_campaigns WHERE user_id = ? AND status = "active"',
      [userId]
    );
    const [leads] = await db.query('SELECT * FROM leads WHERE id = ? AND user_id = ?', [leadId, userId]);
    if (!leads.length) return;
    const lead = leads[0];

    for (const c of campaigns) {
      if (!leadEligibleForEnrollment(lead, c)) continue;
      const [existing] = await db.query(
        'SELECT id FROM drip_enrollments WHERE campaign_id = ? AND lead_id = ?',
        [c.id, leadId]
      );
      if (existing.length === 0) {
        const nextRun = await computeInitialNextRun(c.id);
        await db.query(
          `INSERT INTO drip_enrollments (user_id, campaign_id, lead_id, current_step, next_run_at, status)
           VALUES (?, ?, ?, 1, ?, 'active')`,
          [userId, c.id, leadId, nextRun]
        );
      }
    }
  } catch (err) {
    console.error(`[Drip Engine] Auto-enrollment error for lead #${leadId}:`, err.message);
  }
}

async function logExecution({ enrollmentId, stepId, leadId, channel, status, errorMessage, externalId }) {
  await db.query(
    `INSERT INTO drip_step_executions (enrollment_id, step_id, lead_id, channel, status, error_message, external_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [enrollmentId, stepId, leadId, channel, status, errorMessage || null, externalId || null]
  );
}

async function hasRecentExecution(enrollmentId, stepId) {
  const [rows] = await db.query(
    `SELECT id FROM drip_step_executions
     WHERE enrollment_id = ? AND step_id = ? AND executed_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
     LIMIT 1`,
    [enrollmentId, stepId]
  );
  return rows.length > 0;
}

export async function processDueEnrollments({ userId = null } = {}) {
  let where = `e.status = 'active'
    AND c.status = 'active'
    AND (e.next_run_at IS NULL OR e.next_run_at <= NOW())`;
  const params = [];
  if (userId) {
    where += ' AND e.user_id = ?';
    params.push(userId);
  }

  const [enrollments] = await db.query(
    `SELECT e.*,
            l.id AS lead_id, l.owner_name, l.phone, l.email, l.address, l.estimated_savings,
            l.lead_score, l.status AS lead_status, l.outreach_opt_out,
            c.name AS campaign_name, c.user_id AS campaign_user_id,
            c.timezone, c.quiet_hours_start, c.quiet_hours_end,
            c.stop_on_reply, c.stop_on_statuses, c.enrollment_mode
     FROM drip_enrollments e
     JOIN leads l ON l.id = e.lead_id
     JOIN drip_campaigns c ON c.id = e.campaign_id
     WHERE ${where}
     ORDER BY e.next_run_at ASC
     LIMIT 100`,
    params
  );

  let processedCount = 0;
  const results = [];

  for (const en of enrollments) {
    const lead = {
      id: en.lead_id,
      owner_name: en.owner_name,
      phone: en.phone,
      email: en.email,
      address: en.address,
      estimated_savings: en.estimated_savings,
      lead_score: en.lead_score,
      status: en.lead_status,
      outreach_opt_out: en.outreach_opt_out,
    };

    const campaign = {
      timezone: en.timezone,
      quiet_hours_start: en.quiet_hours_start,
      quiet_hours_end: en.quiet_hours_end,
      stop_on_reply: en.stop_on_reply,
      stop_on_statuses: en.stop_on_statuses,
    };

    const stopReason = await shouldStopEnrollment(campaign, lead);
    if (stopReason) {
      await db.query('UPDATE drip_enrollments SET status = "cancelled" WHERE id = ?', [en.id]);
      results.push({ enrollmentId: en.id, status: 'cancelled', reason: stopReason });
      continue;
    }

    if (!isWithinBusinessHours(campaign)) {
      results.push({ enrollmentId: en.id, status: 'skipped', reason: 'outside_business_hours' });
      continue;
    }

    const [steps] = await db.query(
      'SELECT * FROM drip_steps WHERE campaign_id = ? AND step_order = ?',
      [en.campaign_id, en.current_step]
    );

    if (steps.length === 0) {
      await db.query('UPDATE drip_enrollments SET status = "completed" WHERE id = ?', [en.id]);
      results.push({ enrollmentId: en.id, status: 'completed' });
      continue;
    }

    const step = steps[0];

    if (await hasRecentExecution(en.id, step.id)) {
      results.push({ enrollmentId: en.id, status: 'skipped', reason: 'duplicate_guard' });
      continue;
    }

    const delivery = await executeDripStep({
      step,
      enrollment: en,
      lead,
      campaignName: en.campaign_name,
      userId: en.user_id,
    });

    await logExecution({
      enrollmentId: en.id,
      stepId: step.id,
      leadId: en.lead_id,
      channel: delivery.channel,
      status: delivery.status === 'simulated' ? 'sent' : delivery.status,
      errorMessage: delivery.errorMessage,
      externalId: delivery.externalId,
    });

    const [nextSteps] = await db.query(
      'SELECT * FROM drip_steps WHERE campaign_id = ? AND step_order > ? ORDER BY step_order ASC LIMIT 1',
      [en.campaign_id, en.current_step]
    );

    if (nextSteps.length > 0) {
      const nextStep = nextSteps[0];
      const nextRun = new Date(Date.now() + stepDelayMs(nextStep));
      await db.query(
        'UPDATE drip_enrollments SET current_step = ?, next_run_at = ? WHERE id = ?',
        [nextStep.step_order, nextRun, en.id]
      );
    } else {
      await db.query('UPDATE drip_enrollments SET status = "completed" WHERE id = ?', [en.id]);
    }

    processedCount += 1;
    results.push({ enrollmentId: en.id, stepId: step.id, delivery: delivery.status });
  }

  return { processedCount, totalDue: enrollments.length, results };
}

export async function getCampaignFunnel(campaignId, userId) {
  const [steps] = await db.query(
    'SELECT id, step_order, action_type FROM drip_steps WHERE campaign_id = ? ORDER BY step_order ASC',
    [campaignId]
  );
  const [enrolled] = await db.query(
    'SELECT COUNT(*) AS cnt FROM drip_enrollments WHERE campaign_id = ? AND user_id = ?',
    [campaignId, userId]
  );
  const [replied] = await db.query(
    `SELECT COUNT(DISTINCT om.lead_id) AS cnt
     FROM outreach_messages om
     JOIN drip_enrollments de ON de.lead_id = om.lead_id AND de.campaign_id = ?
     WHERE om.channel = 'sms' AND om.direction = 'inbound' AND de.user_id = ?`,
    [campaignId, userId]
  );
  const [converted] = await db.query(
    `SELECT COUNT(*) AS cnt FROM drip_enrollments de
     JOIN leads l ON l.id = de.lead_id
     WHERE de.campaign_id = ? AND de.user_id = ? AND l.status = 'won'`,
    [campaignId, userId]
  );

  const stepStats = [];
  for (const step of steps) {
    const [sent] = await db.query(
      `SELECT COUNT(*) AS cnt FROM drip_step_executions e
       JOIN drip_enrollments en ON en.id = e.enrollment_id
       WHERE en.campaign_id = ? AND en.user_id = ? AND e.step_id = ? AND e.status = 'sent'`,
      [campaignId, userId, step.id]
    );
    stepStats.push({
      stepOrder: step.step_order,
      actionType: step.action_type,
      sent: sent[0]?.cnt || 0,
    });
  }

  return {
    enrolled: enrolled[0]?.cnt || 0,
    replied: replied[0]?.cnt || 0,
    converted: converted[0]?.cnt || 0,
    steps: stepStats,
  };
}

export async function getCampaignStats(campaignId, userId) {
  const [sent] = await db.query(
    `SELECT COUNT(*) AS cnt FROM drip_step_executions e
     JOIN drip_enrollments en ON en.id = e.enrollment_id
     WHERE en.campaign_id = ? AND en.user_id = ? AND e.status = 'sent'`,
    [campaignId, userId]
  );
  const [failed] = await db.query(
    `SELECT COUNT(*) AS cnt FROM drip_step_executions e
     JOIN drip_enrollments en ON en.id = e.enrollment_id
     WHERE en.campaign_id = ? AND en.user_id = ? AND e.status = 'failed'`,
    [campaignId, userId]
  );
  const [skipped] = await db.query(
    `SELECT COUNT(*) AS cnt FROM drip_step_executions e
     JOIN drip_enrollments en ON en.id = e.enrollment_id
     WHERE en.campaign_id = ? AND en.user_id = ? AND e.status = 'skipped'`,
    [campaignId, userId]
  );
  const [active] = await db.query(
    'SELECT COUNT(*) AS cnt FROM drip_enrollments WHERE campaign_id = ? AND user_id = ? AND status = "active"',
    [campaignId, userId]
  );
  const [completed] = await db.query(
    'SELECT COUNT(*) AS cnt FROM drip_enrollments WHERE campaign_id = ? AND user_id = ? AND status = "completed"',
    [campaignId, userId]
  );
  const [cancelled] = await db.query(
    'SELECT COUNT(*) AS cnt FROM drip_enrollments WHERE campaign_id = ? AND user_id = ? AND status = "cancelled"',
    [campaignId, userId]
  );

  return {
    sent: sent[0]?.cnt || 0,
    failed: failed[0]?.cnt || 0,
    skipped: skipped[0]?.cnt || 0,
    activeEnrollments: active[0]?.cnt || 0,
    completedEnrollments: completed[0]?.cnt || 0,
    cancelledEnrollments: cancelled[0]?.cnt || 0,
  };
}
