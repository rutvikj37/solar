import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import KpiCard from '../../components/ai-calling/KpiCard';
import LeadStatusBadge from '../../components/leads/LeadStatusBadge';
import LeadScoreBadge from '../../components/leads/LeadScoreBadge';
import LeadAvatar from '../../components/leads/LeadAvatar';
import LeadEmptyState from '../../components/leads/LeadEmptyState';
import LeadKanbanBoard from '../../components/leads/LeadKanbanBoard';
import PipelineCustomizeModal from '../../components/leads/PipelineCustomizeModal';
import {
  CRM_PROVIDER_META,
  fetchCrmIntegrations,
  getConnectedProviders,
  pushBulkLeadsToCrm,
} from '../../lib/crmIntegrations.js';
import { API_BASE } from '../../config.js';
import { formatLeadGeneratedAt } from '../../lib/formatDate.js';
import ApiErrorBanner from '../../components/layout/ApiErrorBanner.jsx';
import {
  STATUS_OPTIONS,
  FILTER_TABS,
  filterLeads,
  computeLeadStats,
  sortLeads,
  getFilterTabCount,
  formatLeadValue,
  getStatusLabel,
  getLeadScore,
  getSolarScore,
  getOverdueFollowUps,
  getPurchaseIntent,
  getLeadImageUrl,
} from '../../lib/leads.js';
import {
  fetchPipelineStages,
  stagesToStatusOptions,
  stagesToStatusConfig,
  DEFAULT_PIPELINE_STAGE_LIST,
} from '../../lib/pipelineApi.js';

const API = API_BASE;

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-white/5 border border-glass-stroke" />
        ))}
      </div>
      <div className="h-12 rounded-2xl bg-white/5 border border-glass-stroke" />
      <div className="h-[min(70vh,560px)] rounded-2xl bg-white/5 border border-glass-stroke" />
    </div>
  );
}

