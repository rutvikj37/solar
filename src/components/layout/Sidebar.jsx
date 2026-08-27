import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { API_BASE } from '../../config.js';
import { isAdminRole } from '../../lib/auth.js';

const EXPANDED_WIDTH = 260;
const COLLAPSED_WIDTH = 72;

export default function Sidebar({
  mobileOpen = false,
  onMobileClose,
  collapsed = false,
  showBanner,
}) {
  const [userRole, setUserRole] = useState('');
  const leadsCount = null;
  const isAdmin = isAdminRole(userRole);

  useEffect(() => {
    const token = localStorage.getItem('solar_token');
    if (!token) return undefined;
    let cancelled = false;

    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.user) {
          setUserRole(data.user.role || '');
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

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
      items: [{ name: 'Overview', path: '/dashboard', icon: 'dashboard' }],
    },
    {
      title: 'DISCOVER',
      items: [
        { name: 'Targeting', path: '/map', icon: 'radar' },
        { name: 'Bulk Scan', path: '/bulk-scan', icon: 'layers' },
      ],
    },
    {
      title: 'PIPELINE',
      items: [
        { name: 'Marketplace', path: '/marketplace', icon: 'storefront' },
        { name: 'Lead Manager', path: '/my-leads', icon: 'assignment' },
        { name: 'Reports', path: '/reports', icon: 'analytics' },
        {
          name: 'Integrations',
          path: '/integrations',
          icon: 'alternate_email',
          hint: 'Connect your email',
        },
        { name: 'Drip Workflows', path: '/drip', icon: 'campaign' },
        { name: 'Appointments', path: '/appointments', icon: 'calendar_month' },
      ],
    },
    ...(isAdmin
      ? [
          {
            title: 'AI VOICE CALLING',
            items: [
              { name: 'Dashboard', path: '/ai-calling', icon: 'smart_toy' },
              { name: 'Campaigns', path: '/ai-calling/campaigns', icon: 'campaign' },
              { name: 'Live Monitor', path: '/ai-calling/live', icon: 'monitor_heart' },
              { name: 'Knowledge Base', path: '/ai-calling/knowledge-base', icon: 'auto_stories' },
              { name: 'Prompts & Scripts', path: '/ai-calling/prompts', icon: 'edit_note' },
              { name: 'Analytics', path: '/ai-calling/analytics', icon: 'analytics' },
              { name: 'Settings', path: '/ai-calling/settings', icon: 'settings' },
            ],
          },
        ]
      : []),
    {
      title: 'ACCOUNT',
      items: [
        { name: 'Billing', path: '/billing', icon: 'receipt_long' },
        { name: 'Support', path: '/support', icon: 'support_agent' },
        ...(isAdmin
          ? [{ name: 'Admin', path: '/admin', icon: 'admin_panel_settings', badge: 'Operator' }]
          : []),
        { name: 'Export CSV', action: 'export', icon: 'download' },
      ],
    },
  ];

  const handleAction = (actionName) => {
    handleMobileClose();
    if (actionName === 'export') {
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
        className={`z-50 flex flex-col bg-deep/95 backdrop-blur-xl border-r border-glass-stroke transition-[transform,width] duration-300 ease-out
          w-[260px] lg:w-[var(--sidebar-w)] lg:shrink-0
          fixed left-0 ${topStyle} ${heightStyle}
          ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
          lg:static lg:top-auto lg:h-auto lg:min-h-0 lg:self-stretch lg:translate-x-0 lg:shadow-none
          ${collapsed ? 'lg:p-2.5' : 'p-5 lg:p-3'}
        `}
      >
        {/* Mobile header */}
        <div className="flex justify-between items-center mb-4 lg:hidden pb-2 border-b border-glass-stroke">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Navigation</span>
          <button
            type="button"
            className="text-slate-400 hover:text-white p-1 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
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
                  const tooltip =
                    collapsed && item.hint
                      ? `${item.name} — ${item.hint}`
                      : collapsed
                        ? item.name
                        : undefined;

                  if (item.path) {
                    return (
                      <NavLink
                        key={item.name}
                        to={item.path}
                        title={tooltip}
                        onClick={handleMobileClose}
                        className={({ isActive }) =>
                          `relative group flex items-center rounded-lg text-xs font-semibold transition-all active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary ${
                            collapsed
                              ? 'lg:justify-center lg:px-0 lg:py-2.5 lg:mx-auto lg:w-11'
                              : 'gap-3 px-4 py-2'
                          } ${
                            isActive
                              ? 'text-primary bg-primary/10'
                              : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <div
                                className={`absolute left-0 top-1 bottom-1 w-[3px] bg-primary rounded-r-md ${
                                  collapsed ? 'lg:left-0.5' : ''
                                }`}
                              />
                            )}
                            <span
                              className={`material-symbols-outlined text-base shrink-0 ${
                                isActive ? 'text-primary' : 'text-on-surface-variant group-hover:text-on-surface'
                              }`}
                            >
                              {item.icon}
                            </span>
                            <span
                              className={`flex-1 min-w-0 text-left transition-opacity duration-200 ${
                                collapsed ? 'lg:hidden' : ''
                              }`}
                            >
                              <span className="block truncate">{item.name}</span>
                              {item.hint && (
                                <span className="block text-[9px] font-medium text-slate-500 truncate mt-0.5">
                                  {item.hint}
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
                      onClick={() => handleAction(item.action)}
                      className={`w-full flex items-center rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-all active:scale-[0.98] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                        collapsed
                          ? 'lg:justify-center lg:px-0 lg:py-2.5 lg:mx-auto lg:w-11'
                          : 'gap-3 px-4 py-2'
                      }`}
                    >
                      <span className="material-symbols-outlined text-base text-slate-400 shrink-0">
                        {item.icon}
                      </span>
                      <span className={collapsed ? 'lg:hidden' : ''}>{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}

export { EXPANDED_WIDTH, COLLAPSED_WIDTH };
