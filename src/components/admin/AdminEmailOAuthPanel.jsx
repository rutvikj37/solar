import React, { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '../../config.js';

function authHeaders() {
  const token = localStorage.getItem('solar_token');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function CopyUri({ label, uri }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(uri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{label}</p>
      <button
        type="button"
        onClick={copy}
        className="w-full text-left font-mono text-xs text-blue-600 dark:text-blue-400 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-xl p-2.5 hover:border-blue-400 transition break-all flex items-center justify-between gap-2"
      >
        <span>{uri}</span>
        <span className="text-[10px] font-sans font-semibold px-2 py-0.5 rounded bg-slate-200/70 dark:bg-white/10 text-slate-700 dark:text-slate-200 shrink-0">
          {copied ? 'Copied!' : 'Copy'}
        </span>
      </button>
    </div>
  );
}

export default function AdminEmailOAuthPanel({ embedded = false, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [setup, setSetup] = useState(null);
  const [form, setForm] = useState({
    googleClientId: '',
    googleClientSecret: '',
    microsoftClientId: '',
    microsoftClientSecret: '',
    oauthPublicUrl: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/email-oauth-settings`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load email settings');
      setSetup(json);
      setForm({
        googleClientId: json.googleClientId || '',
        googleClientSecret: '',
        microsoftClientId: json.microsoftClientId || '',
        microsoftClientSecret: '',
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
        googleClientId: form.googleClientId.trim(),
        microsoftClientId: form.microsoftClientId.trim(),
        oauthPublicUrl: form.oauthPublicUrl.trim(),
      };
      if (form.googleClientSecret.trim()) payload.googleClientSecret = form.googleClientSecret.trim();
      if (form.microsoftClientSecret.trim()) payload.microsoftClientSecret = form.microsoftClientSecret.trim();

      const res = await fetch(`${API_BASE}/api/admin/email-oauth-settings`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save email settings');
      setSetup(json);
      setForm((prev) => ({ ...prev, googleClientSecret: '', microsoftClientSecret: '' }));
      setSuccess(
        json.ready
          ? 'Email OAuth settings saved. Users can connect Gmail from Integrations.'
          : 'Settings saved, but Gmail still needs both Client ID and Secret before users can connect.',
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
        Loading Email OAuth telemetry…
      </div>
    );
  }

  return (
    <div className={`space-y-5 ${embedded ? '' : 'max-w-2xl'}`}>
      {!embedded && (
        <div>
          <h3 className="text-slate-900 dark:text-white font-bold text-lg">Email OAuth Connectors</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            One-time platform setup. Allows companies to link Gmail or Outlook alongside custom SMTP.
          </p>
        </div>
      )}
      {embedded && (
        <div>
          <h4 className="text-slate-900 dark:text-white font-bold text-base">Configure Email OAuth</h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Google app credentials unlock direct Gmail authorization for solar companies.
          </p>
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

      {setup?.gmailRedirectUri && (
        <div className="rounded-2xl p-5 border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826] space-y-3 shadow-xs">
          <p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
            OAuth Redirect URIs (Register in Google Cloud Console & Azure AD)
          </p>
          <CopyUri label="Google Cloud Authorized Redirect URI" uri={setup.gmailRedirectUri} />
          <CopyUri label="Microsoft Azure Redirect URI" uri={setup.outlookRedirectUri} />
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
            placeholder="http://localhost:5002"
            className="w-full bg-slate-50 dark:bg-black/30 border border-slate-300 dark:border-white/10 rounded-xl py-2 px-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3 p-4 rounded-xl bg-red-50/60 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20">
            <p className="text-sm font-bold text-red-950 dark:text-red-200 flex items-center gap-1.5">
              <span>Google Cloud (Gmail API)</span>
            </p>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Client ID</label>
              <input
                type="text"
                placeholder="Google OAuth Client ID"
                value={form.googleClientId}
                onChange={(e) => setForm((f) => ({ ...f, googleClientId: e.target.value }))}
                className="w-full bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl py-2 px-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Client Secret {setup?.googleClientSecretSet && <span className="font-normal text-slate-500 dark:text-slate-400">(Saved: ••••••••)</span>}
              </label>
              <input
                type="password"
                placeholder={setup?.googleClientSecretSet ? 'Leave blank to keep current' : 'Client Secret'}
                value={form.googleClientSecret}
                onChange={(e) => setForm((f) => ({ ...f, googleClientSecret: e.target.value }))}
                className="w-full bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl py-2 px-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
              />
            </div>
          </div>

          <div className="space-y-3 p-4 rounded-xl bg-blue-50/60 dark:bg-blue-500/5 border border-blue-200 dark:border-blue-500/20">
            <p className="text-sm font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
              <span>Microsoft Graph (Outlook)</span>
            </p>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Application (Client) ID</label>
              <input
                type="text"
                placeholder="Azure AD Client ID"
                value={form.microsoftClientId}
                onChange={(e) => setForm((f) => ({ ...f, microsoftClientId: e.target.value }))}
                className="w-full bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl py-2 px-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Client Secret {setup?.microsoftClientSecretSet && <span className="font-normal text-slate-500 dark:text-slate-400">(Saved: ••••••••)</span>}
              </label>
              <input
                type="password"
                placeholder={setup?.microsoftClientSecretSet ? 'Leave blank to keep current' : 'Client Secret'}
                value={form.microsoftClientSecret}
                onChange={(e) => setForm((f) => ({ ...f, microsoftClientSecret: e.target.value }))}
                className="w-full bg-white dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl py-2 px-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition active:scale-95 disabled:opacity-50 shadow-xs"
        >
          {saving ? 'Saving…' : 'Save Email OAuth Settings'}
        </button>
      </form>
    </div>
  );
}
