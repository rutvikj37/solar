import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config.js';

export default function TerritoryAnalyticsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = localStorage.getItem('solar_token');
        if (!token) return;
        const res = await fetch(`${API_BASE}/api/team/territory-analytics`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const resData = await res.json();
          setData(resData);
        }
      } catch (err) {
        console.error('Fetch territory analytics error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-primary">
        <span className="material-symbols-outlined text-2xl animate-spin">sync</span>
        <span className="ml-2 font-mono text-xs uppercase">Loading Territory Analytics...</span>
      </div>
    );
  }

  const summary = data?.summary || {};
  const territories = data?.territories || [];

  return (
    <div className="space-y-5 text-xs">
      <div className="border-b border-glass-stroke pb-3">
        <h3 className="font-bold text-white text-base">Territory Conversion & CPL Analytics</h3>
        <p className="text-on-surface-variant text-xs mt-0.5">
          Track Cost Per Qualified Lead (CPL) and Closing Rate per ZIP Code to invest in high-converting territories.
        </p>
      </div>

      {/* Summary Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card p-4 rounded-xl border border-glass-stroke">
          <p className="text-[9px] text-slate-400 font-mono uppercase">Active ZIP Territories</p>
          <p className="text-xl font-bold text-white font-mono mt-1">{summary.totalTerritories || 0}</p>
        </div>
        <div className="glass-card p-4 rounded-xl border border-glass-stroke">
          <p className="text-[9px] text-slate-400 font-mono uppercase">Total Scanned Leads</p>
          <p className="text-xl font-bold text-white font-mono mt-1">{summary.totalScannedLeads || 0}</p>
        </div>
        <div className="glass-card p-4 rounded-xl border border-glass-stroke">
          <p className="text-[9px] text-slate-400 font-mono uppercase">Overall Closing Rate</p>
          <p className="text-xl font-bold text-green-400 font-mono mt-1">{summary.overallClosingRate || 0}%</p>
        </div>
        <div className="glass-card p-4 rounded-xl border border-glass-stroke">
          <p className="text-[9px] text-slate-400 font-mono uppercase">Avg. Cost Per Lead (CPL)</p>
          <p className="text-xl font-bold text-primary font-mono mt-1">${summary.avgCplUsd || '0.50'}</p>
        </div>
      </div>

      {/* Territory Performance Table */}
      <div className="glass-card rounded-2xl overflow-hidden border border-glass-stroke">
        <div className="p-4 border-b border-glass-stroke flex justify-between items-center">
          <h4 className="font-bold text-white text-xs uppercase font-mono tracking-wider">ZIP Code Performance Breakdown</h4>
          <span className="text-[10px] text-slate-400 font-mono">Sorted by Closing Rate (%)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs text-left">
            <thead>
              <tr className="bg-white/5 font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest">
                <th className="px-5 py-3 border-b border-glass-stroke">Territory (ZIP Code)</th>
                <th className="px-5 py-3 border-b border-glass-stroke">Total Scanned</th>
                <th className="px-5 py-3 border-b border-glass-stroke">Qualified Leads</th>
                <th className="px-5 py-3 border-b border-glass-stroke">Closed / Won</th>
                <th className="px-5 py-3 border-b border-glass-stroke">Closing Rate (%)</th>
                <th className="px-5 py-3 border-b border-glass-stroke text-right">Cost Per Lead (CPL $)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-stroke">
              {territories.map((t) => (
                <tr key={t.zip} className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-3 font-bold text-white font-mono">{t.zip}</td>
                  <td className="px-5 py-3 text-slate-300 font-mono">{t.totalScanned}</td>
                  <td className="px-5 py-3 text-slate-300 font-mono">{t.qualifiedCount}</td>
                  <td className="px-5 py-3 text-green-400 font-bold font-mono">{t.closedWonCount}</td>
                  <td className="px-5 py-3">
                    <span className="px-2.5 py-0.5 rounded font-bold font-mono text-[11px] bg-green-500/10 text-green-400 border border-green-500/20">
                      {t.closingRatePct}%
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-primary font-mono">
                    ${t.cplUsd.toFixed(2)}
                  </td>
                </tr>
              ))}
              {territories.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-6 text-slate-500">
                    No territory data recorded yet. Scan properties on the map to generate conversion metrics!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
