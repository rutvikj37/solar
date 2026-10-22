/**
 * AI Orchestrator — provider-agnostic AI interface using Strategy Pattern.
 * Supports OpenAI GPT (default), with architecture for Claude / Gemini swap.
 * Handles: response generation, intent classification, qualification extraction, summary.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { BRAND_NAME } from '../../config/brand.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isKeyValid = (k) => k && k.trim() !== '' && !k.toLowerCase().includes('your_');

// ─── Provider Interface ────────────────────────────────────────────────
class AIProvider {
  async generateResponse(_messages, _options) { throw new Error('Not implemented'); }
  async classifyIntent(_utterance, _context) { throw new Error('Not implemented'); }
}

// ─── OpenAI Provider ───────────────────────────────────────────────────
class OpenAIProvider extends AIProvider {
  constructor(apiKey, model = 'gpt-4o') {
    super();
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateResponse(messages, options = {}) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: options.maxTokens || 500,
        temperature: options.temperature ?? 0.7,
        response_format: options.jsonMode ? { type: 'json_object' } : undefined,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[OpenAI] Error:', err);
      throw new Error('OpenAI API error');
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async classifyIntent(utterance, context) {
    const result = await this.generateResponse([
      {
        role: 'system',
        content: `You are an intent classifier for solar sales calls. Classify the customer's utterance.
Return JSON: {"intent": string, "confidence": number 0-1, "entities": object}
Possible intents: greeting, agreement, objection_not_interested, objection_too_expensive, objection_ask_spouse, objection_already_solar, objection_busy, objection_call_later, objection_need_info, objection_renting, objection_wrong_number, qualification_answer, appointment_interest, request_human, goodbye, unclear`
      },
      { role: 'user', content: `Context: ${context}\nUtterance: "${utterance}"` }
    ], { jsonMode: true, temperature: 0.3 });

    try { return JSON.parse(result); } catch { return { intent: 'unclear', confidence: 0.5, entities: {} }; }
  }
}

// ─── Simulation Provider ───────────────────────────────────────────────
class SimulationProvider extends AIProvider {
  async generateResponse(_messages, _options) {
    return JSON.stringify({
      response: 'Thank you for your time. Based on your roof analysis, you could save significantly on energy costs with solar.',
      intent: 'qualification',
      shouldContinue: true,
    });
  }

  async classifyIntent(utterance) {
    const lower = (utterance || '').toLowerCase();
    if (lower.includes('not interested') || lower.includes('no thanks')) return { intent: 'objection_not_interested', confidence: 0.9, entities: {} };
    if (lower.includes('yes') || lower.includes('sure') || lower.includes('ok')) return { intent: 'agreement', confidence: 0.85, entities: {} };
    if (lower.includes('busy') || lower.includes('call later')) return { intent: 'objection_busy', confidence: 0.8, entities: {} };
    return { intent: 'unclear', confidence: 0.5, entities: {} };
  }
}

// ─── Factory ───────────────────────────────────────────────────────────
function createProvider(model) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (isKeyValid(openaiKey)) {
    return new OpenAIProvider(openaiKey, model || 'gpt-4o');
  }
  console.log('[AI Orchestrator] No API key found — using SimulationProvider');
  return new SimulationProvider();
}

// ─── Public API ────────────────────────────────────────────────────────

/**
 * Build a system prompt for the AI caller incorporating knowledge base + campaign config.
 */
