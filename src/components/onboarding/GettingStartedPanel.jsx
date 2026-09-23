import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CHECKLIST_TASKS } from '../../lib/onboardingConfig.js';

export default function GettingStartedPanel({
  open,
  onClose,
  state,
  progress,
  onReplayTour,
  onToggleTask,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const { done, total, percent } = progress || { done: 0, total: CHECKLIST_TASKS.length, percent: 0 };

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="getting-started-title">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
        aria-label="Close Getting Started"
        onClick={onClose}
      />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-glass-stroke bg-surface-elevated shadow-2xl crm-panel animate-in slide-in-from-right duration-200">
        <div className="flex items-start justify-between gap-3 border-b border-glass-stroke px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Help</p>
            <h2 id="getting-started-title" className="mt-1 text-lg font-bold text-on-surface">
              Getting Started
            </h2>
            <p className="mt-1 text-xs text-on-surface-variant">
              {done} of {total} complete · your installer path
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-on-surface-variant hover:text-on-surface"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="border-b border-glass-stroke px-5 py-3">
          <div className="mb-2 flex items-center justify-between text-[11px] text-on-surface-variant">
            <span>Progress</span>
            <span className="font-mono tabular-nums">{percent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <button
            type="button"
            onClick={onReplayTour}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-glass-stroke bg-white/5 px-3 py-2 text-[11px] font-bold text-on-surface hover:bg-white/10"
          >
            <span className="material-symbols-outlined text-sm">school</span>
            Replay spotlight tour
          </button>
        </div>

        <ul className="flex-1 space-y-2 overflow-y-auto px-4 py-4 custom-scrollbar">
          {CHECKLIST_TASKS.map((task, index) => {
            const complete = Boolean(state?.tasks?.[task.id]);
            return (
              <li
                key={task.id}
                className={`rounded-xl border px-3 py-3 transition-colors ${
                  complete
                    ? 'border-emerald-500/25 bg-emerald-500/5'
                    : 'border-glass-stroke bg-surface-container-low/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => onToggleTask?.(task.id, !complete)}
                    className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border ${
                      complete
                        ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-300'
                        : 'border-glass-stroke text-transparent hover:border-primary/50'
                    }`}
                    aria-pressed={complete}
                    aria-label={complete ? `Mark ${task.title} incomplete` : `Mark ${task.title} complete`}
                  >
                    <span className="material-symbols-outlined text-sm">check</span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-500">{index + 1}</span>
                      <p
                        className={`text-sm font-semibold ${
                          complete ? 'text-on-surface/70 line-through' : 'text-on-surface'
                        }`}
                      >
                        {task.title}
                      </p>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-on-surface-variant">{task.body}</p>
                    <Link
                      to={task.path}
                      onClick={onClose}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                    >
                      Open
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="border-t border-glass-stroke px-5 py-3 text-[11px] text-on-surface-variant">
          Tip: visiting a feature marks that step complete automatically. You can still check or uncheck
          manually.
        </div>
      </aside>
    </div>
  );
}
