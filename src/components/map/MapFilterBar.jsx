import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../config.js';
import {
  fetchAddressSuggestions,
  resolveAddressSuggestion,
} from '../../lib/placesAutocomplete.js';

export default function MapFilterBar({
  zip,
  setZip,
  onSearch,
  singleFamily,
  setSingleFamily,
  skipPaneled,
  setSkipPaneled,
  isDrawingPolygon,
  lassoMode,
  setLassoMode,
  polygonAreaSqMiles,
  onToggleDrawing,
  onClearPolygon,
  hasPolygon,
  canBulkScan = false,
  onOpenScanModal
}) {
  const [presets, setPresets] = useState([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // Autocomplete Suggestions State
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const sessionTokenRef = React.useRef(null);

  const fetchPresets = async () => {
    try {
      const token = localStorage.getItem('solar_token');
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/presets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPresets(data);
      }
    } catch (err) {
      console.error('Fetch presets error:', err);
    }
  };

  useEffect(() => {
    fetchPresets();
  }, []);

  // Location Suggestions — shared Places/Nominatim autocomplete with ranking
  useEffect(() => {
    const query = zip ? zip.trim() : '';
    if (!query || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    let isCancelled = false;
    setLoadingSuggestions(true);

    const timer = setTimeout(async () => {
      try {
        const formatted = await fetchAddressSuggestions(query, sessionTokenRef);
        if (isCancelled) return;
        setSuggestions(formatted);
        setShowSuggestions(formatted.length > 0);
        setHighlightedIndex(formatted.length ? 0 : -1);
      } catch {
        if (!isCancelled) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } finally {
        if (!isCancelled) setLoadingSuggestions(false);
      }
    }, 200);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [zip]);

  const handleSelectSuggestion = async (item) => {
    setShowSuggestions(false);
    setSuggestions([]);
    setHighlightedIndex(-1);

    const resolved = await resolveAddressSuggestion(item, sessionTokenRef);
    const fullAddress = resolved.address || item.description || item.mainText || '';
    setZip(fullAddress);

    if (resolved.lat != null && resolved.lng != null) {
      onSearch(fullAddress, { lat: resolved.lat, lng: resolved.lng });
      return;
    }

    onSearch(fullAddress);
  };

  const handleSelectPreset = (presetId) => {
    setSelectedPresetId(presetId);
    if (!presetId) return;
    const preset = presets.find((p) => String(p.id) === String(presetId));
    if (preset && preset.filters) {
      if (preset.filters.singleFamily !== undefined) setSingleFamily(preset.filters.singleFamily);
      if (preset.filters.skipPaneled !== undefined) setSkipPaneled(preset.filters.skipPaneled);
      if (preset.filters.zip !== undefined) {
        setZip(preset.filters.zip);
        onSearch(preset.filters.zip);
      } else {
        onSearch(zip);
      }
    }
  };

  const handleSavePreset = async () => {
    if (!newPresetName.trim()) return;
    try {
      const token = localStorage.getItem('solar_token');
      const res = await fetch(`${API_BASE}/api/presets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newPresetName.trim(),
          filters: {
            singleFamily,
            skipPaneled,
            zip
          }
        })
      });
      if (res.ok) {
        setShowSaveModal(false);
        setNewPresetName('');
        fetchPresets();
      }
    } catch (err) {
      console.error('Save preset error:', err);
    }
  };

  return (
    <div className="glass-card p-2.5 rounded-2xl border border-glass-stroke shadow-2xl flex flex-wrap items-center justify-between gap-2.5 backdrop-blur-xl text-xs">
      {/* ZIP / Location Search Input with Autocomplete Suggestions Dropdown */}
      <div className="relative flex items-center gap-2 bg-surface-container-low border border-glass-stroke rounded-xl px-3 py-1.5 min-w-[220px] flex-1">
        <span className="material-symbols-outlined text-on-surface-variant text-base">travel_explore</span>
        <input
          type="text"
          placeholder="Search any home address, city, or ZIP..."
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          onFocus={() => zip && suggestions.length > 0 && setShowSuggestions(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlightedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlightedIndex((prev) => Math.max(prev - 1, 0));
            } else if (e.key === 'Enter') {
              if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
                e.preventDefault();
                handleSelectSuggestion(suggestions[highlightedIndex]);
              } else {
                setShowSuggestions(false);
                onSearch(zip);
              }
            } else if (e.key === 'Escape') {
              setShowSuggestions(false);
            }
          }}
          className="bg-transparent border-none text-white text-xs focus:outline-none w-full placeholder:text-slate-500"
        />
        {loadingSuggestions && (
          <span className="material-symbols-outlined text-xs text-primary animate-spin">sync</span>
        )}
        <button
          type="button"
          onClick={() => {
            setShowSuggestions(false);
            onSearch(zip);
          }}
          className="bg-primary text-on-primary font-bold text-[10px] uppercase tracking-wider px-3 py-1 rounded-lg hover:brightness-110 shrink-0"
        >
          Search
        </button>

        {/* Floating Location Autocomplete Suggestions Overlay */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[#0B1021]/95 border border-glass-stroke rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl z-50 text-xs divide-y divide-white/5">
            {suggestions.map((item, idx) => (
              <div
                key={item.id || idx}
                onClick={() => handleSelectSuggestion(item)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`p-2.5 cursor-pointer flex items-center gap-2.5 transition-colors ${
                  highlightedIndex === idx ? 'bg-primary/20 text-white' : 'hover:bg-white/5 text-slate-300'
                }`}
              >
                <span className="material-symbols-outlined text-base text-primary shrink-0">location_on</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white truncate text-xs">{item.mainText}</p>
                  {item.secondaryText && (
                    <p className="text-[10px] text-slate-400 truncate">{item.secondaryText}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preset Selector — saves ZIP for one-click reuse */}
      <div className="flex items-center gap-1.5" title="Save or load ZIP search presets">
        <select
          value={selectedPresetId}
          onChange={(e) => handleSelectPreset(e.target.value)}
          className="bg-surface-container-low border border-glass-stroke rounded-xl py-1.5 px-3 text-white text-xs focus:outline-none focus:border-primary"
          aria-label="Saved filter presets"
        >
          <option value="">Saved filters</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setShowSaveModal(true)}
          title="Save current filters as a reusable preset"
          className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-primary border border-glass-stroke transition-colors"
        >
          <span className="material-symbols-outlined text-base">bookmark_add</span>
        </button>
      </div>

      {/* Polygon Lasso Controls */}
      <div className="flex items-center gap-1.5 border-l border-glass-stroke/50 pl-2.5">
        <div className="flex bg-surface-container-low p-0.5 rounded-xl border border-glass-stroke">
          <button
            type="button"
            onClick={() => setLassoMode && setLassoMode('freehand')}
            title="Drag mouse to draw freehand shape"
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
              lassoMode === 'freehand' ? 'bg-primary text-on-primary shadow-sm' : 'text-slate-400 hover:text-on-surface'
            }`}
          >
            Freehand
          </button>
          <button
            type="button"
            onClick={() => setLassoMode && setLassoMode('click')}
            title="Click points to outline polygon"
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
              lassoMode === 'click' ? 'bg-primary text-on-primary shadow-sm' : 'text-slate-400 hover:text-on-surface'
            }`}
          >
            Point Click
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleDrawing}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all border ${
            isDrawingPolygon
              ? 'bg-primary text-on-primary border-primary animate-pulse'
              : 'bg-white/5 text-white border-glass-stroke hover:bg-white/10'
          }`}
        >
          <span className="material-symbols-outlined text-sm">polyline</span>
          {isDrawingPolygon ? 'Finish Lasso' : 'Draw Lasso'}
        </button>

        {canBulkScan && (
          <>
            {hasPolygon && polygonAreaSqMiles > 0 && (
              <span className="px-2 py-1 rounded-lg bg-primary/15 border border-primary/30 text-primary font-mono font-bold text-[10px]">
                {polygonAreaSqMiles} sq mi
              </span>
            )}

            <button
              type="button"
              onClick={onOpenScanModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold text-[10px] uppercase tracking-wider shadow-lg shadow-emerald-500/25 hover:brightness-110 active:scale-95 transition-all border border-emerald-400/40"
            >
              <span className="material-symbols-outlined text-sm">radar</span>
              Scan this area
            </button>
          </>
        )}

        {hasPolygon && (
          <>
            {!canBulkScan && polygonAreaSqMiles > 0 && (
              <span className="px-2 py-1 rounded-lg bg-primary/15 border border-primary/30 text-primary font-mono font-bold text-[10px]">
                {polygonAreaSqMiles} sq mi
              </span>
            )}

            <button
              type="button"
              onClick={onClearPolygon}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 text-[10px] font-bold uppercase tracking-wider hover:bg-red-500/25"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              Clear Lasso
            </button>
          </>
        )}
      </div>

      {/* Save Preset Dialog Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-surface-elevated border border-glass-stroke rounded-2xl p-5 shadow-2xl space-y-4 text-left">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white text-sm">Save Search Filter Preset</h3>
              <button onClick={() => setShowSaveModal(false)} className="text-slate-400 hover:text-on-surface">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Save your current ZIP search for quick one-click loading. Scan filters (single-family, skip paneled, roof area) are set when you start a scan.
            </p>
            <input
              type="text"
              placeholder="e.g. Beverly Hills SFR"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              className="w-full bg-surface-container-low border border-glass-stroke rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-primary"
            />
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePreset}
                className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:brightness-110"
              >
                Save Preset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
