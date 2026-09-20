export const MARKETPLACE_STATUSES = [
  'new',
  'ai_qualified',
  'marketplace',
  'bidding',
  'no_bid_expanding',
  'winner_selected',
  'lead_unlocked',
  'contacted',
  'interested',
  'appointment',
  'proposal',
  'won',
  'lost',
  'closed_unsold',
  'invalid_refunded',
];

export const TERMINAL_NO_RELIST = new Set([
  'won',
  'lost',
  'closed_unsold',
  'invalid_refunded',
]);

export const ACTIVE_PIPELINE = new Set([
  'lead_unlocked',
  'contacted',
  'interested',
  'appointment',
  'proposal',
]);

export const CLOSED_PIPELINE = new Set(['won', 'lost', 'invalid_refunded', 'closed_unsold']);

export const OUTCOME_TRANSITIONS = {
  lead_unlocked: ['contacted', 'interested', 'lost'],
  contacted: ['interested', 'appointment', 'lost'],
  interested: ['appointment', 'proposal', 'lost'],
  appointment: ['proposal', 'won', 'lost'],
  proposal: ['won', 'lost'],
};

export const DISPUTE_CLAIM_TYPES = [
  'wrong_number',
  'duplicate',
  'already_has_solar',
  'invalid_property',
  'wrong_property_type',
];

export const BIDDING_OPEN_STATUSES = new Set(['bidding', 'no_bid_expanding']);

/**
 * Mission Control early access: new opportunities are exclusive for this many hours
 * after creation, then open to all marketplace-eligible plans (Pioneer+).
 */
export const EARLY_MARKETPLACE_HOURS = 24;

/** True while the lead is still in the Mission Control early-access window. */
export function isEarlyMarketplaceWindow(lead, now = new Date()) {
  if (!lead) return false;
  const created = lead.created_at || lead.createdAt;
  if (!created) return false;
  const createdAt = created instanceof Date ? created : new Date(created);
  if (!Number.isFinite(createdAt.getTime())) return false;
  const ageMs = now.getTime() - createdAt.getTime();
  if (ageMs < 0) return true;
  return ageMs < EARLY_MARKETPLACE_HOURS * 60 * 60 * 1000;
}

/** Minimum USD bid wallet balance required before placing marketplace bids. */
export const MIN_WALLET_BALANCE_TO_BID = 25;

/**
 * Verified-installer gate is controlled by env MARKETPLACE_REQUIRE_VERIFIED.
 * Default: true when NODE_ENV=production (see marketplaceRequireVerified in routes).
 */

export function billRangeFromAmount(bill) {
  const n = Number(bill);
  if (!Number.isFinite(n) || n <= 0) return 'Not provided';
  if (n < 100) return 'Under $100';
  if (n < 150) return '$100–$150';
  if (n < 200) return '$150–$200';
  if (n < 300) return '$200–$300';
  if (n < 400) return '$300–$400';
  if (n < 500) return '$400–$500';
  return '$500+';
}

export function generateLeadCode() {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SX-${ts}-${rnd}`;
}

export function extractZip(address = '', zip = '') {
  if (zip && String(zip).trim()) {
    const z = String(zip).trim().match(/\b(\d{5})(?:-\d{4})?\b/);
    if (z) return z[1];
  }
  const m = String(address || '').match(/\b(\d{5})(?:-\d{4})?\b/);
  return m ? m[1] : null;
}
