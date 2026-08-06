import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../config.js';

export default function TopBar({ onMenuToggle, showBanner }) {
  const [userEmail, setUserEmail] = useState('rutvikj45@gmail.com');
  const [userName, setUserName] = useState('Rutvik');
  const [credits, setCredits] = useState(0);
  const [leadsCount, setLeadsCount] = useState(8);

  useEffect(() => {
    const token = localStorage.getItem('solar_token');
    if (token) {
      // 1. Fetch user profile
      fetch(`${API_BASE}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            setUserEmail(data.user.email || 'rutvikj45@gmail.com');
            setUserName(data.user.name || 'Rutvik');
            setCredits(data.credits !== undefined ? data.credits : 0);
          }
        })
        .catch(console.error);

      // 2. Fetch leads total
      fetch(`${API_BASE}/api/leads`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setLeadsCount(data.length);
          }
        })
        .catch(console.error);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('solar_token');
    window.location.href = '/login';
  };

  const userInitial = userName.trim() ? userName.trim().charAt(0).toUpperCase() : 'R';
  const topPosition = showBanner ? 'top-9' : 'top-0';

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
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/5 rounded-lg text-[10px] font-bold tracking-wider">
          <span className="text-slate-500">REGION</span>
          <span className="text-white">USA</span>
        </div>

        {/* LEADS badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/5 rounded-lg text-[10px] font-bold tracking-wider">
          <span className="text-slate-500">LEADS</span>
          <span className="text-white">{leadsCount}</span>
        </div>

        {/* SCANS badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/5 rounded-lg text-[10px] font-bold tracking-wider">
          <span className="text-slate-500">SCANS</span>
          <span className="text-white">10/10</span>
        </div>

        {/* FREE TRIAL badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-[10px] font-bold tracking-wider text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
          <span>FREE TRIAL</span>
          <span className="text-on-surface ml-0.5">| 10/10 LEADS</span>
        </div>
      </div>

      {/* Right side: Actions + User Profile */}
      <div className="flex items-center gap-4">
        {/* Profile Pill */}
        <div className="flex items-center gap-3 pr-4 border-r border-glass-stroke">
          <div className="w-8 h-8 rounded-full bg-primary text-on-primary font-extrabold text-sm flex items-center justify-center shadow-lg shadow-primary/20 select-none">
            {userInitial}
          </div>
          <div className="text-left hidden md:block">
            <p className="text-on-surface text-xs font-semibold leading-none truncate max-w-[150px]">{userEmail}</p>
            <p className="text-primary-glow text-[9px] font-bold tracking-wider leading-none mt-1 uppercase">{credits} CREDITS</p>
          </div>
        </div>

        {/* Action Icons */}
        <Link to="/profile" className="text-on-surface-variant hover:text-on-surface transition-colors p-1" title="Settings">
          <span className="material-symbols-outlined text-[20px]">settings</span>
        </Link>
        
        <Link to="/my-leads" className="text-on-surface-variant hover:text-on-surface transition-colors p-1" title="Messages/Leads">
          <span className="material-symbols-outlined text-[20px]">chat_bubble</span>
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
