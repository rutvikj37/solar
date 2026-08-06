import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { API_BASE } from '../config.js';

export default function Sidebar({ isOpen, setIsOpen, showBanner }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [leadsCount, setLeadsCount] = useState(null);
  const isMapPage = location.pathname === '/map';

  useEffect(() => {
    const token = localStorage.getItem('solar_token');
    if (!token) return undefined;
    let cancelled = false;
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
        { name: 'Targeting', path: '/map', icon: 'radar' },
        { name: 'Automation', path: '/bulk-scan', icon: 'offline_bolt' }
      ]
    },
    {
      title: 'PIPELINE',
      items: [
        { name: 'Lead Manager', path: '/my-leads', icon: 'assignment', mapOverlay: true },
        { name: 'Appointments', path: '/appointments', icon: 'calendar_month' },
        { name: 'AI Call Center', path: '/call-center', icon: 'record_voice_over' },
        { name: 'Scheduled Calls', path: '/scheduled-calls', icon: 'schedule' },
        { name: 'Bulk Calls', path: '/bulk-calls', icon: 'ring_volume' }
      ]
    },
    {
      title: 'ACCOUNT',
      items: [
        { name: 'Packages', path: '/packages', icon: 'sell' },
        { name: 'Billing', path: '/billing', icon: 'receipt_long' },
        { name: 'Support', path: '/support', icon: 'support_agent' },
        { name: 'Admin', path: '/admin', icon: 'admin_panel_settings' }
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
    setIsOpen(false);
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

  const openLeadManagerOnMap = () => {
    setIsOpen(false);
    if (isMapPage) {
      navigate('/map?leads=1', { replace: false });
      if (typeof window.openLeadManager === 'function') {
        window.openLeadManager();
      }
    } else {
      navigate('/my-leads');
    }
  };

  const leadsOverlayActive = isMapPage && new URLSearchParams(location.search).get('leads') === '1';
  const topStyle = showBanner ? 'lg:top-[104px]' : 'lg:top-20';

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`fixed right-0 top-0 h-full w-[260px] bg-deep border-l border-glass-stroke shadow-2xl flex flex-col p-5 z-50 transition-transform duration-300 lg:translate-x-0 lg:border lg:bg-deep/80 lg:backdrop-blur-md lg:rounded-2xl lg:h-auto lg:bottom-6 ${topStyle} ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex justify-between items-center mb-6 lg:hidden">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Navigation</span>
          <button
            className="text-slate-400 hover:text-white"
            onClick={() => setIsOpen(false)}
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
                  if (item.mapOverlay) {
                    const active = leadsOverlayActive || (!isMapPage && location.pathname === '/my-leads');
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={openLeadManagerOnMap}
                        className={`relative w-full flex items-center gap-3 px-4 py-2 text-xs font-semibold rounded-lg transition-all active:scale-[0.98] text-left ${
                          active
                            ? 'text-primary bg-primary/10'
                            : 'text-on-surface-variant hover:text-on-surface hover:bg-white/5'
                        }`}
                      >
                        {active && <div className="absolute left-0 top-1 bottom-1 w-[3px] bg-primary rounded-r-md" />}
                        <span className={`material-symbols-outlined text-base ${active ? 'text-primary' : 'text-on-surface-variant'}`}>
                          {item.icon}
                        </span>
                        <span className="flex-1">{item.name}</span>
                        {leadsCount != null && (
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                            active ? 'bg-primary/20 text-primary' : 'bg-white/5 text-slate-400'
                          }`}>
                            {leadsCount}
                          </span>
                        )}
                      </button>
                    );
                  }

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
                            <span>{item.name}</span>
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
