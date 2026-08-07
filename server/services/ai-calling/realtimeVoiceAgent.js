/**
 * Real-Time Voice Agent — WebSocket Bridge
 *
 * Bridges Twilio Media Streams ↔ ElevenLabs ConvAI (preferred) or OpenAI Realtime (fallback).
 */
import WebSocket from 'ws';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../../db.js';
import { updateCallRecord, handleCallCompletion } from './callFlowManager.js';
import { executeTool } from './toolExecutor.js';
import { buildRealtimeSystemPrompt, buildRealtimeTools } from './aiOrchestrator.js';
import { isElevenLabsLive } from './elevenLabsService.js';
import {
  prepareElevenLabsSession,
  attachElevenLabsToTwilio,
  forwardTwilioAudioToElevenLabs,
  endElevenLabsSession,
  getElevenLabsActiveSessionCount,
  getElevenLabsActiveSessions,
  injectCoachWhisper as elInjectCoachWhisper,
  getElevenLabsSessionByCallRecordId,
} from './elevenLabsVoiceAgent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const activeSessions = new Map();
const prewarmedSessions = new Map();

/**
 * Pre-warm voice session while ringing — ElevenLabs first, OpenAI fallback.
 */
export async function prepareRealtimeSession(ctx) {
  if (isElevenLabsLive()) {
    try {
      const elSession = await prepareElevenLabsSession(ctx);
      if (elSession) return elSession;
      console.warn('[RealtimeAgent] ElevenLabs prewarm failed — falling back to OpenAI Realtime');
    } catch (err) {
      console.error('[RealtimeAgent] ElevenLabs prewarm error:', err.message);
    }
  }
  return prepareOpenAISession(ctx);
}

export async function prepareOpenAISession({ callRecordId, leadId, campaignId, userId }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes('your_')) return null;

  const key = String(callRecordId);
  if (prewarmedSessions.has(key)) {
    return prewarmedSessions.get(key);
  }

  console.log(`[RealtimeAgent] Preparing OpenAI context for CallRecord #${callRecordId} (no WS until answered)...`);

  let leadData = {};
  let previousCalls = [];
  let campaign = {};
  let knowledgeBase = [];

  try {
    if (leadId) {
      const [leads] = await db.query(
        `SELECT owner_name, phone, address, email, estimated_savings, roof_size, solar_potential, status, property_json, mailing_address
         FROM leads WHERE id = ?`,
        [leadId]
      );
      if (leads.length) {
        const { enrichLeadGeo } = await import('./leadGeo.js');
        leadData = enrichLeadGeo(leads[0]);
      }

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
        `SELECT caller_name, business_name, greeting_script, system_prompt,
                qualification_questions, objection_responses, elevenlabs_voice_id
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
    }
  } catch (err) {
    console.error('[RealtimeAgent] Pre-warm DB fetch error:', err.message);
  }

  let systemPrompt = buildRealtimeSystemPrompt(leadData, campaign, previousCalls, knowledgeBase);
  if (campaign.system_prompt && String(campaign.system_prompt).trim()) {
    systemPrompt = `${String(campaign.system_prompt).trim()}\n\n---\n${systemPrompt}`;
  }
  systemPrompt += `\n\nRECORDING DISCLOSURE: Briefly mention the call may be recorded in your opening.\nFILLER RULE: Do not stack fillers every turn.\nWAIT FOR CUSTOMER: Do not speak first. Wait for the customer to say hello before your opening.`;

  const sessionObj = {
    provider: 'openai',
    openaiWs: null,
    callRecordId,
    leadId,
    campaignId,
    userId,
    systemPrompt,
    tools: buildRealtimeTools(),
    callAnswered: false,
    audioBuffer: [],
    sessionReady: false,
    initialGreetingSent: false,
    transcript: [],
    twilioWs: null,
    streamSid: null,
    markCounter: 0,
    twilioCallSid: null,
    wsConnecting: false,
  };

  prewarmedSessions.set(key, sessionObj);

  try {
    await updateCallRecord(callRecordId, { voice_provider: 'openai' });
  } catch {
    /* ignore */
  }

  return sessionObj;
}

async function connectOpenAIWebSocket(sessionObj) {
  if (sessionObj.openaiWs?.readyState === WebSocket.OPEN) return;
  if (sessionObj.wsConnecting) return;
  sessionObj.wsConnecting = true;

  const apiKey = process.env.OPENAI_API_KEY;
  const url = 'wss://api.openai.com/v1/realtime?model=gpt-realtime';
  const openaiWs = new WebSocket(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  sessionObj.openaiWs = openaiWs;

  openaiWs.on('open', () => {
    console.log(`[RealtimeAgent] OpenAI WS open (call answered) — CallRecord #${sessionObj.callRecordId}`);
    openaiWs.send(
      JSON.stringify({
        type: 'session.update',
        session: {
          type: 'realtime',
          instructions: sessionObj.systemPrompt,
          audio: {
            input: {
              format: { type: 'audio/pcmu' },
              transcription: { model: 'whisper-1', language: 'en' },
              turn_detection: {
                type: 'server_vad',
                threshold: 0.7,
                prefix_padding_ms: 400,
                silence_duration_ms: 600,
              },
            },
            output: {
              format: { type: 'audio/pcmu' },
              voice: 'shimmer',
            },
          },
          tools: sessionObj.tools,
          tool_choice: 'auto',
        },
      })
    );
    sessionObj.sessionReady = true;
    sessionObj.wsConnecting = false;
    scheduleOpenAIGreetingFallback(sessionObj);
  });

  openaiWs.on('message', async (rawData) => {
    try {
      const event = JSON.parse(rawData.toString());
      await handlePrewarmedOpenAIEvent(sessionObj, event);
    } catch (err) {
      console.error('[RealtimeAgent] OpenAI message error:', err.message);
    }
  });

  openaiWs.on('close', () => {
    console.log(`[RealtimeAgent] OpenAI WS closed — CallRecord #${sessionObj.callRecordId}`);
    sessionObj.wsConnecting = false;
  });

  openaiWs.on('error', (err) => {
    console.error(`[RealtimeAgent] OpenAI WS error — CallRecord #${sessionObj.callRecordId}:`, err.message);
    sessionObj.wsConnecting = false;
  });
}

