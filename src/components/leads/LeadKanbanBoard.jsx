import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import LeadStatusBadge from './LeadStatusBadge';
import {
  PIPELINE_STAGES,
  getStatusLabel,
  getLeadScore,
  getSolarScore,
  formatLeadValue,
  groupLeadsByStage,
  getLeadImageUrl,
} from '../../lib/leads.js';

/**
 * Mockup-style Kanban: property thumb, dual scores, next action, drag-drop.
 */
export default function LeadKanbanBoard({
  leads,
  onStatusChange,
  busyId = null,
  stages = null,
  statusConfigMap = null,
}) {
  const [dragId, setDragId] = useState(null);
  const [overStage, setOverStage] = useState(null);
  const stageKeys = stages?.length
    ? [...stages].sort((a, b) => a.order - b.order).map((s) => s.key)
    : PIPELINE_STAGES;
  const groups = groupLeadsByStage(leads, stageKeys);
  const labelFor = (key) => {
    if (statusConfigMap?.[key]?.label) return statusConfigMap[key].label;
    const fromStages = stages?.find((s) => s.key === key);
    return fromStages?.label || getStatusLabel(key);
  };

  const handleDrop = async (stage) => {
    setOverStage(null);
    if (dragId == null) return;
    const lead = leads.find((l) => l.id === dragId);
    setDragId(null);
    if (!lead || lead.status === stage) return;
    await onStatusChange(lead.id, stage);
  };

  return (
    <div className="flex gap-3 overflow-x-auto custom-scrollbar pb-2 min-h-[min(70vh,640px)]">
      {stageKeys.map((stage) => {
        const columnLeads = groups[stage] || [];
        const isOver = overStage === stage;
        return (
          <div
            key={stage}
            className={`shrink-0 w-[280px] flex flex-col rounded-2xl border bg-surface-container-low/40 ${
              isOver ? 'border-primary/50 bg-primary/5' : 'border-glass-stroke'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setOverStage(stage);
            }}
            onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(stage);
            }}
          >
            <div className="px-3 py-3 border-b border-glass-stroke flex items-center justify-between gap-2 sticky top-0 bg-surface-container/95 backdrop-blur-md rounded-t-2xl z-[1]">
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{labelFor(stage)}</p>
                <p className="text-[10px] text-on-surface-variant font-mono mt-0.5">
                  {columnLeads.length} Lead{columnLeads.length === 1 ? '' : 's'}
                </p>
              </div>
              <LeadStatusBadge status={stage} size="xs" configMap={statusConfigMap} />
            </div>

            <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto custom-scrollbar max-h-[calc(100vh-340px)] min-h-[400px]">
              {columnLeads.length === 0 && (
                <p className="text-[11px] text-on-surface-variant text-center py-10 px-2 border border-dashed border-glass-stroke rounded-xl">
                  Drop leads here
                </p>
              )}
              {columnLeads.map((lead) => {
                const name = formatLeadValue(lead.owner_name, 'Unassigned Lead');
                const address = formatLeadValue(lead.address, 'No address');
                const leadScore = getLeadScore(lead);
                const solarScore = getSolarScore(lead);
                const img = getLeadImageUrl(lead);
                const dragging = dragId === lead.id;
                const busy = busyId === lead.id;
                return (
                  <div
                    key={lead.id}
                    draggable={!busy}
                    onDragStart={() => setDragId(lead.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverStage(null);
                    }}
                    className={`rounded-xl border border-glass-stroke bg-surface-elevated/90 overflow-hidden cursor-grab active:cursor-grabbing hover:border-primary/40 transition-all shadow-sm ${
                      dragging ? 'opacity-50 scale-[0.98]' : ''
                    } ${busy ? 'opacity-60 pointer-events-none' : ''}`}
                  >
                    <div className="relative h-20 bg-[#0B1220]">
                      {img ? (
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-on-surface-variant text-3xl">
                            home
                          </span>
                        </div>
                      )}
                      {leadScore >= 85 && (
                        <span className="absolute top-1.5 right-1.5 material-symbols-outlined text-amber-400 text-base drop-shadow">
                          local_fire_department
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <Link
                        to={`/lead/${lead.id}`}
                        className="text-sm font-bold text-white hover:text-primary truncate block leading-tight"
                        title={name}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {name}
                      </Link>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5" title={address}>
                        {address}
                      </p>
                      <div className="flex items-center gap-2 mt-2.5">
                        <span
                          className="inline-flex items-center justify-center min-w-[2rem] h-7 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[11px] font-bold font-mono"
                          title="Lead score"
                        >
                          {leadScore || '—'}
                        </span>
                        <span
                          className="inline-flex items-center justify-center min-w-[2rem] h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold font-mono"
                          title="Solar score"
                        >
                          {solarScore != null ? solarScore : '—'}
                        </span>
                      </div>
                      {(lead.next_action || lead.follow_up_at) && (
                        <p className="text-[10px] text-amber-300/90 truncate mt-2" title={lead.next_action || ''}>
                          Next: {lead.next_action || 'Follow up'}
                        </p>
                      )}
                      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-glass-stroke/60 pt-2">
                        <div className="flex items-center gap-1">
                          {lead.phone && lead.phone !== 'Not Available' && (
                            <a
                              href={`tel:${lead.phone}`}
                              className="p-1 rounded text-on-surface-variant hover:text-primary"
                              onClick={(e) => e.stopPropagation()}
                              title="Call"
                            >
                              <span className="material-symbols-outlined text-sm">call</span>
                            </a>
                          )}
                          <Link
                            to={`/lead/${lead.id}?tab=outreach`}
                            className="p-1 rounded text-on-surface-variant hover:text-primary"
                            onClick={(e) => e.stopPropagation()}
                            title="Email"
                          >
                            <span className="material-symbols-outlined text-sm">mail</span>
                          </Link>
                        </div>
                        <span className="material-symbols-outlined text-on-surface-variant text-sm">
                          drag_indicator
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
