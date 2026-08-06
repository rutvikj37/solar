import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from '../config.js';
import { formatLeadGeneratedAt } from '../lib/formatDate.js';

const API = API_BASE;
const STATUS_OPTIONS = ['new', 'contacted', 'appointment', 'proposal', 'won', 'lost', 'qualified', 'in_progress'];
const FILTER_TABS = ['All', 'Hot Leads', 'Qualified', 'In Progress', 'Won'];

function scoreTone(score) {
  const n = Number(score) || 0;
  if (n >= 85) return 'text-green-400';
  if (n >= 70) return 'text-amber-400';
  return 'text-slate-400';
}

export default function LeadManagerPanel({ onClose, refreshKey = 0, visible = true }) {
  const [leads, setLeads] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState('All');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({});
  const navigate = useNavigate();

  const token = () => localStorage.getItem('solar_token');

  const fetchLeads = useCallback(async () => {
    const t = token();
    if (!t) {
      navigate('/login');
      return;
    }
    setLoading(true);
    try {
      const [leadsRes, sumRes] = await Promise.all([
        fetch(`${API}/api/leads`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${API}/api/leads/pipeline/summary`, { headers: { Authorization: `Bearer ${t}` } })
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
  }, [fetchLeads, refreshKey]);

  // Refetch whenever the panel becomes visible (covers scan → open flow)
  useEffect(() => {
    if (visible) fetchLeads();
  }, [visible, fetchLeads]);

  const filteredLeads = leads.filter((lead) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (lead.owner_name || '').toLowerCase().includes(q) ||
      (lead.address || '').toLowerCase().includes(q) ||
      (lead.email || '').toLowerCase().includes(q) ||
      (lead.phone || '').toLowerCase().includes(q) ||
      String(lead.id).includes(searchTerm);

    if (filterTab === 'All') return matchesSearch;
    if (filterTab === 'Hot Leads') return matchesSearch && lead.lead_score >= 85;
    if (filterTab === 'Qualified') return matchesSearch && lead.lead_score >= 70 && lead.lead_score < 85;
    if (filterTab === 'In Progress') {
      return matchesSearch && ['in_progress', 'contacted', 'appointment', 'proposal'].includes(lead.status);
    }
    if (filterTab === 'Won') return matchesSearch && lead.status === 'won';
    return matchesSearch;
  });

  const handleStatusChange = async (leadId, status) => {
    const t = token();
    const res = await fetch(`${API}/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      const updated = await res.json();
      setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
      const sumRes = await fetch(`${API}/api/leads/pipeline/summary`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      if (sumRes.ok) setSummary(await sumRes.json());
    }
  };

  const totalCount = leads.length;
  const hotCount = leads.filter((l) => l.lead_score >= 85).length;
  const pipelineHint = Object.keys(summary).length
    ? `${summary.new || 0} new · ${summary.contacted || 0} contacted`
    : null;

  return (
    <div className="h-full flex flex-col bg-surface-elevated/95 backdrop-blur-2xl border border-glass-stroke rounded-2xl shadow-2xl overflow-hidden">
      <div className="p-4 border-b border-glass-stroke flex justify-between items-center bg-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-primary text-lg">assignment</span>
          <div className="min-w-0">
            <h3 className="font-headline-md text-sm font-bold text-white leading-tight">Lead Manager</h3>
            <p className="text-[9px] text-on-surface-variant truncate">
              {totalCount} leads · {hotCount} hot{pipelineHint ? ` · ${pipelineHint}` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={fetchLeads}
            className="text-on-surface-variant hover:text-primary p-1.5 rounded-lg hover:bg-white/5"
            title="Refresh leads"
          >
            <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>sync</span>
          </button>
          <Link
            to="/my-leads"
            className="text-on-surface-variant hover:text-primary p-1.5 rounded-lg hover:bg-white/5"
            title="Open full CRM"
          >
            <span className="material-symbols-outlined text-base">open_in_new</span>
          </Link>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-on-surface-variant hover:text-white p-1.5 rounded-lg hover:bg-white/5"
              aria-label="Close Lead Manager"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-3 border-b border-glass-stroke space-y-2">
        <div className="relative text-xs">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">
            search
          </span>
          <input
            type="text"
            placeholder="Search name, address, ID…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 pl-8 pr-3 text-white text-[11px] focus:outline-none focus:border-primary"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto custom-scrollbar pb-0.5">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterTab(tab)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wide transition-all ${
                filterTab === tab
                  ? 'bg-primary text-on-primary'
                  : 'bg-white/5 text-on-surface-variant hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-primary text-xs">
            <span className="material-symbols-outlined text-lg animate-spin">sync</span>
            Loading leads…
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="text-center py-10 text-on-surface-variant text-[11px] px-4">
            No leads found. Scan properties on the map to unlock leads.
          </div>
        ) : (
          filteredLeads.map((lead) => {
            const generatedAt = formatLeadGeneratedAt(lead.created_at);
            return (
              <div
                key={lead.id}
                className="p-3 rounded-xl bg-white/[0.03] border border-glass-stroke hover:border-primary/30 transition-colors text-left"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                    {lead.owner_name ? lead.owner_name.substring(0, 2).toUpperCase() : 'LD'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[12px] font-semibold text-white truncate">
                        {lead.owner_name || 'N/A'}
                      </p>
                      <span className={`text-[10px] font-mono font-bold shrink-0 ${scoreTone(lead.lead_score)}`}>
                        {lead.lead_score ?? '—'}/100
                      </span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant truncate mt-0.5">
                      {lead.address || 'No address'}
                    </p>
                    {generatedAt && (
                      <p className="text-[9px] text-primary/80 mt-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">schedule</span>
                        Generated {generatedAt}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-[9px] text-on-surface-variant font-mono">
                      <span>{lead.phone && lead.phone !== 'Not Available' ? lead.phone : 'No phone'}</span>
                      <span className="truncate max-w-[140px]">
                        {lead.email && lead.email !== 'Not Available' ? lead.email : 'No email'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <select
                        value={lead.status || 'new'}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                        className="bg-surface-container-low border border-glass-stroke rounded-md py-1 px-1.5 text-white text-[9px] max-w-[110px]"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <Link
                        to={`/lead/${lead.id}`}
                        className="text-primary hover:underline text-[10px] font-semibold flex items-center gap-0.5"
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
    </div>
  );
}
