import React from 'react';
import { Link } from 'react-router-dom';
import AppLayout from './AppLayout';

/**
 * Soft-locks the Automation (/bulk-scan) feature until it is ready to ship.
 * Route stays registered; BulkAreaScan is preserved for later re-enable.
 */
export default function AutomationComingSoon() {
  return (
    <AppLayout>
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl text-primary">offline_bolt</span>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Automation</p>
            <h1 className="text-2xl font-bold text-on-surface">Coming Soon</h1>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Automation is coming soon
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
