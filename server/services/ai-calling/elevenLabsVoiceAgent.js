/**
 * ElevenLabs Conversational AI ↔ Twilio Media Streams bridge.
 * Primary live-call voice path for human-feel sales conversations.
 */
import WebSocket from 'ws';
import db from '../../db.js';
import { updateCallRecord, handleCallCompletion } from './callFlowManager.js';
import { executeTool } from './toolExecutor.js';
import { buildRealtimeSystemPrompt } from './aiOrchestrator.js';
import {
  isElevenLabsLive,
  getConversationSignedUrl,
  ensureCampaignAgent,
  TWILIO_ULAW_8000,
  twilioConvAiAudioConfig,
  CONVAI_TTS_MODEL,
  CONVAI_TTS_SETTINGS,
  convAiTurnConfig,
  resolveDefaultVoiceId,
  DEFAULT_VOICE_NAME,
} from './elevenLabsService.js';
import { enrichLeadGeo } from './leadGeo.js';
import { BRAND_NAME } from '../../config/brand.js';

const elPrewarmedSessions = new Map();
const elActiveSessions = new Map();

function buildGreeting(campaign, leadData) {
  if (campaign?.greeting_script && String(campaign.greeting_script).trim()) {
    return String(campaign.greeting_script).trim();
  }
  const callerName = campaign?.caller_name || 'Emily';
  const businessName = campaign?.business_name || BRAND_NAME;
  const customerName = leadData?.owner_name || 'there';
  return `Hi, may I speak with ${customerName}?`;
}

async function loadCallContext({ leadId, campaignId, userId }) {
  let leadData = {};
  let previousCalls = [];
  let campaign = {};
  let knowledgeBase = [];
  let settings = {};

  try {
    if (leadId) {
      const [leads] = await db.query(
        `SELECT owner_name, phone, address, email, estimated_savings, roof_size, solar_potential, status, property_json, mailing_address
         FROM leads WHERE id = ?`,
        [leadId]
      );
      if (leads.length) leadData = enrichLeadGeo(leads[0]);

      const [prevCalls] = await db.query(
        `SELECT transcript, disposition, ai_summary, sentiment, created_at
         FROM ai_call_records
         WHERE lead_id = ? AND transcript IS NOT NULL AND transcript != ''
         ORDER BY created_at DESC LIMIT 3`,
        [leadId]
      );
      previousCalls = prevCalls;
    }

    if (campaignId) {
      const [campaigns] = await db.query(
        `SELECT id, name, caller_name, business_name, greeting_script, system_prompt,
                qualification_questions, objection_responses, elevenlabs_voice_id, elevenlabs_agent_id
         FROM ai_calling_campaigns WHERE id = ?`,
        [campaignId]
      );
      if (campaigns.length) campaign = campaigns[0];
    }

    if (userId) {
      const [kbEntries] = await db.query(
        `SELECT category, title, content FROM ai_knowledge_base WHERE user_id = ? AND is_active = 1 LIMIT 10`,
        [userId]
      );
      knowledgeBase = kbEntries;

      const [settingsRows] = await db.query(
        `SELECT elevenlabs_voice_id, elevenlabs_agent_id, default_caller_name, default_business_name
         FROM ai_calling_settings WHERE user_id = ? LIMIT 1`,
        [userId]
      );
      if (settingsRows.length) settings = settingsRows[0];
    }
  } catch (err) {
    console.error('[ElevenLabsAgent] Context load error:', err.message);
  }

  if (!campaign.caller_name && settings.default_caller_name) {
    campaign.caller_name = settings.default_caller_name;
  }
  if (!campaign.business_name && settings.default_business_name) {
    campaign.business_name = settings.default_business_name;
  }

  return { leadData, previousCalls, campaign, knowledgeBase, settings };
}

/**
 * Pre-warm ElevenLabs agent config while ringing — does NOT connect ConvAI or speak.
 */
