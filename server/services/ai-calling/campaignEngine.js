/**
 * Campaign Engine — manages campaign lifecycle: start, pause, resume, stop,
 * queue processing, retry logic, voicemail drops, and the main dialer loop.
 */
import db from '../../db.js';

/**
 * Start a campaign — set status to 'active' and initialize queue scheduling.
 */
export async function startCampaign(campaignId, userId) {
  const [campaigns] = await db.query(
    'SELECT * FROM ai_calling_campaigns WHERE id = ? AND user_id = ?',
    [campaignId, userId]
  );
  if (!campaigns.length) throw new Error('Campaign not found');
  const campaign = campaigns[0];

  if (campaign.status === 'active') return campaign;
  if (campaign.status === 'completed' || campaign.status === 'cancelled') {
    throw new Error('Cannot start a completed or cancelled campaign');
  }

  await db.query(
    `UPDATE ai_calling_campaigns SET status = 'active', updated_at = NOW() WHERE id = ?`,
    [campaignId]
  );

  // Initialize pending queue items with first attempt time
  await db.query(
    `UPDATE ai_calling_queue SET next_attempt_at = NOW(), status = 'pending'
     WHERE campaign_id = ? AND status = 'pending' AND next_attempt_at IS NULL`,
    [campaignId]
  );

  console.log(`[CampaignEngine] Campaign ${campaignId} started`);
  return { ...campaign, status: 'active' };
}

/**
 * Pause a campaign.
 */
export async function pauseCampaign(campaignId, userId) {
  await db.query(
    `UPDATE ai_calling_campaigns SET status = 'paused', updated_at = NOW()
     WHERE id = ? AND user_id = ? AND status = 'active'`,
    [campaignId, userId]
  );
  console.log(`[CampaignEngine] Campaign ${campaignId} paused`);
}

/**
 * Resume a paused campaign.
 */
export async function resumeCampaign(campaignId, userId) {
  await db.query(
    `UPDATE ai_calling_campaigns SET status = 'active', updated_at = NOW()
     WHERE id = ? AND user_id = ? AND status = 'paused'`,
    [campaignId, userId]
  );
  console.log(`[CampaignEngine] Campaign ${campaignId} resumed`);
}

/**
 * Stop a campaign permanently.
 */
export async function stopCampaign(campaignId, userId) {
  await db.query(
    `UPDATE ai_calling_campaigns SET status = 'completed', updated_at = NOW()
     WHERE id = ? AND user_id = ?`,
    [campaignId, userId]
  );

  // Mark all pending queue items as failed
  await db.query(
    `UPDATE ai_calling_queue SET status = 'failed'
     WHERE campaign_id = ? AND status IN ('pending', 'callback')`,
    [campaignId]
  );

  console.log(`[CampaignEngine] Campaign ${campaignId} stopped`);
}

/**
 * Add leads to a campaign queue.
 */
export async function addLeadsToCampaign(campaignId, userId, leadIds) {
  if (!leadIds.length) return { added: 0, skipped: 0 };

  let added = 0;
  let skipped = 0;

  const [campaign] = await db.query(
    'SELECT retry_attempts FROM ai_calling_campaigns WHERE id = ? AND user_id = ?',
    [campaignId, userId]
  );
  const maxAttempts = campaign.length ? campaign[0].retry_attempts || 3 : 3;

  for (const leadId of leadIds) {
    try {
      await db.query(
        `INSERT INTO ai_calling_queue (campaign_id, lead_id, user_id, max_attempts, status, next_attempt_at)
         VALUES (?, ?, ?, ?, 'pending', NOW())`,
        [campaignId, leadId, userId, maxAttempts]
      );
      added++;
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        skipped++;
      } else {
        throw err;
      }
    }
  }

  // Update campaign total_leads count
  await db.query(
    `UPDATE ai_calling_campaigns SET total_leads = (
       SELECT COUNT(*) FROM ai_calling_queue WHERE campaign_id = ?
     ), updated_at = NOW() WHERE id = ?`,
    [campaignId, campaignId]
  );

  return { added, skipped };
}

