import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../../services/api.js';

const TEMPLATES = [
  {
    id: 'intro',
    label: 'Intro / Value',
    subject: 'Quick question about solar at {{address}}',
    body: 'Hi {{name}},\n\nI reviewed your property and wanted to share a quick solar savings estimate. Would you be open to a short call this week?\n\nThanks,',
  },
  {
    id: 'followup',
    label: 'Follow-up',
    subject: 'Following up on your solar estimate',
    body: 'Hi {{name}},\n\nJust checking in on the solar estimate I sent. Happy to answer questions or walk through financing options.\n\nBest,',
  },
  {
    id: 'appointment',
    label: 'Appointment nudge',
    subject: 'Site survey availability',
    body: 'Hi {{name}},\n\nWould a site survey this week work for you? I can hold a couple of slots and send a calendar invite.\n\nThanks,',
  },
  {
    id: 'proposal',
    label: 'Proposal reminder',
    subject: 'Your solar proposal is ready',
    body: 'Hi {{name}},\n\nYour personalized solar proposal is ready to review. Let me know if you have any questions on pricing or equipment.\n\nRegards,',
  },
];

function blankStep(order = 1) {
  const tpl = TEMPLATES[Math.min(order - 1, TEMPLATES.length - 1)];
  return {
    key: `s-${Date.now()}-${order}`,
    delayDays: order === 1 ? 0 : 2,
    delayHours: 0,
    actionType: 'email',
    subject: tpl.subject,
    templateContent: tpl.body,
    templateId: tpl.id,
    sendTime: '09:00',
  };
}

