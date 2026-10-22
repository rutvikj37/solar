import React, { useState } from 'react';
import { AI_INTENTS, AI_TONES, draftOutreach } from '../../lib/aiOutreach.js';

/**
 * "Write with AI" toggle + options. Calls onDraft({ subject?, body }) with a personalised draft
 * (lead, roof and savings data) for the rep to review before sending.
 */
export default function AiWritePanel({ leadId, channel = 'email', onDraft, disabled = false, defaultIntent = 'follow_up' }) {
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState(defaultIntent);
  const [tone, setTone] = useState('friendly');
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      const draft = await draftOutreach({ leadId: Number(leadId), channel, intent, tone, instructions });
      onDraft?.(draft);
      setOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const field =
    'rounded-lg border border-outline-variant bg-surface px-2 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary';

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/15 disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-sm">auto_awesome</span>
        Write with AI
      </button>
      {open && (
        <div className="rounded-xl border border-outline-variant bg-surface-container p-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <select value={intent} onChange={(e) => setIntent(e.target.value)} className={field} aria-label="Goal">
              {AI_INTENTS.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </select>
            <select value={tone} onChange={(e) => setTone(e.target.value)} className={field} aria-label="Tone">
              {AI_TONES.map((t) => (
                <option key={t} value={t}>
                  {t[0].toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <input
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            maxLength={500}
            placeholder="Optional: anything to mention (e.g. we have Saturday slots)"
            className={`${field} w-full`}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={generate}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-sm ${busy ? 'animate-spin' : ''}`}>
                {busy ? 'progress_activity' : 'auto_awesome'}
              </span>
              {busy ? 'Writing…' : `Draft ${channel === 'sms' ? 'text' : 'email'}`}
            </button>
            <span className="text-[10px] text-on-surface-variant">
              Uses this lead&apos;s roof and savings data. Review before sending.
            </span>
          </div>
          {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
