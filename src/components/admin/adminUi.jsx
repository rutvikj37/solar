import React from 'react';

/** Human-readable admin role labels */
export const ROLE_LABELS = {
  solar_company: 'Company user',
  admin: 'Admin',
  platform_admin: 'Platform admin',
  super_admin: 'Super admin',
};

export function roleLabel(role) {
  return ROLE_LABELS[role] || role || 'Company user';
}

export function AdminPageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="font-label-mono text-[9px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">
            {eyebrow}
          </p>
        )}
        <h3 className="text-lg font-bold text-on-surface">{title}</h3>
        {description && (
          <p className="text-xs text-on-surface-variant mt-1 max-w-2xl">{description}</p>
        )}
      </div>
      {actions ? <div className="flex flex-wrap gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}

export function AdminEmptyState({ icon = 'inbox', title, description, action }) {
  return (
    <div className="rounded-xl border border-dashed border-glass-stroke bg-surface-container-low/40 px-6 py-12 text-center">
      <span className="material-symbols-outlined text-3xl text-on-surface-variant/60">{icon}</span>
      <p className="mt-3 text-sm font-semibold text-on-surface">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-on-surface-variant max-w-sm mx-auto">{description}</p>
      )}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function AdminSectionCard({ title, hint, children, className = '' }) {
  return (
    <div className={`rounded-xl border border-glass-stroke bg-surface-container-low/50 p-4 space-y-3 ${className}`}>
      {(title || hint) && (
        <div>
          {title && (
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
              {title}
            </p>
          )}
          {hint && <p className="text-[11px] text-on-surface-variant/80 mt-0.5">{hint}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatusPill({ status, tone }) {
  const s = String(status || '').toLowerCase();
  let classes = 'bg-white/5 text-on-surface-variant border-white/10';
  if (tone === 'success' || s === 'active' || s === 'paid' || s === 'resolved') {
    classes = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  } else if (tone === 'danger' || s === 'suspended' || s === 'closed' || s === 'failed') {
    classes = 'bg-red-500/15 text-red-300 border-red-500/30';
  } else if (
    tone === 'warn' ||
    s === 'restricted' ||
    s === 'pending' ||
    s === 'open' ||
    s === 'in_progress' ||
    s === 'past_due'
  ) {
    classes = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide ${classes}`}
    >
      {status || '—'}
    </span>
  );
}

export function QueueCard({ icon, label, value, hint, onClick, accent = 'primary' }) {
  const accents = {
    primary: 'hover:border-primary/40',
    amber: 'hover:border-amber-400/40',
    emerald: 'hover:border-emerald-400/40',
    red: 'hover:border-red-400/40',
  };
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`glass-card p-4 rounded-xl text-left w-full transition-colors border border-transparent ${
        onClick ? `cursor-pointer ${accents[accent] || accents.primary}` : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-label-mono text-[9px] text-on-surface-variant uppercase">{label}</p>
        <span className="material-symbols-outlined text-base text-on-surface-variant">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-on-surface mt-1.5 font-mono tabular-nums">{value ?? '—'}</p>
      {hint && <p className="text-[10px] text-on-surface-variant mt-1.5">{hint}</p>}
    </Comp>
  );
}

const ACTION_LABELS = {
  user_role_change: 'Changed user role',
  user_status_change: 'Changed account status',
  user_password_reset: 'Reset password',
  user_credits_adjust: 'Adjusted credits',
  user_plan_grant: 'Granted plan',
  user_plan_restrict: 'Restricted plan',
  user_plan_unrestrict: 'Lifted plan restriction',
  marketplace_lead_approve: 'Approved marketplace lead',
  marketplace_lead_bulk_approve: 'Bulk-approved leads',
  marketplace_installer_verify: 'Verified installer',
  marketplace_wallet_adjust: 'Adjusted bid wallet',
  marketplace_dispute_review: 'Reviewed claim',
};

export function formatAuditAction(action) {
  if (!action) return '—';
  return ACTION_LABELS[action] || String(action).replace(/_/g, ' ');
}

/** Turn audit details JSON into a short readable line */
export function formatAuditDetails(details) {
  if (details == null) return '—';
  let obj = details;
  if (typeof details === 'string') {
    try {
      obj = JSON.parse(details);
    } catch {
      return details;
    }
  }
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    return String(obj);
  }
  const parts = [];
  const pick = [
    'role',
    'from',
    'to',
    'status',
    'mode',
    'amount',
    'packageId',
    'note',
    'email',
    'leadCode',
    'count',
  ];
  for (const key of pick) {
    if (obj[key] != null && obj[key] !== '') {
      parts.push(`${key}: ${obj[key]}`);
    }
  }
  if (parts.length) return parts.join(' · ');
  const keys = Object.keys(obj).slice(0, 4);
  if (!keys.length) return '—';
  return keys.map((k) => `${k}: ${JSON.stringify(obj[k])}`).join(' · ');
}

export function confirmDanger(message) {
  return window.confirm(message);
}
