import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { API_BASE } from '../../config.js';

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
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Reset failed');
      setMessage(data.message || 'Password updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-deep flex items-center justify-center p-6 text-red-400">
        Invalid reset link. <Link to="/forgot-password" className="text-primary ml-2">Request a new one</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-deep text-on-background flex items-center justify-center p-6">
      <div className="glass-card max-w-md w-full p-8 rounded-2xl">
        <h1 className="text-xl font-bold text-white mb-6">Set new password</h1>
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 text-white"
          />
          <input
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm password"
            className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 text-white"
          />
          {error && <div className="text-red-400">{error}</div>}
          {message && <div className="text-green-400">{message}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-on-primary font-bold py-3 rounded-lg disabled:opacity-60"
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
        <p className="text-center mt-6 text-xs">
          <Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
