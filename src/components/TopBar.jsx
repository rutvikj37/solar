import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../config.js';
import { authHeaders, fetchMe, isAuthError, isAdminRole, logoutToLogin } from '../lib/auth.js';

export default function TopBar({ onMenuToggle, showBanner }) {
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [credits, setCredits] = useState(0);
  const [activePackage, setActivePackage] = useState('Free');
  const [hasSubscription, setHasSubscription] = useState(false);
  const [leadsCount, setLeadsCount] = useState(8);

  useEffect(() => {
    fetchMe().then((data) => {
      if (!data?.user) return;
      setUserEmail(data.user.email || '');
      setUserName(data.user.name || '');
      setUserRole(data.user.role || '');
      setCredits(data.credits !== undefined ? data.credits : 0);
      setActivePackage(data.activePackage || data.subscription?.packageName || 'Free');
      setHasSubscription(Boolean(data.subscription));
    });

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
  }, []);

  const handleLogout = () => logoutToLogin();

  const userInitial = userName.trim() ? userName.trim().charAt(0).toUpperCase() : '?';
  const topPosition = showBanner ? 'top-9' : 'top-0';
  const isAdmin = isAdminRole(userRole);

  return (
    <header className={`fixed ${topPosition} left-0 right-0 h-16 bg-deep/95 backdrop-blur-xl border-b border-glass-stroke flex justify-between items-center px-6 z-40 transition-all`}>
      
      {/* Left side: Hamburger button + SollarX Logo */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuToggle}
          className="lg:hidden text-on-surface-variant hover:text-on-surface p-1 rounded-md hover:bg-white/5 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        <Link to="/map" className="flex flex-col text-left select-none">
          <div className="flex items-baseline leading-none font-display">
            <span className="text-on-surface font-semibold text-lg tracking-tight">SollarX</span>
            <span className="text-primary-glow font-semibold text-lg tracking-tight">.ai</span>
          </div>
          <span className="text-[7px] text-on-surface-variant font-bold uppercase tracking-[0.25em] leading-none mt-0.5">
            LEAD INTELLIGENCE
          </span>
        </Link>
      </div>

      {/* Middle side: Live Telemetry Badges */}
      <div className="hidden xl:flex items-center gap-2.5">
        {/* LIVE SAT badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-glass border border-glass-stroke rounded-lg text-[10px] font-bold tracking-wider text-on-surface-variant">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
          <span>LIVE SAT</span>
        </div>

        {/* REGION USA badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold tracking-wider">
          <span className="text-slate-300">REGION</span>
          <span className="text-white font-mono">USA</span>
        </div>

        {/* LEADS badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold tracking-wider">
          <span className="text-slate-300">LEADS</span>
          <span className="text-white font-mono tabular-nums">{leadsCount}</span>
        </div>

        {/* SCANS badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold tracking-wider">
          <span className="text-slate-300">SCANS</span>
          <span className="text-white font-mono tabular-nums">10/10</span>
        </div>

        {/* Plan / credits badge — remaining credits are source of truth (not hardcoded /5) */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-[10px] font-bold tracking-wider text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
          <span className="uppercase">
            {isAdmin ? 'ADMIN' : hasSubscription ? activePackage : activePackage === 'Free' ? 'FREE' : activePackage}
          </span>
          <span className="text-on-surface font-mono tabular-nums ml-0.5">
            | {isAdmin ? 'UNLIMITED' : `${Number(credits).toLocaleString()} CREDITS`}
          </span>
        </div>
      </div>

      {/* Right side: Actions + User Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        {/* Admin Option Button */}
        {isAdmin && (
          <Link
            to="/admin"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold transition-all shadow-sm"
            title="Admin Console"
          >
            <span className="material-symbols-outlined text-[18px]">admin_panel_settings</span>
            <span className="hidden sm:inline">Admin</span>
          </Link>
        )}

        {/* Profile Pill */}
        <div className="flex items-center gap-3 pr-3 border-r border-glass-stroke">
          <div className="w-8 h-8 rounded-full bg-primary text-on-primary font-extrabold text-sm flex items-center justify-center shadow-lg shadow-primary/20 select-none">
            {userInitial}
          </div>
          <div className="text-left hidden md:block">
            <p className="text-on-surface text-xs font-semibold leading-none truncate max-w-[150px]">{userEmail}</p>
            <p className="text-primary-glow text-[9px] font-bold tracking-wider leading-none mt-1 uppercase">
              {isAdmin ? 'ADMIN · UNLIMITED' : `${credits} CREDITS`}
            </p>
          </div>
        </div>

        {/* Action Icons */}
        <Link to="/profile" className="text-on-surface-variant hover:text-on-surface transition-colors p-1" title="Settings">
          <span className="material-symbols-outlined text-[20px]">settings</span>
        </Link>
        
        <Link to="/my-leads" className="text-on-surface-variant hover:text-primary transition-colors p-1 flex items-center gap-1" title="Lead Manager">
          <span className="material-symbols-outlined text-[20px]">assignment</span>
        </Link>

        <button 
          onClick={handleLogout}
          className="text-on-surface-variant hover:text-primary transition-colors p-1" 
          title="Log Out"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
        </button>
      </div>
    </header>
  );
}
