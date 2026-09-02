import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../config.js';
import { authHeaders, isAuthError, logoutToLogin } from '../lib/auth.js';
import { formatLeadGeneratedAt } from '../lib/formatDate.js';
import LeadStatusBadge from './leads/LeadStatusBadge';
import LeadScoreBadge from './leads/LeadScoreBadge';
import LeadAvatar from './leads/LeadAvatar';
import {
  STATUS_OPTIONS,
  FILTER_TABS,
  filterLeads,
  computeLeadStats,
  formatLeadValue,
  formatSavings,
  getStatusLabel,
} from '../lib/leads.js';

const API = API_BASE;

export default function LeadManagerPanel({ onClose, refreshKey = 0, visible = true }) {
  const [leads, setLeads] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState('All');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({});

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsRes, sumRes] = await Promise.all([
        fetch(`${API}/api/leads`, { headers: authHeaders() }),
        fetch(`${API}/api/leads/pipeline/summary`, { headers: authHeaders() }),
      ]);
      if (isAuthError(leadsRes.status) || isAuthError(sumRes.status)) {
        logoutToLogin();
        return;
      }
      if (!leadsRes.ok) throw new Error('Failed to fetch leads');
      setLeads(await leadsRes.json());
      if (sumRes.ok) setSummary(await sumRes.json());
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads, refreshKey]);

  useEffect(() => {
    if (visible) fetchLeads();
  }, [visible, fetchLeads]);

  const stats = useMemo(() => computeLeadStats(leads, summary), [leads, summary]);

  const filteredLeads = useMemo(
    () => filterLeads(leads, { searchTerm, filterTab }),
    [leads, searchTerm, filterTab]
  );

  const handleStatusChange = async (leadId, status) => {
    const res = await fetch(`${API}/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
      const sumRes = await fetch(`${API}/api/leads/pipeline/summary`, { headers: authHeaders() });
      if (sumRes.ok) setSummary(await sumRes.json());
    }
  };

  return (
    <div className="h-full flex flex-col bg-surface-elevated/95 backdrop-blur-2xl border border-glass-stroke rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-glass-stroke bg-white/[0.03]">
        <div className="flex justify-between items-start gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-lg">assignment</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white leading-tight">Lead Manager</h3>
              <p className="text-[10px] text-on-surface-variant mt-0.5">
                {stats.total} leads · {stats.hot} hot · {stats.inPipeline} active
              </p>
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={fetchLeads}
              className="text-on-surface-variant hover:text-primary p-2 rounded-lg hover:bg-white/5 transition-colors"
              title="Refresh leads"
            >
              <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>sync</span>
            </button>
            <Link
              to="/my-leads"
              className="text-on-surface-variant hover:text-primary p-2 rounded-lg hover:bg-white/5 transition-colors"
              title="Open full pipeline"
            >
              <span className="material-symbols-outlined text-base">open_in_new</span>
            </Link>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-on-surface-variant hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
                aria-label="Close Lead Manager"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Mini KPI strip */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { label: 'Total', value: stats.total, icon: 'groups' },
            { label: 'Hot', value: stats.hot, icon: 'local_fire_department' },
            { label: 'Won', value: stats.won, icon: 'emoji_events' },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-white/[0.03] border border-glass-stroke px-2.5 py-2">
              <div className="flex items-center gap-1 text-[9px] text-slate-500 uppercase tracking-wide font-bold">
                <span className="material-symbols-outlined text-[12px]">{item.icon}</span>
                {item.label}
              </div>
              <p className="text-sm font-bold text-white mt-0.5 tabular-nums">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Search + filters */}
      <div className="p-3 border-b border-glass-stroke space-y-2.5 bg-white/[0.01]">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
            search
          </span>
          <input
            type="text"
            placeholder="Search name, address, ID…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-container-low border border-glass-stroke rounded-xl py-2 pl-8 pr-3 text-white text-[11px] focus:outline-none focus:border-primary/50"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-0.5">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterTab(tab)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide transition-all border ${
                filterTab === tab
                  ? 'bg-primary/15 text-primary border-primary/30'
                  : 'bg-white/5 text-on-surface-variant border-transparent hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Lead list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5">
        {loading ? (
          <div className="space-y-2.5 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-white/5 border border-glass-stroke" />
            ))}
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-12 px-4">
            <span className="material-symbols-outlined text-3xl text-slate-600 mb-3 block">radar</span>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              No leads found. Scan properties on the map to unlock leads.
            </p>
            <Link
              to="/map"
              className="inline-flex items-center gap-1 mt-4 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-[10px] font-bold hover:bg-primary/25 transition-all"
            >
              Open map
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
        ) : (
          filteredLeads.map((lead) => {
            const generatedAt = formatLeadGeneratedAt(lead.created_at);
            const savings = formatSavings(lead.estimated_savings);
            return (
              <div
                key={lead.id}
                className="p-3 rounded-xl bg-white/[0.03] border border-glass-stroke hover:border-primary/30 transition-all"
              >
                <div className="flex items-start gap-2.5">
                  <LeadAvatar name={lead.owner_name} score={lead.lead_score} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          to={`/lead/${lead.id}`}
                          className="text-[12px] font-semibold text-white truncate block hover:text-primary transition-colors"
                        >
                          {formatLeadValue(lead.owner_name, 'Unassigned Lead')}
                        </Link>
                        <p className="text-[9px] text-slate-500 font-mono mt-0.5">#{lead.id}</p>
                      </div>
                      <LeadScoreBadge score={lead.lead_score} compact />
                    </div>

                    <p className="text-[10px] text-on-surface-variant truncate mt-1">
                      {formatLeadValue(lead.address, 'No address')}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <LeadStatusBadge status={lead.status} size="xs" />
                      {savings && (
                        <span className="text-[9px] text-emerald-400 font-mono">{savings}</span>
                      )}
                    </div>

                    {generatedAt && (
                      <p className="text-[9px] text-slate-500 mt-1.5 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[11px]">schedule</span>
                        {generatedAt}
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-glass-stroke/40">
                      <select
                        value={lead.status || 'new'}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                        className="bg-surface-container-low border border-glass-stroke rounded-lg py-1 px-2 text-white text-[9px] max-w-[120px] focus:outline-none focus:border-primary/50"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {getStatusLabel(s)}
                          </option>
                        ))}
                      </select>
                      <Link
                        to={`/lead/${lead.id}`}
                        className="text-primary hover:underline text-[10px] font-bold flex items-center gap-0.5 shrink-0"
                      >
                        Open
                        <span className="material-symbols-outlined text-sm">chevron_right</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer CTA */}
      {!loading && leads.length > 0 && (
        <div className="p-3 border-t border-glass-stroke bg-white/[0.02]">
          <Link
            to="/my-leads"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold hover:bg-primary/15 transition-all"
          >
            Open full pipeline
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </div>
      )}
    </div>
  );
}
