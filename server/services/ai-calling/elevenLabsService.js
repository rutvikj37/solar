/**
 * ElevenLabs Conversational AI Service — voice synthesis, agent management,
 * signed WebSocket URLs for real-time voice streaming.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildRealtimeTools } from './aiOrchestrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isKeyValid = (k) => k && k.trim() !== '' && !k.toLowerCase().includes('your_');

export function getElevenLabsCreds() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  return { apiKey, agentId, live: isKeyValid(apiKey) };
}

export function isElevenLabsLive() {
  return getElevenLabsCreds().live;
}

/** Twilio Media Streams wire format — µ-law 8 kHz base64 payloads both directions. */
export const TWILIO_ULAW_8000 = 'ulaw_8000';

/** Live phone path — Eleven v3 Conversational (not flash/multilingual narration). */
export const CONVAI_TTS_MODEL = 'eleven_v3_conversational';

/** Calm, confident sales voice settings (plan: stability 55–65%, similarity 85–90%, speed 0.95–1.0). */
export const CONVAI_TTS_SETTINGS = {
  model_id: CONVAI_TTS_MODEL,
  stability: 0.6,
  similarity_boost: 0.87,
  speed: 0.97,
};

/** One-shot voicemail / hold TTS (HTTP) — flash for low latency. */
export const VOICEMAIL_TTS_MODEL = 'eleven_flash_v2';

export const RECOMMENDED_VOICE_NAMES = ['Sarah', 'Jessica', 'Adam', 'Brian'];
export const DEFAULT_VOICE_NAME = 'Sarah';

/** Fallback IDs if listVoices is unavailable (resolved by name when live). */
const RECOMMENDED_VOICE_FALLBACKS = {
  // Confirmed against live ElevenLabs /v1/voices (Sarah = EXAVITQu4vr4xnSDxMaL)
  Sarah: 'EXAVITQu4vr4xnSDxMaL',
  Jessica: 'cgSgspJ2msmNvuH2EXkP',
  Adam: 'pNInz6obpgDQGcFmaJgB',
  Brian: 'nPczCjzIQlOIWeAhpZyP',
};

export function twilioConvAiAudioConfig() {
  return {
    agent_output_audio_format: TWILIO_ULAW_8000,
    user_input_audio_format: TWILIO_ULAW_8000,
  };
}

/** Patient turn-taking — wait for customer answers; no filler monologues on silence. */
export function convAiTurnConfig() {
  return {
    turn_timeout: 12,
    turn_eagerness: 'patient',
    silence_end_call_timeout: -1,
    turn_model: 'turn_v3',
    speculative_turn: false,
    initial_wait_time: 4,
    soft_timeout_config: {
      timeout_seconds: -1,
    },
  };
}

export function convAiTtsConfig(voiceId) {
  return {
    voice_id: voiceId || RECOMMENDED_VOICE_FALLBACKS.Sarah,
    ...CONVAI_TTS_SETTINGS,
    ...twilioConvAiAudioConfig(),
  };
}

/**
 * Prefer Sarah / Jessica / Adam / Brian at the top of the voice list.
 */
export function sortRecommendedVoices(voices = []) {
  const rank = (name) => {
    const idx = RECOMMENDED_VOICE_NAMES.findIndex(
      (n) => String(name || '').toLowerCase().includes(n.toLowerCase())
    );
    return idx === -1 ? 1000 : idx;
  };
  return [...voices].sort((a, b) => {
    const ra = rank(a.name);
    const rb = rank(b.name);
    if (ra !== rb) return ra - rb;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

/**
 * Resolve a recommended American sales voice ID (default Sarah).
 */
export async function resolveDefaultVoiceId(preferredName = DEFAULT_VOICE_NAME) {
  const want = String(preferredName || DEFAULT_VOICE_NAME).toLowerCase();
  try {
    const voices = await listVoices();
    const exact = voices.find((v) => String(v.name || '').toLowerCase() === want);
    if (exact) return exact.voice_id;
    const partial = voices.find((v) => String(v.name || '').toLowerCase().includes(want));
    if (partial) return partial.voice_id;
    for (const name of RECOMMENDED_VOICE_NAMES) {
      const hit = voices.find((v) => String(v.name || '').toLowerCase().includes(name.toLowerCase()));
      if (hit) return hit.voice_id;
    }
  } catch (err) {
    console.warn('[ElevenLabs] resolveDefaultVoiceId list failed:', err.message);
  }
  const key = RECOMMENDED_VOICE_NAMES.find((n) => n.toLowerCase() === want) || DEFAULT_VOICE_NAME;
  return RECOMMENDED_VOICE_FALLBACKS[key] || RECOMMENDED_VOICE_FALLBACKS.Sarah;
}

/**
 * Convert OpenAI-style realtime tools to ElevenLabs client tools.
 */
export function buildElevenLabsClientTools() {
  return buildRealtimeTools().map((t) => ({
    type: 'client',
    name: t.name,
    description: t.description,
    parameters: t.parameters || { type: 'object', properties: {} },
  })).concat([
    {
      type: 'client',
      name: 'transfer_to_human',
      description: 'Warm-transfer the call to a live sales closer when the customer asks for a human or is ready to buy now.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Why the customer wants a human transfer',
          },
        },
        required: ['reason'],
      },
    },
  ]);
}

