import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { API_BASE } from '../../config.js';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('Verifying your email…');
  const [resendEmail, setResendEmail] = useState('');
  const [resendMsg, setResendMsg] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (searchParams.get('pending') === '1') {
      setStatus('pending');
      setMessage('Check your email for a verification link, then sign in.');
      const email = searchParams.get('email') || '';
      if (email) setResendEmail(email);
      return;
    }
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }
    fetch(`${API_BASE}/api/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Verification failed');
        setStatus('success');
        setMessage(data.message || 'Email verified.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.message);
      });
  }, [searchParams]);

  const resend = async (e) => {
    e.preventDefault();
    setResendMsg('');
    setResending(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not resend');
      setResendMsg(data.message || 'If an unverified account exists, a new link was sent.');
    } catch (err) {
      setResendMsg(err.message);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-dark-shell theme-dark-canvas min-h-screen bg-deep text-on-background flex items-center justify-center p-6">
      <div className="glass-card max-w-md w-full p-8 rounded-2xl text-center space-y-4">
        <h1 className="text-xl font-bold text-white">Email verification</h1>
        <p className={`text-sm ${status === 'error' ? 'text-red-400' : 'text-on-surface-variant'}`}>
          {message}
        </p>

        {(status === 'pending' || status === 'error') && (
          <form onSubmit={resend} className="text-left space-y-2 border-t border-white/10 pt-4">
            <p className="text-xs text-white/50">Didn&apos;t get the email? Resend the link:</p>
            <input
              type="email"
              required
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 text-white text-xs"
            />
            {resendMsg && <p className="text-[11px] text-white/60">{resendMsg}</p>}
            <button
              type="submit"
              disabled={resending}
              className="w-full rounded-lg bg-primary text-on-primary text-xs font-bold py-2.5 disabled:opacity-60"
            >
              {resending ? 'Sending…' : 'Resend verification email'}
            </button>
          </form>
        )}

        <Link to="/login" className="inline-block text-primary hover:underline text-sm font-semibold">
          Go to sign in
        </Link>
      </div>
    </div>
  );
}
