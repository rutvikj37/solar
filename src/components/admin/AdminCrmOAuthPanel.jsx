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
      setForm((prev) => ({ ...prev, hubspotClientSecret: '', salesforceClientSecret: '' }));
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
    return (
      <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
        Loading CRM OAuth telemetry…
      </div>
    );
  }

  return (
    <div className={`space-y-5 ${embedded ? '' : 'max-w-2xl'}`}>
      {!embedded && (
        <div>
          <h3 className="text-slate-900 dark:text-white font-bold text-lg">CRM OAuth Connectors</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            One-time platform setup. Solar installers connect their own HubSpot or Salesforce accounts from their workspace Integrations.
          </p>
        </div>
      )}
      {embedded && (
        <div>
          <h4 className="text-slate-900 dark:text-white font-bold text-base">Configure CRM OAuth</h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Platform credentials for HubSpot and Salesforce Connected Apps.</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl px-4 py-3 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl px-4 py-3 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
          {success}
        </div>
      )}

      <CrmSetupBanner setup={setup} />

      {setup && (
        <div className="flex flex-wrap gap-2 text-[10px] font-mono font-medium">
          <span
            className={`px-2.5 py-1 rounded-full border ${
              setup.hubspotConfigured
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30'
                : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30'
            }`}
          >
            HubSpot: {setup.hubspotConfigured ? 'Connect enabled' : 'locked — save Client ID + Secret'}
          </span>
          <span
            className={`px-2.5 py-1 rounded-full border ${
              setup.salesforceConfigured
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30'
                : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30'
            }`}
          >
            Salesforce: {setup.salesforceConfigured ? 'Connect enabled' : 'locked — save Key + Secret'}
          </span>
        </div>
      )}

      <form onSubmit={handleSave} className="rounded-2xl p-5 sm:p-6 space-y-5 border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826] shadow-xs">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
            OAuth Callback Base URL
          </label>
          <input
            type="url"
            value={form.oauthPublicUrl}
            onChange={(e) => setForm((f) => ({ ...f, oauthPublicUrl: e.target.value }))}
            placeholder="https://api.yourdomain.com"
            className="w-full bg-slate-50 dark:bg-black/30 border border-slate-300 dark:border-white/10 rounded-xl py-2 px-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Public API URL where OAuth providers redirect after authorization. Leave blank to use server origin.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3 p-4 rounded-xl bg-orange-50/60 dark:bg-orange-500/5 border border-orange-200 dark:border-orange-500/20">
            <p className="text-sm font-bold text-orange-950 dark:text-orange-200 flex items-center gap-1.5">
              <span>HubSpot App</span>
            </p>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">App ID (Client ID)</label>
              <input
                type="text"
                value={form.hubspotClientId}
                onChange={(e) => setForm((f) => ({ ...f, hubspotClientId: e.target.value }))}
                className="w-full bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl py-2 px-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                App Secret {setup?.hubspotClientSecretSet && <span className="font-normal text-slate-500 dark:text-slate-400">(Saved: {setup.hubspotClientSecretMasked})</span>}
              </label>
              <input
                type="password"
                value={form.hubspotClientSecret}
                onChange={(e) => setForm((f) => ({ ...f, hubspotClientSecret: e.target.value }))}
                placeholder={setup?.hubspotClientSecretSet ? 'Leave blank to keep current' : 'Required'}
                className="w-full bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl py-2 px-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
            </div>
          </div>

          <div className="space-y-3 p-4 rounded-xl bg-sky-50/60 dark:bg-sky-500/5 border border-sky-200 dark:border-sky-500/20">
            <p className="text-sm font-bold text-sky-950 dark:text-sky-200 flex items-center gap-1.5">
              <span>Salesforce Connected App</span>
            </p>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Consumer Key</label>
              <input
                type="text"
                value={form.salesforceClientId}
                onChange={(e) => setForm((f) => ({ ...f, salesforceClientId: e.target.value }))}
                className="w-full bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl py-2 px-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Consumer Secret {setup?.salesforceClientSecretSet && <span className="font-normal text-slate-500 dark:text-slate-400">(Saved: {setup.salesforceClientSecretMasked})</span>}
              </label>
              <input
                type="password"
                value={form.salesforceClientSecret}
                onChange={(e) => setForm((f) => ({ ...f, salesforceClientSecret: e.target.value }))}
                placeholder={setup?.salesforceClientSecretSet ? 'Leave blank to keep current' : 'Required'}
                className="w-full bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl py-2 px-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition active:scale-95 disabled:opacity-50 shadow-xs"
        >
          {saving ? 'Saving…' : 'Save CRM OAuth Settings'}
        </button>
      </form>
    </div>
  );
}