export async function prepareElevenLabsSession({ callRecordId, leadId, campaignId, userId }) {
  if (!isElevenLabsLive()) return null;

  const key = String(callRecordId);
  if (elPrewarmedSessions.has(key)) {
    return elPrewarmedSessions.get(key);
  }

  console.log(`[ElevenLabsAgent] Preparing ConvAI context for CallRecord #${callRecordId} (no WS until answered)...`);

  const { leadData, previousCalls, campaign, knowledgeBase, settings } = await loadCallContext({
    leadId,
    campaignId,
    userId,
  });

  let systemPrompt = buildRealtimeSystemPrompt(leadData, campaign, previousCalls, knowledgeBase);
  if (campaign.system_prompt && String(campaign.system_prompt).trim()) {
    systemPrompt = `${String(campaign.system_prompt).trim()}\n\n---\n${systemPrompt}`;
  }
  systemPrompt += `\n\nCALL STYLE: Brief qualification call — not a sales pitch. Respect their time.\nTURN-TAKING: After ANY question, stop immediately and wait in silence for their answer. If silent 8+ seconds, one brief "Still with me?" then wait again.\nOPENING: If they haven't spoken, start with "Hi, may I speak with [name]?" — wait — then give the brief ${campaign?.caller_name || 'Emily'}/${campaign?.business_name || BRAND_NAME} intro and ask for 30 seconds.`;

  const greetingScript = buildGreeting(campaign, leadData);
  const voiceId =
    campaign.elevenlabs_voice_id ||
    settings.elevenlabs_voice_id ||
    (await resolveDefaultVoiceId(DEFAULT_VOICE_NAME));

  // Agent config uses empty first_message — greeting only after pickup + silence fallback
  const agentResult = await ensureCampaignAgent({
    campaignId,
    campaignName: campaign.name || `${campaign.caller_name || 'Emily'} Sales`,
    voiceId,
    systemPrompt,
    firstMessage: '',
    existingAgentId: campaign.elevenlabs_agent_id,
    settingsAgentId: settings.elevenlabs_agent_id,
  });

  if (!agentResult.agentId) {
    console.warn('[ElevenLabsAgent] No agent id available — skipping EL prewarm');
    return null;
  }

  const sessionObj = {
    provider: 'elevenlabs',
    elevenWs: null,
    callRecordId,
    leadId,
    campaignId,
    userId,
    agentId: agentResult.agentId,
    voiceId,
    systemPrompt,
    greetingScript,
    greetingCustomerName: leadData?.owner_name || 'there',
    callAnswered: false,
    audioBuffer: [],
    sessionReady: false,
    initialGreetingSent: false,
    transcript: [],
    twilioWs: null,
    streamSid: null,
    markCounter: 0,
    lastInterruptId: 0,
    audioBlocked: false,
    agentSpeaking: false,
    lastVadClearAt: 0,
    twilioCallSid: null,
    wsConnecting: false,
  };

  elPrewarmedSessions.set(key, sessionObj);

  try {
    await updateCallRecord(callRecordId, {
      voice_provider: 'elevenlabs',
      elevenlabs_agent_id: agentResult.agentId,
    });
  } catch {
    /* columns may not exist yet during first boot race */
  }

  return sessionObj;
}

/**
 * Connect ElevenLabs ConvAI WebSocket — only after the callee has answered.
 */
async function connectElevenLabsWebSocket(sessionObj) {
  if (sessionObj.elevenWs?.readyState === WebSocket.OPEN) return;
  if (sessionObj.wsConnecting) return;
  sessionObj.wsConnecting = true;

  const signed = await getConversationSignedUrl(sessionObj.agentId);
  if (!signed.url) {
    console.warn(`[ElevenLabsAgent] No signed URL for CallRecord #${sessionObj.callRecordId}`);
    sessionObj.wsConnecting = false;
    return;
  }

  console.log(`[ElevenLabsAgent] Connecting ConvAI WS after answer — CallRecord #${sessionObj.callRecordId}`);

  const elevenWs = new WebSocket(signed.url);
  sessionObj.elevenWs = elevenWs;

  elevenWs.on('open', () => {
    console.log(`[ElevenLabsAgent] ConvAI WS open (call answered) — CallRecord #${sessionObj.callRecordId}`);
    const twilioAudio = twilioConvAiAudioConfig();
    elevenWs.send(
      JSON.stringify({
        type: 'conversation_initiation_client_data',
        conversation_config_override: {
          agent: {
            prompt: { prompt: sessionObj.systemPrompt },
            first_message: '',
            language: 'en',
          },
          tts: {
            voice_id: sessionObj.voiceId,
            model_id: CONVAI_TTS_MODEL,
            stability: CONVAI_TTS_SETTINGS.stability,
            similarity_boost: CONVAI_TTS_SETTINGS.similarity_boost,
            speed: CONVAI_TTS_SETTINGS.speed,
            agent_output_audio_format: twilioAudio.agent_output_audio_format,
          },
          asr: {
            user_input_audio_format: twilioAudio.user_input_audio_format,
          },
          turn: convAiTurnConfig(),
        },
        source_info: { source: 'twilio', version: '1.0.0' },
      })
    );
    sessionObj.wsConnecting = false;
    scheduleElevenLabsGreetingFallback(sessionObj);
  });

  elevenWs.on('message', async (rawData) => {
    try {
      const event = JSON.parse(rawData.toString());
      await handleElevenLabsEvent(sessionObj, event);
    } catch (err) {
      console.error('[ElevenLabsAgent] Message error:', err.message);
    }
  });

  elevenWs.on('close', () => {
    console.log(`[ElevenLabsAgent] ConvAI WS closed — CallRecord #${sessionObj.callRecordId}`);
    sessionObj.wsConnecting = false;
  });

  elevenWs.on('error', (err) => {
    console.error(`[ElevenLabsAgent] ConvAI WS error — CallRecord #${sessionObj.callRecordId}:`, err.message);
    sessionObj.wsConnecting = false;
  });
}

