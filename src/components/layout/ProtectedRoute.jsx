import React, { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigationType } from 'react-router-dom';
import {
  AUTH_CHANGED_EVENT,
  clearAuthSessionCache,
  getToken,
  isAdminRole,
  isTokenValid,
  loadAuthSession,
  peekAuthSessionCache,
} from '../../lib/auth.js';
import SatelliteUplinkLoader from './SatelliteUplinkLoader.jsx';

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const location = useLocation();
  const navType = useNavigationType();
  const [authTick, setAuthTick] = useState(0);

  useEffect(() => {
    const bump = () => setAuthTick((n) => n + 1);
    const onPageShow = (event) => {
      if (event.persisted) clearAuthSessionCache();
      bump();
    };
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('popstate', bump);
    window.addEventListener(AUTH_CHANGED_EVENT, bump);
    window.addEventListener('storage', bump);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('popstate', bump);
      window.removeEventListener(AUTH_CHANGED_EVENT, bump);
      window.removeEventListener('storage', bump);
    };
  }, []);

  const tokenOk = isTokenValid();
  const token = getToken();
  const [status, setStatus] = useState(() => {
    if (!tokenOk) return 'denied';
    const cached = peekAuthSessionCache(token);
    if (cached) {
      if (requireAdmin && !isAdminRole(cached.role)) return 'forbidden';
      return 'ok';
    }
    return 'loading';
  });

  useEffect(() => {
    const currentToken = getToken();
    if (!currentToken || !isTokenValid(currentToken)) {
      setStatus('denied');
      return;
    }

    const skipNetwork = navType !== 'POP' && peekAuthSessionCache(currentToken);
    if (skipNetwork) {
      setStatus(
        requireAdmin && !isAdminRole(skipNetwork.role) ? 'forbidden' : 'ok'
      );
      return;
    }

    let cancelled = false;
    let retryTimer = null;
    // Background re-checks keep the current screen instead of flashing the loader.
    setStatus((prev) => (prev === 'ok' || prev === 'reconnecting' ? prev : 'loading'));
    loadAuthSession().then((session) => {
      if (cancelled) return;
      if (!session) {
        setStatus('denied');
        return;
      }
      if (session.transient) {
        setStatus('reconnecting');
        retryTimer = setTimeout(() => setAuthTick((n) => n + 1), 15000);
        return;
      }
      setStatus(
        requireAdmin && !isAdminRole(session.role) ? 'forbidden' : 'ok'
      );
    });

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [requireAdmin, location.pathname, location.key, navType, authTick]);

  if (!tokenOk || status === 'denied') {
    const next = `${location.pathname}${location.search || ''}`;
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(next)}`}
        replace
        state={{ from: '/for-installers' }}
      />
    );
  }

  if (status === 'reconnecting') {
    const retry = () => setAuthTick((n) => n + 1);
    if (requireAdmin) {
      return (
        <div className="min-h-screen bg-deep flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-glass-stroke bg-surface-elevated/95 p-8 text-center space-y-4">
            <h1 className="text-xl font-bold text-white">Reconnecting…</h1>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              We couldn&apos;t reach the server to confirm your session. You are still signed in.
            </p>
            <button
              type="button"
              onClick={retry}
              className="px-4 py-2.5 rounded-lg bg-primary text-on-primary text-xs font-bold"
            >
              Retry now
            </button>
          </div>
        </div>
      );
    }
    return (
      <>
        <div
          role="status"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[1000] px-4 py-2 rounded-lg bg-amber-500 text-black text-xs font-semibold shadow-lg flex items-center gap-3"
        >
          <span>Connection issue — reconnecting…</span>
          <button type="button" onClick={retry} className="underline font-bold">
            Retry
          </button>
        </div>
        {children ?? <Outlet />}
      </>
    );
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-deep">
        <SatelliteUplinkLoader visible />
      </div>
    );
  }

  if (status === 'forbidden') {
    return (
      <div className="min-h-screen bg-deep flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-glass-stroke bg-surface-elevated/95 p-8 text-center space-y-4">
          <span className="material-symbols-outlined text-5xl text-amber-400">admin_panel_settings</span>
          <h1 className="text-xl font-bold text-white">Admin access required</h1>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Marketplace approvals and the operator console are only available to admin accounts.
            Ask your platform owner to set your user role to <strong className="text-white">admin</strong>, then
            log out and log back in.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              to="/dashboard"
              className="px-4 py-2.5 rounded-lg bg-primary text-on-primary text-xs font-bold"
            >
              Back to dashboard
            </Link>
            <Link
              to="/marketplace"
              className="px-4 py-2.5 rounded-lg border border-glass-stroke text-xs font-semibold text-slate-200 hover:bg-white/5"
            >
              Installer marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return children ?? <Outlet />;
}
