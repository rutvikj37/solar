import React, { useEffect, useState } from 'react';

const STATUS_CYCLE = [
  {
    status: 'WARMING UP AI MODELS',
    message: 'Preparing your satellite uplink...',
  },
  {
    status: 'ESTABLISHING UPLINK',
    message: 'Syncing lead intelligence...',
  },
  {
    status: 'CALIBRATING SENSORS',
    message: 'Locking orbital coordinates...',
  },
];

export default function SatelliteUplinkLoader({ visible = false, showClose = false, onClose }) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!visible) {
      setPhaseIndex(0);
      setProgress(0);
      return undefined;
    }

    const phaseTimer = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % STATUS_CYCLE.length);
    }, 2800);

    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) return prev;
        return prev + Math.random() * 4 + 1.5;
      });
    }, 180);

    return () => {
      clearInterval(phaseTimer);
      clearInterval(progressTimer);
    };
  }, [visible]);

  if (!visible) return null;

  const { status, message } = STATUS_CYCLE[phaseIndex];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Calibrating satellite uplink"
    >
      <div className="absolute inset-0 bg-deep/85 backdrop-blur-xl" />

      <div className="relative z-10 w-full max-w-md text-center">
        {showClose && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute -top-2 -right-2 w-8 h-8 rounded-full border border-glass-stroke bg-surface-elevated/80 text-on-surface-variant hover:text-white hover:border-white/20 transition-colors flex items-center justify-center"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        )}

        <p className="font-label-mono text-[10px] uppercase tracking-[0.35em] text-tertiary-container mb-6">
          CALIBRATING · SATELLITE
        </p>

        <p
          key={`status-${phaseIndex}`}
          className="font-label-mono text-[11px] uppercase tracking-[0.2em] text-primary-glow mb-3 satellite-uplink-fade-in"
        >
          {status}
        </p>

        <p
          key={`message-${phaseIndex}`}
          className="text-sm text-on-surface-variant mb-10 satellite-uplink-fade-in"
        >
          {message}
        </p>

        <div className="relative mx-auto mb-10 w-44 h-44 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-primary/15 blur-3xl satellite-uplink-pulse" />

          <div className="satellite-uplink-arc satellite-uplink-arc-1" />
          <div className="satellite-uplink-arc satellite-uplink-arc-2" />
          <div className="satellite-uplink-arc satellite-uplink-arc-3" />

          <div className="relative w-16 h-16 rounded-full satellite-uplink-core shadow-[0_0_40px_rgba(56,132,255,0.55),0_0_80px_rgba(239,103,25,0.25)]">
            <div className="absolute inset-1 rounded-full bg-gradient-to-br from-primary-glow/90 via-primary to-primary-container opacity-90" />
            <div className="absolute inset-0 rounded-full border border-white/20" />
          </div>
        </div>

        <div className="mx-auto max-w-xs">
          <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full satellite-uplink-progress-bar transition-[width] duration-300 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="mt-3 font-label-mono text-[9px] uppercase tracking-widest text-on-surface-variant/70">
            {Math.round(Math.min(progress, 100))}% calibrated
          </p>
        </div>
      </div>
    </div>
  );
}
