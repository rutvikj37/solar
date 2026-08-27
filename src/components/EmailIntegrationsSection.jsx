import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../config.js';
import {
  EMAIL_PROVIDER_META,
  connectEmailProvider,
  disconnectEmail,
  fetchEmailIntegration,
  saveSmtpSettings,
  sendTestEmail,
} from '../lib/emailIntegrations.js';

export default function EmailIntegrationsSection({ onToast, isAdmin = false }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [emailQuota, setEmailQuota] = useState(null);
  const [busy, setBusy] = useState('');
  const [showSmtp, setShowSmtp] = useState(false);
  const [smtpForm, setSmtpForm] = useState({
    smtpHost: '',
    smtpPort: '587',
    smtpSecure: true,
    smtpUsername: '',
    smtpPassword: '',
    fromEmail: '',
    fromName: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchEmailIntegration());
      const token = localStorage.getItem('solar_token');
      if (token) {
        const quotaRes = await fetch(`${API_BASE}/api/email/usage`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (quotaRes.ok) setEmailQuota(await quotaRes.json());
        else setEmailQuota(null);
      }
    } catch (err) {
      onToast?.(err.message);
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    load();
  }, [load]);

  const connectOAuth = async (provider) => {
    setBusy(provider);
    try {
      await connectEmailProvider(provider, '/integrations');
    } catch (err) {
      onToast?.(err.message);
      setBusy('');
    }
  };

  const handleDisconnect = async () => {
    setBusy('disconnect');
    try {
      const json = await disconnectEmail();
      onToast?.(json.message || 'Email disconnected.');
      await load();
    } catch (err) {
      onToast?.(err.message);
    } finally {
      setBusy('');
    }
  };

  const handleSaveSmtp = async (e) => {
    e.preventDefault();
    setBusy('smtp');
    try {
      const json = await saveSmtpSettings(smtpForm);
      onToast?.(json.message || 'SMTP connected.');
      setShowSmtp(false);
      await load();
    } catch (err) {
      onToast?.(err.message);
    } finally {
      setBusy('');
    }
  };

  const handleTest = async () => {
    setBusy('test');
    try {
      const json = await sendTestEmail();
      onToast?.(json.message || 'Test email sent.');
    } catch (err) {
      onToast?.(err.message);
    } finally {
      setBusy('');
    }
  };

  const lockedMessage = (label) =>
    isAdmin ? (
      <>
        Not configured yet — set up in{' '}
        <Link to="/admin?tab=integrations" className="text-primary font-bold hover:underline">
          Admin → Integrations
        </Link>
        .
      </>
    ) : (
      <>Not available yet — ask your administrator to enable {label}.</>
    );

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 rounded-2xl bg-white/5 border border-glass-stroke animate-pulse" />
        ))}
      </div>
    );
  }

  const connected = data?.connected;
  const activeProvider = data?.provider;

  const quotaLabel = emailQuota?.unlimited
    ? 'Unlimited emails on your plan'
    : emailQuota
      ? `${emailQuota.remaining ?? 0} of ${emailQuota.limit ?? 0} emails left this period`
      : 'Counted against your subscription';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-white font-bold text-lg">Email</h3>
        <p className="text-xs text-on-surface-variant mt-1">
          Send as your email — we only provide delivery + quota. Connect Gmail, Outlook, or SMTP.
          You never enter AWS keys. Lead, drip, and meeting mail goes From your address; replies
          land in your inbox.
        </p>
      </div>

      <div className="glass-card rounded-xl p-4 border border-primary/20 bg-primary/5 space-y-1.5">
        <p className="text-sm text-white font-semibold">Your mailbox + plan quota</p>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          {quotaLabel}. Successful customer sends use one credit from your plan (shared with drip
          and meetings). Check remaining on the{' '}
          <Link to="/dashboard" className="text-primary font-bold hover:underline">
            Dashboard
          </Link>
          {' '}or upgrade under{' '}
          <Link to="/billing" className="text-primary font-bold hover:underline">
            Billing
          </Link>
          .
        </p>
      </div>

      {connected && (
        <div className="glass-card rounded-xl p-4 border border-green-500/25 bg-green-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm text-white font-semibold">
              Sending as {data.fromName ? `${data.fromName} ` : ''}
              <span className="text-green-300">{data.fromEmail}</span>
            </p>
            <p className="text-[10px] text-on-surface-variant mt-1 capitalize">
              via {EMAIL_PROVIDER_META[activeProvider]?.label || activeProvider} — replies stay in
              this inbox
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={!!busy}
              className="px-3 py-2 rounded-lg bg-white/10 text-xs font-bold text-white hover:bg-white/15 disabled:opacity-50"
            >
              {busy === 'test' ? 'Sending…' : 'Send test'}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={!!busy}
              className="px-3 py-2 rounded-lg border border-glass-stroke text-xs font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {!connected && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {['gmail', 'outlook'].map((key) => {
            const meta = EMAIL_PROVIDER_META[key];
            const available = key === 'gmail' ? data?.gmailAvailable : data?.outlookAvailable;
            return (
              <div
                key={key}
                className="rounded-2xl border border-glass-stroke bg-white/[0.03] p-5 flex flex-col min-h-[180px]"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-2xl text-primary">{meta.icon}</span>
                  <div>
                    <p className="text-white font-bold">{meta.label}</p>
                    <p className="text-[11px] text-on-surface-variant">{meta.description}</p>
                  </div>
                </div>
                <div className="mt-auto pt-4">
                  {available ? (
                    <button
                      type="button"
                      onClick={() => connectOAuth(key)}
                      disabled={!!busy}
                      className="w-full px-4 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:brightness-110 disabled:opacity-50"
                    >
                      {busy === key ? 'Opening login…' : `Connect ${meta.label}`}
                    </button>
                  ) : (
                    <div className="rounded-xl border border-glass-stroke bg-black/20 px-4 py-3 text-center space-y-1.5">
                      <span className="material-symbols-outlined text-on-surface-variant text-xl">lock</span>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">
                        {lockedMessage(meta.label)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!connected && (
        <div className="rounded-2xl border border-glass-stroke bg-white/[0.03] p-5">
          {!showSmtp ? (
            <button
              type="button"
              onClick={() => setShowSmtp(true)}
              className="w-full flex items-center justify-between gap-3 text-left"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl text-primary">dns</span>
                <div>
                  <p className="text-white font-bold">Custom SMTP</p>
                  <p className="text-[11px] text-on-surface-variant">Company mail server or hosting SMTP</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant">expand_more</span>
            </button>
          ) : (
            <form onSubmit={handleSaveSmtp} className="space-y-3">
              <p className="text-white font-bold text-sm">Custom SMTP</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="SMTP host (smtp.gmail.com)"
                  value={smtpForm.smtpHost}
                  onChange={(e) => setSmtpForm((f) => ({ ...f, smtpHost: e.target.value }))}
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-sm text-white"
                  required
                />
                <input
                  type="number"
                  placeholder="Port (587)"
                  value={smtpForm.smtpPort}
                  onChange={(e) => setSmtpForm((f) => ({ ...f, smtpPort: e.target.value }))}
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-sm text-white"
                />
                <input
                  type="email"
                  placeholder="From email"
                  value={smtpForm.fromEmail}
                  onChange={(e) => setSmtpForm((f) => ({ ...f, fromEmail: e.target.value }))}
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-sm text-white"
                  required
                />
                <input
                  type="text"
                  placeholder="From name"
                  value={smtpForm.fromName}
                  onChange={(e) => setSmtpForm((f) => ({ ...f, fromName: e.target.value }))}
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-sm text-white"
                />
                <input
                  type="text"
                  placeholder="Username"
                  value={smtpForm.smtpUsername}
                  onChange={(e) => setSmtpForm((f) => ({ ...f, smtpUsername: e.target.value }))}
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-sm text-white"
                  required
                />
                <input
                  type="password"
                  placeholder="Password / app password"
                  value={smtpForm.smtpPassword}
                  onChange={(e) => setSmtpForm((f) => ({ ...f, smtpPassword: e.target.value }))}
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-sm text-white"
                  required
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-on-surface-variant">
                <input
                  type="checkbox"
                  checked={smtpForm.smtpSecure}
                  onChange={(e) => setSmtpForm((f) => ({ ...f, smtpSecure: e.target.checked }))}
                />
                Use TLS (recommended)
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowSmtp(false)}
                  className="px-4 py-2 rounded-lg text-xs text-on-surface-variant hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy === 'smtp'}
                  className="flex-1 px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold disabled:opacity-50"
                >
                  {busy === 'smtp' ? 'Verifying…' : 'Save & connect SMTP'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {connected && (
        <p className="text-[11px] text-on-surface-variant">
          Open any lead and use <strong className="text-white">Send Email</strong> — messages go
          from your connected address and count against your plan quota.
        </p>
      )}

      {!connected && (
        <p className="text-[11px] text-amber-300/90">
          Connect a mailbox above before sending lead, drip, or meeting emails. Platform noreply is
          never used as From for customer outreach.
        </p>
      )}
    </div>
  );
}
