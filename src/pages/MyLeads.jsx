import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import KpiCard from '../components/ai-calling/KpiCard';
import LeadStatusBadge from '../components/leads/LeadStatusBadge';
import LeadScoreBadge from '../components/leads/LeadScoreBadge';
import LeadAvatar from '../components/leads/LeadAvatar';
import LeadEmptyState from '../components/leads/LeadEmptyState';
import { API_BASE } from '../config.js';
import { formatLeadGeneratedAt } from '../lib/formatDate.js';
import {
  STATUS_OPTIONS,
  FILTER_TABS,
  filterLeads,
  computeLeadStats,
  sortLeads,
  getFilterTabCount,
  formatLeadValue,
  formatSavings,
} from '../lib/leads.js';

const API = API_BASE;

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
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
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [summary, setSummary] = useState({});
  const [tablePage, setTablePage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  const navigate = useNavigate();
  const location = useLocation();
  const token = () => localStorage.getItem('solar_token');

  const fetchLeads = useCallback(async () => {
    const t = token();
    if (!t) {
      navigate('/login');
      return;
    }
    try {
      const [leadsRes, sumRes] = await Promise.all([
        fetch(`${API}/api/leads`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${API}/api/leads/pipeline/summary`, { headers: { Authorization: `Bearer ${t}` } }),
      ]);
      if (!leadsRes.ok) throw new Error('Failed to fetch leads');
      setLeads(await leadsRes.json());
      if (sumRes.ok) setSummary(await sumRes.json());
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads, location.key]);

  useEffect(() => {
    const onFocus = () => fetchLeads();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchLeads]);

  useEffect(() => {
    setTablePage(1);
  }, [searchTerm, filterTab, sortKey, sortDir]);

  const stats = useMemo(() => computeLeadStats(leads, summary), [leads, summary]);

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

  const handleExport = async () => {
    try {
      const { downloadLeadsCsv } = await import('../lib/downloadLeadsCsv.js');
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
      {/* Page header */}
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            <span className="material-symbols-outlined text-sm">assignment</span>
            Pipeline CRM
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Lead Manager</h1>
          <p className="text-xs text-on-surface-variant max-w-2xl">
            Track, qualify, and move homeowners through your solar sales pipeline. Update stage inline or open a lead for full details.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
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
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 mb-4">
            <KpiCard icon="groups" label="Total Leads" value={stats.total} color="blue" />
            <KpiCard icon="local_fire_department" label="Hot Leads" value={stats.hot} color="green" subtitle="Score 85+" />
            <KpiCard icon="trending_up" label="In Pipeline" value={stats.inPipeline} color="amber" />
            <KpiCard icon="emoji_events" label="Closed Won" value={stats.won} color="teal" />
            <KpiCard icon="percent" label="Win Rate" value={stats.conversion} suffix="%" color="purple" subtitle={`Avg score ${stats.avgScore}`} />
          </div>

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
            <div className="sticky top-[72px] z-20 mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 backdrop-blur-xl">
              <span className="text-xs font-bold text-red-300">
                {selectedIds.length} lead{selectedIds.length === 1 ? '' : 's'} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white hover:bg-white/10 transition-all"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-bold hover:bg-red-500/30 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">delete_sweep</span>
                  Delete selected
                </button>
              </div>
            </div>
          )}

          {/* Table view */}
          <section className="glass-card rounded-2xl overflow-hidden border border-glass-stroke flex flex-col min-h-[min(70vh,720px)]">
            {filteredLeads.length === 0 ? (
              <LeadEmptyState hasFilters={hasActiveFilters} onClearFilters={clearFilters} />
            ) : (
              <>
                <div className="flex-1 overflow-auto custom-scrollbar max-h-[calc(100vh-320px)] min-h-[420px]">
                  <table className="w-full table-fixed border-collapse text-left min-w-[1080px]">
                    <colgroup>
                      <col className="w-10" />
                      <col className="w-[26%]" />
                      <col className="w-[28%]" />
                      <col className="w-[9%]" />
                      <col className="w-[14%]" />
                      <col className="w-[9%]" />
                      <col className="w-[10%]" />
                      <col className="w-[72px]" />
                    </colgroup>
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-surface-container-low/95 backdrop-blur-md text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-glass-stroke">
                        <th className="px-3 py-2.5 text-center">
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
                        <th className="px-3 py-2.5">
                          <button type="button" onClick={() => toggleSort('owner_name')} className="inline-flex items-center gap-1 hover:text-white">
                            Name / Contact <SortIcon column="owner_name" />
                          </button>
                        </th>
                        <th className="px-3 py-2.5">Address</th>
                        <th className="px-3 py-2.5">
                          <button type="button" onClick={() => toggleSort('lead_score')} className="inline-flex items-center gap-1 hover:text-white">
                            Score <SortIcon column="lead_score" />
                          </button>
                        </th>
                        <th className="px-3 py-2.5">
                          <button type="button" onClick={() => toggleSort('status')} className="inline-flex items-center gap-1 hover:text-white">
                            Stage <SortIcon column="status" />
                          </button>
                        </th>
                        <th className="px-3 py-2.5">Savings</th>
                        <th className="px-3 py-2.5">
                          <button type="button" onClick={() => toggleSort('created_at')} className="inline-flex items-center gap-1 hover:text-white">
                            Date <SortIcon column="created_at" />
                          </button>
                        </th>
                        <th className="px-3 py-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-glass-stroke/60">
                      {paginatedLeads.map((lead) => {
                        const ownerName = formatLeadValue(lead.owner_name, 'Unassigned Lead');
                        const address = formatLeadValue(lead.address, 'No address');
                        const phone = formatLeadValue(lead.phone);
                        const email = formatLeadValue(lead.email);
                        const savings = formatSavings(lead.estimated_savings);
                        const generatedAt = formatLeadGeneratedAt(lead.created_at);
                        return (
                          <tr key={lead.id} className="hover:bg-white/[0.03] transition-colors group align-middle">
                            <td className="px-3 py-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(lead.id)}
                                onChange={() => handleSelectToggle(lead.id)}
                                className="w-4 h-4 rounded border-glass-stroke bg-surface-container-low text-primary cursor-pointer"
                                aria-label={`Select ${ownerName}`}
                              />
                            </td>
                            <td className="px-3 py-2.5 max-w-0">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <LeadAvatar name={lead.owner_name} score={lead.lead_score} size="sm" />
                                <div className="min-w-0 flex-1 overflow-hidden">
                                  <Link
                                    to={`/lead/${lead.id}`}
                                    className="text-sm font-semibold text-white truncate block hover:text-primary transition-colors leading-tight"
                                    title={ownerName}
                                  >
                                    {ownerName}
                                  </Link>
                                  <p className="text-[11px] text-slate-300 font-mono truncate mt-0.5" title={phone !== '—' ? phone : undefined}>
                                    {phone}
                                  </p>
                                  <p className="text-[10px] text-slate-400 truncate" title={email !== '—' ? email : undefined}>
                                    {email}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 max-w-0">
                              <p className="text-xs text-slate-200 truncate" title={address !== 'No address' ? address : undefined}>
                                {address}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">ID #{lead.id}</p>
                            </td>
                            <td className="px-3 py-2.5">
                              <LeadScoreBadge score={lead.lead_score} showBar />
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-col gap-1 min-w-0">
                                <LeadStatusBadge status={lead.status} />
                                <select
                                  value={lead.status || 'new'}
                                  onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                                  className="w-full min-w-0 bg-surface-container-low border border-glass-stroke rounded-md py-1 px-1.5 text-white text-[11px] focus:outline-none focus:border-primary/50 cursor-pointer"
                                  aria-label={`Update stage for ${ownerName}`}
                                >
                                  {STATUS_OPTIONS.map((s) => (
                                    <option key={s} value={s}>
                                      {s.replace('_', ' ')}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">
                              <p className={`text-xs font-mono tabular-nums ${savings ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {savings || '—'}
                              </p>
                            </td>
                            <td className="px-3 py-2.5">
                              <p className="text-[11px] text-slate-400 whitespace-nowrap" title={generatedAt || undefined}>
                                {generatedAt || '—'}
                              </p>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <Link
                                to={`/lead/${lead.id}`}
                                className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md bg-primary/10 text-primary text-[11px] font-bold hover:bg-primary/20 transition-all whitespace-nowrap"
                              >
                                Open
                                <span className="material-symbols-outlined text-sm">chevron_right</span>
                              </Link>
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
    </>
  );
}
