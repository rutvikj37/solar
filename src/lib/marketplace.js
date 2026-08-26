export const MARKETPLACE_TABS = [
  { id: 'opportunities', label: 'Available Opportunities' },
  { id: 'bids', label: 'My Bids' },
  { id: 'won', label: 'Won Leads' },
  { id: 'active', label: 'Active Leads' },
  { id: 'closed', label: 'Closed Leads' },
  { id: 'wallet', label: 'Bid Wallet' },
];

export const OUTCOME_OPTIONS = [
  'contacted',
  'interested',
  'appointment',
  'proposal',
  'won',
  'lost',
];

export const DISPUTE_TYPES = [
  { id: 'wrong_number', label: 'Wrong number' },
  { id: 'duplicate', label: 'Duplicate' },
  { id: 'already_has_solar', label: 'Already has solar' },
  { id: 'invalid_property', label: 'Invalid property' },
  { id: 'wrong_property_type', label: 'Wrong property type' },
];

export const TIMELINE_OPTIONS = [
  '0–3 months',
  '3–6 months',
  '6–12 months',
  'Just researching',
];

export const HOMEOWNER_STATUS_OPTIONS = [
  'Homeowner',
  'Renter with owner permission',
  'Renter',
  'Property manager',
  'Business owner',
];

export const BIDDING_OPEN_STATUSES = new Set(['bidding', 'no_bid_expanding']);

export function isBiddingOpen(status) {
  return BIDDING_OPEN_STATUSES.has(status);
}

/** Marketplace bid wallet packs (USD). 1 unit = $1 bid balance. */
export const MARKETPLACE_WALLET_PACKS = [
  { id: 'mkt_50', credits: 50, price: 50, label: '$50 wallet' },
  { id: 'mkt_100', credits: 100, price: 100, label: '$100 wallet' },
  { id: 'mkt_250', credits: 250, price: 250, label: '$250 wallet' },
  { id: 'mkt_500', credits: 500, price: 500, label: '$500 wallet' },
];

export function strengthClass(strength) {
  if (strength === 'Leading') return 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30';
  if (strength === 'Competitive') return 'text-amber-300 bg-amber-500/15 border-amber-500/30';
  if (strength === 'Behind') return 'text-slate-300 bg-slate-500/15 border-slate-500/30';
  return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
}

export function formatMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatWhen(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

/** Live countdown until bidding closes (e.g. "47h 12m 5s"). */
export function formatCountdown(closesAt, now = Date.now()) {
  if (!closesAt) return '—';
  const end = new Date(closesAt).getTime();
  if (!Number.isFinite(end)) return '—';
  const diff = end - now;
  if (diff <= 0) return 'Closed';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Urgency tier for countdown styling: none | normal | urgent (<24h) | critical (<1h) | closed */
export function getCountdownUrgency(closesAt, now = Date.now()) {
  if (!closesAt) return 'none';
  const end = new Date(closesAt).getTime();
  if (!Number.isFinite(end)) return 'none';
  const diff = end - now;
  if (diff <= 0) return 'closed';
  if (diff < 3600000) return 'critical';
  if (diff < 86400000) return 'urgent';
  return 'normal';
}

const LEDGER_TYPE_LABELS = {
  top_up: 'Top-up',
  win_debit: 'Lead win charge',
  refund: 'Refund',
  admin_adjust: 'Admin adjustment',
};

export function formatLedgerEntryType(entryType) {
  return LEDGER_TYPE_LABELS[entryType] || String(entryType || '').replace(/_/g, ' ');
}