async function attachOpenAIToTwilio(activeSession, twilioWs, streamSid, twilioCallSid) {
  activeSession.twilioWs = twilioWs;
  activeSession.streamSid = streamSid;
  activeSession.twilioCallSid = twilioCallSid;
  activeSession.callAnswered = true;
  activeSession.audioBuffer = [];

  await connectOpenAIWebSocket(activeSession);
}

function scheduleOpenAIGreetingFallback(sessionObj) {
  if (sessionObj.fallbackTimer) {
    clearTimeout(sessionObj.fallbackTimer);
  }
  sessionObj.fallbackTimer = setTimeout(() => {
    if (
      sessionObj &&
      sessionObj.openaiWs &&
      sessionObj.openaiWs.readyState === WebSocket.OPEN &&
      !sessionObj.initialGreetingSent &&
      sessionObj.callAnswered
    ) {
      console.log('[RealtimeAgent] Silent pickup — OpenAI greeting after answer');
      sessionObj.initialGreetingSent = true;
      sessionObj.openaiWs.send(
        JSON.stringify({
          type: 'response.create',
          response: {
            instructions:
              'The customer answered but has not spoken yet. Greet them warmly in 1 short sentence. Mention the call may be recorded. Introduce yourself and ask if they have 30 seconds.',
          },
        })
      );
    }
  }, 1500);
}

