import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../../config.js';
import { BRAND_NAME } from '../../config/brand.js';
import { authHeaders, isAuthError, isAdminRole, logoutToLogin } from '../../lib/auth.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';

export default function TopBar({
  onNavToggle,
  mobileNavOpen = false,
  sidebarCollapsed = false,
  showBanner,
}) {
  const { user, credits, activePackage, subscription, unlimitedCredits, refreshUserData } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [leadsCount, setLeadsCount] = useState(0);
  const [scanUsedToday, setScanUsedToday] = useState(0);
  const [scanRemaining, setScanRemaining] = useState(0);
  const [scanTotal, setScanTotal] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    refreshUserData();
  }, [refreshUserData]);

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me`, { headers: authHeaders(), cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const quota = data.scanQuota || {};
        setScanUsedToday(Number(quota.usedToday) || Number(data.creditsUsedToday) || 0);
        setScanRemaining(Number(quota.remaining) ?? Number(data.credits) ?? 0);
        setScanTotal(
          Number(quota.total) ||
            Math.max(Number(data.credits) + Number(quota.usedToday || data.creditsUsedToday || 0), 0),
        );
      })
      .catch(console.error);

    fetch(`${API_BASE}/api/leads`, { headers: authHeaders() })
      .then((res) => {
        if (isAuthError(res.status)) {
          logoutToLogin();
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data) => {
        if (Array.isArray(data)) setLeadsCount(data.length);
      })
      .catch(console.error);
  }, [credits]);

  const handleLogout = () => logoutToLogin();

  const userEmail = user?.email || '';
  const userName = user?.name || '';
  const userRole = user?.role || '';
  const userInitial = userName.trim() ? userName.trim().charAt(0).toUpperCase() : '?';
  const topPosition = showBanner ? 'top-9' : 'top-0';
  const isAdmin = isAdminRole(userRole) || unlimitedCredits;
  const hasSubscription = Boolean(subscription);
  const planLabel = isAdmin
    ? 'ADMIN'
    : hasSubscription
      ? subscription?.packageName || activePackage
      : activePackage === 'Free'
        ? 'FREE'
        : activePackage;

  const navToggleLabel = mobileNavOpen
    ? 'Close navigation'
    : sidebarCollapsed
      ? 'Expand sidebar'
      : 'Collapse sidebar';

  return (
    <header
      className={`app-topbar fixed ${topPosition} left-0 right-0 h-16 bg-deep/98 border-b border-glass-stroke flex justify-between items-center gap-2 px-3 sm:px-5 lg:px-6 z-40 transition-all`}
    >
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onNavToggle}
          className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-md hover:bg-white/5 active:scale-95 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary shrink-0"
          aria-label={navToggleLabel}
          aria-expanded={mobileNavOpen || !sidebarCollapsed}
          aria-controls="app-sidebar-nav"
          title={navToggleLabel}
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        <Link to="/map" className="flex flex-col text-left select-none min-w-0">
          <div className="flex items-baseline leading-none font-display">
            <span className="text-on-surface font-semibold text-base sm:text-lg tracking-tight truncate">
              {BRAND_NAME}
            </span>
            <span className="text-primary-glow font-semibold text-base sm:text-lg tracking-tight">
              .com
            </span>
          </div>
          <span className="hidden xs:block sm:block text-[7px] text-on-surface-variant font-bold uppercase tracking-[0.25em] leading-none mt-0.5">
            LEAD INTELLIGENCE
          </span>
        </Link>
      </div>

      {/* Compact mobile credits chip */}
      <div className="flex md:hidden items-center gap-1.5 px-2 py-1 bg-primary/10 border border-primary/20 rounded-lg text-[9px] font-bold tracking-wider text-primary shrink-0 max-w-[42vw]">
        <span className="uppercase truncate">{planLabel}</span>
        <span className="text-on-surface font-mono tabular-nums">
          {isAdmin ? '∞' : Number(credits).toLocaleString()}
        </span>
      </div>

      <div className="hidden xl:flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold tracking-wider">
          <span className="text-slate-300">LEADS</span>
          <span className="text-white font-mono tabular-nums">{leadsCount}</span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold tracking-wider">
          <span className="text-slate-300">SCANS TODAY</span>
          <span className="text-white font-mono tabular-nums">
            {isAdmin
              ? '∞'
              : `${scanUsedToday}/${Math.max(scanTotal, scanRemaining + scanUsedToday) || scanRemaining}`}
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-[10px] font-bold tracking-wider text-primary">
          <span className="uppercase">{planLabel}</span>
          <span className="text-on-surface font-mono tabular-nums ml-0.5">
            | {isAdmin ? 'UNLIMITED' : `${Number(credits).toLocaleString()} CREDITS`}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
        {isAdmin && (
          <Link
            to="/admin"
            className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-all shadow-sm"
            title="Admin Console"
          >
            <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
            <span className="hidden md:inline">Admin</span>
          </Link>
        )}

        <div className="hidden sm:flex items-center gap-2 sm:gap-3 pr-2 sm:pr-3 border-r border-glass-stroke">
          <div className="w-8 h-8 rounded-full bg-primary text-on-primary font-extrabold text-sm flex items-center justify-center shadow-lg shadow-primary/20 select-none shrink-0">
            {userInitial}
          </div>
          <div className="text-left hidden md:block min-w-0">
            <p className="text-on-surface text-xs font-semibold leading-none truncate max-w-[140px]">
              {userEmail}
            </p>
            <p className="text-primary-glow text-[9px] font-bold tracking-wider leading-none mt-1 uppercase">
              {isAdmin ? 'ADMIN · UNLIMITED' : `${credits} LEAD CREDITS`}
            </p>
          </div>
        </div>

        {/* Desktop action icons */}
        <div className="hidden sm:flex items-center gap-0.5">
          <button
            type="button"
            onClick={toggleTheme}
            className="text-on-surface-variant hover:text-on-surface transition-colors p-1.5"
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            <span className="material-symbols-outlined text-[20px]">
              {theme === 'light' ? 'dark_mode' : 'light_mode'}
            </span>
          </button>

          <Link
            to="/profile"
            className="text-on-surface-variant hover:text-on-surface transition-colors p-1.5"
            title="Settings"
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </Link>

          <Link
            to="/my-leads"
            className="text-on-surface-variant hover:text-primary transition-colors p-1.5"
            title="Lead Manager"
          >
            <span className="material-symbols-outlined text-[20px]">assignment</span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="text-on-surface-variant hover:text-primary transition-colors p-1.5"
            title="Log Out"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>
        </div>

        {/* Mobile overflow menu */}
        <div className="relative sm:hidden">
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="text-on-surface-variant hover:text-on-surface p-1.5 rounded-md hover:bg-white/5"
            aria-label="More actions"
            aria-expanded={moreOpen}
          >
            <span className="material-symbols-outlined text-[22px]">more_vert</span>
          </button>
          {moreOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                aria-label="Close menu"
                onClick={() => setMoreOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl border border-glass-stroke bg-deep/98 backdrop-blur-xl shadow-2xl py-1 text-xs overflow-hidden">
                <Link
                  to="/my-leads"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 text-on-surface hover:bg-white/5"
                >
                  <span className="material-symbols-outlined text-base">assignment</span>
                  Lead Manager
                </Link>
                <Link
                  to="/profile"
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 text-on-surface hover:bg-white/5"
                >
                  <span className="material-symbols-outlined text-base">settings</span>
                  Settings
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 text-red-400 hover:bg-white/5"
                  >
                    <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                    Admin
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    toggleTheme();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-on-surface hover:bg-white/5 text-left"
                >
                  <span className="material-symbols-outlined text-base">
                    {theme === 'light' ? 'dark_mode' : 'light_mode'}
                  </span>
                  {theme === 'light' ? 'Dark mode' : 'Light mode'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-on-surface-variant hover:bg-white/5 text-left border-t border-glass-stroke"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
