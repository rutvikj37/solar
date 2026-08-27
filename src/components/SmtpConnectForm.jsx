import React, { useState } from 'react';
import { saveSmtpSettings } from '../lib/emailIntegrations.js';

const DEFAULT_FORM = {
  smtpHost: '',
  smtpPort: '587',
  smtpSecure: true,
  smtpUsername: '',
  smtpPassword: '',
  fromEmail: '',
  fromName: '',
};

/**
 * Inline Custom SMTP / company email connect form.
 * Uses existing saveSmtpSettings API.
 */
export default function SmtpConnectForm({
  onSuccess,
  onError,
  onCancel,
  compact = false,
  submitLabel = 'Save & connect SMTP',
}) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const json = await saveSmtpSettings(form);
      onSuccess?.(json);
      setForm(DEFAULT_FORM);
    } catch (err) {
      onError?.(err.message || 'Failed to connect SMTP');
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-sm text-white placeholder:text-on-surface-variant/60';

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {!compact && (
        <p className="text-[11px] text-on-surface-variant leading-relaxed">
          Company email or hosting SMTP — emails send from your address; replies land in that inbox.
        </p>
      )}
      <div className={`grid grid-cols-1 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2'} gap-3`}>
        <input
          type="text"
          placeholder="SMTP host (smtp.example.com)"
          value={form.smtpHost}
          onChange={set('smtpHost')}
          className={inputClass}
          required
          autoComplete="off"
        />
        <input
          type="number"
          placeholder="Port (587)"
          value={form.smtpPort}
          onChange={set('smtpPort')}
          className={inputClass}
        />
        <input
          type="email"
          placeholder="From email"
          value={form.fromEmail}
          onChange={set('fromEmail')}
          className={inputClass}
          required
          autoComplete="email"
        />
        <input
          type="text"
          placeholder="From name (optional)"
          value={form.fromName}
          onChange={set('fromName')}
          className={inputClass}
        />
        <input
          type="text"
          placeholder="Username"
          value={form.smtpUsername}
          onChange={set('smtpUsername')}
          className={inputClass}
          required
          autoComplete="username"
        />
        <input
          type="password"
          placeholder="Password / app password"
          value={form.smtpPassword}
          onChange={set('smtpPassword')}
          className={inputClass}
          required
          autoComplete="current-password"
        />
      </div>
      <label className="flex items-center gap-2 text-xs text-on-surface-variant">
        <input type="checkbox" checked={form.smtpSecure} onChange={set('smtpSecure')} />
        Use TLS (recommended)
      </label>
      <div className="flex gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs text-on-surface-variant hover:text-white"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={busy}
          className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:brightness-110 disabled:opacity-50"
        >
          {busy ? 'Verifying…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
