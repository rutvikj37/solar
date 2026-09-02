import { API_BASE } from '../config.js';
import {
  STATUS_OPTIONS as DEFAULT_STATUS_OPTIONS,
  STATUS_CONFIG as DEFAULT_STATUS_CONFIG,
  PIPELINE_STAGES as DEFAULT_PIPELINE_STAGES,
} from './leads.js';

const API = API_BASE;

export const DEFAULT_PIPELINE_STAGE_LIST = DEFAULT_PIPELINE_STAGES.map((key, order) => ({
  key,
  label: DEFAULT_STATUS_CONFIG[key]?.label || key,
  color: DEFAULT_STATUS_CONFIG[key]?.color || 'slate',
  order,
  system: true,
}));

function authHeaders() {
  const token = localStorage.getItem('solar_token');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function fetchPipelineStages() {
  const res = await fetch(`${API}/api/pipeline/stages`, { headers: authHeaders() });
  if (!res.ok) {
    return {
      stages: DEFAULT_PIPELINE_STAGE_LIST,
      reservedKeys: DEFAULT_STATUS_OPTIONS,
      defaults: DEFAULT_PIPELINE_STAGE_LIST,
    };
  }
  return res.json();
}

export async function savePipelineStages(stages) {
  const res = await fetch(`${API}/api/pipeline/stages`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ stages }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to save pipeline');
  return data;
}

export async function resetPipelineStages() {
  const res = await fetch(`${API}/api/pipeline/stages/reset`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to reset pipeline');
  return data;
}

export function stagesToStatusOptions(stages) {
  if (!Array.isArray(stages) || !stages.length) return DEFAULT_STATUS_OPTIONS;
  return [...stages].sort((a, b) => a.order - b.order).map((s) => s.key);
}

export function stagesToStatusConfig(stages) {
  const map = { ...DEFAULT_STATUS_CONFIG };
  if (!Array.isArray(stages)) return map;
  for (const s of stages) {
    const color = s.color || 'slate';
    map[s.key] = {
      label: s.label || s.key,
      color,
      dot:
        color === 'green'
          ? 'bg-emerald-400'
          : color === 'amber'
            ? 'bg-amber-400'
            : color === 'orange'
              ? 'bg-orange-400'
              : color === 'purple'
                ? 'bg-purple-400'
                : color === 'sky'
                  ? 'bg-sky-400'
                  : color === 'cyan'
                    ? 'bg-cyan-400'
                    : color === 'blue'
                      ? 'bg-blue-400'
                      : 'bg-slate-400',
    };
  }
  return map;
}

export function getStageLabel(stages, key) {
  const cfg = stagesToStatusConfig(stages);
  return cfg[key]?.label || key;
}
