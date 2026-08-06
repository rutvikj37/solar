import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { API_BASE } from '../config.js';
import { formatLeadGeneratedAt } from '../lib/formatDate.js';

const API = API_BASE;
const STATUS_OPTIONS = ['new', 'contacted', 'appointment', 'proposal', 'won', 'lost', 'qualified', 'in_progress'];

export default function MyLeads() {
  const [leads, setLeads] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState('All');
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [summary, setSummary] = useState({});
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
  }, [fetchLeads, location.key]);

  useEffect(() => {
    const onFocus = () => fetchLeads();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchLeads]);

  useEffect(() => {
    window.exportCSV = () => {
      const t = token();
      if (t) window.open(`${API}/api/leads/export-csv?token=${t}`, '_blank');
    };
    return () => {
      delete window.exportCSV;
    };
  }, []);

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      (lead.owner_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lead.phone || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(lead.id).includes(searchTerm);

    if (filterTab === 'All') return matchesSearch;
    if (filterTab === 'Hot Leads') return matchesSearch && lead.lead_score >= 85;
    if (filterTab === 'Qualified') return matchesSearch && lead.lead_score >= 70 && lead.lead_score < 85;
    if (filterTab === 'In Progress') return matchesSearch && ['in_progress', 'contacted', 'appointment', 'proposal'].includes(lead.status);
    if (filterTab === 'Won') return matchesSearch && lead.status === 'won';
    return matchesSearch;
  });

  const handleSelectToggle = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSelectAllToggle = () => {
    const filteredIds = filteredLeads.map((l) => l.id);
    const allSelected = filteredIds.every((id) => selectedIds.includes(id));
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

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete the ${selectedIds.length} selected leads?`)) return;
    const t = token();
    const response = await fetch(`${API}/api/leads/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ leadIds: selectedIds })
    });
    if (response.ok) {
      setSelectedIds([]);
      await fetchLeads();
    } else {
      alert('Failed to delete selected leads.');
    }
  };

  if (loading) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-primary">
          <span className="material-symbols-outlined text-3xl animate-spin">sync</span>
          <span className="font-label-mono text-sm tracking-widest uppercase">Loading Leads...</span>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-stack-lg">
        <div>
          <h2 className="font-headline-lg text-2xl md:text-headline-lg font-bold text-primary">My Leads</h2>
          <p className="text-on-surface-variant text-sm mt-1">Pipeline CRM for your purchased solar leads.</p>
        </div>
        <div className="w-full sm:w-64 relative text-xs">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
            search
          </span>
          <input
            type="text"
            placeholder="Search name, address, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 pl-9 pr-4 text-white focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 mb-6 text-[10px]">
        {STATUS_OPTIONS.map((s) => (
          <div key={s} className="glass-card rounded-lg px-3 py-2">
            <p className="font-label-mono text-on-surface-variant uppercase">{s}</p>
            <p className="text-white font-bold text-sm mt-0.5">{summary[s] || 0}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 border-b border-glass-stroke pb-1">
        <div className="flex gap-6 text-xs font-semibold overflow-x-auto">
          {['All', 'Hot Leads', 'Qualified', 'In Progress', 'Won'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`pb-3 relative transition-all ${
                filterTab === tab
                  ? 'text-primary font-bold border-b-2 border-primary'
                  : 'text-on-surface-variant hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        {selectedIds.length > 0 && (
          <button
            onClick={handleBulkDelete}
            className="mb-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 px-3.5 py-1.5 rounded-lg text-xs font-bold font-label-mono flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
            DELETE SELECTED ({selectedIds.length})
          </button>
        )}
      </div>

      <section className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs text-left">
            <thead>
              <tr className="bg-white/5">
                <th className="px-6 py-4 border-b border-glass-stroke w-12">
                  <input
                    type="checkbox"
                    checked={
                      filteredLeads.length > 0 &&
                      filteredLeads.map((l) => l.id).every((id) => selectedIds.includes(id))
                    }
                    onChange={handleSelectAllToggle}
                    className="w-4 h-4 rounded border-glass-stroke bg-surface-container-low text-primary"
                  />
                </th>
                <th className="px-6 py-4 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">
                  Lead Details
                </th>
                <th className="px-6 py-4 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">
                  Property Address
                </th>
                <th className="px-6 py-4 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">
                  Score
                </th>
                <th className="px-6 py-4 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">
                  Status
                </th>
                <th className="px-6 py-4 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">
                  Phone
                </th>
                <th className="px-6 py-4 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">
                  Email
                </th>
                <th className="px-6 py-4 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">
                  Generated
                </th>
                <th className="px-6 py-4 text-right font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest border-b border-glass-stroke">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-stroke">
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(lead.id)}
                      onChange={() => handleSelectToggle(lead.id)}
                      className="w-4 h-4 rounded border-glass-stroke bg-surface-container-low text-primary"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-primary/20 text-primary flex items-center justify-center font-bold">
                        {lead.owner_name ? lead.owner_name.substring(0, 2).toUpperCase() : 'LD'}
                      </div>
                      <div>
                        <p className="font-button text-sm text-on-surface font-semibold">
                          {lead.owner_name || 'N/A'}
                        </p>
                        <p className="text-[10px] text-on-surface-variant mt-0.5">SV-ID: {lead.id}</p>
                        {lead.notes && String(lead.notes).toLowerCase().includes('incomplete contact') && (
                          <p className="text-[9px] text-amber-400/90 mt-0.5">Incomplete contact</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant">{lead.address}</td>
                  <td className="px-6 py-4 font-semibold text-white font-mono">{lead.lead_score}/100</td>
                  <td className="px-6 py-4">
                    <select
                      value={lead.status || 'new'}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                      className="bg-surface-container-low border border-glass-stroke rounded-md py-1 px-2 text-white text-[10px]"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant font-mono">
                    {lead.phone && lead.phone !== 'Not Available' ? lead.phone : '—'}
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant truncate max-w-[180px]" title={lead.email || ''}>
                    {lead.email && lead.email !== 'Not Available' ? lead.email : '—'}
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant whitespace-nowrap font-mono text-[10px]">
                    {formatLeadGeneratedAt(lead.created_at) || '—'}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold">
                    <Link
                      to={`/lead/${lead.id}`}
                      className="text-primary hover:underline flex items-center gap-1 ml-auto justify-end"
                    >
                      Details
                      <span className="material-symbols-outlined text-sm">chevron_right</span>
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-on-surface-variant">
                    No leads found. Scan properties on the Map to unlock leads!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AppLayout>
  );
}
