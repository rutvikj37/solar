import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { fetchMe } from '../../lib/auth.js';

/**
 * Persistent authenticated shell. Used as a React Router layout route so
 * TopBar/Sidebar stay mounted across in-app navigations.
 */
export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
              onClick={() => setShowBanner(false)}
              className="text-on-surface-variant hover:text-on-surface transition-colors p-0.5"
            >
              <span className="material-symbols-outlined text-[14px] leading-none block">close</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex-grow flex flex-col relative min-h-screen">
        <TopBar onMenuToggle={() => setSidebarOpen(true)} showBanner={showBanner} />

        <div className="flex-1 flex w-full relative">
          <main
            className={`flex-1 min-h-0 ${bodyPadding} ${
              isMapPage
                ? 'p-0 h-screen overflow-hidden relative'
                : isWideTablePage
                  ? 'pb-8 px-4 sm:px-5 lg:pr-[280px] max-w-[1680px] mx-auto w-full'
                  : 'pb-12 px-6 lg:pr-[280px] max-w-7xl mx-auto w-full'
            }`}
          >
            <div className="app-page h-full min-h-0">
              <Outlet />
            </div>
          </main>
        </div>

        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} showBanner={showBanner} />
      </div>
    </div>
  );
}
