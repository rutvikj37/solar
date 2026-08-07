import React from 'react';
import { Link } from 'react-router-dom';

export default function UpgradeModal({ open, onClose, credits = 0, message }) {
  if (!open) return null;

  const defaultMessage =
    credits <= 0
      ? "You've used your free credits. Subscribe to a monthly plan to keep generating leads."
      : 'You need more credits to continue. Subscribe to a monthly plan or wait for your next renewal.';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-card max-w-md w-full rounded-2xl border border-glass-stroke p-6 shadow-2xl bg-surface-elevated/95">
        <h3 className="text-lg font-bold text-white">Upgrade required</h3>
        <p className="mt-3 text-sm text-on-surface-variant leading-relaxed">
          {message || defaultMessage}
        </p>
        {credits > 0 && (
          <p className="mt-2 text-xs text-on-surface-variant">
            Current balance: <span className="text-primary font-semibold">{credits}</span> credits
          </p>
        )}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link
            to="/billing#plans"
            className="flex-1 text-center bg-primary text-on-primary font-bold py-2.5 rounded-lg text-xs hover:brightness-110"
          >
            View monthly plans
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-glass-stroke text-on-surface-variant font-semibold py-2.5 rounded-lg text-xs hover:bg-white/5"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
