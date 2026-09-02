/**
 * Pipeline stage defaults + merge/validate helpers.
 * Reserved keys must never be renamed/deleted — automations depend on them.
 */

export const RESERVED_STAGE_KEYS = [
  'new',
  'contacted',
  'qualified',
  'appointment',
  'proposal',
  'in_progress',
  'won',
  'lost',
];

export const DEFAULT_STAGES = [
  { key: 'new', label: 'Cold', color: 'slate', order: 0, system: true },
  { key: 'contacted', label: 'Positive', color: 'green', order: 1, system: true },
  { key: 'qualified', label: 'Qualified', color: 'cyan', order: 2, system: true },
  { key: 'appointment', label: 'Appointment', color: 'purple', order: 3, system: true },
  { key: 'proposal', label: 'Proposal', color: 'sky', order: 4, system: true },
  { key: 'in_progress', label: 'Negotiation', color: 'orange', order: 5, system: true },
  { key: 'won', label: 'Closed / Won', color: 'green', order: 6, system: true },
  { key: 'lost', label: 'Lost', color: 'slate', order: 7, system: true },
];

const ALLOWED_COLORS = new Set([
  'slate',
  'blue',
  'cyan',
  'amber',
  'orange',
  'purple',
  'sky',
  'green',
]);

function slugCustomKey(label, existingKeys) {
  const base = String(label || 'custom')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 32) || 'custom';
  let key = `custom_${base}`;
  let i = 2;
  while (existingKeys.has(key) || RESERVED_STAGE_KEYS.includes(key)) {
    key = `custom_${base}_${i}`;
    i += 1;
  }
  return key;
}

export function normalizeStages(raw) {
  const defaultsByKey = Object.fromEntries(DEFAULT_STAGES.map((s) => [s.key, { ...s }]));
  let list = [];
  if (Array.isArray(raw) && raw.length) {
    list = raw
      .map((item, idx) => {
        if (!item || typeof item !== 'object') return null;
        const key = String(item.key || '').trim();
        if (!key) return null;
        const isSystem = RESERVED_STAGE_KEYS.includes(key);
        const label = String(item.label || defaultsByKey[key]?.label || key).trim().slice(0, 60);
        const color = ALLOWED_COLORS.has(item.color) ? item.color : defaultsByKey[key]?.color || 'slate';
        const order = Number.isFinite(Number(item.order)) ? Number(item.order) : idx;
        return {
          key,
          label: label || key,
          color,
          order,
          system: isSystem,
        };
      })
      .filter(Boolean);
  }

  // Ensure every reserved key exists
  const have = new Set(list.map((s) => s.key));
  for (const def of DEFAULT_STAGES) {
    if (!have.has(def.key)) {
      list.push({ ...def });
    }
  }

  // Drop invalid non-custom/non-reserved keys
  list = list.filter(
    (s) => RESERVED_STAGE_KEYS.includes(s.key) || s.key.startsWith('custom_'),
  );

  list.sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
  return list.map((s, i) => ({ ...s, order: i, system: RESERVED_STAGE_KEYS.includes(s.key) }));
}

/**
 * Validate user PUT payload. Reserved keys cannot be removed or have keys renamed.
 * New custom stages may be added; custom stages may be removed/relabeled.
 */
export function validateStagesPayload(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: 'stages must be a non-empty array' };
  }
  if (raw.length > 24) {
    return { ok: false, error: 'Too many stages (max 24)' };
  }

  const keys = raw.map((s) => String(s?.key || '').trim()).filter(Boolean);
  for (const reserved of RESERVED_STAGE_KEYS) {
    if (!keys.includes(reserved)) {
      return {
        ok: false,
        error: `System stage "${reserved}" cannot be removed`,
      };
    }
  }

  const seen = new Set();
  const cleaned = [];
  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    let key = String(item?.key || '').trim();
    const label = String(item?.label || '').trim().slice(0, 60);
    if (!label) {
      return { ok: false, error: 'Each stage needs a label' };
    }

    const isNewCustom = !key || (!RESERVED_STAGE_KEYS.includes(key) && !key.startsWith('custom_'));
    if (isNewCustom) {
      key = slugCustomKey(label, seen);
    } else if (!RESERVED_STAGE_KEYS.includes(key) && !key.startsWith('custom_')) {
      return { ok: false, error: `Invalid stage key: ${key}` };
    }

    if (seen.has(key)) {
      return { ok: false, error: `Duplicate stage key: ${key}` };
    }
    seen.add(key);

    const color = ALLOWED_COLORS.has(item?.color) ? item.color : 'slate';
    cleaned.push({
      key,
      label,
      color,
      order: i,
      system: RESERVED_STAGE_KEYS.includes(key),
    });
  }

  return { ok: true, stages: normalizeStages(cleaned) };
}

export function stagesToConfigMap(stages) {
  const map = {};
  for (const s of stages) {
    map[s.key] = {
      label: s.label,
      color: s.color,
      dot:
        s.color === 'green'
          ? 'bg-emerald-400'
          : s.color === 'amber'
            ? 'bg-amber-400'
            : s.color === 'orange'
              ? 'bg-orange-400'
              : s.color === 'purple'
                ? 'bg-purple-400'
                : s.color === 'sky'
                  ? 'bg-sky-400'
                  : s.color === 'cyan'
                    ? 'bg-cyan-400'
                    : s.color === 'blue'
                      ? 'bg-blue-400'
                      : 'bg-slate-400',
    };
  }
  return map;
}
