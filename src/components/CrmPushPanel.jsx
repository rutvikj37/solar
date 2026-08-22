import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CRM_PROVIDER_META,
  fetchCrmIntegrations,
  getConnectedProviders,
  pushLeadToCrm,
} from '../lib/crmIntegrations.js';

export default function CrmPushPanel({ leadId, leadName, onPushed }) {
  const [integrations, setIntegrations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setIntegrations(await fetchCrmIntegrations());
    } catch (err) {
      setToast(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const connected = getConnectedProviders(integrations);

  const handlePush = async (provider) => {
    setBusy(provider);
    setToast('');
    try {
      const result = await pushLeadToCrm(leadId, provider);
      setToast(result.message || `Pushed to ${CRM_PROVIDER_META[provider]?.label || provider}.`);
      onPushed?.(result);
    } catch (err) {
      setToast(err.message);
    } finally {
      setBusy('');
    }
  };

  if (loading) {
    return (
      <span className="text-[10px] text-on-surface-variant py-2 px-3">CRM…</span>
    );
  }

  if (connected.length === 0) {
    return (
      <Link
        to="/integrations"
        className="inline-flex items-center gap-1.5 bg-secondary/20 text-secondary border border-secondary/30 font-bold py-2 px-3.5 rounded-lg text-xs hover:bg-secondary/30"
      >
        <span className="material-symbols-outlined text-base">link</span>
        Connect CRM
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {connected.map((provider) => {
        const meta = CRM_PROVIDER_META[provider];
        return (
          <button
            key={provider}
            type="button"
            onClick={() => handlePush(provider)}
            disabled={!!busy}
            className={`inline-flex items-center gap-1.5 font-bold py-2 px-3.5 rounded-lg text-xs border disabled:opacity-50 ${meta.btnClass}`}
          >
            <span className="material-symbols-outlined text-base">sync_alt</span>
            {busy === provider ? 'Pushing…' : `Push to ${meta.shortLabel}`}
          </button>
        );
      })}
      {toast && (
        <span className="text-[10px] text-green-400 max-w-[220px]">{toast}</span>
      )}
    </div>
  );
}
