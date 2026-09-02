import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../../services/api.js';

const TEMPLATES = [
  {
    id: 'intro',
    label: 'Proposal Follow Up 1',
    subject: 'Quick idea to lower your energy bills',
    body: 'Hi {owner_name},\n\nI reviewed {address} and wanted to share a quick solar savings idea. Open to a short call?\n\nThanks,',
  },
  {
    id: 'followup',
    label: 'Proposal Follow Up 2',
    subject: 'Following up on your solar estimate',
    body: 'Hi {owner_name},\n\nJust checking in on the solar estimate. Happy to walk through financing options.\n\nBest,',
  },
  {
    id: 'appointment',
    label: 'Proposal Follow Up 3',
    subject: 'Your solar proposal is ready',
    body: 'Hi {owner_name},\n\nYour proposal is ready to review. Any questions on pricing or equipment?\n\nRegards,',
  },
  {
    id: 'custom',
    label: 'Custom template',
    subject: 'Solar opportunity at {address}',
    body: 'Hi {owner_name},\n\n',
  },
];

function blankStep(order = 1) {
  const tpl = TEMPLATES[Math.min(order - 1, TEMPLATES.length - 1)];
  const delayDays = order === 1 ? 0 : order === 2 ? 3 : 7;
  return {
    key: `s-${Date.now()}-${order}-${Math.random().toString(36).slice(2, 6)}`,
    delayDays,
    delayHours: 0,
    actionType: 'email',
    subject: tpl.subject,
    templateContent: tpl.body,
    templateId: tpl.id,
    sendTime: '10:00',
  };
}

function dayLabel(step, idx, steps) {
  if (idx === 0 || Number(step.delayDays) === 0) return 'Day 1 · Immediately';
  let cumulative = 0;
  for (let i = 0; i <= idx; i++) cumulative += Number(steps[i].delayDays) || 0;
  return `Day ${Math.max(1, cumulative)} · After ${step.delayDays} day${Number(step.delayDays) === 1 ? '' : 's'}`;
}

/**
 * Mockup-aligned Create Email Sequence — saves via /api/drip.
 */
