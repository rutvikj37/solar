import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from '../../config.js';
import { authHeaders, getToken } from '../../lib/auth.js';
import { stashEmailDraft } from '../../lib/aiOutreach.js';
import LeadEmailThreads from '../../components/leads/LeadEmailThreads.jsx';
import AiReplySuggestions from '../../components/outreach/AiReplySuggestions.jsx';

function formatWhen(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

/** Workspace inbox: latest email replies from leads, with the full thread for the selected lead. */
export default function Inbox() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    if (!getToken()) return;
    try {
      const res = await fetch(`${API_BASE}/api/inbox?limit=100`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load inbox');
      setMessages(data.messages || []);
      setError('');
      setSelectedLeadId((prev) => prev ?? data.messages?.[0]?.lead_id ?? null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="flex flex-col gap-1 mb-4">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
          <span className="material-symbols-outlined text-sm">inbox</span>
          Two-way email
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight">Inbox</h1>
        <p className="text-xs text-on-surface-variant max-w-2xl">
          Replies from your leads, pulled from your connected Gmail or Outlook mailbox. A reply stops any drip
          campaign set to stop on reply.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 crm-panel p-3 space-y-1 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {loading && <p className="p-3 text-xs text-on-surface-variant">Loading replies…</p>}
          {error && <p className="p-3 text-xs text-red-600 dark:text-red-400">{error}</p>}
          {!loading && !error && messages.length === 0 && (
            <p className="p-3 text-xs text-on-surface-variant">
              No replies yet. Use “Sync replies” on the right after connecting your mailbox in{' '}
              <Link to="/integrations" className="text-primary font-semibold hover:underline">
                Integrations
              </Link>
              .
            </p>
          )}
          {messages.map((m) => {
            const active = m.lead_id === selectedLeadId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedLeadId(m.lead_id)}
                className={`w-full text-left rounded-xl px-3 py-2 border transition-colors ${
                  active
                    ? 'border-primary/40 bg-primary/10'
                    : 'border-transparent hover:bg-surface-container'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-bold text-on-surface">
                    {m.owner_name || m.from_address}
                  </span>
                  <span className="shrink-0 text-[10px] text-on-surface-variant">{formatWhen(m.received_at)}</span>
                </div>
                <div className="truncate text-[11px] font-semibold text-on-surface">{m.subject}</div>
                <div className="line-clamp-2 text-[11px] text-on-surface-variant">{m.preview}</div>
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-3 space-y-3">
          {selectedLeadId ? (
            <>
              <div className="flex justify-end">
                <Link
                  to={`/lead/${selectedLeadId}`}
                  className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                >
                  Open lead <span className="material-symbols-outlined text-sm">open_in_new</span>
                </Link>
              </div>
              <LeadEmailThreads
                key={selectedLeadId}
                leadId={selectedLeadId}
                onSynced={load}
                renderThreadActions={(t) => {
                  const lastInbound = [...t.messages].reverse().find((m) => m.direction === 'inbound');
                  return lastInbound ? (
                    <AiReplySuggestions
                      leadId={selectedLeadId}
                      messageId={lastInbound.id}
                      useLabel="Reply from lead page"
                      onUse={(draft) => {
                        stashEmailDraft(selectedLeadId, draft);
                        navigate(`/lead/${selectedLeadId}?tab=outreach`);
                      }}
                    />
                  ) : null;
                }}
              />
            </>
          ) : (
            <InboxSyncOnly onSynced={load} />
          )}
        </div>
      </div>
    </>
  );
}

function InboxSyncOnly({ onSynced }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const sync = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/inbox/sync`, { method: 'POST', headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      setMsg(data.ok ? `Sync complete — ${data.inserted || 0} new repl${data.inserted === 1 ? 'y' : 'ies'}.` : data.message || data.error || 'Sync failed.');
      if (data.inserted) onSynced();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="crm-panel p-5 space-y-3">
      <p className="text-sm text-on-surface">Pull new replies from your mailbox.</p>
      <button
        type="button"
        onClick={sync}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container disabled:opacity-50"
      >
        <span className={`material-symbols-outlined text-sm ${busy ? 'animate-spin' : ''}`}>sync</span>
        {busy ? 'Syncing…' : 'Sync replies'}
      </button>
      {msg && <p className="text-xs text-on-surface-variant">{msg}</p>}
    </div>
  );
}