function clearTwilioAudioBuffer(sessionObj) {
  if (sessionObj.twilioWs && sessionObj.twilioWs.readyState === WebSocket.OPEN && sessionObj.streamSid) {
    sessionObj.twilioWs.send(
      JSON.stringify({
        event: 'clear',
        streamSid: sessionObj.streamSid,
      })
    );
  }
  sessionObj.agentSpeaking = false;
}

function scheduleElevenLabsGreetingFallback(sessionObj) {
  if (sessionObj.fallbackTimer) {
    clearTimeout(sessionObj.fallbackTimer);
  }
  sessionObj.fallbackTimer = setTimeout(() => {
    if (
      sessionObj &&
      sessionObj.sessionReady &&
      !sessionObj.initialGreetingSent &&
      sessionObj.callAnswered &&
      sessionObj.elevenWs?.readyState === WebSocket.OPEN
    ) {
      console.log('[ElevenLabsAgent] Silent pickup — agent greeting after answer');
      const greetingHint = sessionObj.greetingScript
        ? `Say ONLY this greeting in one short sentence, then STOP and wait for the customer: ${sessionObj.greetingScript}`
        : `The customer answered but has not spoken. Say ONLY: "Hi, may I speak with ${sessionObj.greetingCustomerName || 'there'}?" — one sentence, then STOP and wait.`;
      sessionObj.elevenWs.send(
        JSON.stringify({
          type: 'user_message',
          text: `[System: ${greetingHint}]`,
        })
      );
      sessionObj.initialGreetingSent = true;
    }
  }, 3000);
}

