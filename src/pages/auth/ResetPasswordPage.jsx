import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { API_BASE } from '../../config.js';

function friendlyResetError(err, data, res) {
  if (res?.status === 429 || data?.error === 'Too many requests') {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  if (err?.message === 'Failed to fetch' || err?.name === 'TypeError') {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return data?.error || err?.message || 'Reset failed';
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      <div className="auth-dark-shell theme-dark-canvas min-h-screen bg-deep flex items-center justify-center p-6 text-red-400">
        Invalid reset link.{' '}
        <Link to="/forgot-password" className="text-primary ml-2">
          Request a new one
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-dark-shell theme-dark-canvas min-h-screen bg-deep text-on-background flex items-center justify-center p-6">
      <div className="glass-card max-w-md w-full p-8 rounded-2xl">
        <h1 className="text-xl font-bold text-white mb-6">Set new password</h1>
        {message ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-emerald-300" role="status">{message}</p>
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary text-on-primary font-bold py-3 text-xs"
            >
              Sign in now
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 text-white"
            />
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password"
              className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 text-white"
            />
            {error && <div className="text-red-400" role="alert">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-on-primary font-bold py-3 rounded-lg disabled:opacity-60"
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
        <p className="text-center mt-6 text-xs">
          <Link to="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
