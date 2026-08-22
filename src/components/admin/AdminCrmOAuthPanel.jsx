import React, { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '../../config.js';
import CrmSetupBanner from '../CrmSetupBanner.jsx';

function authHeaders() {
  const token = localStorage.getItem('solar_token');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export default function AdminCrmOAuthPanel({ embedded = false, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [setup, setSetup] = useState(null);
  const [form, setForm] = useState({
    hubspotClientId: '',
    hubspotClientSecret: '',
    salesforceClientId: '',
    salesforceClientSecret: '',
    oauthPublicUrl: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/crm-oauth-settings`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load CRM settings');
      setSetup(json);
      setForm({
        hubspotClientId: json.hubspotClientId || '',
        hubspotClientSecret: '',
        salesforceClientId: json.salesforceClientId || '',
        salesforceClientSecret: '',
        oauthPublicUrl: json.oauthPublicUrl ?? '',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        hubspotClientId: form.hubspotClientId.trim(),
        salesforceClientId: form.salesforceClientId.trim(),
        oauthPublicUrl: form.oauthPublicUrl.trim(),
      };
      if (form.hubspotClientSecret.trim()) payload.hubspotClientSecret = form.hubspotClientSecret.trim();
      if (form.salesforceClientSecret.trim()) payload.salesforceClientSecret = form.salesforceClientSecret.trim();

      const res = await fetch(`${API_BASE}/api/admin/crm-oauth-settings`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save CRM settings');
      setSetup(json);
      setForm((prev) => ({
        ...prev,
        hubspotClientSecret: '',
        salesforceClientSecret: '',
      }));
      setSuccess(
        json.ready
          ? 'CRM OAuth settings saved. Users can connect from Integrations.'
          : 'Settings saved, but at least one provider still needs both ID and Secret before users can connect.',
      );
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-xs text-on-surface-variant">Loading CRM OAuth settings…</p>;
  }

  return (
    <div className={`space-y-5 ${embedded ? '' : 'max-w-2xl'}`}>
      {!embedded && (
        <div>
          <h3 className="text-white font-bold text-lg">CRM OAuth settings</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            One-time platform setup. Users connect their own HubSpot or Salesforce accounts from Integrations.
          </p>
        </div>
      )}
      {embedded && (
        <div>
          <h4 className="text-white font-bold text-base">Configure CRM OAuth</h4>
          <p className="text-xs text-on-surface-variant mt-1">HubSpot and Salesforce app credentials.</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg px-3 py-2 text-xs font-semibold bg-red-500/15 text-red-300 border border-red-500/30">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg px-3 py-2 text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          {success}
        </div>
      )}

      <CrmSetupBanner setup={setup} />

      {setup && (
        <div className="flex flex-wrap gap-2 text-[10px]">
          <span
            className={`px-2 py-1 rounded-full border ${
              setup.hubspotConfigured
                ? 'bg-green-500/10 text-green-300 border-green-500/30'
                : 'bg-amber-500/10 text-amber-200 border-amber-500/30'
            }`}
          >
            HubSpot for users: {setup.hubspotConfigured ? 'Connect enabled' : 'locked — save Client ID + Secret'}
          </span>
          <span
            className={`px-2 py-1 rounded-full border ${
              setup.salesforceConfigured
                ? 'bg-green-500/10 text-green-300 border-green-500/30'
                : 'bg-amber-500/10 text-amber-200 border-amber-500/30'
            }`}
          >
            Salesforce for users: {setup.salesforceConfigured ? 'Connect enabled' : 'locked — save Key + Secret'}
          </span>
        </div>
      )}

      <form onSubmit={handleSave} className="glass-card rounded-xl p-5 space-y-4 border border-glass-stroke">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            OAuth callback base URL
          </label>
          <input
            type="url"
            value={form.oauthPublicUrl}
            onChange={(e) => setForm((f) => ({ ...f, oauthPublicUrl: e.target.value }))}
            placeholder="https://api.yourdomain.com"
            className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-sm text-white"
          />
          <p className="text-[10px] text-on-surface-variant">
            Public API URL where OAuth providers redirect. Leave blank to use server defaults.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3 p-4 rounded-xl bg-orange-500/5 border border-orange-500/20">
            <p className="text-sm font-bold text-orange-200">HubSpot</p>
            <div className="space-y-1">
              <label className="text-[10px] text-on-surface-variant">App ID (Client ID)</label>
              <input
                type="text"
                value={form.hubspotClientId}
                onChange={(e) => setForm((f) => ({ ...f, hubspotClientId: e.target.value }))}
                className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-sm text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-on-surface-variant">
                App Secret {setup?.hubspotClientSecretSet && `(saved: ${setup.hubspotClientSecretMasked})`}
              </label>
              <input
                type="password"
                value={form.hubspotClientSecret}
                onChange={(e) => setForm((f) => ({ ...f, hubspotClientSecret: e.target.value }))}
                placeholder={setup?.hubspotClientSecretSet ? 'Leave blank to keep current' : 'Required'}
                className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-sm text-white"
              />
            </div>
          </div>

          <div className="space-y-3 p-4 rounded-xl bg-sky-500/5 border border-sky-500/20">
            <p className="text-sm font-bold text-sky-200">Salesforce</p>
            <div className="space-y-1">
              <label className="text-[10px] text-on-surface-variant">Consumer Key</label>
              <input
                type="text"
                value={form.salesforceClientId}
                onChange={(e) => setForm((f) => ({ ...f, salesforceClientId: e.target.value }))}
                className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-sm text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-on-surface-variant">
                Consumer Secret {setup?.salesforceClientSecretSet && `(saved: ${setup.salesforceClientSecretMasked})`}
              </label>
              <input
                type="password"
                value={form.salesforceClientSecret}
                onChange={(e) => setForm((f) => ({ ...f, salesforceClientSecret: e.target.value }))}
                placeholder={setup?.salesforceClientSecretSet ? 'Leave blank to keep current' : 'Required'}
                className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-sm text-white"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:brightness-110 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save CRM OAuth settings'}
        </button>
      </form>
    </div>
  );
}