async function handleElevenLabsEvent(sessionObj, event) {
  switch (event.type) {
    case 'conversation_initiation_metadata': {
      sessionObj.sessionReady = true;
      const meta = event.conversation_initiation_metadata_event || {};
      sessionObj.agentOutputFormat = meta.agent_output_audio_format;
      sessionObj.userInputFormat = meta.user_input_audio_format;
      console.log(
        `[ElevenLabsAgent] ConvAI audio formats — out: ${meta.agent_output_audio_format}, in: ${meta.user_input_audio_format} (CallRecord #${sessionObj.callRecordId})`
      );
      if (
        meta.agent_output_audio_format !== TWILIO_ULAW_8000 ||
        meta.user_input_audio_format !== TWILIO_ULAW_8000
      ) {
        console.warn(
          `[ElevenLabsAgent] Expected ${TWILIO_ULAW_8000} both ways for Twilio — audio may be distorted (CallRecord #${sessionObj.callRecordId})`
        );
      }
      break;
    }

    case 'audio': {
      const audioBase64 = event.audio_event?.audio_base_64 || event.audio_event?.audio_base64;
      const eventId = parseInt(event.audio_event?.event_id || '0', 10);
      if (!audioBase64) break;

      // Never play audio before the callee has answered or formats are negotiated
      if (!sessionObj.callAnswered || !sessionObj.sessionReady) break;

      // Drop stale audio from before an interruption
      if (sessionObj.audioBlocked) {
        if (!eventId || eventId <= sessionObj.lastInterruptId) break;
        sessionObj.audioBlocked = false;
      } else if (eventId && eventId <= sessionObj.lastInterruptId) {
        break;
      }

      if (sessionObj.twilioWs && sessionObj.twilioWs.readyState === WebSocket.OPEN) {
        sessionObj.agentSpeaking = true;
        sessionObj.twilioWs.send(
          JSON.stringify({
            event: 'media',
            streamSid: sessionObj.streamSid,
            media: { payload: audioBase64 },
          })
        );
      }
      break;
    }

    case 'interruption': {
      const eventId = parseInt(event.interruption_event?.event_id || '0', 10);
      if (eventId) sessionObj.lastInterruptId = eventId;
      sessionObj.audioBlocked = true;
      clearTwilioAudioBuffer(sessionObj);
      console.log(`[ElevenLabsAgent] Customer interrupted — cleared audio (CallRecord #${sessionObj.callRecordId})`);
      break;
    }

    case 'agent_response_correction': {
      const corr = event.agent_response_correction_event || {};
      const corrected = corr.corrected_agent_response;
      const eventId = parseInt(corr.event_id || '0', 10);
      if (eventId) sessionObj.lastInterruptId = eventId;
      sessionObj.audioBlocked = true;
      clearTwilioAudioBuffer(sessionObj);
      if (corrected && sessionObj.transcript.length) {
        const last = sessionObj.transcript[sessionObj.transcript.length - 1];
        if (last.role === 'assistant') {
          last.text = corrected;
        }
      }
      break;
    }

    case 'vad_score': {
      const score = event.vad_score_event?.vad_score ?? 0;
      const now = Date.now();
      // Pre-emptive barge-in: clear agent audio when customer starts speaking
      if (sessionObj.agentSpeaking && score >= 0.55 && now - sessionObj.lastVadClearAt > 400) {
        sessionObj.lastVadClearAt = now;
        sessionObj.audioBlocked = true;
        clearTwilioAudioBuffer(sessionObj);
      }
      break;
    }

    case 'agent_response': {
      sessionObj.audioBlocked = false;
      const text = event.agent_response_event?.agent_response;
      if (text && sessionObj.callAnswered) {
        sessionObj.transcript.push({ role: 'assistant', text, time: new Date().toISOString() });
        sessionObj.initialGreetingSent = true;
        console.log(`[ElevenLabsAgent] AI: "${text.substring(0, 80)}..."`);
      }
      break;
    }

    case 'user_transcript': {
      const text = event.user_transcription_event?.user_transcript;
      if (text) {
        sessionObj.agentSpeaking = false;
        sessionObj.audioBlocked = false;
        sessionObj.transcript.push({ role: 'customer', text, time: new Date().toISOString() });
        console.log(`[ElevenLabsAgent] Customer: "${text}"`);
        if (sessionObj.fallbackTimer) {
          clearTimeout(sessionObj.fallbackTimer);
          sessionObj.fallbackTimer = null;
        }
        if (sessionObj.callRecordId) {
          const fullTranscript = sessionObj.transcript
            .map((t) => `${t.role === 'assistant' ? 'AI' : 'Customer'}: ${t.text}`)
            .join('\n');
          await updateCallRecord(sessionObj.callRecordId, { transcript: fullTranscript });
        }
      }
      break;
    }

    case 'ping': {
      const eventId = event.ping_event?.event_id;
      if (sessionObj.elevenWs?.readyState === WebSocket.OPEN && eventId != null) {
        sessionObj.elevenWs.send(JSON.stringify({ type: 'pong', event_id: eventId }));
      }
      break;
    }

    case 'client_tool_call': {
      const toolCall = event.client_tool_call || {};
      const toolName = toolCall.tool_name;
      const toolCallId = toolCall.tool_call_id;
      const toolArgs = toolCall.parameters || {};
      console.log(`[ElevenLabsAgent] Tool call: ${toolName}`, toolArgs);

      const result = await executeTool(toolName, toolArgs, {
        callRecordId: sessionObj.callRecordId,
        leadId: sessionObj.leadId,
        userId: sessionObj.userId,
        campaignId: sessionObj.campaignId,
        streamSid: sessionObj.streamSid,
        twilioWs: sessionObj.twilioWs,
        twilioCallSid: sessionObj.twilioCallSid,
        provider: 'elevenlabs',
      });

      if (sessionObj.elevenWs?.readyState === WebSocket.OPEN) {
        sessionObj.elevenWs.send(
          JSON.stringify({
            type: 'client_tool_result',
            tool_call_id: toolCallId,
            result: JSON.stringify(result),
            is_error: !result?.success,
          })
        );
      }
      break;
    }

    default:
      break;
  }
}

