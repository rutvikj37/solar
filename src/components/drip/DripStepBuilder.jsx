import React from 'react';

const MERGE_FIELDS = ['{owner_name}', '{address}', '{estimated_savings}', '{company_name}'];

const STEP_TEMPLATES = [
  {
    name: 'SMS Intro',
    actionType: 'sms',
    delayDays: 0,
    delayHours: 0,
    subject: '',
    templateContent:
      'Hi {owner_name}, your property at {address} has strong solar potential (~{estimated_savings} in savings). Reply YES for a free assessment!',
  },
  {
    name: 'Email Follow-up',
    actionType: 'email',
    delayDays: 2,
    delayHours: 0,
    subject: 'Solar Savings for {address}',
    templateContent:
      'Hi {owner_name},\n\nWe analyzed {address} and estimated {estimated_savings} in 25-year bill savings.\n\nWould you like to book a site audit?\n\n— {company_name}',
  },
  {
    name: 'SMS Reminder',
    actionType: 'sms',
    delayDays: 5,
    delayHours: 0,
    subject: '',
    templateContent:
      'Hi {owner_name}, just checking in about solar for {address}. Still interested? Reply YES to schedule.',
  },
];

export default function DripStepBuilder({ steps, onChange, readOnly = false }) {
  const updateStep = (index, field, value) => {
    const next = steps.map((s, i) => (i === index ? { ...s, [field]: value } : s));
    onChange(next);
  };

  const addStep = (template) => {
    const base = template || {
      actionType: 'sms',
      delayDays: 1,
      delayHours: 0,
      subject: '',
      templateContent: '',
    };
    onChange([...steps, { ...base, order: steps.length + 1 }]);
  };

  const removeStep = (index) => {
    onChange(steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 })));
  };

  const moveStep = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= steps.length) return;
    const next = [...steps];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(next.map((s, i) => ({ ...s, order: i + 1 })));
  };

  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, toIndex) => {
    e.preventDefault();
    const fromIndex = Number(e.dataTransfer.getData('text/plain'));
    if (!Number.isNaN(fromIndex)) moveStep(fromIndex, toIndex);
  };

  const insertMergeField = (index, field) => {
    const step = steps[index];
    updateStep(index, 'templateContent', `${step.templateContent || ''}${field}`);
  };

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => addStep()}
            className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-bold border border-primary/30"
          >
            + Add Step
          </button>
          {STEP_TEMPLATES.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => addStep(t)}
              className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-300 text-xs border border-glass-stroke hover:bg-white/10"
            >
              Template: {t.name}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {steps.map((step, index) => (
          <div
            key={index}
            draggable={!readOnly}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, index)}
            className="p-4 rounded-xl bg-surface-container-low border border-glass-stroke space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {!readOnly && (
                  <span className="material-symbols-outlined text-slate-500 cursor-grab text-base">drag_indicator</span>
                )}
                <span className="text-primary font-mono text-[10px] font-bold uppercase">Step {index + 1}</span>
                <select
                  value={step.actionType}
                  disabled={readOnly}
                  onChange={(e) => updateStep(index, 'actionType', e.target.value)}
                  className="bg-white/5 border border-glass-stroke rounded-lg px-2 py-1 text-xs text-white"
                >
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </div>
              {!readOnly && steps.length > 1 && (
                <button type="button" onClick={() => removeStep(index)} className="text-red-400 hover:text-red-300">
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold">Delay (days)</label>
                <input
                  type="number"
                  min="0"
                  disabled={readOnly}
                  value={step.delayDays ?? 0}
                  onChange={(e) => updateStep(index, 'delayDays', Number(e.target.value))}
                  className="w-full mt-1 bg-white/5 border border-glass-stroke rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold">Delay (hours)</label>
                <input
                  type="number"
                  min="0"
                  max="23"
                  disabled={readOnly}
                  value={step.delayHours ?? 0}
                  onChange={(e) => updateStep(index, 'delayHours', Number(e.target.value))}
                  className="w-full mt-1 bg-white/5 border border-glass-stroke rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            {step.actionType === 'email' && (
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold">Subject</label>
                <input
                  type="text"
                  disabled={readOnly}
                  value={step.subject || ''}
                  onChange={(e) => updateStep(index, 'subject', e.target.value)}
                  className="w-full mt-1 bg-white/5 border border-glass-stroke rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-slate-400 uppercase font-bold">Message</label>
                {!readOnly && (
                  <div className="flex flex-wrap gap-1">
                    {MERGE_FIELDS.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => insertMergeField(index, f)}
                        className="px-1.5 py-0.5 rounded bg-primary/15 text-primary text-[9px] font-mono"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <textarea
                rows={4}
                disabled={readOnly}
                value={step.templateContent || ''}
                onChange={(e) => updateStep(index, 'templateContent', e.target.value)}
                className="w-full bg-white/5 border border-glass-stroke rounded-lg px-3 py-2 text-xs text-white resize-y"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