export default function EmailSequenceBuilder({
  leadId,
  leadName = '',
  address = '',
  campaigns = [],
  enrollments = [],
  optOut = false,
  onSaved,
  onEnrollExisting,
  onCancelEnrollment,
  busy = '',
}) {
  const [seqName, setSeqName] = useState('Proposal Follow Up');
  const [templatePick, setTemplatePick] = useState(TEMPLATES[0].id);
  const [steps, setSteps] = useState([blankStep(1), blankStep(2), blankStep(3)]);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [enrollId, setEnrollId] = useState('');

  const summary = useMemo(() => {
    const emailCount = steps.filter((s) => s.actionType === 'email').length;
    const totalDays = steps.reduce((sum, s, i) => {
      if (i === 0) return sum;
      return sum + (Number(s.delayDays) || 0);
    }, 0);
    return { emailCount, totalDays: totalDays || steps.length, stepCount: steps.length };
  }, [steps]);

  const timeline = useMemo(() => {
    let day = 1;
    return steps.map((s, i) => {
      if (i > 0) day += Number(s.delayDays) || 0;
      const tpl = TEMPLATES.find((t) => t.id === s.templateId);
      return {
        day: i === 0 ? 1 : day,
        label: tpl?.label || `Step ${i + 1}`,
        when: i === 0 ? 'Immediately' : `After ${s.delayDays} days`,
        time: s.sendTime || '10:00',
        key: s.key,
      };
    });
  }, [steps]);

  const applyTemplateToStep = (idx, templateId) => {
    const tpl = TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0];
    setSteps((prev) =>
      prev.map((s, i) =>
        i === idx
          ? {
              ...s,
              templateId: tpl.id,
              subject: tpl.subject,
              templateContent: tpl.body,
            }
          : s,
      ),
    );
  };

  const addStep = () => setSteps((prev) => [...prev, blankStep(prev.length + 1)]);
  const removeStep = (idx) => setSteps((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  const updateStep = (idx, patch) => setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const handleSave = async () => {
    if (optOut) {
      setMsg('Lead opted out of outreach.');
      return;
    }
    if (!seqName.trim()) {
      setMsg('Enter a sequence name');
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      const payload = {
        name: seqName.trim(),
        description: `Created from Lead ${leadId}${leadName ? ` (${leadName})` : ''}`,
        enrollmentMode: 'manual',
        triggerMinScore: 0,
        steps: steps.map((s, i) => ({
          order: i + 1,
          delayDays: Number(s.delayDays) || 0,
          delayHours: Number(s.delayHours) || 0,
          actionType: 'email',
          subject: s.subject || `Step ${i + 1}`,
          templateContent: s.templateContent || '',
        })),
      };
      const created = await apiService.createDripCampaign(payload);
      const campaignId = created?.id || created?.campaign?.id;
      if (campaignId && leadId) {
        await apiService.enrollLeadsInCampaign(campaignId, { leadIds: [Number(leadId)] });
      }
      setMsg('Sequence saved and lead enrolled.');
      if (onSaved) await onSaved(created);
    } catch (err) {
      setMsg(err.message || 'Failed to save sequence');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2 space-y-4">
        <div className="crm-panel p-5 sm:p-6 space-y-5">
          <div>
            <h3 className="text-base font-bold text-on-surface">Create Email Sequence</h3>
            <p className="text-[12px] text-on-surface-variant mt-1">
              Build a multi-step email sequence for this lead. Save enrolls them in Drip Workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-[11px] font-semibold text-on-surface-variant">
              Sequence Name
              <input
                className="mt-1.5 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 text-on-surface text-sm"
                value={seqName}
                onChange={(e) => setSeqName(e.target.value)}
              />
            </label>
            <label className="text-[11px] font-semibold text-on-surface-variant">
              Select Email Template
              <div className="mt-1.5 flex gap-2">
                <select
                  className="flex-1 bg-surface-container-low border border-glass-stroke rounded-lg py-2.5 px-3 text-on-surface text-sm"
                  value={templatePick}
                  onChange={(e) => {
                    setTemplatePick(e.target.value);
                    applyTemplateToStep(0, e.target.value);
                  }}
                >
                  {TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </label>
          </div>

          <div className="space-y-3">
            {steps.map((step, idx) => (
              <div
                key={step.key}
                className="rounded-xl border border-glass-stroke bg-surface-container-low/40 p-3.5 flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-on-surface-variant mt-1 cursor-grab">drag_indicator</span>
                  <div className="flex items-center gap-2 min-w-0 pt-0.5">
                    <span className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-base">mail</span>
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-on-surface">Step {idx + 1}</p>
                      <p className="text-[11px] text-on-surface-variant">{dayLabel(step, idx, steps)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeStep(idx)}
                    className="ml-auto p-1.5 text-red-400 hover:text-red-300"
                    disabled={steps.length <= 1}
                    title="Remove step"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-0 sm:pl-11">
                  <label className="text-[10px] uppercase tracking-wider text-on-surface-variant sm:col-span-2">
                    Template
                    <select
                      className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-2.5 text-on-surface text-xs"
                      value={step.templateId || 'intro'}
                      onChange={(e) => applyTemplateToStep(idx, e.target.value)}
                    >
                      {TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <span className="block mt-1 text-[11px] text-on-surface-variant truncate normal-case tracking-normal">
                      Subject: {step.subject}
                    </span>
                  </label>
                  <label className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                    Send at
                    <input
                      type="time"
                      className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-2.5 text-on-surface text-xs"
                      value={step.sendTime || '10:00'}
                      onChange={(e) => updateStep(idx, { sendTime: e.target.value })}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2 pl-0 sm:pl-11">
                  <label className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                    Delay (days)
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-2.5 text-on-surface text-xs"
                      value={step.delayDays}
                      onChange={(e) => updateStep(idx, { delayDays: e.target.value })}
                    />
                  </label>
                  <label className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                    Subject
                    <input
                      className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-2.5 text-on-surface text-xs"
                      value={step.subject}
                      onChange={(e) => updateStep(idx, { subject: e.target.value })}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addStep}
            className="w-full border border-dashed border-glass-stroke rounded-xl py-3 text-sm font-bold text-primary hover:bg-primary/5 transition-colors"
          >
            + Add Email Step
          </button>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
            <Link to="/drip" className="text-sm font-semibold text-on-surface-variant hover:text-on-surface px-3 py-2">
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || optOut}
              className="bg-primary text-on-primary px-5 py-2.5 rounded-lg text-sm font-bold disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Sequence'}
            </button>
          </div>
          {msg && (
            <p
              className={`text-[12px] ${
                msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('opt')
                  ? 'text-red-400'
                  : 'text-emerald-500'
              }`}
            >
              {msg}
            </p>
          )}
        </div>

        <div className="crm-panel p-5 space-y-3">
          <h3 className="text-sm font-bold text-on-surface">Or enroll in existing sequence</h3>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <label className="flex-1 text-[10px] uppercase tracking-wider text-on-surface-variant">
              Sequence
              <select
                value={enrollId}
                onChange={(e) => setEnrollId(e.target.value)}
                className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface text-xs"
                disabled={optOut}
              >
                <option value="">Select sequence…</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || `Campaign #${c.id}`}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => onEnrollExisting?.(enrollId)}
              disabled={busy === 'enroll' || optOut || !enrollId}
              className="bg-surface-container-high text-on-surface px-4 py-2 rounded-lg font-bold text-xs disabled:opacity-50 border border-glass-stroke"
            >
              {busy === 'enroll' ? 'Enrolling…' : 'Start Sequence'}
            </button>
          </div>
          {enrollments?.length > 0 && (
            <div className="space-y-2 pt-1">
              {enrollments.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-glass-stroke bg-surface-container-low/50"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-on-surface truncate">{e.campaignName}</p>
                    <p className="text-[10px] text-on-surface-variant">
                      Step {e.currentStep} · {e.status || 'active'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCancelEnrollment?.(e.id)}
                    className="text-[10px] font-bold text-red-400"
                  >
                    Stop
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="crm-panel p-5 h-fit sticky top-24">
        <h3 className="text-sm font-bold text-on-surface mb-4">Sequence Summary</h3>
        <div className="grid grid-cols-3 gap-2 mb-5">
          <div className="rounded-lg bg-primary/10 p-3 text-center">
            <p className="text-lg font-black text-on-surface">{summary.emailCount}</p>
            <p className="text-[9px] uppercase text-on-surface-variant font-bold">Emails</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-3 text-center">
            <p className="text-lg font-black text-on-surface">{summary.totalDays}</p>
            <p className="text-[9px] uppercase text-on-surface-variant font-bold">Total Days</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-3 text-center">
            <p className="text-lg font-black text-primary">100%</p>
            <p className="text-[9px] uppercase text-on-surface-variant font-bold">Email</p>
          </div>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Timeline</p>
        <ol className="relative space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-glass-stroke">
          {timeline.map((t) => (
            <li key={t.key} className="relative flex gap-3 pl-0">
              <span className="relative z-[1] w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[14px]">mail</span>
              </span>
              <div className="min-w-0 pb-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-on-surface">Day {t.day}</p>
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                    Email
                  </span>
                </div>
                <p className="text-[12px] text-on-surface truncate mt-0.5">{t.label}</p>
                <p className="text-[11px] text-on-surface-variant">
                  {t.when} · {t.time}
                </p>
              </div>
            </li>
          ))}
        </ol>
        {address ? (
          <p className="text-[10px] text-on-surface-variant mt-4 truncate" title={address}>
            Lead: {leadName || '—'} · {address}
          </p>
        ) : null}
      </div>
    </div>
  );
}
