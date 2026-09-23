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
    <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
            {eyebrow}
          </p>
        )}
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h2>
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">{description}</p>
        )}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}

export function AdminEmptyState({ icon = 'inbox', title, description, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] px-6 py-12 text-center">
      <span className="material-symbols-outlined text-4xl text-slate-400 dark:text-slate-500">
        {icon}
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">{description}</p>
      )}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function AdminSectionCard({ title, hint, children, className = '' }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-[#121826] p-5 space-y-4 shadow-xs ${className}`}
    >
      {(title || hint) && (
        <div className="border-b border-slate-100 dark:border-white/[0.05] pb-3">
          {title && (
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {title}
            </p>
          )}
          {hint && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{hint}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Airy Metric Card based on Stitch Apex Console
 */
export function AdminKpiCard({
  label,
  value,
  trend,
  trendPositive = true,
  subtext,
  icon = 'analytics',
  iconColor = 'blue',
  sparkline = null,
}) {
  const iconBgMap = {
    blue: 'bg-blue-500/10 text-blue-500 dark:text-blue-400',
    emerald: 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-500 dark:text-amber-400',
    purple: 'bg-purple-500/10 text-purple-500 dark:text-purple-400',
    rose: 'bg-rose-500/10 text-rose-500 dark:text-rose-400',
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-white/[0.08] shadow-xs hover:border-slate-300 dark:hover:border-white/20 transition-all duration-200 flex flex-col justify-between group">
      <div>
        <div className="flex items-center justify-between pb-3">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {label}
          </span>
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${iconBgMap[iconColor] || iconBgMap.blue}`}>
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
          </div>
        </div>

        <div className="flex items-baseline gap-2.5">
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-heading tabular-nums">
            {value ?? '—'}
          </span>
          {trend && (
            <span
              className={`inline-flex items-center text-xs font-semibold ${
                trendPositive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">
                {trendPositive ? 'arrow_upward' : 'arrow_downward'}
              </span>
              {trend}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/[0.05] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{subtext || 'Live telemetry'}</span>
        {sparkline}
      </div>
    </div>
  );
}

/**
 * Operations Triage Queue Card based on Stitch Dashboard
 */
export function TriageQueueCard({
  icon,
  title,
  count = 0,
  urgentCount = 0,
  hint,
  actionLabel = 'Review',
  onClick,
  tone = 'blue',
}) {
  const toneGradients = {
    blue: 'border-blue-500/20 hover:border-blue-500/40 bg-gradient-to-br from-blue-500/[0.03] to-transparent',
    amber: 'border-amber-500/20 hover:border-amber-500/40 bg-gradient-to-br from-amber-500/[0.03] to-transparent',
    rose: 'border-rose-500/20 hover:border-rose-500/40 bg-gradient-to-br from-rose-500/[0.03] to-transparent',
    emerald: 'border-emerald-500/20 hover:border-emerald-500/40 bg-gradient-to-br from-emerald-500/[0.03] to-transparent',
  };

  const iconTones = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-5 rounded-2xl border text-left w-full transition-all duration-200 bg-white dark:bg-[#121826] shadow-xs flex flex-col justify-between group ${toneGradients[tone] || toneGradients.blue}`}
    >
      <div>
        <div className="flex items-center justify-between pb-2">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconTones[tone] || iconTones.blue}`}>
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
          </div>
          {urgentCount > 0 ? (
            <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400">
              {urgentCount} urgent
            </span>
          ) : count > 0 ? (
            <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400">
              {count} pending
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400">
              all clear
            </span>
          )}
        </div>

        <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {title}
        </h3>
        {hint && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{hint}</p>}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/[0.05] flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400">
        <span>{actionLabel}</span>
        <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">
          arrow_forward
        </span>
      </div>
    </button>
  );
}

/**
 * Slide-out inspection drawer (Stitch Alex Morgan / Detail style)
 */
export function DrawerSheet({ isOpen, onClose, title, subtitle, children, footer, maxWidth = 'max-w-xl' }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Content */}
      <div
        className={`relative w-full ${maxWidth} bg-white dark:bg-[#111827] border-l border-slate-200 dark:border-white/10 shadow-2xl flex flex-col h-full z-10 transition-transform`}
      >
        {/* Header */}
        <div className="h-16 px-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0">
          <div className="min-w-0 pr-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-white truncate">{title}</h3>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">{children}</div>

        {/* Optional Sticky Footer */}
        {footer && (
          <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function StatusPill({ status, tone }) {
  const s = String(status || '').toLowerCase();
  let classes = 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400 border-slate-200 dark:border-white/10';

  if (
    tone === 'success' ||
    s === 'active' ||
    s === 'paid' ||
    s === 'resolved' ||
    s === 'approved' ||
    s === 'operational'
  ) {
    classes = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25';
  } else if (
    tone === 'danger' ||
    s === 'suspended' ||
    s === 'closed' ||
    s === 'failed' ||
    s === 'rejected' ||
    s === 'outage'
  ) {
    classes = 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25';
  } else if (
    tone === 'warn' ||
    s === 'restricted' ||
    s === 'pending' ||
    s === 'open' ||
    s === 'in_progress' ||
    s === 'past_due' ||
    s === 'degraded'
  ) {
    classes = 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25';
  } else if (tone === 'info' || s === 'new' || s === 'ai_qualified') {
    classes = 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/25';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wider ${classes}`}
    >
      {status || '—'}
    </span>
  );
}

export function QueueCard({ icon, label, value, hint, onClick, accent = 'primary' }) {
  return (
    <TriageQueueCard
      icon={icon}
      title={label}
      count={value}
      hint={hint}
      onClick={onClick}
      tone={accent === 'primary' ? 'blue' : accent}
    />
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
