import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import TerritoryAnalyticsPanel from '../../components/TerritoryAnalyticsPanel.jsx';
import ApiErrorBanner from '../../components/layout/ApiErrorBanner.jsx';
import { API_BASE } from '../../config.js';
import { STATUS_OPTIONS, getStatusLabel } from '../../lib/leads.js';
import { downloadReportsCsv } from '../../lib/downloadReportsCsv.js';

export default function Reports() {
  const [pipeline, setPipeline] = useState(null);
  const [pipelineError, setPipelineError] = useState('');
  const [pipelineLoading, setPipelineLoading] = useState(true);
  const [territoryExport, setTerritoryExport] = useState({
    loading: true,
    error: '',
    summary: null,
    territories: [],
  });
  const [exportBusy, setExportBusy] = useState(false);

  const fetchPipeline = useCallback(async () => {
    const token = localStorage.getItem('solar_token');
    if (!token) {
      setPipelineLoading(false);
      setPipelineError('Sign in to view pipeline reports.');
      return;
    }
    try {
      setPipelineError('');
      setPipelineLoading(true);
      const res = await fetch(`${API_BASE}/api/leads/pipeline/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Could not load pipeline summary.');
      setPipeline(await res.json());
    } catch (err) {
      setPipeline(null);
      setPipelineError(err.message || 'Failed to load pipeline summary.');
    } finally {
      setPipelineLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  const handleTerritoryAnalyticsChange = useCallback((payload) => {
    setTerritoryExport({
      loading: Boolean(payload?.loading),
      error: payload?.error || '',
      summary: payload?.summary || null,
      territories: Array.isArray(payload?.territories) ? payload.territories : [],
    });
  }, []);

  const stages = useMemo(() => {
    const counts = pipeline || {};
    return STATUS_OPTIONS.map((status) => ({
      status,
      label: getStatusLabel(status),
      count: Number(counts[status]) || 0,
    }));
  }, [pipeline]);

  const totalLeads = useMemo(() => stages.reduce((sum, s) => sum + s.count, 0), [stages]);
  const maxStageCount = useMemo(() => Math.max(1, ...stages.map((s) => s.count)), [stages]);
  const wonCount = stages.find((s) => s.status === 'won')?.count || 0;
  const conversionPct = totalLeads > 0 ? ((wonCount / totalLeads) * 100).toFixed(1) : '0.0';

  const canDownload =
    !pipelineLoading &&
    !territoryExport.loading &&
    !exportBusy &&
    (totalLeads > 0 || (territoryExport.territories?.length || 0) > 0 || territoryExport.summary);

  const handleDownloadReports = useCallback(() => {
    if (!canDownload) return;
    try {
      setExportBusy(true);
      downloadReportsCsv({
        stages,
        pipelineMeta: { totalLeads, wonCount, conversionPct },
        territorySummary: territoryExport.summary,
        territories: territoryExport.territories,
      });
    } catch (err) {
      window.alert(err?.message || 'Could not download reports CSV.');
    } finally {
      setExportBusy(false);
    }
  }, [
    canDownload,
    stages,
    totalLeads,
    wonCount,
    conversionPct,
    territoryExport.summary,
    territoryExport.territories,
  ]);

  return (
    <>
      <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            <span className="material-symbols-outlined text-sm">analytics</span>
            Performance
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight">Reports</h1>
          <p className="text-xs text-on-surface-variant max-w-2xl">
            Territory conversion, cost per lead, and pipeline stage mix from your real lead data.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={fetchPipeline}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 border border-glass-stroke text-xs font-bold text-on-surface hover:bg-white/10 hover:text-on-surface transition-all"
          >
            <span className={`material-symbols-outlined text-base ${pipelineLoading ? 'animate-spin' : ''}`}>
              sync
            </span>
            Refresh
          </button>
          <Link
            to="/my-leads"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 border border-glass-stroke text-xs font-bold text-on-surface hover:bg-white/10 hover:text-on-surface transition-all"
          >
            <span className="material-symbols-outlined text-base">assignment</span>
            Lead manager
          </Link>
          <Link
            to="/map"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 border border-glass-stroke text-xs font-bold text-on-surface hover:bg-white/10 hover:text-on-surface transition-all"
          >
            <span className="material-symbols-outlined text-base">radar</span>
            Find leads
          </Link>
          <button
            type="button"
            onClick={handleDownloadReports}
            disabled={!canDownload}
            title={
              canDownload
                ? 'Download pipeline and territory analytics as CSV'
                : 'Load report data before downloading'
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100"
          >
            <span className="material-symbols-outlined text-base">download</span>
            {exportBusy ? 'Preparing…' : 'Download reports'}
          </button>
        </div>
      </div>

      <ApiErrorBanner error={pipelineError} onRetry={fetchPipeline} />

      <section className="crm-panel p-4 sm:p-5 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-bold text-on-surface">Pipeline mix</h2>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Stage counts from your current lead pipeline
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-[11px] text-on-surface-variant">
            <span>
              Total{' '}
              <strong className="text-on-surface font-mono tabular-nums">{totalLeads}</strong>
            </span>
            <span>
              Won{' '}
              <strong className="text-emerald-400 font-mono tabular-nums">{wonCount}</strong>
            </span>
            <span>
              Conversion{' '}
              <strong className="text-primary font-mono tabular-nums">{conversionPct}%</strong>
            </span>
          </div>
        </div>

        {pipelineLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2 animate-pulse">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-white/5 border border-glass-stroke" />
            ))}
          </div>
        ) : totalLeads === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
            <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-2">
              timeline
            </span>
            <p className="text-sm font-semibold text-on-surface mb-1">No pipeline activity yet</p>
            <p className="text-xs text-on-surface-variant max-w-sm mb-4">
              Unlock leads from the map and move them through stages to populate this report.
            </p>
            <Link
              to="/map"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold"
            >
              <span className="material-symbols-outlined text-base">radar</span>
              Open map
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2">
            {stages.map((stage) => {
              const heightPct = Math.max(8, Math.round((stage.count / maxStageCount) * 100));
              return (
                <div
                  key={stage.status}
                  className="rounded-xl border border-glass-stroke bg-white/5 p-3 flex flex-col gap-2 min-h-[88px]"
                >
                  <div className="flex items-baseline justify-between gap-1">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant truncate">
                      {stage.label}
                    </p>
                    <p className="text-sm font-bold font-mono tabular-nums text-on-surface">{stage.count}</p>
                  </div>
                  <div className="mt-auto h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${heightPct}%` }}
                      title={`${stage.count} leads`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <TerritoryAnalyticsPanel showIntro onAnalyticsChange={handleTerritoryAnalyticsChange} />
    </>
  );
}
