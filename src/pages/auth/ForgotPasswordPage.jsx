import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../../config.js';

function friendlyAuthError(err, data, res) {
  if (data?.code === 'EMAIL_NOT_CONFIGURED') {
    return data.error || 'Password reset email is temporarily unavailable. Please try again later or contact support.';
  }
  if (res?.status === 429 || data?.error === 'Too many requests') {
    return 'Too many reset attempts. Please wait a few minutes and try again.';
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
      setMessage(data.message || 'If an account exists, a reset link was sent.');
    } catch (err) {
      setError(friendlyAuthError(err, err.data, err.res));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-dark-shell theme-dark-canvas min-h-screen bg-deep text-on-background flex items-center justify-center p-6">
      <div className="glass-card max-w-md w-full p-8 rounded-2xl">
        <h1 className="text-xl font-bold text-white mb-2">Forgot password</h1>
        <p className="text-xs text-on-surface-variant mb-6">We will email a reset link if the account exists.</p>
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 text-white"
          />
          {error && <div className="text-red-400" role="alert">{error}</div>}
          {message && <div className="text-green-400" role="status">{message}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-on-primary font-bold py-3 rounded-lg disabled:opacity-60"
          >
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
        <p className="text-center mt-6 text-xs">
          <Link to="/login" className="text-primary hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
