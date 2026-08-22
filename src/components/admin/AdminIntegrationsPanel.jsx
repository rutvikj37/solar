import React, { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '../../config.js';
import AdminIntegrationsPreview from './AdminIntegrationsPreview.jsx';
import AdminCrmOAuthPanel from './AdminCrmOAuthPanel.jsx';
import AdminEmailOAuthPanel from './AdminEmailOAuthPanel.jsx';

function authHeaders() {
  const token = localStorage.getItem('solar_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AdminIntegrationsPanel() {
  const [loading, setLoading] = useState(true);
  const [crmSetup, setCrmSetup] = useState(null);
  const [emailSetup, setEmailSetup] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [crmRes, emailRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/crm-oauth-settings`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/admin/email-oauth-settings`, { headers: authHeaders() }),
      ]);
      if (crmRes.ok) setCrmSetup(await crmRes.json());
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
        <h3 className="text-white font-bold text-lg">Integrations setup</h3>
        <p className="text-xs text-on-surface-variant mt-1">
          One-time platform configuration. After saving, users connect their own accounts from{' '}
          <strong className="text-white">Integrations</strong>.
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-on-surface-variant">Loading integration status…</p>
      ) : (
        <AdminIntegrationsPreview crmSetup={crmSetup} emailSetup={emailSetup} />
      )}

      <hr className="border-glass-stroke" />

      <AdminCrmOAuthPanel onSaved={load} embedded />

      <hr className="border-glass-stroke" />

      <AdminEmailOAuthPanel onSaved={load} embedded />
    </div>
  );
}
