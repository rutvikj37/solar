import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import LeadStatusBadge from './LeadStatusBadge';
import LeadScoreBadge from './LeadScoreBadge';
import {
  PIPELINE_STAGES,
  getStatusLabel,
  getLeadScore,
  getSolarScore,
  formatLeadValue,
  groupLeadsByStage,
} from '../../lib/leads.js';

/**
 * Drag-and-drop Kanban. Writes the same status keys via onStatusChange —
 * no new API contract.
 */
export default function LeadKanbanBoard({ leads, onStatusChange, busyId = null }) {
  const [dragId, setDragId] = useState(null);
  const [overStage, setOverStage] = useState(null);
  const groups = groupLeadsByStage(leads);

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
      {PIPELINE_STAGES.map((stage) => {
        const columnLeads = groups[stage] || [];
        const isOver = overStage === stage;
        return (
          <div
            key={stage}
            className={`shrink-0 w-[260px] flex flex-col rounded-2xl border bg-white/[0.02] ${
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
            <div className="px-3 py-2.5 border-b border-glass-stroke flex items-center justify-between gap-2 sticky top-0 bg-surface-container-low/90 backdrop-blur-md rounded-t-2xl z-[1]">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-white truncate">{getStatusLabel(stage)}</p>
                <p className="text-[10px] text-on-surface-variant font-mono">{columnLeads.length} leads</p>
              </div>
              <LeadStatusBadge status={stage} size="xs" />
            </div>

            <div className="flex-1 p-2 space-y-2 overflow-y-auto custom-scrollbar max-h-[calc(100vh-340px)] min-h-[360px]">
              {columnLeads.length === 0 && (
                <p className="text-[11px] text-on-surface-variant text-center py-8 px-2">
                  Drop leads here
                </p>
              )}
              {columnLeads.map((lead) => {
                const name = formatLeadValue(lead.owner_name, 'Unassigned Lead');
                const address = formatLeadValue(lead.address, 'No address');
                const leadScore = getLeadScore(lead);
                const solarScore = getSolarScore(lead);
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
                    className={`rounded-xl border border-glass-stroke bg-surface-container-low/80 p-3 cursor-grab active:cursor-grabbing hover:border-primary/30 transition-all ${
                      dragging ? 'opacity-50 scale-[0.98]' : ''
                    } ${busy ? 'opacity-60 pointer-events-none' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Link
                        to={`/lead/${lead.id}`}
                        className="text-sm font-semibold text-white hover:text-primary truncate leading-tight"
                        title={name}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {name}
                      </Link>
                      {leadScore >= 85 && (
                        <span className="material-symbols-outlined text-amber-400 text-base shrink-0" title="High priority">
                          local_fire_department
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mb-2" title={address}>
                      {address}
                    </p>
                    <div className="flex items-center gap-2 mb-2">
                      <LeadScoreBadge score={leadScore} />
                      {solarScore != null && (
                        <span
                          className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2 py-0.5"
                          title="Solar score"
                        >
                          S {solarScore}
                        </span>
                      )}
                    </div>
                    {lead.next_action ? (
                      <p className="text-[10px] text-amber-300/90 truncate" title={lead.next_action}>
                        Next: {lead.next_action}
                      </p>
                    ) : null}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Link
                        to={`/lead/${lead.id}`}
                        className="text-[10px] font-bold text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open
                      </Link>
                      <span className="material-symbols-outlined text-on-surface-variant text-sm">drag_indicator</span>
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
