import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { API_BASE } from '../config.js';
import { isAdminRole } from '../lib/auth.js';

export default function Sidebar({ isOpen, setIsOpen, onClose, showBanner }) {
  const location = useLocation();
  const handleClose = () => {
    if (typeof setIsOpen === 'function') setIsOpen(false);
    if (typeof onClose === 'function') onClose();
  };

  const [leadsCount, setLeadsCount] = useState(null);
  const [userRole, setUserRole] = useState('');
  const isAdmin = isAdminRole(userRole);

  useEffect(() => {
    const token = localStorage.getItem('solar_token');
    if (!token) return undefined;
    let cancelled = false;

    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.user) {
          setUserRole(data.user.role || '');
        }
      })
      .catch(() => {});

    fetch(`${API_BASE}/api/leads`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setLeadsCount(data.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const menuCategories = [
    {
      title: 'DISCOVER',
      items: [
        { name: 'Targeting', path: '/map', icon: 'radar' }
        // Automation (/bulk-scan) hidden until feature ships
      ]
    },
    {
      title: 'PIPELINE',
      items: [
        { name: 'Lead Manager', path: '/my-leads', icon: 'assignment' },
        { name: 'Drip Workflows', path: '/drip', icon: 'campaign' },
        { name: 'Appointments', path: '/appointments', icon: 'calendar_month' }
      ]
    },
    {
      title: 'AI VOICE CALLING',
      items: [
        { name: 'Dashboard', path: '/ai-calling', icon: 'smart_toy', badge: isAdmin ? null : 'Soon' },
        { name: 'Campaigns', path: '/ai-calling/campaigns', icon: 'campaign', badge: isAdmin ? null : 'Soon' },
        { name: 'Live Monitor', path: '/ai-calling/live', icon: 'monitor_heart', badge: isAdmin ? null : 'Soon' },
        { name: 'Knowledge Base', path: '/ai-calling/knowledge-base', icon: 'auto_stories', badge: isAdmin ? null : 'Soon' },
        { name: 'Prompts & Scripts', path: '/ai-calling/prompts', icon: 'edit_note', badge: isAdmin ? null : 'Soon' },
        { name: 'Analytics', path: '/ai-calling/analytics', icon: 'analytics', badge: isAdmin ? null : 'Soon' },
        { name: 'Settings', path: '/ai-calling/settings', icon: 'settings', badge: isAdmin ? null : 'Soon' }
      ]
    },
    {
      title: 'ACCOUNT',
      items: [
        { name: 'Billing', path: '/billing', icon: 'receipt_long' },
        { name: 'Support', path: '/support', icon: 'support_agent' },
        ...(isAdmin
          ? [{ name: 'Admin', path: '/admin', icon: 'admin_panel_settings', badge: 'Operator' }]
          : [])
      ]
    },
    {
      title: 'TOOLS',
      items: [
        { name: 'Locate Me', action: 'locate', icon: 'location_searching' },
        { name: 'Export CSV', action: 'export', icon: 'download' }
      ]
    }
  ];

  const handleAction = (actionName) => {
    handleClose();
    if (actionName === 'locate') {
      if (typeof window.locateMe === 'function') {
        window.locateMe();
      } else {
        window.location.href = '/map?action=locate';
      }
    } else if (actionName === 'export') {
      if (typeof window.exportCSV === 'function') {
        window.exportCSV();
      } else {
        const token = localStorage.getItem('solar_token');
        if (token) {
          window.open(`${API_BASE}/api/leads/export-csv?token=` + token, '_blank');
        }
      }
    }
  };

  const topStyle = showBanner ? 'top-[100px]' : 'top-[64px]';
  const heightStyle = showBanner ? 'h-[calc(100vh-100px)]' : 'h-[calc(100vh-64px)]';

  return (
    <>
      {isOpen && (
        <div
          className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden ${topStyle}`}
          onClick={handleClose}
        />
      )}

      <aside
        className={`fixed right-0 ${topStyle} ${heightStyle} w-[260px] bg-deep/95 backdrop-blur-xl border-l border-glass-stroke shadow-2xl flex flex-col p-5 z-50 transition-all duration-300 lg:translate-x-0 lg:border lg:bg-deep/80 lg:rounded-2xl lg:h-auto lg:bottom-6 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex justify-between items-center mb-4 lg:hidden pb-2 border-b border-glass-stroke">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Navigation</span>
          <button
            className="text-slate-400 hover:text-white p-1 rounded-md"
            onClick={handleClose}
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="flex-grow space-y-6 overflow-y-auto custom-scrollbar pr-1">
          {menuCategories.map((category) => (
            <div key={category.title} className="space-y-1.5 text-left">
              <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-3 select-none">
                {category.title}
              </h4>
              <div className="space-y-0.5">
                {category.items.map((item) => {
                  if (item.path) {
                    return (
                      <NavLink
                        key={item.name}
                        to={item.path}
                        onClick={() => setIsOpen(false)}
                        className={({ isActive }) =>
                          `relative flex items-center gap-3 px-4 py-2 text-xs font-semibold rounded-lg transition-all active:scale-[0.98] ${
                            isActive
                              ? 'text-primary bg-primary/10'
                              : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && <div className="absolute left-0 top-1 bottom-1 w-[3px] bg-primary rounded-r-md" />}
                            <span className={`material-symbols-outlined text-base ${isActive ? 'text-primary' : 'text-on-surface-variant'}`}>
                              {item.icon}
                            </span>
                            <span className="flex-1">{item.name}</span>
                            {item.name === 'Lead Manager' && leadsCount != null && (
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                                isActive ? 'bg-primary/20 text-primary' : 'bg-white/5 text-slate-400'
                              }`}>
                                {leadsCount}
                              </span>
                            )}
                            {item.badge && (
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase border ${
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
                      onClick={() => handleAction(item.action)}
                      className="w-full flex items-center gap-3 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-all active:scale-[0.98] text-left"
                    >
                      <span className="material-symbols-outlined text-base text-slate-400">
                        {item.icon}
                      </span>
                      <span>{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
