import React, { useEffect, useState } from 'react';
import { API_BASE } from '../../config.js';

const SOURCE_LABELS = {
  sms_keyword: 'replied STOP',
  email_unsubscribe: 'unsubscribe link',
  email_one_click: 'one-click unsubscribe',
  manual: 'manual',
};

/** Opt-out status chips (registry + manual do-not-contact) for a CRM lead. */
export default function OptOutBadge({ leadId, refreshKey }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!leadId) return undefined;
    let cancelled = false;
    const token = localStorage.getItem('solar_token');
    fetch(`${API_BASE}/api/compliance/leads/${leadId}/status`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId, refreshKey]);

  if (!status?.any) return null;

  const title = (status.entries || [])
    .map((e) => `${e.type} · ${e.channel} · ${SOURCE_LABELS[e.source] || e.source} · ${new Date(e.at).toLocaleDateString()}`)
    .join('\n');

  const chips = status.manual
    ? ['Do not contact']
    : [status.email && 'Email unsubscribed', status.sms && 'SMS opted out', status.call && !status.sms && 'Do not call']
        .filter(Boolean);

  return (
    <>
      {chips.map((label) => (
        <span
          key={label}
          title={title || label}
          className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-500"
        >
          <span className="material-symbols-outlined text-[12px]">block</span>
          {label}
        </span>
      ))}
    </>
  );
}