async function handlePrewarmedOpenAIEvent(sessionObj, event) {
  switch (event.type) {
    case 'response.output_audio.delta':
    case 'response.audio.delta':
      if (!sessionObj.callAnswered) break;
      if (sessionObj.twilioWs && sessionObj.twilioWs.readyState === WebSocket.OPEN) {
        sessionObj.twilioWs.send(
          JSON.stringify({
            event: 'media',
            streamSid: sessionObj.streamSid,
            media: { payload: event.delta },
          })
        );
      }
      break;

    case 'response.output_audio.done':
    case 'response.audio.done':
      if (sessionObj.twilioWs && sessionObj.twilioWs.readyState === WebSocket.OPEN) {
        sessionObj.markCounter++;
        sessionObj.twilioWs.send(
          JSON.stringify({
            event: 'mark',
            streamSid: sessionObj.streamSid,
            mark: { name: `response-end-${sessionObj.markCounter}` },
          })
        );
      }
      break;

    case 'response.output_audio_transcript.done':
    case 'response.audio_transcript.done':
      if (event.transcript) {
        sessionObj.transcript.push({
          role: 'assistant',
          text: event.transcript,
          time: new Date().toISOString(),
        });
      }
      break;

    case 'conversation.item.input_audio_transcription.completed':
      if (event.transcript) {
        sessionObj.transcript.push({
          role: 'customer',
          text: event.transcript,
          time: new Date().toISOString(),
        });
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

    case 'input_audio_buffer.speech_started':
      if (sessionObj.fallbackTimer) {
        clearTimeout(sessionObj.fallbackTimer);
        sessionObj.fallbackTimer = null;
      }
      if (sessionObj.twilioWs && sessionObj.twilioWs.readyState === WebSocket.OPEN) {
        sessionObj.twilioWs.send(
          JSON.stringify({
            event: 'clear',
            streamSid: sessionObj.streamSid,
          })
        );
      }
      if (sessionObj.openaiWs && sessionObj.openaiWs.readyState === WebSocket.OPEN) {
        try {
          sessionObj.openaiWs.send(JSON.stringify({ type: 'response.cancel' }));
        } catch {
          /* ignore */
        }
      }
      break;

    case 'response.output_item.done':
      if (event.item?.type === 'function_call') {
        const toolName = event.item.name;
        const toolArgs = JSON.parse(event.item.arguments || '{}');
        const toolCallId = event.item.call_id;

        console.log(`[RealtimeAgent] Tool call: ${toolName}(${JSON.stringify(toolArgs)})`);
        const result = await executeTool(toolName, toolArgs, {
          callRecordId: sessionObj.callRecordId,
          leadId: sessionObj.leadId,
          userId: sessionObj.userId,
          campaignId: sessionObj.campaignId,
          streamSid: sessionObj.streamSid,
          twilioWs: sessionObj.twilioWs,
          twilioCallSid: sessionObj.twilioCallSid,
          provider: 'openai',
        });

        if (sessionObj.openaiWs && sessionObj.openaiWs.readyState === WebSocket.OPEN) {
          sessionObj.openaiWs.send(
            JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: toolCallId,
                output: JSON.stringify(result),
              },
            })
          );
          sessionObj.openaiWs.send(JSON.stringify({ type: 'response.create' }));
        }
      }
      break;

    case 'error':
      if (event.error?.code !== 'response_cancel_not_active') {
        console.error('[RealtimeAgent] OpenAI error:', JSON.stringify(event.error));
      }
      break;

    default:
      break;
  }
}

