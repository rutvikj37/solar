import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { API_BASE } from '../../config.js';
import { BRAND_NAME } from '../../config/brand.js';

function friendlyResetError(err, data, res) {
  if (res?.status === 429 || data?.error === 'Too many requests') {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  if (res?.status === 502 || res?.status === 503) {
    return data?.error || 'Unable to reset password right now. Please try again later.';
  }
  if (err?.message === 'Failed to fetch' || err?.name === 'TypeError') {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return data?.error || err?.message || 'Reset failed';
}

function passwordHints(password) {
  return [
    { ok: password.length >= 8, label: 'At least 8 characters' },
    { ok: /[A-Za-z]/.test(password) && /\d/.test(password), label: 'Letters and a number' },
  ];
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const hints = passwordHints(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(friendlyResetError(null, data, res)), { data, res });
      setMessage(data.message || 'Password updated.');
      setPassword('');
      setConfirm('');
    } catch (err) {
      setError(friendlyResetError(err, err.data, err.res));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-dark-shell theme-dark-canvas bg-deep text-on-background min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div className="w-full max-w-[420px] z-10 text-center glass-card p-8 rounded-2xl border border-glass-stroke">
          <h1 className="text-lg font-bold text-white mb-2">Invalid reset link</h1>
          <p className="text-xs text-on-surface-variant mb-6">
            This link is missing or incomplete. Request a new password reset email.
          </p>
          <Link
            to="/forgot-password"
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary text-on-primary font-bold py-3 text-xs"
          >
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-dark-shell theme-dark-canvas bg-deep text-on-background min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/15 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-glow/10 blur-3xl rounded-full pointer-events-none" />

      <div className="w-full max-w-[420px] z-10">
        <Link
          to="/login"
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <ArrowLeft className="size-3.5" />
          Back to sign in
        </Link>

        <div className="text-center mb-8">
          <Link to="/login" className="inline-flex items-baseline gap-0 mb-2 select-none font-display">
            <span className="text-on-surface font-semibold text-2xl tracking-tight">{BRAND_NAME}</span>
            <span className="text-primary-glow font-semibold text-2xl tracking-tight">.com</span>
          </Link>
          <p className="text-xs text-on-surface-variant">Choose a new secure password</p>
        </div>

        <div className="glass-card p-5 sm:p-8 rounded-2xl border border-glass-stroke shadow-2xl bg-surface-elevated/40 backdrop-blur-xl">
          {message ? (
            <div className="text-center space-y-4" role="status">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                <CheckCircle2 className="size-6" />
              </div>
              <h1 className="text-lg font-bold text-white">Password updated</h1>
              <p className="text-sm text-on-surface-variant leading-relaxed">{message}</p>
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center rounded-lg bg-primary text-on-primary font-bold py-3 text-xs"
              >
                Sign in now
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-start gap-3">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary-glow">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">Set new password</h1>
                  <p className="mt-1 text-xs text-on-surface-variant leading-relaxed">
                    Your reset link is one-time and expires soon. Pick a strong password you don&apos;t reuse elsewhere.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label htmlFor="new-password" className="text-on-surface-variant block font-medium">
                    New password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 focus:outline-none focus:border-primary text-white text-xs placeholder:text-on-surface-variant/30 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="confirm-password" className="text-on-surface-variant block font-medium">
                    Confirm password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 focus:outline-none focus:border-primary text-white text-xs placeholder:text-on-surface-variant/30 transition-colors"
                  />
                </div>

                <ul className="space-y-1.5 rounded-lg border border-glass-stroke bg-surface-container-low/50 px-3 py-2.5">
                  {hints.map((h) => (
                    <li
                      key={h.label}
                      className={`flex items-center gap-2 text-[11px] ${h.ok ? 'text-emerald-300' : 'text-on-surface-variant'}`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${h.ok ? 'bg-emerald-400' : 'bg-on-surface-variant/40'}`}
                        aria-hidden
                      />
                      {h.label}
                    </li>
                  ))}
                </ul>

                {error && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-300" role="alert">
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-on-primary font-bold py-3 rounded-lg disabled:opacity-60 transition-opacity"
                >
                  {loading ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
