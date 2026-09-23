import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext.jsx';

export default function AdminHeader({
  activeTabTitle = 'Overview Dashboard',
  activeTab = 'dashboard',
  onSync,
  syncing = false,
  searchQuery = '',
  onSearchChange,
  onOpenQuickAction,
  onToggleMobileNav,
  unreadCount = 0,
}) {
  const { theme, toggleTheme, isLight } = useTheme();
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 h-16 bg-white/85 dark:bg-[#0B0F19]/85 backdrop-blur-md border-b border-slate-200/80 dark:border-white/[0.08] z-40 px-4 sm:px-6 lg:px-8 flex items-center justify-between transition-colors duration-200">
      {/* Left: Mobile hamburger + Breadcrumbs + Return to App link */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <button
          type="button"
          onClick={onToggleMobileNav}
          className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition"
          aria-label="Toggle navigation"
        >
          <span className="material-symbols-outlined text-[22px]">menu</span>
        </button>

        <nav className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
          <Link
            to="/admin"
            className="hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1 font-semibold"
          >
            <span>Admin Console</span>
          </Link>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <span className="text-blue-600 dark:text-blue-400 font-semibold truncate">
            {activeTabTitle}
          </span>
        </nav>
      </div>

      {/* Right: Search, Status, Time, Sync, Theme, Notifications, Action */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Search */}
        {onSearchChange && (
          <div className="relative hidden md:flex items-center">
            <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search leads, users, telemetry..."
              className="w-56 lg:w-72 h-9 pl-9 pr-10 rounded-xl bg-slate-100 dark:bg-white/5 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-[#121826] text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none transition-all"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
              >
                ✕
              </button>
            ) : (
              <kbd className="absolute right-2.5 px-1.5 py-0.5 rounded bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-[10px] font-mono text-slate-500 dark:text-slate-400 pointer-events-none">
                /
              </kbd>
            )}
          </div>
        )}

        {/* Operational Status */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>99.98% Operational</span>
        </div>

        {/* Live Clock */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-xs font-mono text-slate-700 dark:text-slate-300">
          <span className="material-symbols-outlined text-[15px] text-amber-500">schedule</span>
          <span className="font-semibold">{timeStr || '--:--:--'}</span>
        </div>

        {/* Sync Button */}
        {onSync && (
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#121826] hover:bg-slate-50 dark:hover:bg-white/5 border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs transition active:scale-95 disabled:opacity-50"
            title="Sync live telemetry"
          >
            <span
              className={`material-symbols-outlined text-[16px] text-blue-500 ${
                syncing ? 'animate-spin' : ''
              }`}
            >
              refresh
            </span>
            <span className="hidden sm:inline">Sync</span>
          </button>
        )}

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200/70 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-300 transition"
          title={`Switch to ${isLight ? 'Dark' : 'Light'} mode`}
        >
          <span className="material-symbols-outlined text-[19px]">
            {isLight ? 'dark_mode' : 'light_mode'}
          </span>
        </button>

        {/* Quick Action Button */}
        {onOpenQuickAction && (
          <button
            type="button"
            onClick={onOpenQuickAction}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">bolt</span>
            <span className="hidden sm:inline">Quick Action</span>
          </button>
        )}
      </div>
    </header>
  );
}