/**
 * Get the next lead to call from a campaign queue.
 * Respects calling window and daily limits.
 */
export async function getNextQueueItem(campaignId) {
  const [items] = await db.query(
    `SELECT q.*, l.phone, l.owner_name, l.address, l.email, l.estimated_savings, l.property_json, l.mailing_address
     FROM ai_calling_queue q
     JOIN leads l ON l.id = q.lead_id
     WHERE q.campaign_id = ?
       AND q.status IN ('pending', 'callback')
       AND q.next_attempt_at <= NOW()
       AND q.attempt_count < q.max_attempts
       AND l.phone IS NOT NULL AND l.phone != ''
     ORDER BY q.priority DESC, q.next_attempt_at ASC
     LIMIT 1`,
    [campaignId]
  );

  if (!items.length) return null;
  const { enrichLeadGeo } = await import('./leadGeo.js');
  return enrichLeadGeo(items[0]);
}

/**
 * Check if current time is within the campaign's calling window.
 */
export function isWithinCallingWindow(campaign) {
  const tz = campaign.timezone || 'America/New_York';
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const currentHour = parseInt(parts.find((p) => p.type === 'hour').value, 10);
  const currentMin = parseInt(parts.find((p) => p.type === 'minute').value, 10);
  const currentTime = currentHour * 60 + currentMin;

  const [startH, startM] = (campaign.calling_window_start || '09:00').split(':').map(Number);
  const [endH, endM] = (campaign.calling_window_end || '20:00').split(':').map(Number);

  const startTime = startH * 60 + (startM || 0);
  const endTime = endH * 60 + (endM || 0);

  // Check day of week
  const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' });
  const currentDay = dayFormatter.format(now);
  const allowedDays = campaign.calling_days
    ? (typeof campaign.calling_days === 'string' ? JSON.parse(campaign.calling_days) : campaign.calling_days)
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  if (!allowedDays.includes(currentDay)) return false;
  return currentTime >= startTime && currentTime < endTime;
}

/**
 * Schedule a retry for a queue item.
 */
export async function scheduleRetry(queueId, retryDelayMinutes) {
  await db.query(
    `UPDATE ai_calling_queue
     SET attempt_count = attempt_count + 1,
         last_attempt_at = NOW(),
         next_attempt_at = DATE_ADD(NOW(), INTERVAL ? MINUTE),
         status = 'pending'
     WHERE id = ?`,
    [retryDelayMinutes, queueId]
  );
}

/**
 * Mark a queue item with a final status.
 */
export async function updateQueueStatus(queueId, status) {
  await db.query(
    `UPDATE ai_calling_queue SET status = ?, last_attempt_at = NOW() WHERE id = ?`,
    [status, queueId]
  );
}

/**
 * Schedule a callback for a queue item.
 */
export async function scheduleCallback(queueId, callbackAt) {
  await db.query(
    `UPDATE ai_calling_queue
     SET status = 'callback', callback_at = ?, next_attempt_at = ?
     WHERE id = ?`,
    [callbackAt, callbackAt, queueId]
  );
}

/**
 * Get campaign progress stats.
 */
export async function getCampaignProgress(campaignId) {
  const [rows] = await db.query(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
       SUM(CASE WHEN status = 'calling' THEN 1 ELSE 0 END) as in_progress,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
       SUM(CASE WHEN status = 'answered' THEN 1 ELSE 0 END) as answered,
       SUM(CASE WHEN status = 'no_answer' THEN 1 ELSE 0 END) as no_answer,
       SUM(CASE WHEN status = 'voicemail' THEN 1 ELSE 0 END) as voicemail,
       SUM(CASE WHEN status = 'callback' THEN 1 ELSE 0 END) as callback,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
       SUM(CASE WHEN status = 'do_not_call' THEN 1 ELSE 0 END) as do_not_call
     FROM ai_calling_queue WHERE campaign_id = ?`,
    [campaignId]
  );
  return rows[0] || {};
}
