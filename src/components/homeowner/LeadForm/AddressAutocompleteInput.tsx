import { useEffect, useRef, useState } from 'react';
import { loadGoogleMapsScript } from '@/lib/googleMapsLoader.js';
import { looksLikeStreetAddress } from '@/lib/geocodeHelpers.js';
import { resolveGoogleMapsApiKey } from '@/lib/mapsKey.js';
import {
  fetchAddressSuggestions,
  resolveAddressSuggestion,
} from '@/lib/placesAutocomplete.js';

type Suggestion = {
  id: string;
  description: string;
  mainText: string;
  secondaryText?: string;
  lat?: number;
  lng?: number;
  placeId?: string | null;
  placePrediction?: { toPlace?: () => { fetchFields: (opts: { fields: string[] }) => Promise<void>; formattedAddress?: string; displayName?: string; location?: { lat: () => number; lng: () => number } } };
};

type AddressAutocompleteInputProps = {
  value: string;
  placeholder?: string;
  onChange: (address: string) => void;
  onPlaceSelect: (payload: { address: string; lat?: number; lng?: number }) => void;
};

export function AddressAutocompleteInput({
  value,
  placeholder = 'PROPERTY ADDRESS *',
  onChange,
  onPlaceSelect,
}: AddressAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [mapsReady, setMapsReady] = useState(false);
  const sessionTokenRef = useRef(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pickingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    resolveGoogleMapsApiKey()
      .then((key) => {
        if (cancelled || !key) return null;
        return loadGoogleMapsScript(key, { libraries: 'places' });
      })
      .then(() => {
        if (!cancelled) setMapsReady(true);
      })
      .catch(() => {
        if (!cancelled) setMapsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const q = value.trim();
    if (!mapsReady || q.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await fetchAddressSuggestions(q, sessionTokenRef);
        if (cancelled) return;
        setSuggestions(rows);
        setShowSuggestions(rows.length > 0);
        setHighlightedIndex(rows.length ? 0 : -1);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, mapsReady]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pickSuggestion = async (item: Suggestion) => {
    pickingRef.current = true;
    setShowSuggestions(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
    setLoading(true);
    try {
      const resolved = await resolveAddressSuggestion(item, sessionTokenRef);
      onPlaceSelect(resolved);
    } finally {
      setLoading(false);
      pickingRef.current = false;
    }
  };

  const geocodeTypedAddress = async () => {
    const q = value.trim();
    if (q.length < 5 || !looksLikeStreetAddress(q)) return;
    setLoading(true);
    try {
      const resolved = await resolveAddressSuggestion(
        { id: q, description: q, mainText: q },
        sessionTokenRef,
      );
      if (resolved.lat != null && resolved.lng != null) {
        onPlaceSelect(resolved);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        className="form-input-base w-full"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
        onBlur={() => {
          window.setTimeout(() => {
            if (pickingRef.current) return;
            setShowSuggestions(false);
            void geocodeTypedAddress();
          }, 150);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
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
        }}
        autoComplete="off"
      />

      {loading ? (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-cyan-400/70 font-bold">
          …
        </span>
      ) : null}

      {showSuggestions && suggestions.length > 0 ? (
        <ul className="absolute z-40 left-0 right-0 mt-1 max-h-56 overflow-auto rounded-xl border border-white/10 bg-[#0a1020] shadow-2xl py-1">
          {suggestions.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                className={`w-full text-left px-3 py-2.5 transition-colors ${
                  index === highlightedIndex ? 'bg-cyan-500/15' : 'hover:bg-white/5'
                }`}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => pickSuggestion(item)}
              >
                <span className="block text-sm font-semibold text-white">{item.mainText}</span>
                {item.secondaryText ? (
                  <span className="block text-[11px] text-white/45 truncate">{item.secondaryText}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
