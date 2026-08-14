import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  getToken,
  isAdminRole,
  loadAuthSession,
  peekAuthSessionCache,
} from '../lib/auth.js';
import SatelliteUplinkLoader from './SatelliteUplinkLoader.jsx';

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const location = useLocation();
  const token = getToken();
  const [status, setStatus] = useState(() => {
    if (!token) return 'denied';
    const cached = peekAuthSessionCache(token);
    if (cached) {
      if (requireAdmin && !isAdminRole(cached.role)) return 'forbidden';
      return 'ok';
    }
    return 'loading';
  });

  useEffect(() => {
    const currentToken = getToken();
    if (!currentToken) {
      setStatus('denied');
      return;
    }

    const cached = peekAuthSessionCache(currentToken);
    if (cached) {
      setStatus(
        requireAdmin && !isAdminRole(cached.role) ? 'forbidden' : 'ok'
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
  }, [requireAdmin, location.pathname]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-deep">
        <SatelliteUplinkLoader visible />
      </div>
    );
  }

  if (status === 'denied') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (status === 'forbidden') {
    return <Navigate to="/dashboard" replace />;
  }

  return children ?? <Outlet />;
}