/**
 * List available ElevenLabs voices (recommended sales voices first).
 */
export async function listVoices() {
  const { apiKey, live } = getElevenLabsCreds();

  if (!live) {
    return sortRecommendedVoices([
      { voice_id: RECOMMENDED_VOICE_FALLBACKS.Sarah, name: 'Sarah', preview_url: null, recommended: true },
      { voice_id: RECOMMENDED_VOICE_FALLBACKS.Jessica, name: 'Jessica', preview_url: null, recommended: true },
      { voice_id: RECOMMENDED_VOICE_FALLBACKS.Adam, name: 'Adam', preview_url: null, recommended: true },
      { voice_id: RECOMMENDED_VOICE_FALLBACKS.Brian, name: 'Brian', preview_url: null, recommended: true },
      { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', preview_url: null },
    ]);
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey },
    });
    if (!response.ok) {
      console.error('[ElevenLabs] Failed to list voices:', response.status);
      return sortRecommendedVoices(
        Object.entries(RECOMMENDED_VOICE_FALLBACKS).map(([name, voice_id]) => ({
          voice_id,
          name,
          preview_url: null,
          recommended: true,
        }))
      );
    }
    const data = await response.json();
    const mapped = (data.voices || []).map((v) => {
      const name = v.name || '';
      const recommended = RECOMMENDED_VOICE_NAMES.some((n) =>
        name.toLowerCase().includes(n.toLowerCase())
      );
      return {
        voice_id: v.voice_id,
        name,
        preview_url: v.preview_url || null,
        labels: v.labels || {},
        recommended,
      };
    });
    return sortRecommendedVoices(mapped);
  } catch (err) {
    console.error('[ElevenLabs] listVoices network error:', err.message);
    return sortRecommendedVoices(
      Object.entries(RECOMMENDED_VOICE_FALLBACKS).map(([name, voice_id]) => ({
        voice_id,
        name,
        preview_url: null,
        recommended: true,
      }))
    );
  }
}

/**
 * Get a signed WebSocket URL for real-time conversational AI.
 */
export async function getConversationSignedUrl(overrideAgentId) {
  const { apiKey, agentId, live } = getElevenLabsCreds();
  const targetAgent = overrideAgentId || agentId;

  if (!live || !targetAgent) {
    return { url: null, simulated: true };
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(targetAgent)}`,
    { headers: { 'xi-api-key': apiKey } }
  );
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error('[ElevenLabs] Failed to get signed URL:', response.status, errText);
    return { url: null, simulated: true, error: errText };
  }
  const data = await response.json();
  return { url: data.signed_url, simulated: false };
}

function agentConversationConfig(systemPrompt, firstMessage, voiceId) {
  const twilioAudio = twilioConvAiAudioConfig();
  return {
    agent: {
      prompt: {
        prompt: systemPrompt,
        tools: buildElevenLabsClientTools(),
      },
      first_message: firstMessage || '',
      language: 'en',
    },
    tts: {
      voice_id: voiceId || RECOMMENDED_VOICE_FALLBACKS.Sarah,
      model_id: CONVAI_TTS_MODEL,
      stability: CONVAI_TTS_SETTINGS.stability,
      similarity_boost: CONVAI_TTS_SETTINGS.similarity_boost,
      speed: CONVAI_TTS_SETTINGS.speed,
      agent_output_audio_format: twilioAudio.agent_output_audio_format,
    },
    asr: {
      quality: 'high',
      user_input_audio_format: twilioAudio.user_input_audio_format,
    },
    turn: convAiTurnConfig(),
  };
}

/**
 * Update an ElevenLabs Conversational AI agent's system prompt + first message + tools.
 */
export async function updateAgentPrompt(agentIdOverride, systemPrompt, firstMessage, voiceId) {
  const { apiKey, agentId, live } = getElevenLabsCreds();
  const target = agentIdOverride || agentId;

  if (!live || !target) {
    return { ok: false, simulated: true };
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${target}`, {
    method: 'PATCH',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversation_config: agentConversationConfig(systemPrompt, firstMessage, voiceId),
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error('[ElevenLabs] Failed to update agent:', response.status, errText);
  }

  return { ok: response.ok, simulated: false };
}

