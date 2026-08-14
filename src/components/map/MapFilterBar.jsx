import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../config.js';

export default function MapFilterBar({
  zip,
  setZip,
  onSearch,
  singleFamily,
  setSingleFamily,
  skipPaneled,
  setSkipPaneled,
  minSavings,
  setMinSavings,
  isDrawingPolygon,
  lassoMode,
  setLassoMode,
  polygonAreaSqMiles,
  onToggleDrawing,
  onClearPolygon,
  hasPolygon,
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
  const autocompleteServiceRef = React.useRef(null);
  const placesServiceRef = React.useRef(null);
  const geocoderRef = React.useRef(null);

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

  // Location Suggestions Predictions Debounce Effect
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
      if (window.google?.maps?.places?.AutocompleteService) {
        if (!autocompleteServiceRef.current) {
          autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
        }
        autocompleteServiceRef.current.getPlacePredictions(
          { input: query, types: ['geocode'], componentRestrictions: { country: ['us', 'ca'] } },
          async (predictions, status) => {
            if (isCancelled) return;
            if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions?.length) {
              const formatted = predictions.slice(0, 5).map((p) => ({
                id: p.place_id,
                description: p.description,
                mainText: p.structured_formatting?.main_text || p.description,
                secondaryText: p.structured_formatting?.secondary_text || '',
                placeId: p.place_id
              }));
              setSuggestions(formatted);
              setShowSuggestions(true);
              setLoadingSuggestions(false);
            } else {
              fetchNominatimFallback(query, isCancelled);
            }
          }
        );
      } else {
        fetchNominatimFallback(query, isCancelled);
      }
    }, 200);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [zip]);

  const fetchNominatimFallback = async (query, isCancelled) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=us,ca`
      );
      if (res.ok) {
        const data = await res.json();
        if (isCancelled) return;
        const formatted = (data || []).map((item) => ({
          id: item.place_id || item.osm_id,
          description: item.display_name,
          mainText: item.address?.city || item.address?.town || item.address?.postcode || item.display_name.split(',')[0],
          secondaryText: item.display_name.split(',').slice(1).join(',').trim(),
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon)
        }));
        setSuggestions(formatted);
        setShowSuggestions(formatted.length > 0);
      }
    } catch {
      // ignore
    } finally {
      if (!isCancelled) setLoadingSuggestions(false);
    }
  };

  const handleSelectSuggestion = async (item) => {
    const fullAddress = item.description || item.mainText || '';
    setZip(fullAddress);
    setShowSuggestions(false);
    setSuggestions([]);
    setHighlightedIndex(-1);

    const searchWithLocation = (address, loc) => {
      onSearch(address || fullAddress, loc);
    };

    if (item.lat != null && item.lng != null) {
      searchWithLocation(fullAddress, { lat: item.lat, lng: item.lng });
      return;
    }

    if (item.placeId && window.google?.maps?.places?.PlacesService) {
      if (!placesServiceRef.current) {
        placesServiceRef.current = new window.google.maps.places.PlacesService(document.createElement('div'));
      }
      placesServiceRef.current.getDetails(
        { placeId: item.placeId, fields: ['geometry', 'formatted_address'] },
        (place, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
            const address = place.formatted_address || fullAddress;
            setZip(address);
            searchWithLocation(address, {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng()
            });
            return;
          }
          if (!geocoderRef.current) geocoderRef.current = new window.google.maps.Geocoder();
          geocoderRef.current.geocode({ placeId: item.placeId }, (results, geoStatus) => {
            if (geoStatus === 'OK' && results[0]?.geometry?.location) {
              const loc = results[0].geometry.location;
              const address = results[0].formatted_address || fullAddress;
              setZip(address);
              searchWithLocation(address, { lat: loc.lat(), lng: loc.lng() });
            } else {
              onSearch(fullAddress);
            }
          });
        }
      );
      return;
    }

    if (item.placeId && window.google?.maps) {
      if (!geocoderRef.current) geocoderRef.current = new window.google.maps.Geocoder();
      geocoderRef.current.geocode({ placeId: item.placeId }, (results, status) => {
        if (status === 'OK' && results[0]?.geometry?.location) {
          const loc = results[0].geometry.location;
          const address = results[0].formatted_address || fullAddress;
          setZip(address);
          searchWithLocation(address, { lat: loc.lat(), lng: loc.lng() });
        } else {
          onSearch(fullAddress);
        }
      });
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
      if (preset.filters.minSavings !== undefined) setMinSavings(preset.filters.minSavings);
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
            minSavings,
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

      {/* Preset Selector Dropdown */}
      <div className="flex items-center gap-1.5">
        <select
          value={selectedPresetId}
          onChange={(e) => handleSelectPreset(e.target.value)}
          className="bg-surface-container-low border border-glass-stroke rounded-xl py-1.5 px-3 text-white text-xs focus:outline-none focus:border-primary"
        >
          <option value="">-- Preset Filters --</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setShowSaveModal(true)}
          title="Save current filters as preset"
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
              lassoMode === 'freehand' ? 'bg-primary text-on-primary shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Freehand
          </button>
          <button
            type="button"
            onClick={() => setLassoMode && setLassoMode('click')}
            title="Click points to outline polygon"
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
              lassoMode === 'click' ? 'bg-primary text-on-primary shadow-sm' : 'text-slate-400 hover:text-white'
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

        {hasPolygon && (
          <>
            {polygonAreaSqMiles > 0 && (
              <span className="px-2 py-1 rounded-lg bg-primary/15 border border-primary/30 text-primary font-mono font-bold text-[10px]">
                {polygonAreaSqMiles} sq mi
              </span>
            )}

            <button
              type="button"
              onClick={onOpenScanModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold text-[10px] uppercase tracking-wider shadow-lg shadow-emerald-500/25 hover:brightness-110 active:scale-95 transition-all border border-emerald-400/40 animate-pulse"
            >
              <span className="material-symbols-outlined text-sm">bolt</span>
              Scan Territory Leads
            </button>

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

      {/* Quick Filter Toggles */}
      <div className="flex items-center gap-2 border-l border-glass-stroke/50 pl-2.5">
        <label className="flex items-center gap-1.5 text-on-surface-variant text-[11px] cursor-pointer">
          <input
            type="checkbox"
            checked={singleFamily}
            onChange={(e) => setSingleFamily(e.target.checked)}
            className="accent-primary rounded cursor-pointer"
          />
          Single Family
        </label>

        <label className="flex items-center gap-1.5 text-on-surface-variant text-[11px] cursor-pointer">
          <input
            type="checkbox"
            checked={skipPaneled}
            onChange={(e) => setSkipPaneled(e.target.checked)}
            className="accent-primary rounded cursor-pointer"
          />
          Skip Paneled
        </label>
      </div>

      {/* Save Preset Dialog Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-surface-elevated border border-glass-stroke rounded-2xl p-5 shadow-2xl space-y-4 text-left">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white text-sm">Save Search Filter Preset</h3>
              <button onClick={() => setShowSaveModal(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              Save your current search settings (Single-family, Skip paneled, Min savings, ZIP) for quick 1-click loading.
            </p>
            <input
              type="text"
              placeholder="e.g. High Value SFR + >$25k Savings"
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