export default function MyLeads() {
  const [leads, setLeads] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState('All');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [summary, setSummary] = useState({});
  const [tablePage, setTablePage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [crmIntegrations, setCrmIntegrations] = useState(null);
  const [bulkPushBusy, setBulkPushBusy] = useState('');
  const [bulkPushMessage, setBulkPushMessage] = useState('');
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('lead_crm_view') === 'kanban' ? 'kanban' : 'list';
    } catch {
      return 'list';
    }
  });
  const [statusBusyId, setStatusBusyId] = useState(null);
  const [pipelineStages, setPipelineStages] = useState(DEFAULT_PIPELINE_STAGE_LIST);
  const [showPipelineModal, setShowPipelineModal] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const token = () => localStorage.getItem('solar_token');

  const statusOptions = useMemo(
    () => stagesToStatusOptions(pipelineStages) || STATUS_OPTIONS,
    [pipelineStages],
  );
  const statusConfigMap = useMemo(() => stagesToStatusConfig(pipelineStages), [pipelineStages]);

  const setView = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('lead_crm_view', mode);
    } catch {
      /* ignore */
    }
  };

  const fetchLeads = useCallback(async () => {
    const t = token();
    if (!t) {
      navigate('/login');
      return;
    }
    try {
      setLoadError('');
      const [leadsRes, sumRes] = await Promise.all([
        fetch(`${API}/api/leads`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${API}/api/leads/pipeline/summary`, { headers: { Authorization: `Bearer ${t}` } }),
      ]);
      if (!leadsRes.ok) throw new Error('Failed to fetch leads');
      setLeads(await leadsRes.json());
      if (sumRes.ok) setSummary(await sumRes.json());
    } catch (error) {
      setLoadError(error.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads, location.key]);

  useEffect(() => {
    fetchPipelineStages()
      .then((data) => {
        if (data?.stages?.length) setPipelineStages(data.stages);
      })
      .catch(() => {});
  }, [location.key]);

  useEffect(() => {
    fetchCrmIntegrations()
      .then(setCrmIntegrations)
      .catch(() => setCrmIntegrations(null));
  }, [location.key]);

  useEffect(() => {
    const onFocus = () => fetchLeads();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchLeads]);

  useEffect(() => {
    setTablePage(1);
  }, [searchTerm, filterTab, sortKey, sortDir]);

  const stats = useMemo(() => computeLeadStats(leads, summary), [leads, summary]);
  const overdueLeads = useMemo(() => getOverdueFollowUps(leads), [leads]);

  const filteredLeads = useMemo(
    () => sortLeads(filterLeads(leads, { searchTerm, filterTab }), { key: sortKey, direction: sortDir }),
    [leads, searchTerm, filterTab, sortKey, sortDir]
  );

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const paginatedLeads = filteredLeads.slice((tablePage - 1) * pageSize, tablePage * pageSize);
  const hasActiveFilters = Boolean(searchTerm.trim()) || filterTab !== 'All';

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'owner_name' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ column }) => {
    if (sortKey !== column) return <span className="material-symbols-outlined text-[14px] opacity-30">unfold_more</span>;
    return (
      <span className="material-symbols-outlined text-[14px] text-primary">
        {sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
      </span>
    );
  };

  const handleSelectToggle = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSelectAllToggle = () => {
    const filteredIds = filteredLeads.map((l) => l.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const handleStatusChange = async (leadId, status) => {
    const t = token();
    setStatusBusyId(leadId);
    try {
      const res = await fetch(`${API}/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
        const sumRes = await fetch(`${API}/api/leads/pipeline/summary`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        if (sumRes.ok) setSummary(await sumRes.json());
      }
    } finally {
      setStatusBusyId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected lead${selectedIds.length === 1 ? '' : 's'}?`)) return;
    const t = token();
    const response = await fetch(`${API}/api/leads/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ leadIds: selectedIds }),
    });
    if (response.ok) {
      setSelectedIds([]);
      await fetchLeads();
    } else {
      alert('Failed to delete selected leads.');
    }
  };

  const connectedCrms = useMemo(() => getConnectedProviders(crmIntegrations), [crmIntegrations]);

  const handleBulkPush = async (provider) => {
    if (selectedIds.length === 0) return;
    setBulkPushBusy(provider);
    setBulkPushMessage('');
    try {
      const result = await pushBulkLeadsToCrm(selectedIds.slice(0, 50), provider);
      setBulkPushMessage(
        `${result.success} pushed to ${CRM_PROVIDER_META[provider].label}${result.failed ? `, ${result.failed} failed` : ''}`,
      );
    } catch (err) {
      setBulkPushMessage(err.message);
    } finally {
      setBulkPushBusy('');
    }
  };

  const handleExport = async () => {
    try {
      const { downloadLeadsCsv } = await import('../../lib/downloadLeadsCsv.js');
      await downloadLeadsCsv();
    } catch {
      alert('Export failed');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterTab('All');
  };

  return (
    <>
      <ApiErrorBanner error={loadError} onRetry={fetchLeads} />
      {/* Page header */}
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            <span className="material-symbols-outlined text-sm">assignment</span>
            Pipeline CRM
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Leads CRM</h1>
          <p className="text-xs text-on-surface-variant max-w-2xl">
            List or Kanban pipeline — drag stages, open Lead 360 for outreach, appointments, and proposals. Existing automations stay intact.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex rounded-xl border border-glass-stroke bg-white/5 p-0.5">
            <button
              type="button"
              onClick={() => setView('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-bold transition-all ${
                viewMode === 'list' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-base">view_list</span>
              List
            </button>
            <button
              type="button"
              onClick={() => setView('kanban')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-bold transition-all ${
                viewMode === 'kanban' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-base">view_kanban</span>
              Kanban
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowPipelineModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 border border-glass-stroke text-xs font-bold text-white hover:bg-white/10 transition-all"
          >
            <span className="material-symbols-outlined text-base">tune</span>
            Customize
          </button>
          <button
            type="button"
            onClick={fetchLeads}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 border border-glass-stroke text-xs font-bold text-white hover:bg-white/10 transition-all"
          >
            <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>sync</span>
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 border border-glass-stroke text-xs font-bold text-white hover:bg-white/10 transition-all"
          >
            <span className="material-symbols-outlined text-base">download</span>
            Export CSV
          </button>
          <Link
            to="/map"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20"
          >
            <span className="material-symbols-outlined text-base">radar</span>
            Find Leads
          </Link>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* KPI row — mockup: Total / New / Appointments / Proposals / Closed Won / Conversion */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 mb-4">
            <KpiCard icon="groups" label="Total Leads" value={stats.total} color="blue" />
            <KpiCard icon="fiber_new" label="New" value={stats.newThisWeek} color="sky" subtitle="Last 7 days" />
            <KpiCard icon="event" label="Appointments" value={stats.appointments} color="amber" />
            <KpiCard icon="description" label="Proposals Sent" value={stats.proposalsSent} color="indigo" />
            <KpiCard icon="emoji_events" label="Closed Won" value={stats.won} color="teal" />
            <KpiCard
              icon="percent"
              label="Conversion"
              value={stats.conversion}
              suffix="%"
              color="green"
              subtitle={`Avg score ${stats.avgScore}`}
            />
          </div>

          {overdueLeads.length > 0 && (
            <div className="mb-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-300">
                  {overdueLeads.length} overdue follow-up{overdueLeads.length === 1 ? '' : 's'}
                </p>
                <p className="text-[11px] text-on-surface-variant truncate">
                  Next: {formatLeadValue(overdueLeads[0].owner_name, 'Lead')} —{' '}
                  {overdueLeads[0].next_action || 'Follow up'} (
                  {formatLeadGeneratedAt(overdueLeads[0].follow_up_at)})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFilterTab('Overdue')}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-500/30 text-xs font-bold"
              >
                Show overdue
              </button>
            </div>
          )}

          {/* Toolbar */}
          <div className="glass-card rounded-2xl border border-glass-stroke p-3 mb-3 space-y-3">
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
                search
              </span>
              <input
                type="text"
                placeholder="Search name, address, phone, email, or ID…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface-container-low border border-glass-stroke rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-0.5">
                {FILTER_TABS.map((tab) => {
                  const count = getFilterTabCount(leads, tab);
                  const active = filterTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setFilterTab(tab)}
                      className={`shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all border ${
                        active
                          ? 'bg-primary/15 text-primary border-primary/30'
                          : 'bg-white/5 text-on-surface-variant border-transparent hover:text-white hover:border-glass-stroke'
                      }`}
                    >
                      {tab}
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md ${active ? 'bg-primary/20' : 'bg-white/5'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] text-on-surface-variant shrink-0">
                Showing <span className="text-white font-bold">{filteredLeads.length}</span> of {leads.length} leads
              </p>
            </div>
          </div>

          {/* Bulk actions */}
          {selectedIds.length > 0 && (
            <div className="sticky top-[72px] z-20 mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/25 backdrop-blur-xl">
              <span className="text-xs font-bold text-primary">
                {selectedIds.length} lead{selectedIds.length === 1 ? '' : 's'} selected
              </span>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white hover:bg-white/10 transition-all"
                >
                  Clear
                </button>
                {connectedCrms.length === 0 ? (
                  <Link
                    to="/integrations"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-secondary/20 text-secondary border border-secondary/30 text-xs font-bold hover:bg-secondary/30 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">link</span>
                    Connect CRM
                  </Link>
                ) : (
                  connectedCrms.map((provider) => {
                    const meta = CRM_PROVIDER_META[provider];
                    return (
                      <button
                        key={provider}
                        type="button"
                        onClick={() => handleBulkPush(provider)}
                        disabled={!!bulkPushBusy}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border text-xs font-bold disabled:opacity-50 ${meta.btnClass}`}
                      >
                        <span className="material-symbols-outlined text-sm">sync_alt</span>
                        {bulkPushBusy === provider
                          ? 'Pushing…'
                          : `Push to ${meta.shortLabel}`}
                      </button>
                    );
                  })
                )}
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-bold hover:bg-red-500/30 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">delete_sweep</span>
                  Delete selected
                </button>
              </div>
              {bulkPushMessage && (
                <p className="text-[10px] text-green-400 w-full text-right">{bulkPushMessage}</p>
              )}
            </div>
          )}

          {/* Table / Kanban view */}
          <section className="glass-card rounded-2xl overflow-hidden border border-glass-stroke flex flex-col min-h-[min(70vh,720px)]">
            {filteredLeads.length === 0 ? (
              <LeadEmptyState hasFilters={hasActiveFilters} onClearFilters={clearFilters} />
            ) : viewMode === 'kanban' ? (
              <div className="p-3">
                <p className="text-[11px] text-on-surface-variant mb-3 px-1">
                  Drag and drop leads across stages to update pipeline. Same statuses used by drip, appointments, and proposals.
                </p>
                <LeadKanbanBoard
                  leads={filteredLeads}
                  onStatusChange={handleStatusChange}
                  busyId={statusBusyId}
                  stages={pipelineStages}
                  statusConfigMap={statusConfigMap}
                />
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-auto custom-scrollbar max-h-[calc(100vh-320px)] min-h-[420px]">
                  <table className="w-full border-collapse text-left min-w-[1480px]">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-surface-container-low/95 backdrop-blur-md text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-glass-stroke">
                        <th className="px-3 py-3 text-center w-10">
                          <input
                            type="checkbox"
                            checked={
                              filteredLeads.length > 0 &&
                              filteredLeads.every((l) => selectedIds.includes(l.id))
                            }
                            onChange={handleSelectAllToggle}
                            className="w-4 h-4 rounded border-glass-stroke bg-surface-container-low text-primary cursor-pointer"
                            aria-label="Select all leads"
                          />
                        </th>
                        <th className="px-3 py-3 min-w-[220px]">
                          <button type="button" onClick={() => toggleSort('owner_name')} className="inline-flex items-center gap-1 hover:text-white">
                            Lead / Property <SortIcon column="owner_name" />
                          </button>
                        </th>
                        <th className="px-3 py-3">
                          <button type="button" onClick={() => toggleSort('lead_score')} className="inline-flex items-center gap-1 hover:text-white">
                            Lead Score <SortIcon column="lead_score" />
                          </button>
                        </th>
                        <th className="px-3 py-3">Solar Score</th>
                        <th className="px-3 py-3">
                          <button type="button" onClick={() => toggleSort('status')} className="inline-flex items-center gap-1 hover:text-white">
                            Stage <SortIcon column="status" />
                          </button>
                        </th>
                        <th className="px-3 py-3">Purchase Intent</th>
                        <th className="px-3 py-3">Last Activity</th>
                        <th className="px-3 py-3">Next Follow-up</th>
                        <th className="px-3 py-3">Assigned To</th>
                        <th className="px-3 py-3">Lead Source</th>
                        <th className="px-3 py-3">
                          <button type="button" onClick={() => toggleSort('created_at')} className="inline-flex items-center gap-1 hover:text-white">
                            Created <SortIcon column="created_at" />
                          </button>
                        </th>
                        <th className="px-3 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-glass-stroke/60">
                      {paginatedLeads.map((lead) => {
                        const ownerName = formatLeadValue(lead.owner_name, 'Unassigned Lead');
                        const address = formatLeadValue(lead.address, 'No address');
                        const generatedAt = formatLeadGeneratedAt(lead.created_at);
                        const leadScore = getLeadScore(lead);
                        const solarScore = getSolarScore(lead);
                        const intent = getPurchaseIntent(lead);
                        const img = getLeadImageUrl(lead);
                        const assignee =
                          formatLeadValue(lead.assigned_to_name, null) ||
                          formatLeadValue(lead.owner_user_name, null) ||
                          'You';
                        return (
                          <tr key={lead.id} className="hover:bg-white/[0.03] transition-colors group align-middle">
                            <td className="px-3 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(lead.id)}
                                onChange={() => handleSelectToggle(lead.id)}
                                className="w-4 h-4 rounded border-glass-stroke bg-surface-container-low text-primary cursor-pointer"
                                aria-label={`Select ${ownerName}`}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#0B1220] border border-glass-stroke shrink-0">
                                  {img ? (
                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <LeadAvatar name={lead.owner_name} score={leadScore} size="sm" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <Link
                                    to={`/lead/${lead.id}`}
                                    className="text-sm font-semibold text-white truncate block hover:text-primary transition-colors leading-tight"
                                    title={ownerName}
                                  >
                                    {ownerName}
                                  </Link>
                                  <p className="text-[11px] text-slate-400 truncate mt-0.5" title={address}>
                                    {address}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <LeadScoreBadge score={leadScore} showBar />
                            </td>
                            <td className="px-3 py-3">
                              {solarScore != null ? (
                                <span className="inline-flex items-center justify-center min-w-[2.25rem] h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold font-mono">
                                  {solarScore}
                                </span>
                              ) : (
                                <span className="text-slate-500 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex flex-col gap-1 min-w-0">
                                <LeadStatusBadge status={lead.status} configMap={statusConfigMap} />
                                <select
                                  value={
                                    statusOptions.includes(lead.status)
                                      ? lead.status
                                      : lead.status || 'new'
                                  }
                                  onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                                  disabled={statusBusyId === lead.id}
                                  className="w-full min-w-0 bg-surface-container-low border border-glass-stroke rounded-md py-1 px-1.5 text-white text-[11px] focus:outline-none focus:border-primary/50 cursor-pointer disabled:opacity-50"
                                  aria-label={`Update stage for ${ownerName}`}
                                >
                                  {!statusOptions.includes(lead.status || 'new') && lead.status ? (
                                    <option value={lead.status}>{lead.status}</option>
                                  ) : null}
                                  {statusOptions.map((s) => (
                                    <option key={s} value={s}>
                                      {statusConfigMap[s]?.label || getStatusLabel(s)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <p className="text-[11px] text-slate-300 max-w-[140px] truncate" title={intent}>
                                {intent}
                              </p>
                            </td>
                            <td className="px-3 py-3 max-w-[140px]">
                              {lead.last_activity_at ? (
                                <>
                                  <p className="text-[11px] text-slate-200 truncate capitalize">
                                    {(lead.last_activity_type || 'activity').replace(/_/g, ' ')}
                                  </p>
                                  <p className="text-[10px] text-slate-500 whitespace-nowrap">
                                    {formatLeadGeneratedAt(lead.last_activity_at)}
                                  </p>
                                </>
                              ) : (
                                <span className="text-slate-500 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              {lead.follow_up_at ? (
                                <>
                                  <p
                                    className={`text-[11px] whitespace-nowrap ${
                                      new Date(lead.follow_up_at).getTime() < Date.now() &&
                                      lead.status !== 'won' &&
                                      lead.status !== 'lost'
                                        ? 'text-amber-300 font-bold'
                                        : 'text-amber-300/90'
                                    }`}
                                  >
                                    {formatLeadGeneratedAt(lead.follow_up_at)}
                                  </p>
                                  {lead.next_action ? (
                                    <p className="text-[10px] text-slate-400 truncate mt-0.5 max-w-[120px]" title={lead.next_action}>
                                      {lead.next_action}
                                    </p>
                                  ) : null}
                                </>
                              ) : (
                                <span className="text-slate-500 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <p className="text-[11px] text-slate-300 truncate max-w-[100px]">{assignee}</p>
                            </td>
                            <td className="px-3 py-3">
                              <p className="text-[11px] text-slate-300 truncate max-w-[100px]">
                                {formatLeadValue(lead.lead_source, '—')}
                              </p>
                            </td>
                            <td className="px-3 py-3">
                              <p className="text-[11px] text-slate-400 whitespace-nowrap" title={generatedAt || undefined}>
                                {generatedAt || '—'}
                              </p>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <div className="inline-flex items-center gap-0.5 justify-end">
                                {lead.phone && lead.phone !== 'Not Available' ? (
                                  <a
                                    href={`tel:${lead.phone}`}
                                    className="p-1.5 rounded-md text-on-surface-variant hover:text-primary hover:bg-primary/10"
                                    title="Call"
                                    aria-label={`Call ${ownerName}`}
                                  >
                                    <span className="material-symbols-outlined text-base">call</span>
                                  </a>
                                ) : null}
                                <Link
                                  to={`/lead/${lead.id}?tab=outreach`}
                                  className="p-1.5 rounded-md text-on-surface-variant hover:text-primary hover:bg-primary/10"
                                  title="SMS"
                                  aria-label={`SMS ${ownerName}`}
                                >
                                  <span className="material-symbols-outlined text-base">sms</span>
                                </Link>
                                <Link
                                  to={`/lead/${lead.id}?tab=outreach`}
                                  className="p-1.5 rounded-md text-on-surface-variant hover:text-primary hover:bg-primary/10"
                                  title="Email"
                                  aria-label={`Email ${ownerName}`}
                                >
                                  <span className="material-symbols-outlined text-base">mail</span>
                                </Link>
                                <Link
                                  to={`/lead/${lead.id}`}
                                  className="p-1.5 rounded-md text-on-surface-variant hover:text-primary hover:bg-primary/10"
                                  title="More"
                                  aria-label={`Open ${ownerName}`}
                                >
                                  <span className="material-symbols-outlined text-base">more_horiz</span>
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 border-t border-glass-stroke/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-white/[0.02] shrink-0">
                  <div className="flex items-center gap-3 text-slate-400 flex-wrap">
                    <span>
                      {filteredLeads.length > 0 ? (tablePage - 1) * pageSize + 1 : 0}–
                      {Math.min(tablePage * pageSize, filteredLeads.length)} of {filteredLeads.length}
                    </span>
                    <label className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono uppercase">Rows</span>
                      <select
                        value={pageSize}
                        onChange={(e) => {
                          setPageSize(Number(e.target.value));
                          setTablePage(1);
                        }}
                        className="bg-surface-container-low border border-glass-stroke rounded-lg py-1 px-2 text-white text-xs"
                      >
                        <option value={15}>15</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </label>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={tablePage === 1}
                      onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-glass-stroke text-white font-bold disabled:opacity-40 hover:bg-white/10 transition-all"
                    >
                      Prev
                    </button>
                    <span className="px-3 text-slate-400 font-mono">
                      {tablePage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={tablePage >= totalPages}
                      onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-glass-stroke text-white font-bold disabled:opacity-40 hover:bg-white/10 transition-all"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </>
      )}

      <PipelineCustomizeModal
        open={showPipelineModal}
        onClose={() => setShowPipelineModal(false)}
        onSaved={(stages) => {
          if (stages?.length) setPipelineStages(stages);
        }}
      />
    </>
  );
}
