import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { isAdminRole, loadAuthSession } from '../lib/auth.js';
import {
  CRM_PROVIDER_META,
  connectCrmProvider,
  crmToastFromSearchParams,
  disconnectCrmProvider,
  fetchCrmIntegrations,
  getConnectedProviders,
} from '../lib/crmIntegrations.js';
import { emailToastFromSearchParams } from '../lib/emailIntegrations.js';
import EmailIntegrationsSection from '../components/EmailIntegrationsSection.jsx';

const CRM_KEYS = ['hubspot', 'salesforce'];

const CARD_STYLES = {
  hubspot: {
    gradient: 'from-[#ff7a59]/20 via-orange-500/10 to-transparent',
    border: 'border-[#ff7a59]/35',
    accent: 'text-[#ff7a59]',
    badge: 'bg-[#ff7a59]/15 text-[#ffb199] border-[#ff7a59]/30',
    button: 'bg-[#ff7a59] hover:bg-[#ff8f6f] text-white',
    logo: 'H',
  },
  salesforce: {
    gradient: 'from-sky-400/20 via-sky-500/10 to-transparent',
    border: 'border-sky-400/35',
    accent: 'text-sky-300',
    badge: 'bg-sky-500/15 text-sky-200 border-sky-500/30',
    button: 'bg-sky-500 hover:bg-sky-400 text-white',
    logo: 'SF',
  },
};

export default function IntegrationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadAuthSession().then((session) => setIsAdmin(isAdminRole(session?.role)));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchCrmIntegrations());
    } catch (err) {
      setToast(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const crmMsg = crmToastFromSearchParams(searchParams, setSearchParams);
    const emailMsg = emailToastFromSearchParams(searchParams, setSearchParams);
    const msg = crmMsg || emailMsg;
    if (msg) {
      setToast(msg);
      load();
    }
  }, [searchParams, setSearchParams, load]);

  const connectOAuth = async (provider) => {
    setBusy(provider);
    try {
      await connectCrmProvider(provider, '/integrations');
    } catch (err) {
      setToast(err.message);
      setBusy('');
    }
  };

  const disconnect = async (provider) => {
    setBusy(`disconnect-${provider}`);
    try {
      const json = await disconnectCrmProvider(provider);
      setToast(json.message || 'Disconnected.');
      await load();
    } catch (err) {
      setToast(err.message);
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

  const providerMap = Object.fromEntries((data?.providers || []).map((p) => [p.provider, p]));
  const connected = getConnectedProviders(data);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="font-headline-lg text-2xl font-bold text-primary">Integrations</h2>
        <p className="text-on-surface-variant text-sm mt-1">
          Connect CRM and email once — push leads and send messages from your own accounts.
        </p>
      </div>

      {toast && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex justify-between gap-2 border ${
            toast.toLowerCase().includes('fail') || toast.toLowerCase().includes('error')
              ? 'bg-red-500/10 text-red-400 border-red-500/25'
              : 'bg-green-500/10 text-green-400 border-green-500/25'
          }`}
        >
          <span>{toast}</span>
          <button type="button" onClick={() => setToast('')} className="opacity-70 hover:opacity-100 shrink-0">
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CRM_KEYS.map((key) => (
            <div key={key} className="h-56 rounded-2xl bg-white/5 border border-glass-stroke animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CRM_KEYS.map((key) => {
            const meta = CRM_PROVIDER_META[key];
            const style = CARD_STYLES[key];
            const row = providerMap[key] || { connected: false };
            const available = key === 'hubspot' ? data?.hubspotAvailable : data?.salesforceAvailable;

            return (
              <div
                key={key}
                className={`relative overflow-hidden rounded-2xl border ${style.border} bg-gradient-to-br ${style.gradient} p-6 flex flex-col min-h-[220px]`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black ${style.badge} border`}
                    >
                      {style.logo}
                    </div>
                    <div>
                      <p className="text-white font-bold text-lg">{meta.label}</p>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">{meta.description}</p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border ${
                      row.connected
                        ? 'bg-green-500/15 text-green-300 border-green-500/30'
                        : 'bg-white/5 text-on-surface-variant border-glass-stroke'
                    }`}
                  >
                    {row.connected ? 'Connected ✓' : 'Not connected'}
                  </span>
                </div>

                <div className="mt-auto pt-6">
                  {row.connected ? (
                    <div className="space-y-3">
                      <p className={`text-xs ${style.accent} font-semibold`}>
                        Push leads from{' '}
                        <Link to="/my-leads" className="underline underline-offset-2 hover:brightness-110">
                          My Leads
                        </Link>
                      </p>
                      <button
                        type="button"
                        onClick={() => disconnect(key)}
                        disabled={!!busy}
                        className="w-full px-4 py-2.5 rounded-xl border border-glass-stroke text-xs font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                      >
                        {busy === `disconnect-${key}` ? 'Disconnecting…' : 'Disconnect'}
                      </button>
                    </div>
                  ) : available ? (
                    <button
                      type="button"
                      onClick={() => connectOAuth(key)}
                      disabled={!!busy}
                      className={`w-full px-4 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50 ${style.button}`}
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

      {connected.length > 0 && (
        <div className="glass-card rounded-xl p-4 border border-primary/20 bg-primary/5">
          <p className="text-sm text-white font-semibold">You&apos;re all set</p>
          <p className="text-xs text-on-surface-variant mt-1">
            Select leads in{' '}
            <Link to="/my-leads" className="text-primary font-bold hover:underline">
              My Leads
            </Link>{' '}
            and use <strong className="text-white">Push to {connected.map((p) => CRM_PROVIDER_META[p].label).join(' / ')}</strong>.
          </p>
        </div>
      )}

      <hr className="border-glass-stroke" />

      <EmailIntegrationsSection onToast={setToast} isAdmin={isAdmin} />
    </div>
  );
}