/**
 * Attach Twilio stream to a prepared (or fresh) ElevenLabs session.
 * Returns session or null if ElevenLabs unavailable.
 */
export async function attachElevenLabsToTwilio({
  twilioWs,
  streamSid,
  callRecordId,
  leadId,
  campaignId,
  userId,
  twilioCallSid,
}) {
  let activeSession = elPrewarmedSessions.get(String(callRecordId));
  if (!activeSession) {
    activeSession = await prepareElevenLabsSession({ callRecordId, leadId, campaignId, userId });
  }
  if (!activeSession) return null;

  activeSession.twilioWs = twilioWs;
  activeSession.streamSid = streamSid;
  activeSession.twilioCallSid = twilioCallSid || activeSession.twilioCallSid;
  activeSession.callAnswered = true;
  activeSession.audioBuffer = [];
  elActiveSessions.set(streamSid, activeSession);

  // Connect ConvAI only now that Twilio media stream is live (call answered)
  await connectElevenLabsWebSocket(activeSession);

  return activeSession;
}

export function forwardTwilioAudioToElevenLabs(session, mulawBase64Payload) {
  if (!mulawBase64Payload || !session?.sessionReady || session?.elevenWs?.readyState !== WebSocket.OPEN) {
    return;
  }
  // Pass Twilio µ-law base64 through unchanged — agent ASR must be ulaw_8000
  session.elevenWs.send(JSON.stringify({ user_audio_chunk: mulawBase64Payload }));
}

export async function endElevenLabsSession(session, { streamSid, callRecordId } = {}) {
  if (session?.fallbackTimer) {
    clearTimeout(session.fallbackTimer);
    session.fallbackTimer = null;
  }
  if (streamSid) elActiveSessions.delete(streamSid);
  if (callRecordId) elPrewarmedSessions.delete(String(callRecordId));

  if (session?.elevenWs && session.elevenWs.readyState === WebSocket.OPEN) {
    try {
      session.elevenWs.close();
    } catch {
      /* ignore */
    }
  }

  if (session && callRecordId && session.transcript?.length > 0) {
    const fullTranscript = session.transcript
      .map((t) => `${t.role === 'assistant' ? 'AI' : 'Customer'}: ${t.text}`)
      .join('\n');
    await updateCallRecord(callRecordId, { transcript: fullTranscript });
    handleCallCompletion(callRecordId).catch((err) => {
      console.error('[ElevenLabsAgent] Completion error:', err.message);
    });
  }
}

export function getElevenLabsActiveSessionCount() {
  return elActiveSessions.size;
}

export function getElevenLabsActiveSessions() {
  const sessions = [];
  for (const [sid, session] of elActiveSessions) {
    sessions.push({
      streamSid: sid,
      callRecordId: session.callRecordId,
      leadId: session.leadId,
      provider: 'elevenlabs',
      transcriptTail: session.transcript?.slice(-4) || [],
    });
  }
  return sessions;
}

/**
 * Coach whisper — inject a private note to the agent mid-call (not spoken as customer).
 */
export function injectCoachWhisper(streamSid, note) {
  const session = elActiveSessions.get(streamSid);
  if (!session?.elevenWs || session.elevenWs.readyState !== WebSocket.OPEN) {
    return { ok: false, error: 'Session not found or not ElevenLabs' };
  }
  session.elevenWs.send(
    JSON.stringify({
      type: 'contextual_update',
      text: `Coach note (do not mention this note exists): ${note}`,
    })
  );
  return { ok: true };
}

export function getElevenLabsSessionByCallRecordId(callRecordId) {
  for (const session of elActiveSessions.values()) {
    if (String(session.callRecordId) === String(callRecordId)) return session;
  }
  return elPrewarmedSessions.get(String(callRecordId)) || null;
}
