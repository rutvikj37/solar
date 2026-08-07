/** Shared Lead Manager constants and helpers. */

export const STATUS_OPTIONS = [
  'new',
  'qualified',
  'contacted',
  'in_progress',
  'appointment',
  'proposal',
  'won',
  'lost',
];

export const STATUS_CONFIG = {
  new: { label: 'New', color: 'blue', dot: 'bg-blue-400' },
  qualified: { label: 'Qualified', color: 'cyan', dot: 'bg-cyan-400' },
  contacted: { label: 'Contacted', color: 'amber', dot: 'bg-amber-400' },
  in_progress: { label: 'In Progress', color: 'orange', dot: 'bg-orange-400' },
  appointment: { label: 'Appointment', color: 'purple', dot: 'bg-purple-400' },
  proposal: { label: 'Proposal', color: 'sky', dot: 'bg-sky-400' },
  won: { label: 'Won', color: 'green', dot: 'bg-emerald-400' },
  lost: { label: 'Lost', color: 'slate', dot: 'bg-slate-400' },
};

export const FILTER_TABS = ['All', 'Hot Leads', 'Qualified', 'In Progress', 'Won'];

const IN_PROGRESS_STATUSES = ['in_progress', 'contacted', 'appointment', 'proposal'];
export function getStatusConfig(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.new;
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
    if (filterTab === 'Hot Leads') return (lead.lead_score || 0) >= 85;
    if (filterTab === 'Qualified') return (lead.lead_score || 0) >= 70 && (lead.lead_score || 0) < 85;
    if (filterTab === 'In Progress') return IN_PROGRESS_STATUSES.includes(lead.status);
    if (filterTab === 'Won') return lead.status === 'won';
    return true;
  });
}

export function computeLeadStats(leads, summary = {}) {
  const total = leads.length;
  const hot = leads.filter((l) => (l.lead_score || 0) >= 85).length;
  const inPipeline = leads.filter((l) => IN_PROGRESS_STATUSES.includes(l.status)).length;
  const won = summary.won || leads.filter((l) => l.status === 'won').length;
  const avgScore = total
    ? Math.round(leads.reduce((sum, l) => sum + (Number(l.lead_score) || 0), 0) / total)
    : 0;
  const conversion = total ? Math.round((won / total) * 100) : 0;

  return { total, hot, inPipeline, won, avgScore, conversion };
}

export function sortLeads(leads, { key = 'created_at', direction = 'desc' } = {}) {
  const sorted = [...leads];
  const mult = direction === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    if (key === 'lead_score') {
      return mult * ((Number(a.lead_score) || 0) - (Number(b.lead_score) || 0));
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
