import React from 'react';
import { useOnboardingOptional } from './onboarding/OnboardingProvider.jsx';

/** Opens Getting Started checklist — shared OnboardingProvider (single instance). */
export function DashboardTourButton() {
  const onboarding = useOnboardingOptional();
  if (!onboarding) return null;

  return (
    <button
      type="button"
      onClick={() => onboarding.openPanel()}
      className="inline-flex items-center gap-1.5 rounded-lg border border-glass-stroke bg-white/5 px-3 py-1.5 text-[11px] font-bold text-on-surface hover:bg-white/10"
    >
      <span className="material-symbols-outlined text-sm">school</span>
      Getting Started
      {onboarding.progress?.done < onboarding.progress?.total ? (
        <span className="rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[9px] text-primary">
          {onboarding.progress.done}/{onboarding.progress.total}
        </span>
      ) : null}
    </button>
  );
}

/** Replays spotlight walkthrough without mounting a second tour tree. */
export function StartTutorialButton() {
  const onboarding = useOnboardingOptional();
  if (!onboarding) return null;
  return (
    <button
      type="button"
      onClick={() => onboarding.runTour({ openChecklistAfter: false })}
      disabled={onboarding.tourRunning}
      className="inline-flex items-center gap-1.5 rounded-lg border border-glass-stroke bg-white/5 px-3 py-1.5 text-[11px] font-bold text-on-surface hover:bg-white/10 disabled:opacity-60"
    >
      <span className="material-symbols-outlined text-sm">play_circle</span>
      {onboarding.tourRunning ? 'Tour running…' : 'Replay tour'}
    </button>
  );
}

/** @deprecated No-op — spotlight is owned by OnboardingProvider */
export default function DashboardTour() {
  return null;
}
