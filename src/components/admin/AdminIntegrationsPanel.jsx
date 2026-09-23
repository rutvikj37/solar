import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../../config.js';
import AdminIntegrationsPreview from './AdminIntegrationsPreview.jsx';
import AdminCrmOAuthPanel from './AdminCrmOAuthPanel.jsx';
import AdminEmailOAuthPanel from './AdminEmailOAuthPanel.jsx';
import { AdminPageHeader } from './adminUi.jsx';

function authHeaders() {
  const token = localStorage.getItem('solar_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** SMTP-first launch; CRM / mailbox OAuth available under Advanced. */
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
    <div className="space-y-6 max-w-4xl">
      <AdminPageHeader
        eyebrow="Platform"
        title="Integrations"
        description="Launch is SMTP-first. Company mailboxes connect from Integrations; HubSpot / Salesforce / Gmail OAuth are optional under Advanced."
      />

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

      <div className="pt-2 border-t border-glass-stroke space-y-4">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-[11px] font-semibold text-on-surface-variant hover:text-on-surface inline-flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-sm">
            {showAdvanced ? 'expand_less' : 'expand_more'}
          </span>
          {showAdvanced ? 'Hide' : 'Show'} advanced OAuth (not required for launch)
        </button>
        {showAdvanced && (
          <div className="space-y-8">
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Configure platform OAuth apps only when you are ready to enable CRM push or Gmail/Microsoft
              mailbox connect for companies. Prefer SMTP until those flows ship.
            </p>
            <AdminCrmOAuthPanel embedded onSaved={load} />
            <AdminEmailOAuthPanel embedded onSaved={load} />
          </div>
        )}
      </div>
    </div>
  );
}
