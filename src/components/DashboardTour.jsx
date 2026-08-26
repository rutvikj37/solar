import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const TOUR_KEY = 'solarx_dashboard_tour_v1';

const STEPS = [
  {
    title: 'Targeting map',
    body: 'Search any address, draw a freehand or point-click lasso, then unlock high-fit homes nearby.',
    to: '/map',
    cta: 'Open Targeting',
  },
  {
    title: 'Bulk Scan',
    body: 'Scan an area with filters: min roof size, single-family only, and skip homes that already have panels.',
    to: '/bulk-scan',
    cta: 'Open Bulk Scan',
  },
  {
    title: 'Marketplace',
    body: 'Bid on qualified homeowner inquiries. Contact details stay hidden until you win.',
    to: '/marketplace',
    cta: 'Open Marketplace',
  },
  {
    title: 'Lead Manager',
    body: 'Track unlocked leads, schedule follow-ups, log what you discussed, and send quotations.',
    to: '/my-leads',
    cta: 'Open Leads',
  },
  {
    title: 'Appointments',
    body: 'See upcoming vs scheduled visits. Booking a survey can email the homeowner a confirmation.',
    to: '/appointments',
    cta: 'Open Appointments',
  },
];

export default function DashboardTour({ forceOpen = false, onClose }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      setStep(0);
      return;
    }
    try {
      if (!localStorage.getItem(TOUR_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [forceOpen]);

  const close = (persist = true) => {
    if (persist) {
      try {
        localStorage.setItem(TOUR_KEY, '1');
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
    onClose?.();
  };

  if (!open) return null;
  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0D1122] shadow-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Tutorial · {step + 1}/{STEPS.length}
            </p>
            <h3 className="text-lg font-bold text-white mt-1">{current.title}</h3>
          </div>
          <button type="button" onClick={() => close(true)} className="text-slate-400 hover:text-white p-1">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
        <p className="text-sm text-white/70 leading-relaxed">{current.body}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            to={current.to}
            onClick={() => close(true)}
            className="rounded-lg bg-primary text-on-primary text-xs font-bold px-3 py-2"
          >
            {current.cta}
          </Link>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="rounded-lg border border-white/15 bg-white/5 text-xs font-bold px-3 py-2 text-white"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={() => close(true)}
              className="rounded-lg border border-white/15 bg-white/5 text-xs font-bold px-3 py-2 text-white"
            >
              Done
            </button>
          )}
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="rounded-lg text-xs font-bold px-3 py-2 text-slate-400"
            >
              Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function DashboardTourButton() {
  const [force, setForce] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setForce(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-white/10"
      >
        <span className="material-symbols-outlined text-sm">school</span>
        Start tutorial
      </button>
      {force && <DashboardTour forceOpen onClose={() => setForce(false)} />}
    </>
  );
}
