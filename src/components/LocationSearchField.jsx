import React, { useEffect, useRef, useState } from 'react';

function extractZipFromDisplayName(name) {
  const match = String(name || '').match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : '';
}

function formatSuggestion(row) {
  const parts = String(row.display_name || row.label || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const mainText = parts.slice(0, 2).join(', ') || parts[0] || 'Unknown';
  const secondaryText = parts.slice(2).join(', ') || '';
  return {
    ...row,
    mainText,
    secondaryText,
    shortLabel: mainText,
  };
}

async function fetchAreaSuggestions(query) {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6&countrycodes=us,ca`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data || []).map((row) =>
    formatSuggestion({
      label: row.display_name,
      lat: parseFloat(row.lat),
      lng: parseFloat(row.lon),
      zip: row.address?.postcode
        ? String(row.address.postcode).slice(0, 5)
        : extractZipFromDisplayName(row.display_name),
      type: row.type || row.class || 'place',
    }),
  );
}

export async function geocodeSearchArea(query) {
  const results = await fetchAreaSuggestions(query);
  if (!results.length) {
    throw new Error('Could not find that area. Try a city name, ZIP, or full street address.');
  }
  return results[0];
}

const EXAMPLE_AREAS = ['Beverly Hills, CA', 'Austin, TX', 'Phoenix, AZ', 'Miami, FL'];

const RADIUS_OPTIONS = [
  { value: 1, label: '1 mi' },
  { value: 3, label: '3 mi' },
  { value: 5, label: '5 mi' },
  { value: 10, label: '10 mi' },
  { value: 20, label: '20 mi' },
];

export default function LocationSearchField({
  mode,
  onModeChange,
  zip,
  onZipChange,
  areaQuery,
  onAreaQueryChange,
  resolvedArea,
  onAreaResolved,
  radius,
  onRadiusChange,
  radiusHint,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (mode !== 'area') {
      setSuggestions([]);
      setShowSuggestions(false);
      setNoResults(false);
      return undefined;
    }

    const q = areaQuery?.trim() || '';
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setNoResults(false);
      return undefined;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setNoResults(false);
      try {
        const rows = await fetchAreaSuggestions(q);
        setSuggestions(rows);
        setShowSuggestions(true);
        setNoResults(rows.length === 0);
        setHighlightedIndex(rows.length ? 0 : -1);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
        setNoResults(true);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [mode, areaQuery]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pickSuggestion = (row) => {
    onAreaQueryChange(row.shortLabel);
    onAreaResolved?.(row);
    setShowSuggestions(false);
    setNoResults(false);
  };

  const handleAreaKeyDown = (e) => {
    if (!showSuggestions && e.key !== 'ArrowDown') return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!showSuggestions && suggestions.length) setShowSuggestions(true);
      setHighlightedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
      e.preventDefault();
      pickSuggestion(suggestions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const clearResolved = () => {
    onAreaQueryChange('');
    onAreaResolved?.(null);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div className="space-y-4">
      {/* Mode switch */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onModeChange('zip')}
          className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
            mode === 'zip'
              ? 'border-primary/50 bg-primary/10 shadow-[0_0_0_1px_rgba(var(--primary-rgb,99,102,241),0.25)]'
              : 'border-glass-stroke bg-white/[0.03] hover:bg-white/[0.06]'
          }`}
        >
          <span
            className={`material-symbols-outlined text-xl ${mode === 'zip' ? 'text-primary' : 'text-on-surface-variant'}`}
          >
            pin
          </span>
          <div>
            <p className={`text-xs font-bold ${mode === 'zip' ? 'text-white' : 'text-on-surface-variant'}`}>
              ZIP code
            </p>
            <p className="text-[10px] text-on-surface-variant mt-0.5">5-digit postal code</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => onModeChange('area')}
          className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
            mode === 'area'
              ? 'border-primary/50 bg-primary/10 shadow-[0_0_0_1px_rgba(var(--primary-rgb,99,102,241),0.25)]'
              : 'border-glass-stroke bg-white/[0.03] hover:bg-white/[0.06]'
          }`}
        >
          <span
            className={`material-symbols-outlined text-xl ${mode === 'area' ? 'text-primary' : 'text-on-surface-variant'}`}
          >
            travel_explore
          </span>
          <div>
            <p className={`text-xs font-bold ${mode === 'area' ? 'text-white' : 'text-on-surface-variant'}`}>
              Search area
            </p>
            <p className="text-[10px] text-on-surface-variant mt-0.5">City, neighborhood, address</p>
          </div>
        </button>
      </div>

      {/* Location input */}
      <div className="rounded-xl border border-glass-stroke bg-surface-container-low/50 p-4 space-y-3">
        {mode === 'zip' ? (
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Enter ZIP code
            </label>
            <div className="flex items-center gap-2 bg-surface-container-low border border-glass-stroke rounded-xl px-3 py-2.5 focus-within:border-primary/60 transition-colors">
              <span className="material-symbols-outlined text-primary text-lg">location_on</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 90210"
                value={zip}
                onChange={(e) => onZipChange(e.target.value.replace(/[^\d-]/g, '').slice(0, 10))}
                className="flex-1 bg-transparent border-none text-white text-sm focus:outline-none placeholder:text-on-surface-variant/40"
              />
              {zip.length >= 5 && (
                <span className="material-symbols-outlined text-green-400 text-base">check_circle</span>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3" ref={containerRef}>
            <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Search location
            </label>

            {resolvedArea ? (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/25">
                <span className="material-symbols-outlined text-green-400 text-xl shrink-0">check_circle</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{resolvedArea.shortLabel}</p>
                  {resolvedArea.secondaryText && (
                    <p className="text-[10px] text-on-surface-variant truncate mt-0.5">
                      {resolvedArea.secondaryText}
                    </p>
                  )}
                  <p className="text-[10px] text-green-400/90 mt-1">Area confirmed — ready to scan</p>
                </div>
                <button
                  type="button"
                  onClick={clearResolved}
                  className="text-on-surface-variant hover:text-on-surface p-1 shrink-0"
                  title="Change location"
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                </button>
              </div>
            ) : (
              <>
                <div className="relative flex items-center gap-2 bg-surface-container-low border border-glass-stroke rounded-xl px-3 py-2.5 focus-within:border-primary/60 transition-colors">
                  <span className="material-symbols-outlined text-primary text-lg shrink-0">search</span>
                  <input
                    type="text"
                    placeholder="City, neighborhood, or street address…"
                    value={areaQuery}
                    onChange={(e) => {
                      onAreaQueryChange(e.target.value);
                      onAreaResolved?.(null);
                    }}
                    onFocus={() => areaQuery.trim().length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
                    onKeyDown={handleAreaKeyDown}
                    className="flex-1 bg-transparent border-none text-white text-sm focus:outline-none placeholder:text-on-surface-variant/40"
                  />
                  {loading && (
                    <span className="material-symbols-outlined text-primary text-base animate-spin shrink-0">
                      progress_activity
                    </span>
                  )}
                </div>

                {!areaQuery.trim() && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] text-on-surface-variant w-full mb-0.5">Try:</span>
                    {EXAMPLE_AREAS.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => {
                          onAreaQueryChange(ex);
                          onAreaResolved?.(null);
                        }}
                        className="px-2.5 py-1 rounded-full bg-white/5 border border-glass-stroke text-[10px] text-on-surface-variant hover:text-on-surface hover:border-primary/40 transition-colors"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                )}

                {showSuggestions && suggestions.length > 0 && (
                  <ul className="rounded-xl border border-glass-stroke bg-[#0B1021]/98 shadow-2xl overflow-hidden divide-y divide-white/5">
                    {suggestions.map((row, idx) => (
                      <li key={`${row.lat}-${row.lng}-${idx}`}>
                        <button
                          type="button"
                          onClick={() => pickSuggestion(row)}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors ${
                            highlightedIndex === idx ? 'bg-primary/15' : 'hover:bg-white/5'
                          }`}
                        >
                          <span className="material-symbols-outlined text-primary text-base shrink-0">
                            location_on
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-white truncate">{row.mainText}</p>
                            {row.secondaryText && (
                              <p className="text-[10px] text-on-surface-variant truncate">{row.secondaryText}</p>
                            )}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {noResults && areaQuery.trim().length >= 2 && !loading && (
                  <p className="text-[11px] text-amber-300/90 flex items-center gap-1.5 px-1">
                    <span className="material-symbols-outlined text-sm">info</span>
                    No matches — try a city + state (e.g. Denver, CO)
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Radius */}
        <div className="space-y-2 pt-1 border-t border-glass-stroke/60">
          <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            Scan radius
          </label>
          <div className="flex flex-wrap gap-1.5">
            {RADIUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onRadiusChange(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                  radius === opt.value
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-white/5 text-on-surface-variant border-glass-stroke hover:text-on-surface hover:border-primary/40'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {radiusHint && <p className="text-[10px] text-on-surface-variant leading-relaxed">{radiusHint}</p>}
        </div>
      </div>
    </div>
  );
}

export { extractZipFromDisplayName, formatSuggestion };
