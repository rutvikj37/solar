import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { isAdminRole } from '../../lib/auth.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTaskSummary } from '../../lib/tasks.js';

const EXPANDED_WIDTH = 260;
const COLLAPSED_WIDTH = 72;

export default function Sidebar({
  mobileOpen = false,
  onMobileClose,
  collapsed = false,
  showBanner,
}) {
  const { user, plan, can, entitlements, unlimitedCredits } = useAuth();
  const taskSummary = useTaskSummary();
  const overdueTasks = Number(taskSummary?.overdue) || 0;
  const dueTodayTasks = Number(taskSummary?.dueToday) || 0;
  const taskHint = overdueTasks
    ? `${overdueTasks} overdue`
    : dueTodayTasks
      ? `${dueTodayTasks} due today`
      : 'Follow-up queue';
  const userRole = user?.role || '';
  const leadsCount = null;
  const isAdmin = isAdminRole(userRole);

  // Only show for finite plan limits (Scout/Pioneer/Mission Control). Hide for admin/unlimited (MAX_SAFE_INTEGER).
  const dripAutomationLimit = Number(entitlements?.limits?.emailAutomationLimit);
  const dripAutomationHint =
    !unlimitedCredits &&
    !entitlements?.unlimited &&
    Number.isFinite(dripAutomationLimit) &&
    dripAutomationLimit > 0 &&
    dripAutomationLimit < 10000
      ? `Up to ${dripAutomationLimit} automations`
      : undefined;

  const handleMobileClose = () => {
    if (typeof onMobileClose === 'function') onMobileClose();
  };

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && typeof onMobileClose === 'function') onMobileClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, onMobileClose]);

  const menuCategories = [
    {
      title: 'OVERVIEW',
      items: [{ name: 'Overview', path: '/dashboard', icon: 'dashboard', tourId: 'tour-nav-overview' }],
    },
    {
      title: 'DISCOVER',
      items: [
        { name: 'Targeting', path: '/map', icon: 'radar', tourId: 'tour-nav-map' },
        { name: 'Bulk Scan', path: '/bulk-scan', icon: 'layers', tourId: 'tour-nav-bulk-scan' },
      ],
    },
    {
      title: 'PIPELINE',
      items: [
        {
          name: 'Marketplace',
          path: '/marketplace',
          icon: 'storefront',
          locked: !can('marketplace'),
          lockHint: 'Pioneer+',
          tourId: 'tour-nav-marketplace',
        },
        { name: 'Leads CRM', path: '/my-leads', icon: 'assignment', tourId: 'tour-nav-leads' },
        {
          name: 'Tasks',
          path: '/tasks',
          icon: 'task_alt',
          hint: taskHint,
          badge: overdueTasks > 0 ? String(overdueTasks) : undefined,
        },
        { name: 'Inbox', path: '/inbox', icon: 'inbox', hint: 'Lead email replies' },
        { name: 'Reports', path: '/reports', icon: 'analytics' },
        {
          name: 'Integrations',
          path: '/integrations',
          icon: 'alternate_email',
          hint: 'Connect your email',
        },
        {
          name: 'Drip Workflows',
          path: '/drip',
          icon: 'campaign',
          hint: dripAutomationHint,
        },
        {
          name: 'Appointments',
          path: '/appointments',
          icon: 'calendar_today',
          locked: !can('appointments'),
          lockHint: 'Mission Control',
          tourId: 'tour-nav-appointments',
        },
      ],
    },
    ...(isAdmin
      ? [
          {
            title: 'ADMIN',
            items: [
              { name: 'Admin Console', path: '/admin', icon: 'admin_panel_settings', badge: 'Operator' },
              {
                name: 'Marketplace Approvals',
                path: '/admin?tab=marketplace&mkt=leads',
                icon: 'fact_check',
                hint: 'Review homeowner forms',
              },
              {
                name: 'Users & Billing',
                path: '/admin?tab=users',
                icon: 'group',
              },
              {
                name: 'Support Tickets',
                path: '/admin?tab=tickets',
                icon: 'support_agent',
              },
            ],
          },
        ]
      : []),
    {
      title: 'ACCOUNT',
      items: [
        { name: 'Team', path: '/team', icon: 'group' },
        { name: 'Billing', path: '/billing', icon: 'receipt_long', tourId: 'tour-nav-billing' },
        { name: 'Support', path: '/support', icon: 'support_agent' },
        {
          name: 'Getting Started',
          action: 'help',
          icon: 'school',
          tourId: 'tour-nav-help',
          hint: 'Tutorial & checklist',
        },
        {
          name: 'Export CSV',
          action: 'export',
          icon: 'download',
          locked: !can('csvExport'),
          lockHint: 'Scout+',
        },
      ],
    },
  ];

  const handleAction = (actionName) => {
    handleMobileClose();
    if (actionName === 'help') {
      window.dispatchEvent(new CustomEvent('str:open-getting-started'));
      return;
    }
    if (actionName === 'export') {
      if (!can('csvExport')) {
        window.location.href = '/billing#plans';
        return;
      }
      if (typeof window.exportCSV === 'function') {
        window.exportCSV();
      } else {
        import('../../lib/downloadLeadsCsv.js')
          .then(({ downloadLeadsCsv }) => downloadLeadsCsv())
          .catch(() => alert('Export failed'));
      }
    }
  };

  const topStyle = showBanner ? 'top-[100px]' : 'top-[64px]';
  const heightStyle = showBanner ? 'h-[calc(100vh-100px)]' : 'h-[calc(100vh-64px)]';

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${topStyle} ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleMobileClose}
        aria-hidden={!mobileOpen}
      />

      <aside
        id="app-sidebar-nav"
        aria-label="App navigation"
        data-collapsed={collapsed ? 'true' : 'false'}
        style={{
          ['--sidebar-w']: `${collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH}px`,
        }}
        className={`app-sidebar z-50 flex flex-col bg-deep/95 backdrop-blur-xl border-r border-glass-stroke transition-[transform,width] duration-300 ease-out
          w-[260px] lg:w-[var(--sidebar-w)] lg:shrink-0
          fixed left-0 ${topStyle} ${heightStyle}
          ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
          lg:sticky lg:self-start lg:translate-x-0 lg:shadow-none
          ${collapsed ? 'lg:p-2.5' : 'p-5 lg:p-3'}
        `}
      >
        {/* Mobile header */}
        <div className="flex justify-between items-center mb-4 lg:hidden pb-2 border-b border-glass-stroke">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Navigation</span>
          <button
            type="button"
            className="text-slate-400 hover:text-on-surface p-1 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            onClick={handleMobileClose}
            aria-label="Close navigation"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <nav className="flex-grow space-y-5 overflow-y-auto overflow-x-hidden custom-scrollbar pr-0.5" aria-label="Primary">
          {menuCategories.map((category) => (
            <div key={category.title} className="space-y-1 text-left">
              <h4
                className={`text-[9px] font-bold text-slate-500 uppercase tracking-widest select-none transition-all duration-300 ${
                  collapsed
                    ? 'px-3 lg:opacity-0 lg:h-0 lg:m-0 lg:overflow-hidden lg:px-0'
                    : 'px-3'
                }`}
              >
                {category.title}
              </h4>
              <div className="space-y-0.5">
                {category.items.map((item) => {
                  const tooltip = item.locked
                    ? `${item.name} — ${item.lockHint || 'Upgrade required'}`
                    : collapsed && item.hint
                      ? `${item.name} — ${item.hint}`
                      : collapsed
                        ? item.name
                        : undefined;

                  if (item.path) {
                    const tourAttr = item.tourId ? { 'data-tour': item.tourId } : {};
                    return (
                      <NavLink
                        key={item.name}
                        to={item.locked ? '/billing#plans' : item.path}
                        title={tooltip}
                        onClick={handleMobileClose}
                        {...tourAttr}
                        className={({ isActive }) =>
                          `relative group flex items-center rounded-lg text-xs font-semibold transition-all active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary ${
                            collapsed
                              ? 'lg:justify-center lg:px-0 lg:py-2.5 lg:mx-auto lg:w-11'
                              : 'gap-3 px-4 py-2'
                          } ${
                            item.locked
                              ? 'text-on-surface-variant/50 hover:text-on-surface-variant hover:bg-white/5'
                              : isActive
                                ? 'text-primary bg-primary/10'
                                : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && !item.locked && (
                              <div
                                className={`absolute left-0 top-1 bottom-1 w-[3px] bg-primary rounded-r-md ${
                                  collapsed ? 'lg:left-0.5' : ''
                                }`}
                              />
                            )}
                            <span
                              className={`material-symbols-outlined text-base shrink-0 ${
                                item.locked
                                  ? 'text-on-surface-variant/40'
                                  : isActive
                                    ? 'text-primary'
                                    : 'text-on-surface-variant group-hover:text-on-surface'
                              }`}
                            >
                              {item.locked ? 'lock' : item.icon}
                            </span>
                            <span
                              className={`flex-1 min-w-0 text-left transition-opacity duration-200 ${
                                collapsed ? 'lg:hidden' : ''
                              }`}
                            >
                              <span className="block truncate">{item.name}</span>
                              {(item.hint || item.lockHint) && (
                                <span className="block text-[9px] font-medium text-slate-500 truncate mt-0.5">
                                  {item.locked ? item.lockHint : item.hint}
                                </span>
                              )}
                            </span>
                            {item.name === 'Lead Manager' && leadsCount != null && (
                              <span
                                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                                  collapsed ? 'lg:hidden' : ''
                                } ${
                                  isActive ? 'bg-primary/20 text-primary' : 'bg-white/5 text-slate-400'
                                }`}
                              >
                                {leadsCount}
                              </span>
                            )}
                            {item.badge && (
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase border ${
                                  collapsed ? 'lg:hidden' : ''
                                } ${
                                  item.badge === 'Soon'
                                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                    : 'bg-red-500/20 text-red-400 border-red-500/30'
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    );
                  }

                  return (
                    <button
                      key={item.name}
                      type="button"
                      title={tooltip}
                      data-tour={item.tourId || undefined}
                      onClick={() => handleAction(item.action)}
                      className={`w-full flex items-center rounded-lg text-xs font-semibold transition-all active:scale-[0.98] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                        item.locked
                          ? 'text-on-surface-variant/50 hover:bg-white/5'
                          : 'text-slate-300 hover:text-on-surface hover:bg-white/5'
                      } ${
                        collapsed
                          ? 'lg:justify-center lg:px-0 lg:py-2.5 lg:mx-auto lg:w-11'
                          : 'gap-3 px-4 py-2'
                      }`}
                    >
                      <span className="material-symbols-outlined text-base text-slate-400 shrink-0">
                        {item.locked ? 'lock' : item.icon}
                      </span>
                      <span className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
                        <span className="block truncate">{item.name}</span>
                        {item.hint && (
                          <span className={`block text-[9px] font-medium text-slate-500 truncate mt-0.5 ${collapsed ? 'lg:hidden' : ''}`}>
                            {item.hint}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Active Plan & Quotas Footer Widget */}
        <div className={`mt-auto pt-3 border-t border-glass-stroke/60 ${collapsed ? 'px-1 py-2 text-center' : 'px-2 pb-1'}`}>
          {!collapsed ? (
            <div className="p-3 rounded-xl bg-surface-container-low/80 border border-glass-stroke space-y-2">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5 truncate">
                  <span className="material-symbols-outlined text-[15px] text-primary shrink-0">verified</span>
                  <span className="truncate">{plan.planName}</span>
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold shrink-0 uppercase">
                  {plan.statusLabel}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-on-surface-variant text-[11px]">Credit Balance</span>
                <span className="font-mono font-bold text-on-surface">
                  {plan.creditsLabel}
                </span>
              </div>
              <NavLink
                to="/billing"
                onClick={handleMobileClose}
                className="w-full py-1.5 px-2 rounded-lg bg-white/5 hover:bg-primary hover:text-on-primary text-primary text-[11px] font-semibold flex items-center justify-center gap-1 transition-all active:scale-95 group shadow-xs"
              >
                <span>Plan Details & Quotas</span>
                <span className="material-symbols-outlined text-[13px] group-hover:translate-x-0.5 transition-transform">
                  arrow_forward
                </span>
              </NavLink>
            </div>
          ) : (
            <NavLink
              to="/billing"
              title={`Active Plan: ${plan.planName} (${plan.unlimited ? 'unlimited' : plan.creditsLabel} credits)`}
              className="w-10 h-10 mx-auto rounded-xl bg-surface-container-low border border-glass-stroke hover:border-primary/50 text-primary flex items-center justify-center transition active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">verified</span>
            </NavLink>
          )}
        </div>
      </aside>
    </>
  );
}

export { EXPANDED_WIDTH, COLLAPSED_WIDTH };
