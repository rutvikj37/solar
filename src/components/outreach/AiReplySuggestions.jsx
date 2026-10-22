import React, { useState } from 'react';
import { fetchReplySuggestions } from '../../lib/aiOutreach.js';

/** AI reply options for the homeowner's latest email in a thread. onUse({ subject, body }). */
export default function AiReplySuggestions({ leadId, messageId = null, onUse, useLabel = 'Use this reply' }) {
  const [state, setState] = useState({ loading: false, error: '', suggestions: null });

  const load = async () => {
    setState({ loading: true, error: '', suggestions: null });
    try {
      const data = await fetchReplySuggestions(Number(leadId), messageId);
      setState({ loading: false, error: '', suggestions: data.suggestions || [] });
    } catch (err) {
      setState({ loading: false, error: err.message, suggestions: null });
    }
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="pt-1 space-y-2">
      <button
        type="button"
        onClick={load}
        disabled={state.loading}
        className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/15 disabled:opacity-50"
      >
        <span className={`material-symbols-outlined text-sm ${state.loading ? 'animate-spin' : ''}`}>
          {state.loading ? 'progress_activity' : 'auto_awesome'}
        </span>
        {state.loading ? 'Thinking…' : state.suggestions ? 'Regenerate replies' : 'Suggest replies'}
      </button>
      {state.error && <p className="text-[11px] text-red-600 dark:text-red-400">{state.error}</p>}
      {state.suggestions?.map((s, i) => (
        <div key={i} className="rounded-xl border border-outline-variant bg-surface p-3 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-primary">{s.label}</div>
          <p className="whitespace-pre-wrap text-xs text-on-surface">{s.body}</p>
          <div className="flex gap-2">
            {onUse && (
              <button
                type="button"
                onClick={() => onUse({ subject: s.subject, body: s.body })}
                className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-on-primary"
              >
                {useLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => copy(s.body)}
              className="rounded-lg border border-outline-variant px-2.5 py-1 text-[11px] font-bold text-on-surface-variant hover:text-on-surface"
            >
              Copy
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
