import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { API_BASE } from '../config.js';
import { authHeaders } from '../lib/auth.js';

const PROVIDERS = [
  { id: 'google', name: 'Google Calendar', icon: 'event' },
  { id: 'outlook', name: 'Outlook Calendar', icon: 'calendar_month' },
];

function formatWhen(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
}

/** Connect Google / Outlook so CRM appointments are created, moved and removed on the rep's calendar. */
export default function CalendarIntegrationsSection({ onToast }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/calendar`, { headers: authHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to load calendar status');
      setData(json);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const ok = searchParams.get('calendar');
    const fail = searchParams.get('calendar_error');
    if (!ok && !fail) return;
    if (ok) {
      const name = PROVIDERS.find((p) => ok.startsWith(p.id))?.name || 'Calendar';
      onToast?.(`${name} connected. New and updated appointments will sync automatically.`);
    } else {
      onToast?.(`Calendar connection failed: ${fail}`);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('calendar');
    next.delete('calendar_error');
    setSearchParams(next, { replace: true });
    load();
  }, [searchParams, setSearchParams, onToast, load]);

  const connect = async (provider) => {
    setBusy(provider);
    try {
      const res = await fetch(`${API_BASE}/api/calendar/connect/${provider}?returnTo=/integrations`, {
        headers: authHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.authorizeUrl) throw new Error(json.error || 'Could not start calendar connection');
      window.location.href = json.authorizeUrl;
    } catch (err) {
      onToast?.(err.message);
      setBusy('');
    }
  };

  const disconnect = async (provider) => {
    setBusy(provider);
    try {
      const res = await fetch(`${API_BASE}/api/calendar/${provider}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to disconnect calendar');
      onToast?.('Calendar disconnected. Existing events stay on your calendar.');
      await load();
    } catch (err) {
      onToast?.(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div id="calendar" className="space-y-4 scroll-mt-6">
      <div>
        <h3 className="text-on-surface font-bold text-lg">Calendar sync</h3>
        <p className="text-xs text-on-surface-variant mt-1">
          Appointments you book, reschedule or cancel in the CRM are mirrored to your own calendar. Homeowners are not
          invited from your calendar; they get the usual confirmation email.
        </p>
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {!data && !error && <div className="h-28 rounded-2xl bg-surface-container border border-outline-variant animate-pulse" />}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PROVIDERS.map((p) => {
            const s = data.providers?.[p.id] || {};
            const needsReconnect = s.connected && s.status === 'needs_reconnect';
            return (
              <div key={p.id} className="glass-card rounded-xl p-4 border border-outline-variant space-y-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">{p.icon}</span>
                  <span className="text-sm font-bold text-on-surface">{p.name}</span>
                  {s.connected && (
                    <span
                      className={`ml-auto rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${
                        needsReconnect || s.status === 'error'
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                          : 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400'
                      }`}
                    >
                      {needsReconnect ? 'Reconnect' : s.status === 'error' ? 'Sync error' : 'Connected'}
                    </span>
                  )}
                </div>

                {s.connected ? (
                  <div className="text-[11px] text-on-surface-variant space-y-0.5">
                    {s.accountEmail && <p className="text-on-surface font-semibold">{s.accountEmail}</p>}
                    <p>Last sync: {formatWhen(s.lastSyncAt) || 'not yet'}</p>
                    {s.lastError && <p className="text-amber-700 dark:text-amber-400">{s.lastError}</p>}
                  </div>
                ) : !s.configured ? (
                  <p className="text-[11px] text-on-surface-variant">
                    Not available yet: the platform admin needs to add {p.name} OAuth credentials.
                  </p>
                ) : (
                  <p className="text-[11px] text-on-surface-variant">Not connected.</p>
                )}

                <div className="flex gap-2">
                  {(!s.connected || needsReconnect) && (
                    <button
                      type="button"
                      disabled={!s.configured || busy === p.id}
                      onClick={() => connect(p.id)}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary disabled:opacity-50"
                    >
                      {busy === p.id ? 'Opening…' : needsReconnect ? 'Reconnect' : 'Connect'}
                    </button>
                  )}
                  {s.connected && (
                    <button
                      type="button"
                      disabled={busy === p.id}
                      onClick={() => disconnect(p.id)}
                      className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data?.missingEnv?.length > 0 && (
        <div className="rounded-xl border border-outline-variant bg-surface-container p-3 text-[11px] text-on-surface-variant space-y-1">
          <p className="font-bold text-on-surface">Admin setup</p>
          <p>
            Set {data.missingEnv.join(', ')} in the server .env (the Gmail / Outlook mail OAuth clients are used as a
            fallback). Authorized redirect URIs:
          </p>
          {PROVIDERS.map((p) =>
            data.providers?.[p.id]?.redirectUri ? (
              <code key={p.id} className="block break-all text-on-surface">
                {data.providers[p.id].redirectUri}
              </code>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
