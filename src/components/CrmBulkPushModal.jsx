import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import CrmSetupBanner from './CrmSetupBanner.jsx';
import {
  CRM_PROVIDER_META,
  connectCrmProvider,
  crmToastFromSearchParams,
  fetchCrmIntegrations,
  getProviderStatus,
  pushBulkLeadsToCrm,
} from '../lib/crmIntegrations.js';

const CRM_KEYS = ['hubspot', 'salesforce'];
const BULK_PUSH_MAX = 50;

export default function CrmBulkPushModal({ leadIds, open, onClose, onComplete }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [integrations, setIntegrations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [phase, setPhase] = useState('select');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  const count = leadIds?.length || 0;
  const cappedIds = (leadIds || []).slice(0, BULK_PUSH_MAX);
  const returnTo = '/my-leads';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setIntegrations(await fetchCrmIntegrations());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setPhase('select');
    setSummary(null);
    setError('');
    setProgress({ current: 0, total: cappedIds.length });
    load();
  }, [open, load, cappedIds.length]);

  useEffect(() => {
    if (!open) return;
    const msg = crmToastFromSearchParams(searchParams, setSearchParams);
    if (msg) load();
  }, [open, searchParams, setSearchParams, load]);

  if (!open) return null;

  const connectedCount = CRM_KEYS.filter((p) => getProviderStatus(integrations, p).connected).length;

  const handleConnect = async (provider) => {
    setBusy(`connect-${provider}`);
    setError('');
    try {
      await connectCrmProvider(provider, returnTo);
    } catch (err) {
      setError(err.message);
      setBusy('');
    }
  };

  const handleBulkPush = async (provider) => {
    setBusy(`push-${provider}`);
    setError('');
    setPhase('pushing');
    setProgress({ current: 0, total: cappedIds.length });
    try {
      const result = await pushBulkLeadsToCrm(cappedIds, provider);
      setSummary(result);
      setProgress({ current: cappedIds.length, total: cappedIds.length });
      setPhase('done');
      onComplete?.(result);
    } catch (err) {
      setError(err.message);
      setPhase('select');
    } finally {
      setBusy('');
    }
  };

  const renderProviderRow = (key) => {
    const meta = CRM_PROVIDER_META[key];
    const row = getProviderStatus(integrations, key);
    const available = key === 'hubspot' ? integrations?.hubspotAvailable : integrations?.salesforceAvailable;
    const isConnected = row.connected;

    return (
      <div
        key={key}
        className="flex flex-col gap-2 p-3 rounded-xl bg-white/[0.03] border border-glass-stroke"
      >
        <div className="flex items-start gap-3">
          <span className={`material-symbols-outlined text-lg ${meta.dotClass.replace('bg-', 'text-')}`}>
            {meta.icon}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-white font-bold text-xs">{meta.label}</p>
              {isConnected && (
                <span className="text-[9px] font-bold uppercase tracking-wide text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
                  Connected
                </span>
              )}
            </div>
            <p className="text-[10px] text-on-surface-variant mt-0.5">{meta.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {isConnected ? (
            <button
              type="button"
              onClick={() => handleBulkPush(key)}
              disabled={!!busy || phase === 'pushing'}
              className={`flex-1 min-w-[120px] px-3 py-2 rounded-lg border text-xs font-bold ${meta.btnClass} disabled:opacity-50`}
            >
              {busy === `push-${key}` ? 'Pushing…' : `Push ${count} to ${meta.shortLabel}`}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleConnect(key)}
              disabled={!!busy || !available}
              className="flex-1 min-w-[120px] px-3 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold hover:brightness-110 disabled:opacity-50"
            >
              {busy === `connect-${key}` ? 'Opening…' : `Connect ${meta.shortLabel}`}
            </button>
          )}
          {!available && (
            <p className="w-full text-[10px] text-amber-400/90">Server OAuth not configured yet.</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border border-glass-stroke bg-[#0F172A] shadow-2xl p-5 space-y-4 text-left max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crm-bulk-push-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p id="crm-bulk-push-title" className="text-white font-bold text-base">
              Push to CRM
            </p>
            <p className="text-[11px] text-on-surface-variant mt-1">
              {count} lead{count === 1 ? '' : 's'} selected
              {count > BULK_PUSH_MAX && (
                <span className="text-amber-400"> — only the first {BULK_PUSH_MAX} will be pushed</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={phase === 'pushing'}
            className="p-1 rounded-lg text-on-surface-variant hover:text-white hover:bg-white/10 disabled:opacity-40"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/25">
            {error}
          </div>
        )}

        {phase === 'pushing' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-white">
              <span className="material-symbols-outlined text-base animate-spin text-primary">sync</span>
              Pushing leads to CRM…
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-[10px] text-on-surface-variant">
              Processing sequentially to respect CRM rate limits…
            </p>
          </div>
        )}

        {phase === 'done' && summary && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/25">
              <p className="text-sm font-bold text-green-300">
                {summary.success} pushed, {summary.failed} failed
              </p>
            </div>
            {summary.failed > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                {summary.results
                  .filter((r) => !r.ok)
                  .map((r) => (
                    <p key={r.leadId} className="text-[10px] text-red-300/90 font-mono">
                      Lead #{r.leadId}: {r.error}
                    </p>
                  ))}
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:brightness-110"
            >
              Done
            </button>
          </div>
        )}

        {phase === 'select' && (
          <>
            {loading ? (
              <p className="text-xs text-on-surface-variant py-6 text-center">Loading integrations…</p>
            ) : (
              <>
                {connectedCount === 0 && integrations?.setup?.ready && (
                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-[10px] text-primary leading-relaxed">
                    <strong>Connect first.</strong> Link HubSpot or Salesforce below, then push all selected leads
                    in one batch.
                  </div>
                )}

                <CrmSetupBanner setup={integrations?.setup} />
                {CRM_KEYS.map(renderProviderRow)}

                <Link
                  to="/profile"
                  onClick={onClose}
                  className="block text-center text-[10px] text-on-surface-variant hover:text-primary pt-1"
                >
                  Manage connections in Profile →
                </Link>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