export function buildSystemPrompt({ callerName, businessName, knowledgeBase, qualificationQuestions, objectionResponses, leadData }) {
  const kbSection = (knowledgeBase || [])
    .filter((a) => a.is_active)
    .map((a) => `### ${a.title}\n${a.content}`)
    .join('\n\n');

  const questions = Array.isArray(qualificationQuestions)
    ? qualificationQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')
    : `1. Do you own the home you're living in?
2. Approximately what do you spend on electricity each month? (A rough estimate is fine.)
3. Have you ever considered installing solar, or is this something completely new for you?`;

  const defaultObjections = `- "I'm busy" → "I completely understand. What would be a better time today or tomorrow for a quick call?"
- "I'm not interested" → "Thanks for letting me know. Is it because you're not considering solar at all, or just not looking right now?"
- "Solar is too expensive" → "The consultation is free and shows whether solar would actually save you money. No obligation to buy."
- "I need to ask my spouse" → "Would it help to schedule when both of you are available?"
- "How much will I save?" → "That depends on your home and usage — the consultation prepares a personalized estimate."
- "How did you get my number?" → "We use publicly available property info and contact databases. Your property looked like a good candidate."`;

  const objections = typeof objectionResponses === 'object' && objectionResponses
    ? Object.entries(objectionResponses)
        .map(([k, v]) => `- If "${k}": ${v}`)
        .join('\n')
    : defaultObjections;

  return `You are ${callerName || 'Emily'}, a warm, friendly, and natural human caller for ${businessName || BRAND_NAME}. This is a brief qualification call — not a sales pitch.

CRITICAL CONVERSATIONAL RULES:
- Speak naturally and warmly. Never rush. Ask ONE question at a time.
- Keep responses under 20 words unless briefly explaining something.
- After a question, STOP and wait for their answer.
- Never pressure booking. If "not now," offer a callback.
- If they agree, book the earliest suitable appointment.

LEAD CONTEXT:
- Name: ${leadData?.owner_name || 'Homeowner'}
- Address: ${leadData?.address || 'your neighborhood'}
- Savings Potential: $${Number(leadData?.estimated_savings || 0).toLocaleString()}

QUALIFICATION GOALS (one at a time):
${questions}

OBJECTION RESPONSES:
${objections}

KNOWLEDGE BASE:
${kbSection || 'Solar consultations are free, no-obligation, and show personalized savings based on the home.'}`;
}

/**
 * Generate an AI response for a conversation turn.
 */
export async function generateCallResponse(transcript, systemPrompt, model) {
  const provider = createProvider(model);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...transcript.map((t) => ({ role: t.role, content: t.text })),
  ];
  return provider.generateResponse(messages, { temperature: 0.7, maxTokens: 300 });
}

/**
 * Classify the customer's intent from their utterance.
 */
export async function classifyIntent(utterance, conversationContext, model) {
  const provider = createProvider(model);
  return provider.classifyIntent(utterance, conversationContext);
}

/**
 * Extract qualification data from a full transcript.
 */
export async function extractQualification(fullTranscript, model) {
  const provider = createProvider(model);
  const result = await provider.generateResponse([
    {
      role: 'system',
      content: `Analyze the following sales call transcript and extract qualification data.
Return JSON: {
  "isHomeowner": boolean|null,
  "monthlyElectricBill": string|null,
  "interestedInSolar": boolean|null,
  "interestedInConsultation": boolean|null,
  "preferredAppointmentTime": string|null,
  "spouseApprovalNeeded": boolean,
  "hasExistingSolar": boolean,
  "additionalNotes": string
}`
    },
    { role: 'user', content: fullTranscript }
  ], { jsonMode: true, temperature: 0.2 });

  try { return JSON.parse(result); } catch { return { isHomeowner: null, monthlyElectricBill: null, interestedInSolar: null }; }
}

/**
 * Generate a call summary + sentiment + disposition from a full transcript.
 */
