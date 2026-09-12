import React, { useEffect, useMemo, useState } from 'react';
import {
  fetchPipelineStages,
  savePipelineStages,
  resetPipelineStages,
  DEFAULT_PIPELINE_STAGE_LIST,
} from '../../lib/pipelineApi.js';

const COLORS = ['slate', 'blue', 'cyan', 'amber', 'orange', 'purple', 'sky', 'green'];

/**
 * Edit labels/order and add custom stages. System keys cannot be deleted.
 */
export default function PipelineCustomizeModal({ open, onClose, onSaved }) {
  const [stages, setStages] = useState(DEFAULT_PIPELINE_STAGE_LIST);
  const [reservedKeys, setReservedKeys] = useState([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [newLabel, setNewLabel] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    fetchPipelineStages()
      .then((data) => {
        setStages(data.stages || DEFAULT_PIPELINE_STAGE_LIST);
        setReservedKeys(data.reservedKeys || []);
      })
      .catch(() => setStages(DEFAULT_PIPELINE_STAGE_LIST));
  }, [open]);

  const canMove = useMemo(() => stages.length > 1, [stages]);

  if (!open) return null;

  const move = (index, dir) => {
    const next = [...stages];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setStages(next.map((s, i) => ({ ...s, order: i })));
  };

  const updateField = (index, patch) => {
    setStages((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const removeCustom = (index) => {
    const stage = stages[index];
    if (stage.system || reservedKeys.includes(stage.key)) return;
    setStages((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i })));
  };

  const addCustom = () => {
    const label = newLabel.trim();
    if (!label) return;
    setStages((prev) => [
      ...prev,
      {
        key: '',
        label,
        color: 'blue',
        order: prev.length,
        system: false,
      },
    ]);
    setNewLabel('');
  };

  const handleSave = async () => {
    setBusy('save');
    setError('');
    try {
      const data = await savePipelineStages(stages);
      onSaved?.(data.stages);
      onClose?.();
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setBusy('');
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset pipeline to default stages?')) return;
    setBusy('reset');
    setError('');
    try {
      const data = await resetPipelineStages();
      setStages(data.stages || DEFAULT_PIPELINE_STAGE_LIST);
      onSaved?.(data.stages);
    } catch (err) {
      setError(err.message || 'Reset failed');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl max-h-[90vh] overflow-hidden rounded-2xl border border-glass-stroke bg-surface-elevated shadow-2xl flex flex-col crm-panel">
        <div className="px-5 py-4 border-b border-glass-stroke flex items-start justify-between gap-3">
          <div>
            <h2 className="text-on-surface font-bold text-base">Customize Pipeline</h2>
            <p className="text-[11px] text-on-surface-variant mt-1">
              Rename and reorder stages. System stages stay for drip, appointments, and proposals.
              Add custom stages for your process.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface"
            aria-label="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
          {stages.map((stage, index) => (
            <div
              key={`${stage.key || 'new'}-${index}`}
              className="flex items-center gap-2 p-2.5 rounded-xl border border-glass-stroke bg-white/[0.03]"
            >
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  disabled={!canMove || index === 0}
                  onClick={() => move(index, -1)}
                  className="text-on-surface-variant hover:text-on-surface disabled:opacity-30"
                  aria-label="Move up"
                >
                  <span className="material-symbols-outlined text-sm">keyboard_arrow_up</span>
                </button>
                <button
                  type="button"
                  disabled={!canMove || index === stages.length - 1}
                  onClick={() => move(index, 1)}
                  className="text-on-surface-variant hover:text-on-surface disabled:opacity-30"
                  aria-label="Move down"
                >
                  <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
                </button>
              </div>
              <input
                type="text"
                value={stage.label}
                onChange={(e) => updateField(index, { label: e.target.value })}
                className="flex-1 min-w-0 bg-surface-container-low border border-glass-stroke rounded-lg py-1.5 px-2.5 text-on-surface text-xs"
              />
              <select
                value={stage.color || 'slate'}
                onChange={(e) => updateField(index, { color: e.target.value })}
                className="bg-surface-container-low border border-glass-stroke rounded-lg py-1.5 px-2 text-on-surface text-[11px]"
              >
                {COLORS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {stage.system || reservedKeys.includes(stage.key) ? (
                <span className="text-[9px] font-bold uppercase text-primary/80 px-1.5">System</span>
              ) : (
                <button
                  type="button"
                  onClick={() => removeCustom(index)}
                  className="text-red-300 hover:text-red-200"
                  aria-label="Remove custom stage"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              )}
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="New custom stage label…"
              className="flex-1 bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') addCustom();
              }}
            />
            <button
              type="button"
              onClick={addCustom}
              className="px-3 py-2 rounded-lg bg-white/10 text-on-surface text-xs font-bold"
            >
              Add
            </button>
          </div>
          {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>

        <div className="px-4 py-3 border-t border-glass-stroke flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={!!busy}
            className="text-xs font-bold text-on-surface-variant hover:text-on-surface disabled:opacity-50"
          >
            {busy === 'reset' ? 'Resetting…' : 'Reset defaults'}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-white/5 border border-glass-stroke text-xs font-bold text-on-surface"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!!busy}
              className="px-3.5 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold disabled:opacity-50"
            >
              {busy === 'save' ? 'Saving…' : 'Save pipeline'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
