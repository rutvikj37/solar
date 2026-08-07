import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getToken, fetchMe, isAdminRole } from '../lib/auth.js';
import SatelliteUplinkLoader from './SatelliteUplinkLoader.jsx';

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const location = useLocation();
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setStatus('denied');
      return;
    }

    let cancelled = false;
    fetchMe().then((data) => {
      if (cancelled) return;
      if (!data) {
        setStatus('denied');
        return;
      }
      if (requireAdmin && !isAdminRole(data.user?.role)) {
        setStatus('forbidden');
        return;
      }
      setStatus('ok');
    });

    return () => {
      cancelled = true;
    };
  }, [location.pathname, requireAdmin]);

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

  return children;
}