export async function generateCallSummary(fullTranscript, model) {
  const provider = createProvider(model);
  const result = await provider.generateResponse([
    {
      role: 'system',
      content: `Analyze the following sales call transcript and generate a summary.
Return JSON: {
  "summary": "2-3 sentence summary of the call",
  "sentiment": "positive"|"neutral"|"negative",
  "disposition": "qualified"|"not_interested"|"callback"|"appointment_booked"|"wrong_number"|"do_not_call"|"voicemail_left"|"no_disposition",
  "leadScoreDelta": number (-20 to +30),
  "keyTopics": ["topic1", "topic2"],
  "nextAction": "string describing recommended next action"
}`
    },
    { role: 'user', content: fullTranscript }
  ], { jsonMode: true, temperature: 0.2 });

  try {
    return JSON.parse(result);
  } catch {
    return { summary: 'Call completed. Unable to generate AI summary.', sentiment: 'unknown', disposition: 'no_disposition', leadScoreDelta: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════════
// REAL-TIME VOICE AGENT — System Prompt & Tool Definitions
// For OpenAI Realtime API session configuration
// ═══════════════════════════════════════════════════════════════════

/**
 * Build system instructions for the OpenAI Realtime API session.
 * Includes full AI personality, CRM memory, and conversation goals.
 */
export function buildRealtimeSystemPrompt(leadData, campaign, previousCalls = [], knowledgeBase = []) {
  const callerName = campaign?.caller_name || 'Emily';
  const businessName = campaign?.business_name || BRAND_NAME;
  const customerName = leadData?.owner_name || 'there';
  const address = leadData?.address || '';
  const state = leadData?.state || '';
  const zip = leadData?.zip || '';
  const savings = leadData?.estimated_savings ? `$${Number(leadData.estimated_savings).toLocaleString()}` : '';
  const roofSqft = leadData?.roof_sqft || '';
  const utility = leadData?.utility_company || '';

  // Build previous call memory
  let memorySection = '';
  if (previousCalls.length > 0) {
    memorySection = `\n\nPREVIOUS CALL HISTORY (DO NOT re-ask questions already answered):\n`;
    for (const call of previousCalls) {
      const date = new Date(call.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      memorySection += `- ${date}: Disposition: ${call.disposition || 'unknown'}. ${call.ai_summary || ''}\n`;
      if (call.transcript) {
        memorySection += `  Key points from transcript: ${call.transcript.substring(0, 200)}...\n`;
      }
    }
  }

  // Build Knowledge Base section for unexpected customer questions
  let kbSection = '';
  if (knowledgeBase.length > 0) {
    kbSection = '\n\nCOMPANY KNOWLEDGE BASE & FAQS (use to answer unexpected customer questions accurately):\n' +
      knowledgeBase.map(k => `- [${k.category || 'General'}] ${k.title}: ${k.content}`).join('\n');
  }

  // Parse campaign-specific qualification questions
  let qualQuestions = `1. Do you own the home you're living in?
2. Approximately what do you spend on electricity each month? (A rough estimate is fine.)
3. Have you ever considered installing solar, or is this something completely new for you?`;
  if (campaign?.qualification_questions) {
    try {
      const qs = typeof campaign.qualification_questions === 'string'
        ? JSON.parse(campaign.qualification_questions)
        : campaign.qualification_questions;
      if (Array.isArray(qs) && qs.length > 0) {
        qualQuestions = qs.map((q, i) => `${i + 1}. ${q}`).join('\n');
      }
    } catch { /* use defaults */ }
  }

  // Parse objection responses
  let objectionSection = '';
  if (campaign?.objection_responses) {
    try {
      const obj = typeof campaign.objection_responses === 'string'
        ? JSON.parse(campaign.objection_responses)
        : campaign.objection_responses;
      if (typeof obj === 'object' && obj) {
        objectionSection = '\n\nOBJECTION HANDLING PLAYBOOK:\n' +
          Object.entries(obj).map(([k, v]) => `- If they say "${k}": ${v}`).join('\n');
      }
    } catch { /* no objection overrides */ }
  }

  return `You are ${callerName}, a warm, friendly, and natural human caller for ${businessName}. You are making an outbound call to a US homeowner — NOT a sales pitch. This is a brief qualification call that respects their time.

STRICT LANGUAGE REQUIREMENT (CRITICAL):
- YOU MUST ALWAYS SPEAK EXCLUSIVELY IN CLEAR AMERICAN ENGLISH.
- NEVER SPEAK GERMAN, KOREAN, SPANISH, OR ANY OTHER FOREIGN LANGUAGE UNDER ANY CIRCUMSTANCES.
- EVEN IF THE PHONE LINE NOISE OR CUSTOMER UTTERANCE SOUNDS LIKE ANOTHER LANGUAGE, ALWAYS RESPOND ONLY IN AMERICAN ENGLISH.

PERSONALITY & AI RULES:
- Speak naturally and warmly. Never rush the customer.
- Ask ONLY ONE question at a time. Wait for the answer before asking the next.
- After asking a question, STOP talking immediately and wait in silence for their answer.
- If they stay silent, wait at least 8 seconds before ONE brief check-in like "Still with me?" — then wait again.
- Never pressure someone into booking. Never interrupt the customer.
- Keep answers under 20 words unless briefly explaining something important.
- If the customer asks a question, answer it before asking another.
- If they say "not now," offer a callback using schedule_callback.
- If they agree to book, use check_availability then book_appointment and confirm.
- You are a REAL PERSON, not a chatbot or AI. Never reveal you are AI.
- Do not repeat information already said. Do not sound like a script reader.

CALL FLOW — follow this structure naturally (not word-for-word robotic):

STEP 1 — INTRODUCTION (first turn only):
${campaign?.greeting_script?.trim()
    ? campaign.greeting_script.trim()
    : `First say: "Hi, may I speak with ${customerName}?"
Wait for them to respond.
Then say: "Hi ${customerName}, my name is ${callerName}, and I'm calling from ${businessName}. I know I wasn't expecting your call, so I'll be brief. We help homeowners find out whether solar could reduce their electricity costs. Do you have about 30 seconds?"`}

STEP 2 — QUALIFICATION (one question at a time, wait for each answer):
Say: "Just a couple of quick questions."
Then ask these in order — ONE at a time, waiting for each answer:
${qualQuestions}
When they confirm they own the home, use verify_homeowner tool.

STEP 3 — IF INTERESTED:
"Based on what you've shared, it sounds like your home may be a good candidate for solar. We work with licensed solar professionals in your area who can provide a free, no-obligation consultation and personalized savings estimate."

STEP 4 — APPOINTMENT CLOSE:
"The consultation usually takes about 20 minutes and can help you understand potential savings without any obligation to purchase anything."
Use check_availability for real slots, then offer TWO specific times, e.g.:
"I have availability Tuesday at 3:00 PM or Wednesday at 10:30 AM. Which works better for you?"
When they pick a time, use book_appointment.

STEP 5 — CONFIRM:
"Perfect. I've reserved [date] at [time]. You'll receive a confirmation by text and email shortly. Is there anything else you'd like to ask before we finish?"

STEP 6 — CLOSING:
"Thank you, ${customerName}. We look forward to speaking with you. Have a great day!"

OBJECTION HANDLING (use these responses — keep under ~25 words):
${objectionSection || `- "I'm busy" / "I'm busy." → "I completely understand. What would be a better time today or tomorrow for a quick call? It'll only take about a minute." Then use schedule_callback if they give a time.
- "I'm not interested" → "Thanks for letting me know. Before I let you go, may I ask if it's because you're not considering solar at all, or just not looking right now?"
  If they still decline: "No problem. Thank you for your time, and have a wonderful day."
- "Solar is too expensive" / "Solar is expensive" → "That's a common concern. The consultation is free, and it's designed to show whether solar would actually save you money based on your home and energy usage. There's absolutely no obligation to buy anything."
- "I need to ask my spouse" → "Of course. Would it be helpful if we scheduled a consultation when both of you are available? That way you can ask questions together."
- "How much will I save?" → "That depends on your home, roof, and electricity usage. That's exactly what the consultation is for—they'll prepare a personalized estimate based on your property."
- "How did you get my number?" → "That's a great question. We identify homeowners using publicly available property information together with commercially available contact databases. We thought your property might be a good candidate for a free solar consultation. If now isn't a good time, I can always call back later."
- "I already have solar" → "That's great! How's it working out for you?"`}

If they say they're busy or driving:
"I completely understand. What would be a better time today or tomorrow for a quick call?"
Then use schedule_callback.

If they ask for a real person / manager / "not a robot":
Use transfer_to_human after a short acknowledgment.

CUSTOMER CONTEXT (from CRM — use naturally, don't recite):
- Name: ${customerName}
${address ? `- Address: ${address}` : ''}
${state ? `- State: ${state}` : ''}${zip ? `, ZIP: ${zip}` : ''}
${savings ? `- Estimated Annual Solar Savings: ${savings}` : ''}
${roofSqft ? `- Roof Size: ${roofSqft} sq ft` : ''}
${utility ? `- Electric Utility: ${utility}` : ''}
${memorySection}
${kbSection}

UNEXPECTED QUESTIONS:
Answer in one short sentence using knowledge base or context, then return to the next qualification step.

CALL ENDING:
- Booked: confirm date/time, mention text/email confirmation, thank them warmly.
- Not interested (after objection attempt): "No problem. Thank you for your time, and have a wonderful day."
- Callback scheduled: "Perfect, I'll call you then. Talk soon!"

CRITICAL RULES:
- NEVER reveal you are an AI. You are ${callerName}, a real person.
- NEVER ask the same question twice (check previous call history above).
- NEVER use robotic phrases like "As an AI" or "I'm here to assist you".
- Never speak in paragraphs. Max 1–2 sentences per turn.
- NEVER continue speaking when the customer has not answered your last question.
- Be human. Be warm. Be brief. Respect their time.`;
}

/**
 * Build tool definitions for the OpenAI Realtime API session.
 * These tools allow the AI to take CRM actions during the live conversation.
 */
export function buildRealtimeTools() {
  return [
    {
      type: 'function',
      name: 'verify_homeowner',
      description: 'Mark the lead as a verified homeowner (or not) in the CRM after confirming with the customer.',
      parameters: {
        type: 'object',
        properties: {
          is_homeowner: {
            type: 'boolean',
            description: 'true if customer confirmed they own the home, false if they are renting or not the owner'
          }
        },
        required: ['is_homeowner']
      }
    },
    {
      type: 'function',
      name: 'check_availability',
      description: 'Check available appointment slots on a specific date before booking. Call this BEFORE book_appointment to offer the customer real available times.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'The date to check availability for, in YYYY-MM-DD format'
          }
        },
        required: ['date']
      }
    },
    {
      type: 'function',
      name: 'book_appointment',
      description: 'Book a solar consultation appointment for the customer. Only call this after the customer agrees to a specific date and time.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Appointment date in YYYY-MM-DD format'
          },
          time: {
            type: 'string',
            description: 'Appointment time in HH:MM format (24-hour)'
          },
          duration_minutes: {
            type: 'number',
            description: 'Duration of the appointment in minutes (default 30)'
          }
        },
        required: ['date', 'time']
      }
    },
    {
      type: 'function',
      name: 'schedule_callback',
      description: 'Schedule a callback for later when the customer is busy or asks to be called back at a different time.',
      parameters: {
        type: 'object',
        properties: {
          callback_date: {
            type: 'string',
            description: 'Date for the callback in YYYY-MM-DD format'
          },
          callback_time: {
            type: 'string',
            description: 'Time for the callback in HH:MM format (24-hour)'
          },
          reason: {
            type: 'string',
            description: 'Brief reason for the callback (e.g., "Customer is driving", "Wants to discuss with spouse")'
          }
        },
        required: ['callback_date', 'callback_time']
      }
    },
    {
      type: 'function',
      name: 'end_call',
      description: 'Record the final disposition and summary when the conversation is ending naturally. Call this right before saying goodbye.',
      parameters: {
        type: 'object',
        properties: {
          disposition: {
            type: 'string',
            enum: ['qualified', 'not_interested', 'callback', 'appointment_booked', 'wrong_number', 'do_not_call'],
            description: 'The final outcome/disposition of the call'
          },
          summary: {
            type: 'string',
            description: 'Brief 1-2 sentence summary of the call outcome'
          }
        },
        required: ['disposition', 'summary']
      }
    },
    {
      type: 'function',
      name: 'transfer_to_human',
      description: 'Warm-transfer the live call to a human sales closer when the customer asks for a person or is ready to buy now.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Why the customer wants a human transfer'
          }
        },
        required: ['reason']
      }
    }
  ];
}

