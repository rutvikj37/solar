import { API_BASE } from '../config.js';
import { authHeaders } from './auth.js';

export const AI_INTENTS = [
  { id: 'intro', label: 'Introduction' },
  { id: 'follow_up', label: 'Follow-up' },
  { id: 'appointment', label: 'Book a site visit' },
  { id: 'proposal_follow_up', label: 'Proposal follow-up' },
  { id: 're_engage', label: 'Re-engage' },
  { id: 'custom', label: 'Custom (use my instructions)' },
];
export const AI_TONES = ['friendly', 'professional', 'concise'];

const PENDING_DRAFT_KEY = (leadId) => `ai-email-draft:${leadId}`;

async function post(path, body) {
  const res = await fetch(`${API_BASE}/api/ai-outreach${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `AI request failed (${res.status})`);
    err.code = data.code || null;
    throw err;
  }
  return data;
}

export const draftOutreach = (body) => post('/draft', body);
export const fetchReplySuggestions = (leadId, messageId) => post('/reply-suggestions', { leadId, messageId });

/** Hand a reply draft from the Inbox page to the lead page composer. */
export function stashEmailDraft(leadId, draft) {
  try {
    sessionStorage.setItem(PENDING_DRAFT_KEY(leadId), JSON.stringify(draft));
  } catch {
    /* storage unavailable */
  }
}

export function takeStashedEmailDraft(leadId) {
  try {
    const raw = sessionStorage.getItem(PENDING_DRAFT_KEY(leadId));
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_DRAFT_KEY(leadId));
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