/**
 * Mockup-style Create Email Sequence — saves via /api/drip and enrolls this lead.
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
  const [seqName, setSeqName] = useState(`Outreach — ${leadName || 'Lead'}`);
  const [templatePick, setTemplatePick] = useState(TEMPLATES[0].id);
  const [steps, setSteps] = useState([blankStep(1), blankStep(2), blankStep(3)]);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [enrollId, setEnrollId] = useState('');

  const summary = useMemo(() => {
    const emailCount = steps.filter((s) => s.actionType === 'email').length;
    const totalDays = steps.reduce((sum, s) => sum + (Number(s.delayDays) || 0), 0);
    return { emailCount, totalDays, stepCount: steps.length };
  }, [steps]);

  const applyTemplateToStep = (idx, templateId) => {
    const tpl = TEMPLATES.find((t) => t.id === templateId) || TEMPLATES[0];
    setSteps((prev) =>
      prev.map((s, i) =>
        i === idx
          ? {
              ...s,
              templateId: tpl.id,
              subject: tpl.subject
                .replace('{{address}}', address || 'your home')
                .replace('{{name}}', leadName || 'there'),
              templateContent: tpl.body
                .replace(/\{\{name\}\}/g, leadName || 'there')
                .replace(/\{\{address\}\}/g, address || 'your property'),
            }
          : s,
      ),
    );
  };

  const addStep = () => {
    setSteps((prev) => [...prev, blankStep(prev.length + 1)]);
  };

  const removeStep = (idx) => {
    setSteps((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const updateStep = (idx, patch) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

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
        description: `Created from Lead ${leadId}`,
        enrollmentMode: 'manual',
        triggerMinScore: 0,
        steps: steps.map((s, i) => ({
          order: i + 1,
          delayDays: Number(s.delayDays) || 0,
          delayHours: Number(s.delayHours) || 0,
          actionType: s.actionType || 'email',
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
        <div className="glass-card rounded-xl border border-glass-stroke p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white">Create Email Sequence</h3>
              <p className="text-[11px] text-on-surface-variant mt-0.5">
                Build steps, then save to Drip and enroll this lead.
              </p>
            </div>
            <Link to="/drip" className="text-[11px] text-primary font-bold hover:underline">
              Open Drip Workflows →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-[10px] uppercase tracking-wider text-slate-400">
              Sequence name
              <input
                className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white text-xs"
                value={seqName}
                onChange={(e) => setSeqName(e.target.value)}
              />
            </label>
            <label className="text-[10px] uppercase tracking-wider text-slate-400">
              Start from template
              <select
                className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white text-xs"
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
            </label>
          </div>

          <div className="space-y-3">
            {steps.map((step, idx) => (
              <div
                key={step.key}
                className="rounded-xl border border-glass-stroke bg-white/[0.03] p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-white">Step {idx + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeStep(idx)}
                    className="text-[10px] font-bold text-red-300 hover:text-red-200"
                    disabled={steps.length <= 1}
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <label className="text-[9px] uppercase text-slate-500">
                    Delay (days)
                    <input
                      type="number"
                      min={0}
                      className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-1.5 px-2 text-white text-xs"
                      value={step.delayDays}
                      onChange={(e) => updateStep(idx, { delayDays: e.target.value })}
                    />
                  </label>
                  <label className="text-[9px] uppercase text-slate-500">
                    Time
                    <input
                      type="time"
                      className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-1.5 px-2 text-white text-xs"
                      value={step.sendTime || '09:00'}
                      onChange={(e) => updateStep(idx, { sendTime: e.target.value })}
                    />
                  </label>
                  <label className="text-[9px] uppercase text-slate-500 sm:col-span-2">
                    Template
                    <select
                      className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-1.5 px-2 text-white text-xs"
                      value={step.templateId || 'intro'}
                      onChange={(e) => applyTemplateToStep(idx, e.target.value)}
                    >
                      {TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block text-[9px] uppercase text-slate-500">
                  Subject
                  <input
                    className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-1.5 px-2 text-white text-xs"
                    value={step.subject}
                    onChange={(e) => updateStep(idx, { subject: e.target.value })}
                  />
                </label>
                <label className="block text-[9px] uppercase text-slate-500">
                  Body
                  <textarea
                    className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-1.5 px-2 text-white text-xs min-h-[72px]"
                    value={step.templateContent}
                    onChange={(e) => updateStep(idx, { templateContent: e.target.value })}
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addStep}
              className="inline-flex items-center gap-1.5 bg-white/10 text-white px-3 py-2 rounded-lg text-xs font-bold"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              Add step
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || optOut}
              className="inline-flex items-center gap-1.5 bg-primary text-on-primary px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save & Enroll'}
            </button>
          </div>
          {msg && (
            <p className={`text-[11px] ${msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('opt') ? 'text-red-400' : 'text-emerald-400'}`}>
              {msg}
            </p>
          )}
        </div>

        <div className="glass-card rounded-xl border border-glass-stroke p-5 space-y-3">
          <h3 className="text-sm font-bold text-white">Or enroll in existing sequence</h3>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <label className="flex-1 text-[10px] uppercase tracking-wider text-slate-400">
              Sequence
              <select
                value={enrollId}
                onChange={(e) => setEnrollId(e.target.value)}
                className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white text-xs"
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
              className="bg-white/10 text-white px-4 py-2 rounded-lg font-bold text-xs disabled:opacity-50"
            >
              {busy === 'enroll' ? 'Enrolling…' : 'Start Sequence'}
            </button>
          </div>
          {enrollments?.length > 0 && (
            <div className="space-y-2 pt-2">
              {enrollments.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/5 border border-glass-stroke"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{e.campaignName}</p>
                    <p className="text-[10px] text-on-surface-variant">
                      Step {e.currentStep} · {e.status || 'active'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCancelEnrollment?.(e.id)}
                    className="text-[10px] font-bold text-red-300 hover:text-red-200"
                  >
                    Stop
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="glass-card rounded-xl border border-glass-stroke p-5">
          <h3 className="text-sm font-bold text-white mb-3">Sequence summary</h3>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-lg bg-white/5 p-3 text-center">
              <p className="text-[9px] uppercase text-slate-500">Emails</p>
              <p className="text-xl font-black text-white">{summary.emailCount}</p>
            </div>
            <div className="rounded-lg bg-white/5 p-3 text-center">
              <p className="text-[9px] uppercase text-slate-500">Steps</p>
              <p className="text-xl font-black text-white">{summary.stepCount}</p>
            </div>
            <div className="rounded-lg bg-white/5 p-3 text-center">
              <p className="text-[9px] uppercase text-slate-500">Days</p>
              <p className="text-xl font-black text-primary">{summary.totalDays}</p>
            </div>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
            Timeline
          </p>
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={s.key} className="flex gap-2 text-[11px]">
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-white font-semibold truncate">{s.subject || `Step ${i + 1}`}</p>
                  <p className="text-slate-500">
                    Day +{s.delayDays || 0}
                    {s.sendTime ? ` · ${s.sendTime}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
