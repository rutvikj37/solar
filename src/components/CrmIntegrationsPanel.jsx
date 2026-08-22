import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CRM_PROVIDER_META,
  connectCrmProvider,
  crmToastFromSearchParams,
  disconnectCrmProvider,
  fetchCrmIntegrations,
} from '../lib/crmIntegrations.js';
import CrmSetupBanner from './CrmSetupBanner.jsx';

const STEPS = [
  { n: 1, title: 'Connect HubSpot or Salesforce', body: 'One-time OAuth login — takes about 30 seconds.' },
  { n: 2, title: 'Open any lead', body: 'Go to My Leads and open the lead you want to send.' },
  { n: 3, title: 'Click Push to CRM', body: 'Choose HubSpot or Salesforce — done in one click.' },
];

const CRM_KEYS = ['hubspot', 'salesforce'];

export default function CrmIntegrationsPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchCrmIntegrations());
    } catch (err) {
      setToast(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const msg = crmToastFromSearchParams(searchParams, setSearchParams);
    if (msg) {
      setToast(msg);
      load();
    }
  }, [searchParams, setSearchParams, load]);

  const connectOAuth = async (provider) => {
    setBusy(provider);
    try {
      await connectCrmProvider(provider, '/profile');
    } catch (err) {
      setToast(err.message);
      setBusy('');
    }
  };

  const disconnect = async (provider) => {
    setBusy(`disconnect-${provider}`);
    try {
      const json = await disconnectCrmProvider(provider);
      setToast(json.message || 'Disconnected.');
      await load();
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusy('');
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-6 rounded-xl text-xs text-on-surface-variant">
        Loading CRM integrations…
      </div>
    );
  }

  const providerMap = Object.fromEntries((data?.providers || []).map((p) => [p.provider, p]));
  const anyConnected = CRM_KEYS.some((k) => providerMap[k]?.connected);

  return (
    <div className="glass-card p-6 rounded-xl space-y-5">
      <div>
        <h4 className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-widest font-semibold">
          CRM Integrations
        </h4>
        <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
          Connect HubSpot or Salesforce once — then push any lead from Lead Details with the{' '}
          <strong className="text-white">Push to CRM</strong> button.
        </p>
      </div>

      {!anyConnected && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {STEPS.map((s) => (
            <div key={s.n} className="p-3 rounded-xl bg-primary/5 border border-primary/15">
              <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px] font-bold mb-2">
                {s.n}
              </span>
              <p className="text-white text-xs font-bold">{s.title}</p>
              <p className="text-[10px] text-on-surface-variant mt-1 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      )}

      <CrmSetupBanner setup={data?.setup} />

      {toast && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex justify-between gap-2 border ${
            toast.toLowerCase().includes('fail') || toast.toLowerCase().includes('error')
              ? 'bg-red-500/10 text-red-400 border-red-500/25'
              : 'bg-green-500/10 text-green-400 border-green-500/25'
          }`}
        >
          <span>{toast}</span>
          <button type="button" onClick={() => setToast('')} className="opacity-70 hover:opacity-100 shrink-0">
            ✕
          </button>
        </div>
      )}

      {CRM_KEYS.map((key) => {
        const meta = CRM_PROVIDER_META[key];
        const row = providerMap[key] || { connected: false };
        const available = key === 'hubspot' ? data?.hubspotAvailable : data?.salesforceAvailable;
        return (
          <div
            key={key}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-surface-container-low border border-glass-stroke"
          >
            <div className="flex items-start gap-3 min-w-0">
              <span className={`material-symbols-outlined text-2xl ${meta.dotClass.replace('bg-', 'text-')}`}>
                {meta.icon}
              </span>
              <div>
                <p className="text-white font-bold">{meta.label}</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">{meta.description}</p>
                {row.connected && (
                  <p className="text-[10px] text-green-400 mt-1 font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    Ready to push
                    {row.portalId ? ` · Portal ${row.portalId}` : ''}
                  </p>
                )}
                {!available && (
                  <p className="text-[10px] text-amber-400/90 mt-1">
                    Waiting for server OAuth setup — see instructions above.
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {row.connected ? (
                <>
                  <span className="px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/25 text-xs text-green-400 font-bold">
                    Connected
                  </span>
                  <button
                    type="button"
                    onClick={() => disconnect(key)}
                    disabled={!!busy}
                    className="px-3 py-2 rounded-lg border border-glass-stroke text-xs text-red-400 hover:bg-red-500/10"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => connectOAuth(key)}
                  disabled={!!busy || !available}
                  className="px-5 py-2.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:brightness-110 disabled:opacity-50 min-w-[140px]"
                >
                  {busy === key ? 'Opening login…' : `Connect ${meta.label}`}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