export function handleMediaStreamConnection(twilioWs) {
  let streamSid = null;
  let callRecordId = null;
  let leadId = null;
  let campaignId = null;
  let userId = null;
  let activeSession = null;

  console.log('[RealtimeAgent] New Twilio Media Stream connection opened');

  twilioWs.on('message', async (rawMessage) => {
    try {
      const msg = JSON.parse(rawMessage.toString());

      switch (msg.event) {
        case 'connected':
          console.log('[RealtimeAgent] Twilio stream connected');
          break;

        case 'start': {
          streamSid = msg.start.streamSid;
          const params = msg.start.customParameters || {};
          callRecordId = params.callRecordId || params.callrecordid;
          leadId = params.leadId || params.leadid;
          campaignId = params.campaignId || params.campaignid;
          userId = params.userId || params.userid;
          const twilioCallSid = msg.start.callSid || params.callSid || params.callsid;

          console.log(
            `[RealtimeAgent] Stream started — SID: ${streamSid}, CallRecord: ${callRecordId}, Lead: ${leadId}`
          );

          if (callRecordId) {
            await updateCallRecord(callRecordId, { status: 'in_progress' });
          }

          // Prefer ElevenLabs attachment
          if (isElevenLabsLive()) {
            activeSession = await attachElevenLabsToTwilio({
              twilioWs,
              streamSid,
              callRecordId,
              leadId,
              campaignId,
              userId,
              twilioCallSid,
            });
          }

          if (!activeSession) {
            const prewarmed = prewarmedSessions.get(String(callRecordId));
            if (prewarmed) {
              activeSession = prewarmed;
            } else {
              activeSession = await prepareOpenAISession({
                callRecordId,
                leadId,
                campaignId,
                userId,
              });
            }
            if (activeSession) {
              activeSessions.set(streamSid, activeSession);
              await attachOpenAIToTwilio(activeSession, twilioWs, streamSid, twilioCallSid);
            }
          } else {
            activeSessions.set(streamSid, activeSession);
          }
          break;
        }

        case 'media':
          if (!activeSession || !activeSession.callAnswered) break;
          if (activeSession.provider === 'elevenlabs') {
            forwardTwilioAudioToElevenLabs(activeSession, msg.media.payload);
          } else if (activeSession.openaiWs?.readyState === WebSocket.OPEN) {
            activeSession.openaiWs.send(
              JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: msg.media.payload,
              })
            );
          }
          break;

        case 'mark':
          break;

        case 'stop':
          console.log(`[RealtimeAgent] Twilio stream stopped — SID: ${streamSid}`);
          await handleStreamEnd();
          break;

        default:
          break;
      }
    } catch (err) {
      console.error('[RealtimeAgent] Error processing Twilio message:', err.message);
    }
  });

  twilioWs.on('close', async () => {
    console.log(`[RealtimeAgent] Twilio WebSocket closed — SID: ${streamSid}`);
    await handleStreamEnd();
  });

  twilioWs.on('error', (err) => {
    console.error('[RealtimeAgent] Twilio WebSocket error:', err.message);
  });

  async function handleStreamEnd() {
    if (streamSid && activeSessions.has(streamSid)) {
      activeSessions.delete(streamSid);
    }
    if (callRecordId && prewarmedSessions.has(String(callRecordId))) {
      prewarmedSessions.delete(String(callRecordId));
    }

    if (activeSession?.provider === 'elevenlabs') {
      await endElevenLabsSession(activeSession, { streamSid, callRecordId });
      return;
    }

    if (activeSession?.openaiWs && activeSession.openaiWs.readyState === WebSocket.OPEN) {
      activeSession.openaiWs.close();
    }

    if (activeSession && callRecordId && activeSession.transcript?.length > 0) {
      const fullTranscript = activeSession.transcript
        .map((t) => `${t.role === 'assistant' ? 'AI' : 'Customer'}: ${t.text}`)
        .join('\n');

      await updateCallRecord(callRecordId, { transcript: fullTranscript });

      handleCallCompletion(callRecordId).catch((err) => {
        console.error('[RealtimeAgent] Completion processing error:', err.message);
      });
    }

    console.log(`[RealtimeAgent] Session cleaned up — CallRecord: ${callRecordId}`);
  }
}

export function getActiveSessionCount() {
  return activeSessions.size + getElevenLabsActiveSessionCount();
}

export function getActiveSessions() {
  const sessions = [];
  for (const [sid, session] of activeSessions) {
    sessions.push({
      streamSid: sid,
      callRecordId: session.callRecordId,
      leadId: session.leadId,
      provider: session.provider || 'openai',
      transcriptTail: session.transcript?.slice(-4) || [],
    });
  }
  // Dedupe ElevenLabs sessions already in activeSessions
  for (const el of getElevenLabsActiveSessions()) {
    if (!sessions.find((s) => s.streamSid === el.streamSid)) sessions.push(el);
  }
  return sessions;
}

export function injectCoachWhisper(callRecordIdOrStreamSid, note) {
  const byStream = activeSessions.get(callRecordIdOrStreamSid);
  if (byStream?.provider === 'elevenlabs') {
    return elInjectCoachWhisper(callRecordIdOrStreamSid, note);
  }
  const el = getElevenLabsSessionByCallRecordId(callRecordIdOrStreamSid);
  if (el?.streamSid) return elInjectCoachWhisper(el.streamSid, note);

  // OpenAI: inject as system instruction via conversation item
  let openaiSession = byStream;
  if (!openaiSession) {
    for (const s of activeSessions.values()) {
      if (String(s.callRecordId) === String(callRecordIdOrStreamSid)) {
        openaiSession = s;
        break;
      }
    }
  }
  if (openaiSession?.openaiWs?.readyState === WebSocket.OPEN) {
    openaiSession.openaiWs.send(
      JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: `Coach note (do not mention this note): ${note}`,
            },
          ],
        },
      })
    );
    return { ok: true, provider: 'openai' };
  }
  return { ok: false, error: 'No active session found' };
}
