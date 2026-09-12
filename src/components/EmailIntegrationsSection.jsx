import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../config.js';
import {
  EMAIL_PROVIDER_META,
  disconnectEmail,
  fetchEmailIntegration,
  sendTestEmail,
} from '../lib/emailIntegrations.js';
import SmtpConnectForm from './SmtpConnectForm.jsx';

export default function EmailIntegrationsSection({ onToast }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [emailQuota, setEmailQuota] = useState(null);
  const [busy, setBusy] = useState('');

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash !== '#email') return;
    const el = document.getElementById('email');
    if (el) {
      requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }, [loading]);

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

  if (loading) {
    return (
      <div id="email" className="space-y-4">
        <div className="h-48 rounded-2xl bg-white/5 border border-glass-stroke animate-pulse" />
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
    <div id="email" className="space-y-4 scroll-mt-6">
      <div>
        <h3 className="text-white font-bold text-lg">Email</h3>
        <p className="text-xs text-on-surface-variant mt-1">
          Connect company SMTP in one step. Emails send from your inbox — replies come back to you.
          Uses your plan email quota.
        </p>
      </div>

      <div className="glass-card rounded-xl p-4 border border-primary/20 bg-primary/5 space-y-1.5">
        <p className="text-sm text-white font-semibold">Your mailbox + plan quota</p>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          {quotaLabel}. Check remaining on the{' '}
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
        <div className="rounded-2xl border border-glass-stroke bg-white/[0.03] p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl text-primary">dns</span>
            <div>
              <p className="text-white font-bold text-lg">Company email / SMTP</p>
              <p className="text-[11px] text-on-surface-variant">
                Hosting, Google Workspace SMTP, Microsoft, or any mail server
              </p>
            </div>
          </div>
          <SmtpConnectForm
            onSuccess={async (json) => {
              onToast?.(json.message || 'SMTP connected.');
              await load();
            }}
            onError={(msg) => onToast?.(msg)}
          />
        </div>
      )}

      {connected && (
        <p className="text-[11px] text-on-surface-variant">
          Open any lead and use <strong className="text-white">Send Email</strong> — messages go
          from your connected address and count against your plan quota.
        </p>
      )}

      {!connected && (
        <p className="text-[11px] text-on-surface-variant">
          Enter your SMTP host and credentials above. Platform noreply is never used as From for
          customer outreach.
        </p>
      )}
    </div>
  );
}