/**
 * Create a new ElevenLabs Conversational AI agent for a campaign.
 */
export async function createAgent(name, voiceId, systemPrompt, firstMessage) {
  const { apiKey, live } = getElevenLabsCreds();

  if (!live) {
    return { agentId: `sim_agent_${Date.now()}`, simulated: true };
  }

  const response = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: name || `Solar Sales ${Date.now()}`,
      conversation_config: agentConversationConfig(systemPrompt, firstMessage, voiceId),
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error('[ElevenLabs] Failed to create agent:', response.status, errText);
    throw new Error('Failed to create ElevenLabs agent');
  }

  const data = await response.json();
  return { agentId: data.agent_id, simulated: false };
}

/**
 * Ensure a campaign (or settings) has a usable ElevenLabs agent with current prompt/voice.
 * Persists agent_id when a campaignId is provided.
 */
export async function ensureCampaignAgent({
  campaignId,
  campaignName,
  voiceId,
  systemPrompt,
  firstMessage,
  existingAgentId,
  settingsAgentId,
}) {
  const { live, agentId: envAgentId } = getElevenLabsCreds();
  if (!live) {
    return { agentId: existingAgentId || settingsAgentId || envAgentId || null, simulated: true };
  }

  let agentId = existingAgentId || settingsAgentId || envAgentId || null;
  const resolvedVoice = voiceId || (await resolveDefaultVoiceId(DEFAULT_VOICE_NAME));

  try {
    if (agentId) {
      const updated = await updateAgentPrompt(agentId, systemPrompt, firstMessage, resolvedVoice);
      if (!updated.ok) {
        const created = await createAgent(campaignName || 'Solar Sales Caller', resolvedVoice, systemPrompt, firstMessage);
        agentId = created.agentId;
      }
    } else {
      const created = await createAgent(campaignName || 'Solar Sales Caller', resolvedVoice, systemPrompt, firstMessage);
      agentId = created.agentId;
    }
  } catch (err) {
    console.error('[ElevenLabs] ensureCampaignAgent error:', err.message);
    return { agentId: agentId || null, simulated: false, error: err.message };
  }

  if (campaignId && agentId) {
    try {
      const db = (await import('../../db.js')).default;
      await db.query(
        `UPDATE ai_calling_campaigns SET elevenlabs_agent_id = ? WHERE id = ?`,
        [agentId, campaignId]
      );
    } catch (err) {
      console.error('[ElevenLabs] Failed to persist campaign agent id:', err.message);
    }
  }

  return { agentId, voiceId: resolvedVoice, simulated: false };
}

/**
 * Synthesize speech audio. Defaults to MP3; pass outputFormat 'ulaw_8000' for Twilio.
 * Uses flash for one-shot voicemail latency; live calls use eleven_v3_conversational via ConvAI.
 */
export async function synthesizeSpeechAudio(text, voiceId, outputFormat = 'mp3_44100_128') {
  const { apiKey, live } = getElevenLabsCreds();
  if (!live) return null;

  const targetVoice = voiceId || (await resolveDefaultVoiceId(DEFAULT_VOICE_NAME));
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${targetVoice}?output_format=${encodeURIComponent(outputFormat)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: outputFormat.startsWith('ulaw') ? 'application/octet-stream' : 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: VOICEMAIL_TTS_MODEL,
      voice_settings: {
        stability: CONVAI_TTS_SETTINGS.stability,
        similarity_boost: CONVAI_TTS_SETTINGS.similarity_boost,
        style: 0.35,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    console.error('[ElevenLabs TTS] Speech synthesis failed:', response.status);
    return null;
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
