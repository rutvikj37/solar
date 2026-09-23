import React, { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import Sidebar, { COLLAPSED_WIDTH, EXPANDED_WIDTH } from './Sidebar';
import TopBar from './TopBar';
import { useAuth } from '../../context/AuthContext.jsx';
import { isAdminRole } from '../../lib/auth.js';
import OnboardingProvider from '../onboarding/OnboardingProvider.jsx';

const SIDEBAR_COLLAPSED_KEY = 'str_sidebar_collapsed';

/**
 * Persistent authenticated shell. Used as a React Router layout route so
 * TopBar/Sidebar stay mounted across in-app navigations.
 */
export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [showBanner, setShowBanner] = useState(true);
  const { user, credits, subscription, refreshUserData, loading: authLoading } = useAuth();
  const location = useLocation();
  const isMapPage = location.pathname === '/map';
  const isWideTablePage = location.pathname === '/my-leads';

  useEffect(() => {
    refreshUserData();
  }, [location.pathname, refreshUserData]);

  // Close mobile drawer on navigate
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Spotlight tour needs sidebar targets visible on small screens
  useEffect(() => {
    const prepare = () => {
      if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 1024px)').matches) {
        setMobileOpen(true);
      }
    };
    window.addEventListener('str:prepare-tour', prepare);
    return () => window.removeEventListener('str:prepare-tour', prepare);
  }, []);

  useEffect(() => {
    const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
    document.documentElement.style.setProperty('--app-sidebar-w', `${width}px`);
    document.documentElement.style.setProperty('--app-banner-h', showBanner ? '36px' : '0px');
    document.documentElement.style.setProperty('--app-topbar-h', '64px');
    document.documentElement.style.setProperty(
      '--app-chrome-h',
      showBanner ? '100px' : '64px',
    );
    const id = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 320);
    return () => window.clearTimeout(id);
  }, [collapsed, showBanner]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* ignore quota / private mode */
      }
      return next;
    });
  };

  /** One control: drawer on mobile, icon-rail collapse on desktop. */
  const handleNavToggle = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
      toggleCollapsed();
      return;
    }
    setMobileOpen((open) => !open);
  };

  const creditsLow = credits !== null && credits !== undefined && credits <= 2;
  const creditsEmpty = credits === 0;
  const planName = subscription?.packageName;
  const bannerCredits = authLoading ? null : credits;
  const bodyPadding = showBanner ? 'pt-[100px]' : 'pt-16';

  // Admin users are directed strictly to the admin operator console — no user functionality
  if (!authLoading && user && isAdminRole(user.role)) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <OnboardingProvider>
      <div className="min-h-screen bg-deep text-on-background flex flex-col font-sans overflow-x-hidden">
        {showBanner && (
          <div className="fixed top-0 left-0 right-0 h-9 bg-deep border-b border-glass-stroke py-1.5 px-3 sm:px-6 flex items-center justify-between gap-2 text-[10px] sm:text-[11px] text-on-surface-variant z-50">
            <div className="flex items-center gap-1.5 select-none min-w-0 flex-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0"></span>
              <span className="truncate">
                {bannerCredits === null
                  ? '1 lead unlock = 1 credit'
                  : creditsEmpty
                    ? planName
                      ? `${planName} — no unlock credits left.`
                      : 'No credits remaining. Subscribe to continue.'
                    : `${Number(bannerCredits).toLocaleString()} credit${bannerCredits === 1 ? '' : 's'} left · 1 lead = 1 credit${planName ? ` · ${planName}` : ''}`}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {(creditsLow || creditsEmpty) && (
                <Link
                  to="/billing#plans"
                  className="px-2.5 sm:px-3 py-1 font-bold text-[10px] rounded-full bg-primary text-on-primary hover:brightness-110 active:scale-95 transition-all shadow-sm whitespace-nowrap"
                >
                  {creditsEmpty ? 'Subscribe' : 'Upgrade'}
                </Link>
              )}
              <button
                type="button"
                onClick={() => setShowBanner(false)}
                className="text-on-surface-variant hover:text-on-surface transition-colors p-0.5"
                aria-label="Dismiss banner"
              >
                <span className="material-symbols-outlined text-[14px] leading-none block">close</span>
              </button>
            </div>
          </div>
        )}

        <div className="flex-grow flex flex-col relative min-h-screen min-w-0">
          <TopBar
            onNavToggle={handleNavToggle}
            mobileNavOpen={mobileOpen}
            sidebarCollapsed={collapsed}
            showBanner={showBanner}
          />

          <div className={`flex-1 flex w-full min-h-0 min-w-0 relative ${bodyPadding}`}>
            <Sidebar
              mobileOpen={mobileOpen}
              onMobileClose={() => setMobileOpen(false)}
              collapsed={collapsed}
              showBanner={showBanner}
            />

            <main
              className={`app-main-canvas flex-1 min-w-0 min-h-0 ${
                isMapPage
                  ? 'relative overflow-hidden p-0'
                  : isWideTablePage
                    ? 'pb-8 px-3 sm:px-5 max-w-[1680px] mx-auto w-full'
                    : 'pb-10 sm:pb-12 px-3 sm:px-5 lg:px-6 max-w-7xl mx-auto w-full'
              }`}
            >
              <div className={`app-page min-h-0 min-w-0 ${isMapPage ? 'h-full' : ''}`}>
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </div>
    </OnboardingProvider>
  );
}
