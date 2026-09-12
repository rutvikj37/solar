import React, { useEffect, useState } from 'react';

export default function AskHeraFab({ className = '' }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className={`flex flex-col items-end gap-2 ${className}`}>
      {open && (
        <div className="w-72 max-w-[calc(100vw-2rem)] bg-deep/95 border border-glass-stroke rounded-2xl shadow-2xl backdrop-blur-xl p-4 text-left animate-fade-in">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">auto_awesome</span>
              <div>
                <p className="text-xs font-bold text-on-surface">Ask Hera</p>
                <p className="text-[10px] text-on-surface-variant">AI mission assistant</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-on-surface-variant hover:text-on-surface p-0.5"
              aria-label="Close Ask Hera"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
          <p className="text-[11px] text-on-surface-variant leading-relaxed">
            Hera chat is coming soon. Use Mission Targeting and Lead Manager for now — this panel is a UI stub only.
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 w-full py-2 rounded-lg bg-primary/15 border border-primary/25 text-primary text-[10px] font-bold uppercase tracking-wider hover:bg-primary/25 transition-colors"
          >
            Got it
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-xl border text-xs font-bold transition-all active:scale-[0.98] ${
          open
            ? 'bg-primary text-on-primary border-primary'
            : 'bg-deep/95 text-on-surface border-glass-stroke backdrop-blur-xl hover:bg-white/10'
        }`}
        aria-expanded={open}
        aria-label="Ask Hera"
      >
        <span className="material-symbols-outlined text-base">auto_awesome</span>
        Ask Hera
      </button>
    </div>
  );
}
