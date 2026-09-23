import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { logoutToLogin } from '../../lib/auth.js';

export const ADMIN_NAV_GROUPS = [
  {
    label: 'Overview',
    tabs: [{ id: 'dashboard', label: 'Dashboard', icon: 'dashboard' }],
  },
  {
    label: 'Platform',
    tabs: [
      { id: 'users', label: 'Users', icon: 'group' },
      { id: 'subscriptions', label: 'Subscriptions', icon: 'credit_card' },
      { id: 'plans', label: 'Plans', icon: 'package_2' },
    ],
  },
  {
    label: 'Marketplace',
    tabs: [
      { id: 'marketplace', label: 'Marketplace', icon: 'storefront', badgeKey: 'pendingMarketplace' },
    ],
  },
  {
    label: 'Support',
    tabs: [
      { id: 'tickets', label: 'Tickets', icon: 'support_agent', badgeKey: 'openTickets' },
      { id: 'inquiries', label: 'Inquiries', icon: 'contact_support', badgeKey: 'inquiries' },
    ],
  },
  {
    label: 'System',
    tabs: [
      { id: 'apis', label: 'API Health', icon: 'monitoring' },
      { id: 'integrations', label: 'Integrations', icon: 'extension' },
      { id: 'audit', label: 'Audit Log', icon: 'security' },
    ],
  },
  {
    label: 'Your Company',
    hint: 'Account context',
    tabs: [
      { id: 'team', label: 'Team', icon: 'groups' },
      { id: 'territory', label: 'Territory', icon: 'analytics' },
    ],
  },
];

export const ADMIN_TABS = ADMIN_NAV_GROUPS.flatMap((g) => g.tabs);

export default function AdminNav({
  activeTab,
  onSelect,
  badges = {},
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile,
}) {
  const { user } = useAuth();
  const userName = user?.name || user?.email?.split('@')[0] || 'Admin';
  const userEmail = user?.email || 'admin@spacetoroof.com';
  const userRole = (user?.role || 'admin').replace('_', ' ');

  const getInitials = (name) => {
    if (!name) return 'AD';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const navContent = (
    <div className="flex flex-col h-full justify-between">
      <div className="flex flex-col h-full min-h-0">
        {/* Workspace Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.08] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
              S
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-xs tracking-tight text-slate-900 dark:text-white truncate">
                  SPACETOROOF
                </span>
                <span className="font-mono text-[10px] text-slate-400 font-medium">
                  Operator • v4.18.2
                </span>
              </div>
            )}
          </div>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <span className="material-symbols-outlined text-[18px]">
                {collapsed ? 'dock_to_right' : 'dock_to_left'}
              </span>
            </button>
          )}
        </div>

        {/* Navigation Tree */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 text-xs">
          {ADMIN_NAV_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1">
              {!collapsed && (
                <div className="flex items-center justify-between px-3 pb-1">
                  <span className="font-mono text-[10px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                    {group.label}
                  </span>
                  {group.hint && (
                    <span className="text-[9px] text-slate-400/80 dark:text-slate-500/80">
                      {group.hint}
                    </span>
                  )}
                </div>
              )}
              <div className="space-y-0.5">
                {group.tabs.map((t) => {
                  const active = activeTab === t.id;
                  const badge = t.badgeKey ? Number(badges[t.badgeKey] || 0) : 0;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onSelect(t.id);
                        if (onCloseMobile) onCloseMobile();
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        active
                          ? 'bg-blue-50 dark:bg-blue-600/15 text-blue-600 dark:text-blue-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                      } ${collapsed ? 'justify-center px-2' : ''}`}
                      title={collapsed ? t.label : undefined}
                    >
                      <span className={`material-symbols-outlined text-[19px] shrink-0 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                        {t.icon}
                      </span>
                      {!collapsed && (
                        <span className="flex-1 text-left truncate">{t.label}</span>
                      )}
                      {!collapsed && badge > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full font-mono text-[10px] font-bold bg-amber-500/15 text-amber-500 dark:text-amber-300">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* User Footer Profile */}
        <div className="p-3 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-black/20 shrink-0">
          <div className="flex items-center justify-between p-2 rounded-xl hover:bg-white dark:hover:bg-white/5 transition border border-transparent hover:border-slate-200 dark:hover:border-white/10 group">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 ring-2 ring-blue-500/20">
                {getInitials(userName)}
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                    {userName}
                  </span>
                  <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 uppercase font-medium truncate">
                    {userRole}
                  </span>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                type="button"
                onClick={() => logoutToLogin()}
                className="text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition"
                title="Sign Out"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed left-0 top-0 h-screen bg-white dark:bg-[#111622] border-r border-slate-200/80 dark:border-white/[0.08] z-50 transition-all duration-200 ${
          collapsed ? 'w-18' : 'w-64'
        }`}
      >
        {navContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-[#111622] shadow-2xl">
            <div className="absolute top-3 right-3">
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
