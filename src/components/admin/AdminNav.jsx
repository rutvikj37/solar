import React from 'react';

/**
 * Left-rail navigation for the operator console.
 * Groups platform ops separately from the signed-in company workspace.
 */
export const ADMIN_NAV_GROUPS = [
  {
    label: 'Home',
    tabs: [{ id: 'dashboard', label: 'Dashboard', icon: 'dashboard' }],
  },
  {
    label: 'Marketplace ops',
    tabs: [{ id: 'marketplace', label: 'Marketplace', icon: 'storefront', badgeKey: 'pendingMarketplace' }],
  },
  {
    label: 'Users & billing',
    tabs: [
      { id: 'users', label: 'Users', icon: 'group' },
      { id: 'subscriptions', label: 'Subscriptions', icon: 'card_membership' },
      { id: 'plans', label: 'Plans', icon: 'sell' },
    ],
  },
  {
    label: 'Support',
    tabs: [
      { id: 'tickets', label: 'Tickets', icon: 'support_agent', badgeKey: 'openTickets' },
      { id: 'inquiries', label: 'Inquiries', icon: 'mail', badgeKey: 'inquiries' },
    ],
  },
  {
    label: 'Platform',
    tabs: [
      { id: 'apis', label: 'API health', icon: 'api' },
      { id: 'integrations', label: 'Integrations', icon: 'extension' },
      { id: 'audit', label: 'Audit log', icon: 'history' },
    ],
  },
  {
    label: 'Your company',
    hint: 'Signed-in account only',
    tabs: [
      { id: 'team', label: 'Team', icon: 'groups' },
      { id: 'territory', label: 'Territory', icon: 'analytics' },
    ],
  },
];

export const ADMIN_TABS = ADMIN_NAV_GROUPS.flatMap((g) => g.tabs);

export default function AdminNav({ activeTab, onSelect, badges = {} }) {
  return (
    <nav
      className="w-full lg:w-56 shrink-0 space-y-4 lg:sticky lg:top-4 lg:self-start"
      aria-label="Admin sections"
    >
      {ADMIN_NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <div className="flex items-baseline justify-between gap-2 px-2 mb-1.5">
            <p className="font-label-mono text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">
              {group.label}
            </p>
            {group.hint && (
              <span className="text-[9px] text-on-surface-variant/70 truncate">{group.hint}</span>
            )}
          </div>
          <ul className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
            {group.tabs.map((t) => {
              const active = activeTab === t.id;
              const badge = t.badgeKey ? Number(badges[t.badgeKey] || 0) : 0;
              return (
                <li key={t.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => onSelect(t.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-primary text-on-primary'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                    <span className="flex-1 text-left whitespace-nowrap">{t.label}</span>
                    {badge > 0 && (
                      <span
                        className={`min-w-[1.25rem] h-5 px-1.5 rounded-md text-[10px] font-bold tabular-nums flex items-center justify-center ${
                          active ? 'bg-black/20 text-on-primary' : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
