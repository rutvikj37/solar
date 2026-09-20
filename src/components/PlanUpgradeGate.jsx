import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Upgrade wall when a plan feature is locked.
 */
export default function PlanUpgradeGate({
  title = 'Upgrade required',
  message,
  feature,
  packageName,
  className = '',
}) {
  return (
    <div
      className={`rounded-2xl border border-primary/25 bg-primary/5 p-6 sm:p-8 text-center space-y-3 ${className}`}
    >
      <span className="material-symbols-outlined text-4xl text-primary">workspace_premium</span>
      <h2 className="text-lg font-bold text-on-surface">{title}</h2>
      <p className="text-sm text-on-surface-variant max-w-md mx-auto leading-relaxed">
        {message ||
          `This feature is not included in your current plan${packageName ? ` (${packageName})` : ''}.`}
      </p>
      {feature ? (
        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/70 font-semibold">
          Feature: {feature}
        </p>
      ) : null}
      <Link
        to="/billing#plans"
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-on-primary text-xs font-bold px-5 py-2.5 hover:brightness-110"
      >
        View Founding Launch Plans
      </Link>
    </div>
  );
}
