import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../../config.js';

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
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setMessage(data.message || 'If an account exists, a reset link was sent.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-deep text-on-background flex items-center justify-center p-6">
      <div className="glass-card max-w-md w-full p-8 rounded-2xl">
        <h1 className="text-xl font-bold text-white mb-2">Forgot password</h1>
        <p className="text-xs text-on-surface-variant mb-6">We will email a reset link if the account exists.</p>
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 text-white"
          />
          {error && <div className="text-red-400">{error}</div>}
          {message && <div className="text-green-400">{message}</div>}
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
