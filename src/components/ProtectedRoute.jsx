import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigationType } from 'react-router-dom';
import {
  AUTH_CHANGED_EVENT,
  clearAuthSessionCache,
  getToken,
  isAdminRole,
  isTokenValid,
  loadAuthSession,
  peekAuthSessionCache,
} from '../lib/auth.js';
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
    setStatus('loading');
    loadAuthSession().then((session) => {
      if (cancelled) return;
      if (!session) {
        setStatus('denied');
        return;
      }
      setStatus(
        requireAdmin && !isAdminRole(session.role) ? 'forbidden' : 'ok'
      );
    });

    return () => {
      cancelled = true;
    };
  }, [requireAdmin, location.pathname, location.key, navType, authTick]);

  if (!tokenOk || status === 'denied') {
    return <Navigate to="/login" replace />;
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-deep">
        <SatelliteUplinkLoader visible />
      </div>
    );
  }

  if (status === 'forbidden') {
    return <Navigate to="/dashboard" replace />;
  }

  return children ?? <Outlet />;
}
