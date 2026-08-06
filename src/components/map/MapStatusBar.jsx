import React, { useEffect, useState } from 'react';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatClock(date, timeZone) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone
    }).format(date);
  } catch {
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
  }
}

function formatDate(date) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    }).format(date);
  } catch {
    return date.toDateString();
  }
}

function Pill({ label, value, live = false }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-deep/90 border border-glass-stroke backdrop-blur-md text-[9px] font-bold tracking-wider uppercase whitespace-nowrap">
      {live && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
      <span className="text-slate-500">{label}</span>
      <span className="text-white font-mono normal-case tracking-normal">{value}</span>
    </div>
  );
}

export default function MapStatusBar({
  feedLive = false,
  zoom = 15,
  lat = null,
  lng = null,
  className = ''
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const coord =
    lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)
      ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      : '—';

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-1.5 pointer-events-none select-none ${className}`}
    >
      <Pill label="Feed" value={feedLive ? 'LIVE' : 'OFF'} live={feedLive} />
      <Pill label="UTC" value={formatClock(now, 'UTC')} />
      <Pill label="Local" value={formatClock(now)} />
      <Pill label="Date" value={formatDate(now)} />
      <Pill label="Zoom" value={String(Math.round(zoom * 10) / 10)} />
      <Pill label="Coord" value={coord} />
    </div>
  );
}
