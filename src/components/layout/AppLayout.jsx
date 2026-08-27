import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import Sidebar, { COLLAPSED_WIDTH, EXPANDED_WIDTH } from './Sidebar';
import TopBar from './TopBar';
import { fetchMe } from '../../lib/auth.js';

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
  const [credits, setCredits] = useState(null);
  const location = useLocation();
  const isMapPage = location.pathname === '/map';
  const isWideTablePage = location.pathname === '/my-leads';

  const bodyPadding = showBanner ? 'pt-[104px]' : 'pt-16';

  useEffect(() => {
    let cancelled = false;
    fetchMe().then((data) => {
      if (!cancelled && data?.credits !== undefined) setCredits(data.credits);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Close mobile drawer on navigate
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Keep CSS var in sync + nudge Google Maps when rail width changes
  useEffect(() => {
    const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
    document.documentElement.style.setProperty('--app-sidebar-w', `${width}px`);
    const id = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 320);
    return () => window.clearTimeout(id);
  }, [collapsed]);

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

  const creditsLow = credits !== null && credits <= 2;
  const creditsEmpty = credits === 0;

  return (
    <div className="min-h-screen bg-deep text-on-background flex flex-col font-sans overflow-x-hidden">
      {showBanner && (
        <div className="fixed top-0 left-0 right-0 h-9 bg-deep border-b border-glass-stroke py-2 px-6 flex items-center justify-between text-[11px] text-on-surface-variant z-50">
          <div className="flex items-center gap-1.5 select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            <span>
              {credits === null
                ? '1 lead unlock = 1 credit'
                : creditsEmpty
                  ? 'No credits remaining. Subscribe to a monthly plan to generate more leads.'
                  : `${Number(credits).toLocaleString()} credit${credits === 1 ? '' : 's'} remaining — 1 lead = 1 credit`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {(creditsLow || creditsEmpty) && (
              <Link
                to="/billing#plans"
                className="px-3 py-1 font-bold text-[10px] rounded-full bg-primary text-on-primary hover:brightness-110 active:scale-95 transition-all shadow-sm"
              >
                {creditsEmpty ? 'Subscribe' : 'Upgrade plan'}
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

        {/*
          Desktop: sidebar is in-flow (lg:static) so main flex-1 fills leftover width.
          Mobile: sidebar stays a fixed overlay drawer; main is full width.
          Avoids lg:pl gutters that left a huge empty deep column beside the map.
        */}
        <div className={`flex-1 flex w-full min-h-0 min-w-0 relative ${bodyPadding}`}>
          <Sidebar
            mobileOpen={mobileOpen}
            onMobileClose={() => setMobileOpen(false)}
            collapsed={collapsed}
            showBanner={showBanner}
          />

          <main
            className={`flex-1 min-w-0 min-h-0 ${
              isMapPage
                ? 'relative overflow-hidden p-0'
                : isWideTablePage
                  ? 'pb-8 px-4 sm:px-5 max-w-[1680px] mx-auto w-full'
                  : 'pb-12 px-6 max-w-7xl mx-auto w-full'
            }`}
          >
            <div className={`app-page min-h-0 min-w-0 ${isMapPage ? 'h-full' : ''}`}>
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
