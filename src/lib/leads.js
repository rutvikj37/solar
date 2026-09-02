/** Shared Lead Manager / Lead CRM constants and helpers.
 * Status KEYS are stable DB values — never rename them or automations break.
 * Labels match the Lead CRM pipeline (Cold → … → Closed/Won).
 */

export const STATUS_OPTIONS = [
  'new',
  'contacted',
  'qualified',
  'appointment',
  'proposal',
  'in_progress',
  'won',
  'lost',
];

/** Kanban column order = sales pipeline order */
export const PIPELINE_STAGES = STATUS_OPTIONS;

export const STATUS_CONFIG = {
  new: { label: 'Cold', color: 'slate', dot: 'bg-slate-400' },
  contacted: { label: 'Positive', color: 'green', dot: 'bg-emerald-400' },
  qualified: { label: 'Qualified', color: 'cyan', dot: 'bg-cyan-400' },
  appointment: { label: 'Appointment', color: 'purple', dot: 'bg-purple-400' },
  proposal: { label: 'Proposal', color: 'sky', dot: 'bg-sky-400' },
  in_progress: { label: 'Negotiation', color: 'orange', dot: 'bg-orange-400' },
  won: { label: 'Closed / Won', color: 'green', dot: 'bg-emerald-400' },
  lost: { label: 'Lost', color: 'slate', dot: 'bg-slate-400' },
};

export const LOST_REASONS = [
  'Not interested',
  'Price',
  'Competitor',
  'Financing',
  'Could not contact',
  'Timing',
  'Property unsuitable',
  'Other',
];

export const FILTER_TABS = ['All', 'Hot Leads', 'Qualified', 'In Progress', 'Won'];

const IN_PROGRESS_STATUSES = ['in_progress', 'contacted', 'appointment', 'proposal', 'qualified'];

export function getStatusConfig(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.new;
}

export function getStatusLabel(status) {
  return getStatusConfig(status).label;
}

export function getScoreTier(score) {
  const n = Number(score) || 0;
  if (n >= 85) return { label: 'Hot', className: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' };
  if (n >= 70) return { label: 'Warm', className: 'text-amber-400 bg-amber-500/15 border-amber-500/30' };
  if (n >= 50) return { label: 'Moderate', className: 'text-sky-400 bg-sky-500/15 border-sky-500/30' };
  return { label: 'Cold', className: 'text-slate-400 bg-slate-500/15 border-slate-500/30' };
}

export function formatLeadValue(value, fallback = '—') {
  if (!value || value === 'Not Available') return fallback;
  return value;
}

export function formatSavings(amount) {
  const n = Number(amount);
  if (!n || Number.isNaN(n)) return null;
  return `$${n.toLocaleString()}/yr`;
}

export function getLeadInitials(name) {
  if (!name) return 'LD';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function parseMaybeJson(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Lead score 0–100 from row or enriched payload */
export function getLeadScore(lead) {
  if (!lead) return 0;
  const direct = Number(lead.lead_score);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct);
  const pe = lead.propertyExtra || parseMaybeJson(lead.property_json);
  const overall = Number(pe?.aiLeadScore?.overall);
  if (Number.isFinite(overall) && overall > 0) return Math.round(overall);
  return 0;
}

/** Solar suitability score when available (does not invent values) */
export function getSolarScore(lead) {
  if (!lead) return null;
  const pe = lead.propertyExtra || parseMaybeJson(lead.property_json);
  const fromBreakdown = Number(pe?.aiLeadScore?.breakdown?.solarSuitability);
  if (Number.isFinite(fromBreakdown) && fromBreakdown > 0) return Math.round(fromBreakdown);
  if (Number.isFinite(Number(lead.solarScore)) && Number(lead.solarScore) > 0) {
    return Math.round(Number(lead.solarScore));
  }
  const solar = lead.solar || parseMaybeJson(lead.solar_json);
  const fromSolar = Number(solar?.solarScore ?? solar?.score);
  if (Number.isFinite(fromSolar) && fromSolar > 0 && fromSolar <= 100) return Math.round(fromSolar);
  const pot = Number(lead.solar_potential);
  if (Number.isFinite(pot) && pot > 0 && pot <= 100) return Math.round(pot);
  return null;
}

export function filterLeads(leads, { searchTerm = '', filterTab = 'All' } = {}) {
  const q = searchTerm.trim().toLowerCase();
  return leads.filter((lead) => {
    const matchesSearch =
      !q ||
      (lead.owner_name || '').toLowerCase().includes(q) ||
      (lead.address || '').toLowerCase().includes(q) ||
      (lead.email || '').toLowerCase().includes(q) ||
      (lead.phone || '').toLowerCase().includes(q) ||
      String(lead.id).includes(q);

    if (!matchesSearch) return false;
    if (filterTab === 'All') return true;
    if (filterTab === 'Hot Leads') return getLeadScore(lead) >= 85;
    if (filterTab === 'Qualified') {
      const score = getLeadScore(lead);
      return (score >= 70 && score < 85) || lead.status === 'qualified';
    }
    if (filterTab === 'In Progress') return IN_PROGRESS_STATUSES.includes(lead.status);
    if (filterTab === 'Won') return lead.status === 'won';
    return true;
  });
}

export function computeLeadStats(leads, summary = {}) {
  const total = leads.length;
  const hot = leads.filter((l) => getLeadScore(l) >= 85).length;
  const inPipeline = leads.filter((l) => IN_PROGRESS_STATUSES.includes(l.status)).length;
  const won = summary.won || leads.filter((l) => l.status === 'won').length;
  const avgScore = total
    ? Math.round(leads.reduce((sum, l) => sum + getLeadScore(l), 0) / total)
    : 0;
  const conversion = total ? Math.round((won / total) * 100) : 0;

  return { total, hot, inPipeline, won, avgScore, conversion };
}

export function sortLeads(leads, { key = 'created_at', direction = 'desc' } = {}) {
  const sorted = [...leads];
  const mult = direction === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    if (key === 'lead_score') {
      return mult * (getLeadScore(a) - getLeadScore(b));
    }
    if (key === 'owner_name') {
      return mult * (a.owner_name || '').localeCompare(b.owner_name || '');
    }
    if (key === 'status') {
      return mult * (a.status || '').localeCompare(b.status || '');
    }
    const da = new Date(a.created_at || 0).getTime();
    const db = new Date(b.created_at || 0).getTime();
    return mult * (da - db);
  });

  return sorted;
}

