import React, { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { fetchMe, isAdminRole, peekAuthSessionCache, getToken } from '../../lib/auth.js';

function ComingSoonView() {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl text-primary">smart_toy</span>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">AI Voice Calling</p>
          <h1 className="text-2xl font-bold text-on-surface">Coming Soon</h1>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            This feature is currently available to admins only. We&apos;re finishing polish before opening it to all users.
          </p>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:brightness-110 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

/**
 * Gates all AI Calling pages: admins see the real feature; everyone else sees Coming Soon.
 * Must sit inside the authenticated AppLayout route (uses Outlet).
 */
export default function AiCallingAdminGate() {
  const cached = peekAuthSessionCache(getToken());
  const [status, setStatus] = useState(() => {
    if (cached) return isAdminRole(cached.role) ? 'admin' : 'locked';
    return 'loading';
  });

  useEffect(() => {
    if (cached) {
      setStatus(isAdminRole(cached.role) ? 'admin' : 'locked');
      return;
    }
    let cancelled = false;
    fetchMe().then((data) => {
      if (cancelled) return;
      const role = data?.user?.role || '';
      setStatus(isAdminRole(role) ? 'admin' : 'locked');
    });
    return () => {
      cancelled = true;
    };
  }, [cached]);

  if (status === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center py-16 text-on-surface-variant text-sm">
        Loading…
      </div>
    );
  }

  if (status === 'locked') {
    return <ComingSoonView />;
  }

  return <Outlet />;
}
