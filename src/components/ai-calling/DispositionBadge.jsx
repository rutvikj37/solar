import React from 'react';

const BADGE_STYLES = {
  // Campaign statuses
  draft: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 animate-pulse',
  paused: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  completed: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',

  // Call statuses
  initiated: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  ringing: 'bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse',
  in_progress: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 animate-pulse',
  no_answer: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  busy: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
  voicemail: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  transferred: 'bg-teal-500/15 text-teal-400 border-teal-500/30',

  // Dispositions
  qualified: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  not_interested: 'bg-red-500/15 text-red-400 border-red-500/30',
  callback: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  appointment_booked: 'bg-green-500/15 text-green-300 border-green-500/30',
  wrong_number: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  do_not_call: 'bg-red-500/15 text-red-400 border-red-500/30',
  voicemail_left: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  no_disposition: 'bg-slate-500/15 text-slate-400 border-slate-500/30',

  // Sentiments
  positive: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  neutral: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  negative: 'bg-red-500/15 text-red-400 border-red-500/30',
  unknown: 'bg-slate-500/15 text-slate-400 border-slate-500/30',

  // Queue
  pending: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  calling: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 animate-pulse',
  answered: 'bg-green-500/15 text-green-400 border-green-500/30',

  // Appointment statuses
  confirmed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  rescheduled: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  no_show: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const LABELS = {
  in_progress: 'In Progress',
  no_answer: 'No Answer',
  not_interested: 'Not Interested',
  appointment_booked: 'Appt. Booked',
  wrong_number: 'Wrong Number',
  do_not_call: 'Do Not Call',
  voicemail_left: 'Voicemail Left',
  no_disposition: 'Pending',
  no_show: 'No Show',
};

export default function DispositionBadge({ status, size = 'sm' }) {
  const key = (status || 'unknown').toLowerCase().replace(/-/g, '_');
  const style = BADGE_STYLES[key] || BADGE_STYLES.unknown;
  const label = LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const sizeClass = size === 'lg'
    ? 'text-[11px] px-3 py-1 rounded-lg'
    : 'text-[9px] px-2 py-0.5 rounded-md';

  return (
    <span className={`${style} ${sizeClass} font-bold uppercase tracking-wider border inline-flex items-center gap-1 select-none`}>
      {label}
    </span>
  );
}
