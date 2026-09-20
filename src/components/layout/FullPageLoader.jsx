import React from "react";

/**
 * Lightweight Suspense fallback for cold lazy routes.
 * Avoids the heavy SatelliteUplinkLoader animation on marketing navigations.
 */
export default function FullPageLoader() {
  return (
    <div
      className="min-h-screen bg-deep flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
        <p className="font-label-mono text-[10px] uppercase tracking-[0.3em] text-on-surface-variant">
          Loading
        </p>
      </div>
    </div>
  );
}
