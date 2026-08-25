import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { API_BASE } from '../../config.js';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('Verifying your email…');

  useEffect(() => {
    if (searchParams.get('pending') === '1') {
      setStatus('pending');
      setMessage('Check your email for a verification link, then sign in.');
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

  return (
    <div className="min-h-screen bg-deep text-on-background flex items-center justify-center p-6">
      <div className="glass-card max-w-md w-full p-8 rounded-2xl text-center">
        <h1 className="text-xl font-bold text-white mb-4">Email verification</h1>
        <p className={`text-sm mb-6 ${status === 'error' ? 'text-red-400' : 'text-on-surface-variant'}`}>
          {message}
        </p>
        <Link to="/login" className="text-primary hover:underline text-sm font-semibold">
          Go to sign in
        </Link>
      </div>
    </div>
  );
}
