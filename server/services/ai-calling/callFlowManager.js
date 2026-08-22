/**
 * Call Flow Manager — orchestrates the full lifecycle of an AI outbound call.
 */
import db from '../../db.js';
import { initiateOutboundCall, updateCallTwiml, generateVoicemailTwiML } from './twilioVoiceService.js';
import { generateCallSummary, extractQualification, scoreCallQuality } from './aiOrchestrator.js';
import { bookAppointmentWithIntegrations } from './calendarService.js';
import { updateQueueStatus, scheduleRetry } from './campaignEngine.js';
import {
  sendAppointmentConfirmation,
  sendAppointmentInviteEmail,
} from './smsNotificationService.js';
import { prepareRealtimeSession } from './realtimeVoiceAgent.js';
import { synthesizeSpeechAudio } from './elevenLabsService.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { buildSignedMediaFileUrl } from '../../utils/signedMediaUrl.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = process.env.PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:5002';
const VM_CACHE_DIR = path.resolve(__dirname, '../../uploads/voicemail-cache');

function formatMysqlDateTime(date = new Date()) {
  const d = new Date(date);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

export async function createCallRecord({ campaignId, queueId, leadId, userId }) {
  const streamToken = crypto.randomBytes(24).toString('hex');
  const [result] = await db.query(
    `INSERT INTO ai_call_records (campaign_id, queue_id, lead_id, user_id, status, stream_token, started_at)
     VALUES (?, ?, ?, ?, 'initiated', ?, NOW())`,
    [campaignId || null, queueId || null, leadId, userId, streamToken]
  );
  return { callRecordId: result.insertId, streamToken };
}

/** Verify Twilio media stream custom parameters against an active call record. */
export async function validateMediaStreamStart({ callRecordId, streamToken, twilioCallSid = null }) {
  if (!callRecordId || !streamToken) return false;
  const [rows] = await db.query(
    `SELECT id, stream_token, twilio_call_sid, status FROM ai_call_records
     WHERE id = ? AND stream_token = ? LIMIT 1`,
    [callRecordId, streamToken]
  );
  if (!rows.length) return false;
  const record = rows[0];
  const allowedStatuses = new Set(['initiated', 'ringing', 'in_progress']);
  if (!allowedStatuses.has(record.status)) return false;
  if (twilioCallSid && record.twilio_call_sid && record.twilio_call_sid !== twilioCallSid) {
    return false;
  }
  return true;
}

export async function updateCallRecord(callRecordId, updates) {
  const allowed = [
    'status',
    'disposition',
    'duration_seconds',
    'recording_url',
    'recording_sid',
    'transcript',
    'ai_summary',
    'ai_notes',
    'sentiment',
    'lead_score_delta',
    'qualification_data',
    'ended_at',
    'twilio_call_sid',
    'voice_provider',
    'elevenlabs_agent_id',
    'qa_score',
    'qa_notes',
  ];

  const setClauses = [];
  const values = [];

  for (const [key, val] of Object.entries(updates)) {
    if (allowed.includes(key)) {
      setClauses.push(`${key} = ?`);
      values.push(key === 'qualification_data' || key === 'qa_notes' ? (typeof val === 'object' ? JSON.stringify(val) : val) : val);
    }
  }

  if (setClauses.length === 0) return;
  values.push(callRecordId);
  await db.query(`UPDATE ai_call_records SET ${setClauses.join(', ')} WHERE id = ?`, values);
}

/**
 * Initiate an outbound AI call to a lead.
 */
export async function initiateAICall({ campaignId, queueId, leadId, userId, phoneNumber, campaign }) {
  // Compliance gate: DNC / do_not_call dispositions
  const [dnc] = await db.query(
    `SELECT id FROM ai_call_records
     WHERE lead_id = ? AND disposition = 'do_not_call' LIMIT 1`,
    [leadId]
  );
  if (dnc.length) {
    if (queueId) await updateQueueStatus(queueId, 'do_not_call');
    throw new Error('Lead is on do-not-call list');
  }

  const [leadRows] = await db.query(
    `SELECT status FROM leads WHERE id = ? AND user_id = ?`,
    [leadId, userId]
  );
  if (leadRows[0]?.status === 'do_not_call') {
    if (queueId) await updateQueueStatus(queueId, 'do_not_call');
    throw new Error('Lead marked do_not_call');
  }

  const { callRecordId: recordId, streamToken } = await createCallRecord({
    campaignId,
    queueId,
    leadId,
    userId,
  });

  prepareRealtimeSession({ callRecordId: recordId, leadId, campaignId, userId }).catch((err) => {
    console.error('[CallFlow] Error pre-warming voice session:', err.message);
  });

  if (queueId) {
    await updateQueueStatus(queueId, 'calling');
  }

  const publicBase = process.env.PUBLIC_URL || process.env.FRONTEND_URL || BASE_URL;
  const wsBase = publicBase.replace(/^https?:\/\//, 'wss://');

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsBase}/media-stream">
      <Parameter name="callRecordId" value="${recordId}" />
      <Parameter name="streamToken" value="${streamToken}" />
      <Parameter name="leadId" value="${leadId}" />
      <Parameter name="campaignId" value="${campaignId || ''}" />
      <Parameter name="userId" value="${userId}" />
    </Stream>
  </Connect>
</Response>`;

  const statusCallbackUrl = `${publicBase}/api/ai-calling/webhooks/voice-status?callRecordId=${recordId}`;
  const amdCallbackUrl = `${publicBase}/api/ai-calling/webhooks/amd?callRecordId=${recordId}`;

  try {
    const result = await initiateOutboundCall(phoneNumber, statusCallbackUrl, {
      callerId: campaign?.twilio_number || process.env.TWILIO_PHONE_NUMBER,
      twiml,
      record: true,
      recordingCallbackUrl: `${publicBase}/api/ai-calling/webhooks/recording?callRecordId=${recordId}`,
      amdStatusCallbackUrl: amdCallbackUrl,
      timeout: 30,
    });

    await updateCallRecord(recordId, {
      twilio_call_sid: result.callSid,
      status: 'ringing',
    });

    return { callRecordId: recordId, callSid: result.callSid, simulated: result.simulated };
  } catch (err) {
    console.error(`[CallFlow] Failed to initiate call for lead ${leadId}:`, err.message);
    await updateCallRecord(recordId, { status: 'failed', ended_at: formatMysqlDateTime() });
    if (queueId) await updateQueueStatus(queueId, 'failed');
    throw err;
  }
}

/**
 * Handle AMD (answering machine detection) — drop ElevenLabs voicemail or hang up.
 */
export async function handleAmdWebhook(callRecordId, twilioData) {
  const answeredBy = (twilioData.AnsweredBy || twilioData.answered_by || '').toLowerCase();
  console.log(`[CallFlow] AMD for CallRecord #${callRecordId}: ${answeredBy}`);

  const isMachine =
    answeredBy.includes('machine') ||
    answeredBy === 'fax' ||
    answeredBy === 'machine_start' ||
    answeredBy === 'machine_end_beep' ||
    answeredBy === 'machine_end_silence' ||
    answeredBy === 'machine_end_other';

  if (!isMachine) return { handled: false, answeredBy };

  const [records] = await db.query('SELECT * FROM ai_call_records WHERE id = ?', [callRecordId]);
  if (!records.length) return { handled: false };
  const record = records[0];

  // Load voicemail template
  let script =
    "Hi, this is Emily with Solar Velocity. Sorry we missed you — we're offering a free solar savings consultation. We'll try you again soon. Have a great day!";
  try {
    const [templates] = await db.query(
      `SELECT script FROM ai_voicemail_templates WHERE user_id = ? AND is_default = 1 LIMIT 1`,
      [record.user_id]
    );
    if (templates.length) script = templates[0].script;
  } catch {
    /* ignore */
  }

  let audioUrl = null;
  try {
    const [settings] = await db.query(
      `SELECT elevenlabs_voice_id FROM ai_calling_settings WHERE user_id = ? LIMIT 1`,
      [record.user_id]
    );
    const voiceId = settings[0]?.elevenlabs_voice_id || '21m00Tcm4TlvDq8ikWAM';
    const audio = await synthesizeSpeechAudio(script, voiceId, 'mp3_44100_128');
    if (audio) {
      if (!fs.existsSync(VM_CACHE_DIR)) fs.mkdirSync(VM_CACHE_DIR, { recursive: true });
      const fileName = `vm_${callRecordId}_${Date.now()}.mp3`;
      const filePath = path.join(VM_CACHE_DIR, fileName);
      fs.writeFileSync(filePath, audio);
      const publicBase = process.env.PUBLIC_URL || process.env.FRONTEND_URL || BASE_URL;
      audioUrl = buildSignedMediaFileUrl(publicBase, fileName);
    }
  } catch (err) {
    console.error('[CallFlow] Voicemail TTS failed:', err.message);
  }

  const twiml = generateVoicemailTwiML(script, audioUrl);
  if (record.twilio_call_sid) {
    await updateCallTwiml(record.twilio_call_sid, twiml);
  }

  await updateCallRecord(callRecordId, {
    status: 'voicemail',
    disposition: 'voicemail_left',
    ended_at: formatMysqlDateTime(),
    ai_notes: `AMD detected machine (${answeredBy}). Voicemail dropped.`,
  });

  if (record.queue_id) {
    const [campaigns] = await db.query(
      'SELECT retry_delay_minutes FROM ai_calling_campaigns WHERE id = ?',
      [record.campaign_id]
    );
    const delay = campaigns.length ? campaigns[0].retry_delay_minutes : 60;
    await scheduleRetry(record.queue_id, delay);
    await updateQueueStatus(record.queue_id, 'voicemail');
  }

  return { handled: true, answeredBy, audioUrl: !!audioUrl };
}

export async function handleCallCompletion(callRecordId) {
  const [records] = await db.query('SELECT * FROM ai_call_records WHERE id = ?', [callRecordId]);
  if (!records.length) return;
  const record = records[0];

  const transcript = record.transcript || '';
  if (!transcript || transcript.length < 20) {
    await updateCallRecord(callRecordId, {
      status: record.status === 'transferred' ? 'transferred' : 'completed',
      disposition: record.disposition || 'no_disposition',
      ended_at: formatMysqlDateTime(),
    });
    return;
  }

  try {
    const qualification = await extractQualification(transcript);
    const summary = await generateCallSummary(transcript);
    const qa = await scoreCallQuality(transcript);

    await updateCallRecord(callRecordId, {
      status: record.status === 'transferred' ? 'transferred' : 'completed',
      disposition: summary.disposition || record.disposition || 'no_disposition',
      ai_summary: summary.summary,
      ai_notes: summary.nextAction || '',
      sentiment: summary.sentiment || 'unknown',
      lead_score_delta: summary.leadScoreDelta || 0,
      qualification_data: qualification,
      qa_score: qa.score ?? null,
      qa_notes: qa,
      ended_at: formatMysqlDateTime(),
    });

    const [existingAppts] = await db.query(
      'SELECT id FROM ai_calling_appointments WHERE call_record_id = ?',
      [callRecordId]
    );

    if (
      summary.disposition === 'appointment_booked' &&
      existingAppts.length === 0 &&
      qualification.preferredAppointmentTime
    ) {
      await handleAppointmentBooking(record, qualification);
    }

    if (record.queue_id) {
      const finalStatus = mapDispositionToQueueStatus(summary.disposition);
      await updateQueueStatus(record.queue_id, finalStatus);
    }

    if (record.campaign_id) {
      await db.query(
        `UPDATE ai_calling_campaigns SET completed_calls = completed_calls + 1 WHERE id = ?`,
        [record.campaign_id]
      );
    }

    await db.query(
      `INSERT INTO lead_activities (lead_id, user_id, type, content, meta)
       VALUES (?, ?, 'ai_call', ?, ?)`,
      [
        record.lead_id,
        record.user_id,
        summary.summary,
        JSON.stringify({
          callRecordId,
          disposition: summary.disposition,
          sentiment: summary.sentiment,
          qaScore: qa.score,
        }),
      ]
    );

    await db.query(
      `INSERT INTO ai_calling_audit_log (user_id, action, entity_type, entity_id, details)
       VALUES (?, 'call_completed', 'ai_call_record', ?, ?)`,
      [
        record.user_id,
        callRecordId,
        JSON.stringify({ disposition: summary.disposition, qaScore: qa.score, provider: record.voice_provider }),
      ]
    );
  } catch (err) {
    console.error(`[CallFlow] Error processing call completion for record ${callRecordId}:`, err.message);
    await updateCallRecord(callRecordId, {
      status: 'completed',
      disposition: 'no_disposition',
      ai_notes: `Error during processing: ${err.message}`,
      ended_at: formatMysqlDateTime(),
    });
  }
}

async function handleAppointmentBooking(callRecord, qualification) {
  let scheduledAtDate = new Date();
  if (qualification.preferredAppointmentTime) {
    const parsed = new Date(qualification.preferredAppointmentTime);
    if (!isNaN(parsed.getTime())) {
      scheduledAtDate = parsed;
    } else {
      scheduledAtDate.setDate(scheduledAtDate.getDate() + 1);
      scheduledAtDate.setHours(10, 0, 0, 0);
    }
  }
  const mysqlScheduledAt = scheduledAtDate.toISOString().slice(0, 19).replace('T', ' ');

  const [leads] = await db.query(
    'SELECT phone, owner_name, email, address, property_json, mailing_address FROM leads WHERE id = ?',
    [callRecord.lead_id]
  );
  const { enrichLeadGeo } = await import('./leadGeo.js');
  const lead = enrichLeadGeo(leads[0] || {});

  const booked = await bookAppointmentWithIntegrations({
    userId: callRecord.user_id,
    leadId: callRecord.lead_id,
    scheduledAt: mysqlScheduledAt,
    durationMinutes: 30,
    notes: `Booked by AI caller. Monthly bill: ${qualification.monthlyElectricBill || 'Unknown'}`,
    lead,
  });

  await db.query(
    `INSERT INTO ai_calling_appointments
     (call_record_id, lead_id, user_id, appointment_id, agency_name, scheduled_at, duration_minutes,
      status, google_calendar_event_id, outlook_event_id, invite_link, agency_id)
     VALUES (?, ?, ?, ?, ?, ?, 30, 'confirmed', ?, ?, ?, ?)`,
    [
      callRecord.id,
      callRecord.lead_id,
      callRecord.user_id,
      booked.appointmentId,
      booked.agency?.name || null,
      mysqlScheduledAt,
      booked.googleEventId,
      booked.outlookEventId,
      booked.inviteLink,
      booked.agency?.id || null,
    ]
  );

  await db.query(`UPDATE leads SET status = 'appointment_booked' WHERE id = ? AND user_id = ?`, [
    callRecord.lead_id,
    callRecord.user_id,
  ]);

  if (lead.phone) {
    try {
      await sendAppointmentConfirmation(lead, {
        scheduledAt: mysqlScheduledAt,
        durationMinutes: 30,
        agencyName: booked.agency?.name,
        inviteLink: booked.inviteLink,
      });
    } catch (err) {
      console.error('[CallFlow] SMS confirmation failed:', err.message);
    }
  }
  try {
    await sendAppointmentInviteEmail(lead, {
      scheduledAt: mysqlScheduledAt,
      durationMinutes: 30,
      agencyName: booked.agency?.name,
      inviteLink: booked.inviteLink,
    });
  } catch (err) {
    console.error('[CallFlow] Email invite failed:', err.message);
  }
}

export async function handleVoiceStatusWebhook(callRecordId, twilioData) {
  const status = (twilioData.CallStatus || '').toLowerCase();
  const statusMap = {
    queued: 'initiated',
    ringing: 'ringing',
    'in-progress': 'in_progress',
    completed: 'completed',
    'no-answer': 'no_answer',
    busy: 'busy',
    failed: 'failed',
    canceled: 'failed',
  };

  const mappedStatus = statusMap[status] || 'initiated';
  const updates = { status: mappedStatus };

  if (twilioData.CallDuration) {
    updates.duration_seconds = parseInt(twilioData.CallDuration, 10);
  }
  if (twilioData.RecordingUrl) {
    updates.recording_url = twilioData.RecordingUrl;
  }
  if (twilioData.CallSid) {
    updates.twilio_call_sid = twilioData.CallSid;
  }

  await updateCallRecord(callRecordId, updates);

  if (['completed', 'no_answer', 'busy', 'failed'].includes(mappedStatus)) {
    if (mappedStatus === 'no_answer' || mappedStatus === 'busy') {
      const [records] = await db.query('SELECT queue_id, campaign_id FROM ai_call_records WHERE id = ?', [
        callRecordId,
      ]);
      if (records.length && records[0].queue_id) {
        const [campaigns] = await db.query(
          'SELECT retry_delay_minutes FROM ai_calling_campaigns WHERE id = ?',
          [records[0].campaign_id]
        );
        const delay = campaigns.length ? campaigns[0].retry_delay_minutes : 60;
        await scheduleRetry(records[0].queue_id, delay);
      }
      await updateCallRecord(callRecordId, {
        disposition: 'no_disposition',
        ended_at: formatMysqlDateTime(),
      });
    } else if (mappedStatus === 'completed') {
      handleCallCompletion(callRecordId).catch((err) => {
        console.error('[CallFlow] Async completion error:', err.message);
      });
    }
  }
}

function mapDispositionToQueueStatus(disposition) {
  const map = {
    qualified: 'completed',
    appointment_booked: 'completed',
    not_interested: 'completed',
    callback: 'callback',
    wrong_number: 'failed',
    do_not_call: 'do_not_call',
    voicemail_left: 'voicemail',
    no_disposition: 'completed',
  };
  return map[disposition] || 'completed';
}