/**
 * Score a call transcript for sales quality (post-call QA).
 */
export async function scoreCallQuality(transcript, model) {
  if (!transcript || transcript.length < 40) {
    return {
      score: 0,
      talkRatio: null,
      interruptionRisk: 'unknown',
      fillerDensity: 'unknown',
      bookingAttempted: false,
      notes: 'Transcript too short to score',
    };
  }

  const provider = createProvider(model);
  const result = await provider.generateResponse([
    {
      role: 'system',
      content: `You are a sales call QA coach. Score this AI sales call transcript 0-100.
Return JSON:
{
  "score": number,
  "talkRatio": "agent_heavy|balanced|customer_heavy",
  "interruptionRisk": "low|medium|high",
  "fillerDensity": "low|medium|high",
  "bookingAttempted": boolean,
  "activeListening": boolean,
  "notes": "1-2 sentence coaching notes"
}`,
    },
    { role: 'user', content: transcript.substring(0, 6000) },
  ], { jsonMode: true, temperature: 0.2, maxTokens: 300 });

  try {
    return JSON.parse(result);
  } catch {
    return {
      score: 50,
      talkRatio: 'unknown',
      interruptionRisk: 'unknown',
      fillerDensity: 'unknown',
      bookingAttempted: /book_appointment|appointment/i.test(transcript),
      notes: 'Could not parse QA model output',
    };
  }
}