export function getFilterTabCount(leads, tab) {
  return filterLeads(leads, { filterTab: tab }).length;
}

export function groupLeadsByStage(leads) {
  const groups = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, []]));
  leads.forEach((lead) => {
    const key = PIPELINE_STAGES.includes(lead.status) ? lead.status : 'new';
    groups[key].push(lead);
  });
  return groups;
}

/**
 * Stage-aware Next Best Action (display only — does not auto-change status).
 */
export function getNextBestAction(lead) {
  const status = lead?.status || 'new';
  const name = formatLeadValue(lead?.owner_name, 'homeowner');
  const custom = (lead?.next_action || '').trim();

  const byStatus = {
    new: {
      title: 'Start outreach',
      detail: `Begin Email Sequence 1 for ${name}.`,
      cta: 'outreach',
      ctaLabel: 'Open Outreach',
    },
    contacted: {
      title: 'Call homeowner',
      detail: `${name} is in Positive — confirm interest and book next steps.`,
      cta: 'call',
      ctaLabel: 'Call Now',
    },
    qualified: {
      title: 'Book site assessment',
      detail: 'Lead is qualified. Schedule a site visit.',
      cta: 'appointment',
      ctaLabel: 'Book Appointment',
    },
    appointment: {
      title: 'Complete site survey',
      detail: 'Prepare for or complete the scheduled assessment.',
      cta: 'appointment',
      ctaLabel: 'View Appointment',
    },
    proposal: {
      title: 'Follow up on proposal',
      detail: 'Check engagement and follow up while interest is high.',
      cta: 'proposal',
      ctaLabel: 'Open Proposal',
    },
    in_progress: {
      title: 'Send revised proposal',
      detail: 'Negotiate terms and close remaining objections.',
      cta: 'proposal',
      ctaLabel: 'Revise Proposal',
    },
    won: {
      title: 'Record final sale details',
      detail: 'Capture system size, sale value, and close date for reporting.',
      cta: 'details',
      ctaLabel: 'Lead Details',
    },
    lost: {
      title: 'Review lost reason',
      detail: 'Confirm the loss reason is logged for analytics.',
      cta: 'details',
      ctaLabel: 'Lead Details',
    },
  };

  const base = byStatus[status] || byStatus.new;
  if (custom) {
    return { ...base, title: custom, detail: base.detail };
  }
  return base;
}
