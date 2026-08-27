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
  const copy = () => navigator.clipboard?.writeText(uri);
  return (
    <div className="space-y-1">
      <p className="text-[10px] text-on-surface-variant">{label}</p>
      <button
        type="button"
        onClick={copy}
        className="w-full text-left font-mono text-[10px] text-primary bg-black/30 rounded-lg p-2 hover:bg-black/40 break-all"
      >
        {uri}
        <span className="block text-[9px] text-on-surface-variant mt-1">Click to copy</span>
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
    return <p className="text-xs text-on-surface-variant">Loading email OAuth settings…</p>;
  }

  return (
    <div className={`space-y-5 ${embedded ? '' : 'max-w-2xl'}`}>
      {!embedded && (
        <div>
          <h3 className="text-white font-bold text-lg">Email OAuth settings</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            One-time platform setup. Users connect Gmail or SMTP from Integrations.
          </p>
        </div>
      )}
      {embedded && (
        <div>
          <h4 className="text-white font-bold text-base">Configure Email OAuth</h4>
          <p className="text-xs text-on-surface-variant mt-1">
            Google app credentials unlock Gmail for users. Microsoft fields are optional / unused in
            the user UI.
          </p>
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

      {setup?.gmailRedirectUri && (
        <div className="glass-card rounded-xl p-4 border border-glass-stroke space-y-3">
          <p className="text-xs font-bold text-white">Redirect URLs (register in Google Cloud + Azure)</p>
          <CopyUri label="Gmail" uri={setup.gmailRedirectUri} />
          <CopyUri label="Outlook" uri={setup.outlookRedirectUri} />
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
            placeholder="http://localhost:5002"
            className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-sm text-white"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3 p-4 rounded-xl bg-red-500/5 border border-red-500/20">
            <p className="text-sm font-bold text-red-200">Google (Gmail)</p>
            <input
              type="text"
              placeholder="Client ID"
              value={form.googleClientId}
              onChange={(e) => setForm((f) => ({ ...f, googleClientId: e.target.value }))}
              className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-sm text-white"
            />
            <input
              type="password"
              placeholder={setup?.googleClientSecretSet ? 'Leave blank to keep current' : 'Client Secret'}
              value={form.googleClientSecret}
              onChange={(e) => setForm((f) => ({ ...f, googleClientSecret: e.target.value }))}
              className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-sm text-white"
            />
          </div>
          <div className="space-y-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
            <p className="text-sm font-bold text-blue-200">Microsoft (Outlook)</p>
            <input
              type="text"
              placeholder="Application (client) ID"
              value={form.microsoftClientId}
              onChange={(e) => setForm((f) => ({ ...f, microsoftClientId: e.target.value }))}
              className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-sm text-white"
            />
            <input
              type="password"
              placeholder={setup?.microsoftClientSecretSet ? 'Leave blank to keep current' : 'Client Secret'}
              value={form.microsoftClientSecret}
              onChange={(e) => setForm((f) => ({ ...f, microsoftClientSecret: e.target.value }))}
              className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-sm text-white"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:brightness-110 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Email OAuth settings'}
        </button>
      </form>
    </div>
  );
}
