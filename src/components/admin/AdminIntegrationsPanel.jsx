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
    <div className="space-y-6 max-w-5xl">
      <AdminPageHeader
        eyebrow="Platform Orchestration"
        title="Integrations & Mail Relay"
        description="Launch is SMTP-first. Company mailboxes connect from user Integrations; HubSpot / Salesforce / Gmail OAuth can be enabled under Advanced settings."
      />

      {/* Recommended Banner */}
      <div className="rounded-2xl border border-blue-200 dark:border-blue-500/20 bg-blue-50/70 dark:bg-blue-500/5 p-5 sm:p-6 shadow-xs space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <span className="material-symbols-outlined text-xl">mail</span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Company SMTP Relay (Recommended Launch Architecture)
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                  Ready
                </span>
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                No third-party platform OAuth approval is required for launch. Each solar company configures their own SMTP host, port, credentials, and mailbox from their workspace Integrations tab. Plan email quotas automatically meter outbound sends.
              </p>
            </div>
          </div>
        </div>
        <div className="pt-2 flex items-center gap-3 border-t border-blue-200/60 dark:border-white/10">
          <Link
            to="/integrations"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition"
          >
            <span>Open user Integrations workspace</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826]">
          <p className="text-xs text-slate-500 dark:text-slate-400 animate-pulse">Loading integration telemetry…</p>
        </div>
      ) : (
        <AdminIntegrationsPreview crmSetup={null} emailSetup={emailSetup} smtpOnly />
      )}

      {/* Advanced OAuth Section */}
      <div className="pt-4 border-t border-slate-200/80 dark:border-white/[0.08] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Advanced OAuth Connectors
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Optional platform-level app credentials for HubSpot, Salesforce, Google Workspace, and Microsoft Graph.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#121826] hover:bg-slate-50 dark:hover:bg-white/5 border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 shadow-xs inline-flex items-center gap-1.5 transition active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">
              {showAdvanced ? 'expand_less' : 'tune'}
            </span>
            {showAdvanced ? 'Hide OAuth Settings' : 'Configure Advanced OAuth'}
          </button>
        </div>

        {showAdvanced && (
          <div className="space-y-6 pt-2">
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              <strong>Launch Note:</strong> Configure platform OAuth apps only when you are ready to enable native CRM lead push or direct mailbox authorization. Prefer company SMTP until your OAuth applications are verified by Google / Microsoft.
            </div>
            <AdminCrmOAuthPanel embedded onSaved={load} />
            <AdminEmailOAuthPanel embedded onSaved={load} />
          </div>
        )}
      </div>
    </div>
  );
}
