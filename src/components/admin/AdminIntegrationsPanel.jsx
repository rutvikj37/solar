import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../../config.js';
import AdminIntegrationsPreview from './AdminIntegrationsPreview.jsx';

function authHeaders() {
  const token = localStorage.getItem('solar_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Launch posture: SMTP-first. CRM / Gmail OAuth panels stay available in code but hidden from the admin UI. */
export default function AdminIntegrationsPanel() {
  const [loading, setLoading] = useState(true);
  const [emailSetup, setEmailSetup] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const emailRes = await fetch(`${API_BASE}/api/admin/email-oauth-settings`, { headers: authHeaders() });
      if (emailRes.ok) setEmailSetup(await emailRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h3 className="text-on-surface font-bold text-lg">Integrations setup</h3>
        <p className="text-xs text-on-surface-variant mt-1">
          Launch is <strong className="text-on-surface">SMTP-first</strong>. Users connect company SMTP from{' '}
          <Link to="/integrations" className="text-primary font-semibold hover:underline">
            Integrations
          </Link>
          . HubSpot, Salesforce, and Gmail OAuth are not required for go-live.
        </p>
      </div>

      <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5 space-y-2">
        <p className="text-sm font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">mail</span>
          Company SMTP (recommended)
        </p>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          No platform OAuth credentials needed. Each company enters their SMTP host, port, and mailbox on the
          Integrations page. Plan email quota still meters sends.
        </p>
        <Link
          to="/integrations"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
        >
          Open user Integrations →
        </Link>
      </div>

      {loading ? (
        <p className="text-xs text-on-surface-variant">Loading integration status…</p>
      ) : (
        <AdminIntegrationsPreview crmSetup={null} emailSetup={emailSetup} smtpOnly />
      )}

      <div className="pt-2 border-t border-glass-stroke">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-[11px] font-semibold text-on-surface-variant hover:text-on-surface"
        >
          {showAdvanced ? 'Hide' : 'Show'} advanced OAuth (not required for launch)
        </button>
        {showAdvanced && (
          <p className="mt-2 text-[11px] text-on-surface-variant leading-relaxed">
            HubSpot / Salesforce CRM OAuth and Gmail / Microsoft mailbox OAuth remain on the API (
            <code className="text-[10px]">/api/admin/crm-oauth-settings</code>,{' '}
            <code className="text-[10px]">/api/admin/email-oauth-settings</code>) but are de-emphasized for this
            launch. Prefer SMTP until CRM push ships.
          </p>
        )}
      </div>
    </div>
  );
}
