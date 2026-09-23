import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { API_BASE } from '../../config.js';
import { BRAND_NAME } from '../../config/brand.js';

function friendlyAuthError(err, data, res) {
  if (data?.code === 'ACCOUNT_NOT_FOUND' || res?.status === 404) {
    return data?.error || 'Sorry, no account exists for that email.';
  }
  if (data?.code === 'EMAIL_NOT_CONFIGURED') {
    return (
      data.error ||
      'Password reset email is temporarily unavailable. Please try again later or contact support.'
    );
  }
  if (res?.status === 429 || data?.error === 'Too many requests') {
    return 'Too many reset attempts. Please wait a few minutes and try again.';
  }
  if (res?.status === 502 || res?.status === 503) {
    return (
      data?.error ||
      'Password reset email is temporarily unavailable. Please try again later or contact support.'
    );
  }
  if (err?.message === 'Failed to fetch' || err?.name === 'TypeError') {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return data?.error || err?.message || 'Request failed';
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(friendlyAuthError(null, data, res)), { data, res });
      setMessage(data.message || 'A password reset link has been sent to your email.');
    } catch (err) {
      setError(friendlyAuthError(err, err.data, err.res));
    } finally {
      setLoading(false);
    }
  };

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
          <p className="text-xs text-on-surface-variant">Secure account recovery</p>
        </div>

        <div className="glass-card p-5 sm:p-8 rounded-2xl border border-glass-stroke shadow-2xl bg-surface-elevated/40 backdrop-blur-xl">
          {message ? (
            <div className="text-center space-y-4" role="status">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                <MailCheck className="size-6" />
              </div>
              <h1 className="text-lg font-bold text-white">Check your inbox</h1>
              <p className="text-sm text-on-surface-variant leading-relaxed">{message}</p>
              <p className="text-[11px] text-on-surface-variant/80 leading-relaxed">
                The link expires in 2 hours. If you signed in with Google, you can keep using Google —
                or set a password from the email to also sign in with email.
              </p>
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center rounded-lg bg-primary text-on-primary font-bold py-3 text-xs"
              >
                Return to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-bold text-white mb-2">Forgot password</h1>
              <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
                Enter the email on your account. We&apos;ll send a reset link if it&apos;s registered.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label htmlFor="forgot-email" className="text-on-surface-variant block font-medium">
                    Email address
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 focus:outline-none focus:border-primary text-white text-xs placeholder:text-on-surface-variant/30 transition-colors"
                  />
                </div>
                {error && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-300 space-y-2" role="alert">
                    <p>{error}</p>
                    {/no account exists/i.test(error) && (
                      <p className="text-[11px] text-red-200/80">
                        Need an account?{' '}
                        <Link to="/register" className="underline hover:text-white">
                          Create one here
                        </Link>
                      </p>
                    )}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary text-on-primary font-bold py-3 rounded-lg disabled:opacity-60 transition-opacity"
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
