import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../AppLayout';
import { fetchMe, isAdminRole } from '../../lib/auth.js';

function ComingSoonView() {
  return (
    <AppLayout>
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
    </AppLayout>
  );
}

/**
 * Gates all AI Calling pages: admins see the real feature; everyone else sees Coming Soon.
 */
export default function AiCallingAdminGate({ children }) {
  const [status, setStatus] = useState('loading'); // loading | admin | locked

  useEffect(() => {
    let cancelled = false;
    fetchMe().then((data) => {
      if (cancelled) return;
      const role = data?.user?.role || '';
      setStatus(isAdminRole(role) ? 'admin' : 'locked');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-deep flex items-center justify-center text-on-surface-variant text-sm">
        Loading…
      </div>
    );
  }

  if (status === 'locked') {
    return <ComingSoonView />;
  }

  return children;
}
