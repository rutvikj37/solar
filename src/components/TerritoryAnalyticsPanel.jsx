import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../config.js';
import ApiErrorBanner from './layout/ApiErrorBanner.jsx';

const SORT_OPTIONS = [
  { key: 'closingRatePct', label: 'Close rate' },
  { key: 'totalScanned', label: 'Scanned' },
  { key: 'qualifiedCount', label: 'Qualified' },
  { key: 'cplUsd', label: 'CPL' },
  { key: 'zip', label: 'ZIP' },
];

function formatCpl(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '$0.50';
  return `$${n.toFixed(2)}`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-white/5 border border-glass-stroke" />
        ))}
      </div>
      <div className="h-[min(50vh,420px)] rounded-2xl bg-white/5 border border-glass-stroke" />
    </div>
  );
}

function EmptyTerritoryState() {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-3xl text-primary">map</span>
      </div>
      <h3 className="text-base font-bold text-on-surface mb-1.5">No territory data yet</h3>
      <p className="text-sm text-on-surface-variant max-w-md mb-5 leading-relaxed">
        Scan properties on the map to build ZIP-level conversion, close rate, and cost-per-lead metrics.
      </p>
      <Link
        to="/map"
        className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:brightness-110 active:scale-95 transition-all"
      >
        <span className="material-symbols-outlined text-base">radar</span>
        Open Mission Targeting
      </Link>
    </div>
  );
}

/**
 * Territory conversion / CPL analytics.
 * @param {{
 *   showIntro?: boolean,
 *   className?: string,
 *   onAnalyticsChange?: (payload: {
 *     loading: boolean,
 *     error: string,
 *     summary: object | null,
 *     territories: Array<object>,
 *   }) => void,
 * }} props
 */
export default function TerritoryAnalyticsPanel({
  showIntro = true,
  className = '',
  onAnalyticsChange,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState('closingRatePct');
  const [sortDir, setSortDir] = useState('desc');

  const fetchAnalytics = useCallback(async () => {
    const token = localStorage.getItem('solar_token');
    if (!token) {
      setLoading(false);
      setError('Sign in to view territory reports.');
      return;
    }
    try {
      setError('');
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/team/territory-analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Could not load territory analytics.');
      setData(await res.json());
    } catch (err) {
      setData(null);
      setError(err.message || 'Failed to load territory analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const summary = data?.summary || {};
  const territories = useMemo(() => {
    const list = [...(data?.territories || [])];
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (sortKey === 'zip') {
        return String(a.zip || '').localeCompare(String(b.zip || '')) * dir;
      }
      return ((Number(a[sortKey]) || 0) - (Number(b[sortKey]) || 0)) * dir;
    });
    return list;
  }, [data?.territories, sortKey, sortDir]);

  useEffect(() => {
    if (typeof onAnalyticsChange !== 'function') return;
    onAnalyticsChange({
      loading,
      error,
      summary: data?.summary || null,
      territories,
    });
  }, [loading, error, data, territories, onAnalyticsChange]);

  const maxCloseRate = useMemo(
    () => Math.max(1, ...territories.map((t) => Number(t.closingRatePct) || 0)),
    [territories],
  );

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'zip' ? 'asc' : 'desc');
    }
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className={`space-y-4 text-xs ${className}`}>
      <ApiErrorBanner error={error} onRetry={fetchAnalytics} />

      {showIntro && (
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h3 className="font-bold text-on-surface text-base">Territory conversion &amp; CPL</h3>
            <p className="text-on-surface-variant text-xs mt-0.5 max-w-2xl">
              Cost per qualified lead and closing rate by ZIP — invest where conversion is strongest.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchAnalytics}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-glass-stroke text-xs font-bold text-on-surface hover:bg-white/10 hover:text-on-surface transition-all self-start"
          >
            <span className="material-symbols-outlined text-base">sync</span>
            Refresh
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {[
          {
            label: 'Active ZIP territories',
            value: summary.totalTerritories || 0,
            tone: 'text-on-surface',
          },
          {
            label: 'Total scanned leads',
            value: summary.totalScannedLeads || 0,
            tone: 'text-on-surface',
          },
          {
            label: 'Overall closing rate',
            value: `${summary.overallClosingRate || 0}%`,
            tone: 'text-emerald-400',
          },
          {
            label: 'Avg. cost per lead',
            value: formatCpl(summary.avgCplUsd),
            tone: 'text-primary',
          },
        ].map((kpi) => (
          <div key={kpi.label} className="crm-panel p-4">
            <p className="text-[9px] text-on-surface-variant font-label-mono uppercase tracking-widest">
              {kpi.label}
            </p>
            <p className={`text-xl font-bold font-mono tabular-nums mt-1 ${kpi.tone}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <section className="crm-panel overflow-hidden">
        <div className="p-4 border-b border-glass-stroke flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h4 className="font-bold text-on-surface text-xs uppercase font-label-mono tracking-wider">
              ZIP performance
            </h4>
            <p className="text-[10px] text-on-surface-variant mt-0.5">
              {territories.length} territor{territories.length === 1 ? 'y' : 'ies'} from your pipeline
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider mr-1">Sort</span>
            {SORT_OPTIONS.map((opt) => {
              const active = sortKey === opt.key;
              return (
                <button
                  type="button"
                  key={opt.key}
                  onClick={() => toggleSort(opt.key)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                    active
                      ? 'bg-primary/15 text-primary border-primary/30'
                      : 'bg-white/5 text-on-surface-variant border-glass-stroke hover:text-on-surface hover:border-glass-stroke'
                  }`}
                >
                  {opt.label}
                  {active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                </button>
              );
            })}
          </div>
        </div>

        {territories.length === 0 ? (
          <EmptyTerritoryState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs text-left">
              <thead>
                <tr className="bg-surface-container-low/95 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-glass-stroke">
                  <th className="px-5 py-3">Territory (ZIP)</th>
                  <th className="px-5 py-3">Scanned</th>
                  <th className="px-5 py-3">Qualified</th>
                  <th className="px-5 py-3">Closed / Won</th>
                  <th className="px-5 py-3 min-w-[140px]">Closing rate</th>
                  <th className="px-5 py-3 text-right">CPL ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-stroke">
                {territories.map((t) => {
                  const rate = Number(t.closingRatePct) || 0;
                  const barPct = Math.round((rate / maxCloseRate) * 100);
                  return (
                    <tr key={t.zip} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3 font-bold text-on-surface font-mono">{t.zip}</td>
                      <td className="px-5 py-3 text-on-surface-variant font-mono tabular-nums">
                        {t.totalScanned}
                      </td>
                      <td className="px-5 py-3 text-on-surface-variant font-mono tabular-nums">
                        {t.qualifiedCount}
                      </td>
                      <td className="px-5 py-3 text-emerald-400 font-bold font-mono tabular-nums">
                        {t.closedWonCount}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5 min-w-[120px]">
                          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500/80"
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                          <span className="shrink-0 px-2 py-0.5 rounded font-bold font-mono text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 tabular-nums">
                            {rate}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-primary font-mono tabular-nums">
                        {formatCpl(t.cplUsd)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
