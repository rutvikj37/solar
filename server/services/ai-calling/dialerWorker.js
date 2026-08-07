/**
 * Campaign Dialer Worker — processes active campaign queues automatically.
 */
import db from '../../db.js';
import {
  getNextQueueItem,
  isWithinCallingWindow,
  updateQueueStatus,
} from './campaignEngine.js';
import { initiateAICall } from './callFlowManager.js';
import { getActiveSessionCount } from './realtimeVoiceAgent.js';
import { sendAppointmentReminder } from './smsNotificationService.js';

let dialerTimer = null;
let reminderTimer = null;
let tickInFlight = false;

async function getSettingsForUser(userId) {
  const [rows] = await db.query(
    `SELECT daily_call_limit, concurrent_call_limit FROM ai_calling_settings WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  return {
    dailyCallLimit: rows[0]?.daily_call_limit ?? 100,
    concurrentCallLimit: rows[0]?.concurrent_call_limit ?? 5,
  };
}

async function countTodayCalls(userId) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS cnt FROM ai_call_records
     WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
    [userId]
  );
  return rows[0]?.cnt || 0;
}

async function isLeadCallable(leadId) {
  const [dnc] = await db.query(
    `SELECT id FROM ai_call_records WHERE lead_id = ? AND disposition = 'do_not_call' LIMIT 1`,
    [leadId]
  );
  if (dnc.length) return false;
  const [leads] = await db.query(`SELECT status, phone FROM leads WHERE id = ?`, [leadId]);
  if (!leads.length) return false;
  if (leads[0].status === 'do_not_call') return false;
  if (!leads[0].phone) return false;
  return true;
}

async function dialOneCampaign(campaign) {
  if (!isWithinCallingWindow(campaign)) return false;

  const settings = await getSettingsForUser(campaign.user_id);
  const active = getActiveSessionCount();
  if (active >= settings.concurrentCallLimit) {
    console.log(`[Dialer] Concurrent limit reached (${active}/${settings.concurrentCallLimit})`);
    return false;
  }

  const todayCount = await countTodayCalls(campaign.user_id);
  if (todayCount >= settings.dailyCallLimit) {
    console.log(`[Dialer] Daily limit reached for user ${campaign.user_id}`);
    return false;
  }

  const item = await getNextQueueItem(campaign.id);
  if (!item) return false;

  if (!(await isLeadCallable(item.lead_id))) {
    await updateQueueStatus(item.id, 'do_not_call');
    return true;
  }

  try {
    console.log(`[Dialer] Dialing queue #${item.id} lead #${item.lead_id} campaign #${campaign.id}`);
    await initiateAICall({
      campaignId: campaign.id,
      queueId: item.id,
      leadId: item.lead_id,
      userId: campaign.user_id,
      phoneNumber: item.phone,
      campaign,
    });
    return true;
  } catch (err) {
    console.error(`[Dialer] Failed queue #${item.id}:`, err.message);
    await updateQueueStatus(item.id, 'failed');
    return true;
  }
}

async function dialerTick() {
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    const [campaigns] = await db.query(
      `SELECT * FROM ai_calling_campaigns WHERE status = 'active' ORDER BY updated_at ASC`
    );
    for (const campaign of campaigns) {
      // Attempt up to concurrent slots worth per campaign per tick
      const settings = await getSettingsForUser(campaign.user_id);
      const room = Math.max(1, Math.min(3, settings.concurrentCallLimit - getActiveSessionCount()));
      for (let i = 0; i < room; i++) {
        const dialed = await dialOneCampaign(campaign);
        if (!dialed) break;
      }
    }
  } catch (err) {
    console.error('[Dialer] Tick error:', err.message);
  } finally {
    tickInFlight = false;
  }
}

/**
 * Send 24h and 1h appointment reminders.
 */
async function reminderTick() {
  try {
    // 24h window: 23-25 hours ahead
    const [soon24] = await db.query(
      `SELECT a.*, l.phone, l.owner_name, l.email
       FROM ai_calling_appointments a
       JOIN leads l ON l.id = a.lead_id
       WHERE a.status = 'confirmed'
         AND a.reminder_24h_sent = 0
         AND a.scheduled_at BETWEEN DATE_ADD(NOW(), INTERVAL 23 HOUR) AND DATE_ADD(NOW(), INTERVAL 25 HOUR)`
    );
    for (const appt of soon24) {
      try {
        await sendAppointmentReminder(
          { phone: appt.phone, owner_name: appt.owner_name },
          { scheduledAt: appt.scheduled_at, inviteLink: appt.invite_link },
          'tomorrow'
        );
        await db.query(`UPDATE ai_calling_appointments SET reminder_24h_sent = 1 WHERE id = ?`, [appt.id]);
      } catch (err) {
        console.error('[Reminder] 24h failed:', err.message);
      }
    }

    const [soon1] = await db.query(
      `SELECT a.*, l.phone, l.owner_name
       FROM ai_calling_appointments a
       JOIN leads l ON l.id = a.lead_id
       WHERE a.status = 'confirmed'
         AND a.reminder_1h_sent = 0
         AND a.scheduled_at BETWEEN DATE_ADD(NOW(), INTERVAL 50 MINUTE) AND DATE_ADD(NOW(), INTERVAL 70 MINUTE)`
    );
    for (const appt of soon1) {
      try {
        await sendAppointmentReminder(
          { phone: appt.phone, owner_name: appt.owner_name },
          { scheduledAt: appt.scheduled_at, inviteLink: appt.invite_link },
          'in about an hour'
        );
        await db.query(`UPDATE ai_calling_appointments SET reminder_1h_sent = 1 WHERE id = ?`, [appt.id]);
      } catch (err) {
        console.error('[Reminder] 1h failed:', err.message);
      }
    }
  } catch (err) {
    console.error('[Reminder] Tick error:', err.message);
  }
}

export function startDialerWorker({ intervalMs = 15000 } = {}) {
  if (dialerTimer) return;
  console.log(`[Dialer] Starting campaign dialer worker (every ${intervalMs}ms)`);
  dialerTimer = setInterval(dialerTick, intervalMs);
  // Kick once shortly after boot
  setTimeout(dialerTick, 3000);

  if (!reminderTimer) {
    reminderTimer = setInterval(reminderTick, 5 * 60 * 1000);
    setTimeout(reminderTick, 10000);
  }
}

export function stopDialerWorker() {
  if (dialerTimer) {
    clearInterval(dialerTimer);
    dialerTimer = null;
  }
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }
}

export async function runDialerOnce() {
  await dialerTick();
}
