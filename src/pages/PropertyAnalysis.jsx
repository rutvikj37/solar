import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../config.js';
import FullPageLoader from '../components/FullPageLoader.jsx';

export default function PropertyAnalysis() {
  const [data, setData] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('solar_token');
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${API_BASE}/api/team/territory-analytics`, { headers }),
      fetch(`${API_BASE}/api/leads`, { headers }),
    ])
      .then(async ([analyticsRes, leadsRes]) => {
        if (analyticsRes.ok) {
          setData(await analyticsRes.json());
        } else {
          setError('Could not load territory analytics.');
        }
        if (leadsRes.ok) {
          setLeads(await leadsRes.json());
        }
      })
      .catch(() => setError('Failed to load analysis data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <FullPageLoader />;

  const summary = data?.summary || {};
  const territories = data?.territories || [];
  const topTerritory = territories[0];
  const topLead = leads.find((l) => l.lead_score >= 70) || leads[0];

  return (
    <>
      <div className="mb-stack-lg">
        <h2 className="font-headline-lg text-2xl md:text-headline-lg font-bold text-primary">
          Territory Insight Report
        </h2>
        <p className="text-on-surface-variant text-sm mt-1">
          Real conversion metrics from your scanned leads and ZIP territories.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-stack-md mb-stack-lg text-xs">
        <div className="glass-card p-5 rounded-xl">
          <p className="font-label-mono text-[9px] text-on-surface-variant uppercase">Active ZIP Territories</p>
          <p className="text-2xl font-bold text-white font-mono mt-1">{summary.totalTerritories || 0}</p>
        </div>
        <div className="glass-card p-5 rounded-xl">
          <p className="font-label-mono text-[9px] text-on-surface-variant uppercase">Total Scanned Leads</p>
          <p className="text-2xl font-bold text-white font-mono mt-1">{summary.totalScannedLeads || leads.length}</p>
        </div>
        <div className="glass-card p-5 rounded-xl">
          <p className="font-label-mono text-[9px] text-on-surface-variant uppercase">Overall Closing Rate</p>
          <p className="text-2xl font-bold text-green-400 font-mono mt-1">{summary.overallClosingRate || 0}%</p>
        </div>
        <div className="glass-card p-5 rounded-xl">
          <p className="font-label-mono text-[9px] text-on-surface-variant uppercase">Avg. Cost Per Lead</p>
          <p className="text-2xl font-bold text-primary font-mono mt-1">${summary.avgCplUsd || '0.50'}</p>
        </div>
      </div>

      {topTerritory && (
        <div className="glass-card rounded-2xl overflow-hidden mb-stack-lg border border-glass-stroke">
          <div className="p-6 border-b border-glass-stroke">
            <h3 className="font-headline-md text-lg font-bold text-white">Top Performing Territory</h3>
            <p className="text-on-surface-variant text-sm mt-1">
              ZIP {topTerritory.zip} — {topTerritory.closingRatePct}% closing rate across{' '}
              {topTerritory.totalScanned} scanned leads
            </p>
          </div>
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <p className="text-[9px] text-on-surface-variant uppercase">Qualified</p>
              <p className="text-lg font-bold text-white font-mono">{topTerritory.qualifiedCount}</p>
            </div>
            <div>
              <p className="text-[9px] text-on-surface-variant uppercase">Closed / Won</p>
              <p className="text-lg font-bold text-green-400 font-mono">{topTerritory.closedWonCount}</p>
            </div>
            <div>
              <p className="text-[9px] text-on-surface-variant uppercase">CPL</p>
              <p className="text-lg font-bold text-primary font-mono">${topTerritory.cplUsd?.toFixed(2)}</p>
            </div>
            <div className="flex items-end">
              <Link
                to="/map"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold"
              >
                <span className="material-symbols-outlined text-base">travel_explore</span>
                Scan More in This Area
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="glass-card rounded-2xl overflow-hidden mb-stack-lg">
        <div className="p-4 border-b border-glass-stroke">
          <h4 className="font-bold text-white text-xs uppercase font-mono tracking-wider">
            ZIP Code Performance
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs text-left">
            <thead>
              <tr className="bg-white/5 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest">
                <th className="px-5 py-3 border-b border-glass-stroke">ZIP</th>
                <th className="px-5 py-3 border-b border-glass-stroke">Scanned</th>
                <th className="px-5 py-3 border-b border-glass-stroke">Qualified</th>
                <th className="px-5 py-3 border-b border-glass-stroke">Won</th>
                <th className="px-5 py-3 border-b border-glass-stroke">Close Rate</th>
                <th className="px-5 py-3 border-b border-glass-stroke text-right">CPL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-stroke">
              {territories.map((t) => (
                <tr key={t.zip} className="hover:bg-white/5">
                  <td className="px-5 py-3 font-bold text-white font-mono">{t.zip}</td>
                  <td className="px-5 py-3 text-slate-300 font-mono">{t.totalScanned}</td>
                  <td className="px-5 py-3 text-slate-300 font-mono">{t.qualifiedCount}</td>
                  <td className="px-5 py-3 text-green-400 font-mono">{t.closedWonCount}</td>
                  <td className="px-5 py-3 text-green-400 font-mono">{t.closingRatePct}%</td>
                  <td className="px-5 py-3 text-right text-primary font-mono">${t.cplUsd?.toFixed(2)}</td>
                </tr>
              ))}
              {territories.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-on-surface-variant">
                    No territory data yet. Run a map scan to build your insight report.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {topLead && (
        <div className="glass-card p-6 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-label-mono text-[9px] text-on-surface-variant uppercase">Highest-scoring lead</p>
            <h3 className="text-white font-bold mt-1">{topLead.address?.split(',')[0] || 'Lead'}</h3>
            <p className="text-on-surface-variant text-xs mt-0.5">
              Score {topLead.lead_score}/100 · {topLead.status || 'new'}
            </p>
          </div>
          <Link
            to={`/lead/${topLead.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-container-highest border border-glass-stroke text-white text-xs font-semibold hover:bg-white/5"
          >
            <span className="material-symbols-outlined text-base">visibility</span>
            View Lead
          </Link>
        </div>
      )}
    </>
  );
}
