import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../../config.js';
import { authHeaders, getToken } from '../../lib/auth.js';

function formatWhen(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

function SyncStatusLine({ status }) {
  if (!status) return null;
  const inbox = status.inbox || {};
  if (!status.connected) {
    return (
      <p className="text-xs text-on-surface-variant">
        Connect Gmail or Outlook in{' '}
        <Link to="/integrations" className="text-primary font-semibold hover:underline">
          Integrations
        </Link>{' '}
        to see replies here.
      </p>
    );
  }
  if (!inbox.enabled) {
    return <p className="text-xs text-on-surface-variant">Reply sync is turned off on this server.</p>;
  }
  if (!inbox.supported) {
    return (
      <p className="text-xs text-on-surface-variant">
        Your {status.provider?.toUpperCase()} mailbox is send-only. Connect Gmail or Outlook to pull replies.
      </p>
    );
  }
  if (inbox.status === 'needs_reconnect') {
    return (
      <p className="text-xs text-amber-600 dark:text-amber-400">
        {inbox.error || 'Reconnect your mailbox to allow reading replies.'}{' '}
        <Link to="/integrations" className="font-semibold underline">
          Reconnect
        </Link>
      </p>
    );
  }
  return (
    <p className="text-xs text-on-surface-variant">
      {status.fromEmail} · {inbox.lastSyncAt ? `last synced ${formatWhen(inbox.lastSyncAt)}` : 'not synced yet'}
      {inbox.status === 'error' && inbox.error ? ` · ${inbox.error}` : ''}
    </p>
  );
}

/**
 * Two-way email conversation for a lead: outbound outreach/drip emails plus synced replies,
 * grouped into threads. `renderThreadActions(thread)` lets callers add per-thread actions.
 */
export default function LeadEmailThreads({ leadId, onSynced, renderThreadActions = null }) {
  const [threads, setThreads] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const [openKey, setOpenKey] = useState(null);

  const load = useCallback(async () => {
    if (!leadId || !getToken()) return;
    try {
      const [tRes, sRes] = await Promise.all([
        fetch(`${API_BASE}/api/inbox/leads/${leadId}/threads`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/inbox/status`, { headers: authHeaders() }),
      ]);
      const tData = tRes.ok ? await tRes.json() : { threads: [] };
      const sData = sRes.ok ? await sRes.json() : null;
      setThreads(tData.threads || []);
      setStatus(sData);
      setOpenKey((prev) => prev ?? tData.threads?.[0]?.key ?? null);
    } catch {
      /* non-blocking panel */
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/inbox/sync`, { method: 'POST', headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setMessage(data.error || 'Too many sync requests — try again shortly.');
      } else if (data.ok) {
        setMessage(
          data.status === 'throttled'
            ? 'Already up to date.'
            : data.inserted
              ? `Pulled ${data.inserted} new repl${data.inserted === 1 ? 'y' : 'ies'}.`
              : 'No new replies.',
        );
        if (data.inserted) onSynced?.();
      } else {
        setMessage(data.message || data.error || 'Sync failed.');
      }
      await load();
    } finally {
      setSyncing(false);
    }
  };

  const canSync = status?.connected && status?.inbox?.enabled && status?.inbox?.supported;

  return (
    <div className="crm-panel p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-on-surface">Email conversation</h3>
          <SyncStatusLine status={status} />
        </div>
        {canSync && (
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-sm ${syncing ? 'animate-spin' : ''}`}>sync</span>
            {syncing ? 'Syncing…' : 'Sync replies'}
          </button>
        )}
      </div>
      {message && <p className="text-xs text-on-surface-variant">{message}</p>}

      {loading ? (
        <p className="text-xs text-on-surface-variant">Loading emails…</p>
      ) : threads.length === 0 ? (
        <p className="text-xs text-on-surface-variant">No emails with this lead yet.</p>
      ) : (
        <div className="space-y-2">
          {threads.map((t) => {
            const open = openKey === t.key;
            return (
              <div key={t.key} className="rounded-xl border border-outline-variant overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenKey(open ? null : t.key)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-surface-container"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-on-surface">{t.subject}</span>
                    <span className="block text-[10px] text-on-surface-variant">
                      {t.messages.length} message{t.messages.length === 1 ? '' : 's'} · {formatWhen(t.lastAt)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {t.hasReply && (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        Replied
                      </span>
                    )}
                    <span className="material-symbols-outlined text-sm text-on-surface-variant">
                      {open ? 'expand_less' : 'expand_more'}
                    </span>
                  </span>
                </button>
                {open && (
                  <div className="space-y-2 border-t border-outline-variant p-3">
                    {t.messages.map((m) => {
                      const inbound = m.direction === 'inbound';
                      return (
                        <div key={m.id} className={`flex ${inbound ? 'justify-start' : 'justify-end'}`}>
                          <div
                            className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                              inbound
                                ? 'bg-surface-container text-on-surface'
                                : 'bg-primary/10 text-on-surface border border-primary/20'
                            }`}
                          >
                            <div className="mb-1 text-[10px] text-on-surface-variant">
                              {inbound ? m.from : `You${m.from && m.from !== 'You' ? ` (${m.from})` : ''}`} ·{' '}
                              {formatWhen(m.at)}
                              {!inbound && m.status && m.status !== 'sent' ? ` · ${m.status}` : ''}
                            </div>
                            <div className="whitespace-pre-wrap break-words">{m.body}</div>
                          </div>
                        </div>
                      );
                    })}
                    {renderThreadActions ? renderThreadActions(t) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
