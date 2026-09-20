import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { ensureFirebaseAuth } from '../../lib/firebase.js';
import { BRAND_NAME } from '../../config/brand.js';

/**
 * Firebase email Action URL handler for your own domain.
 * Paste this in Firebase Console → Authentication → Templates → Action URL:
 *   https://spacetoroof.com/auth/action
 *
 * Firebase redirects here with ?mode=&oobCode=&apiKey=&continueUrl=
 */
export default function FirebaseAuthActionPage() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || '';
  const oobCode = searchParams.get('oobCode') || '';
  const continueUrl = searchParams.get('continueUrl') || '/login';

  const [status, setStatus] = useState('loading'); // loading | form | success | error
  const [message, setMessage] = useState('Checking link…');
  const [formError, setFormError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const safeContinue = useMemo(() => {
    try {
      if (continueUrl.startsWith('/')) return continueUrl;
      const u = new URL(continueUrl);
      if (u.hostname.endsWith('spacetoroof.com') || u.hostname === 'localhost') {
        return `${u.pathname}${u.search}${u.hash}` || '/login';
      }
    } catch {
      /* ignore */
    }
    return '/login';
  }, [continueUrl]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!oobCode || !mode) {
        setStatus('error');
        setMessage('Invalid or incomplete action link.');
        return;
      }

      try {
        const auth = await ensureFirebaseAuth();

        if (mode === 'resetPassword') {
          const mail = await verifyPasswordResetCode(auth, oobCode);
          if (cancelled) return;
          setEmail(mail || '');
          setStatus('form');
          setMessage('Choose a new password for your account.');
          return;
        }

        if (mode === 'verifyEmail' || mode === 'recoverEmail') {
          await applyActionCode(auth, oobCode);
          if (cancelled) return;
          setStatus('success');
          setMessage(
            mode === 'verifyEmail'
              ? 'Email verified successfully. You can sign in now.'
              : 'Email address recovered successfully.',
          );
          return;
        }

        // Fallback: inspect code to show a clear message
        const info = await checkActionCode(auth, oobCode);
        if (cancelled) return;
        setStatus('error');
        setMessage(
          `Unsupported action (${info?.operation || mode}). Open the latest link from your email.`,
        );
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setMessage(err?.message || 'This link is invalid or has expired.');
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [mode, oobCode]);

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setFormError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const auth = await ensureFirebaseAuth();
      await confirmPasswordReset(auth, oobCode, password);
      setStatus('success');
      setMessage('Password updated. You can sign in with your new password.');
    } catch (err) {
      setFormError(err?.message || 'Could not update password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-dark-shell theme-dark-canvas min-h-screen bg-deep text-on-background flex items-center justify-center p-6">
      <div className="glass-card max-w-md w-full p-8 rounded-2xl border border-glass-stroke">
        <div className="mb-6 text-center">
          <div className="font-display text-xl font-semibold tracking-tight">
            <span className="text-on-surface">{BRAND_NAME}</span>
            <span className="text-primary-glow">.com</span>
          </div>
          <p className="text-xs text-on-surface-variant mt-2">Account security</p>
        </div>

        {status === 'loading' && (
          <p className="text-sm text-on-surface-variant text-center">{message}</p>
        )}

        {status === 'form' && (
          <form onSubmit={handleResetSubmit} className="space-y-4 text-xs">
            <p className="text-sm text-on-surface-variant">{message}</p>
            {email ? (
              <p className="text-[11px] text-on-surface-variant">
                Account: <span className="text-white">{email}</span>
              </p>
            ) : null}
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
            {formError ? <div className="text-red-400">{formError}</div> : null}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-on-primary font-bold py-3 rounded-lg disabled:opacity-60"
            >
              {submitting ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}

        {status === 'success' && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-emerald-400">{message}</p>
            <Link
              to={safeContinue}
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary py-3 text-xs font-bold text-on-primary"
            >
              Continue to sign in
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-red-400">{message}</p>
            <Link to="/login" className="text-xs text-primary hover:underline">
              Back to login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
