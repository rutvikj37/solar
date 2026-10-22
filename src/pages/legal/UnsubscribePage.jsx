import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { API_BASE } from '../../config.js';

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('t') || '';
  const [state, setState] = useState('loading');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setState('error');
      setError('This unsubscribe link is missing its token.');
      return;
    }
    fetch(`${API_BASE}/api/compliance/unsubscribe/status?t=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'This unsubscribe link is invalid.');
        setEmail(data.email || '');
        setState(data.unsubscribed ? 'unsubscribed' : 'confirm');
      })
      .catch((err) => {
        setState('error');
        setError(err.message);
      });
  }, [token]);

  const submit = async (action) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/compliance/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setState(data.unsubscribed ? 'unsubscribed' : 'confirm');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface flex items-center justify-center p-6">
      <div className="glass-card max-w-md w-full p-8 rounded-2xl text-center space-y-4">
        <span className="material-symbols-outlined text-4xl text-primary">
          {state === 'unsubscribed' ? 'mark_email_read' : 'unsubscribe'}
        </span>
        <h1 className="text-xl font-bold text-on-surface">Email preferences</h1>

        {state === 'loading' && <p className="text-sm text-on-surface-variant">Checking your link…</p>}

        {state === 'confirm' && (
          <>
            <p className="text-sm text-on-surface-variant">
              Stop receiving solar outreach emails at <strong className="text-on-surface">{email}</strong>?
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => submit('unsubscribe')}
              className="w-full rounded-lg bg-primary text-on-primary text-sm font-bold py-2.5 disabled:opacity-60"
            >
              {busy ? 'Working…' : 'Unsubscribe'}
            </button>
          </>
        )}

        {state === 'unsubscribed' && (
          <>
            <p className="text-sm text-on-surface-variant">
              <strong className="text-on-surface">{email}</strong> has been unsubscribed. You won&apos;t receive
              further marketing emails from SpaceToRoof or its partner installers.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => submit('resubscribe')}
              className="text-xs text-on-surface-variant underline hover:text-on-surface disabled:opacity-60"
            >
              Unsubscribed by mistake? Resubscribe
            </button>
          </>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Link to="/" className="inline-block text-primary hover:underline text-sm font-semibold">
          Back to home
        </Link>
      </div>
    </div>
  );
}
