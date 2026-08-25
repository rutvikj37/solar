import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { buildLeadMarkerIcon } from '@/lib/mapMarkers.js';
import { loadGoogleMapsScript } from '@/lib/googleMapsLoader.js';
import {
  debounce,
  geocodeAddress,
  looksLikeStreetAddress,
  reverseGeocodeLatLng,
} from '@/lib/geocodeHelpers.js';
import { resolveGoogleMapsApiKey } from '@/lib/mapsKey.js';

type LocationPayload = {
  address?: string;
  lat?: number;
  lng?: number;
};

type PropertyLocationMapProps = {
  address?: string;
  lat?: number;
  lng?: number;
  onLocationChange: (payload: LocationPayload) => void;
};

const HOME_PIN_COLOR = '#38bdf8';

export function PropertyLocationMap({
  address = '',
  lat,
  lng,
  onLocationChange,
}: PropertyLocationMapProps) {
  const mapContainerRef = useCallback((node: HTMLDivElement | null) => {
    setMapEl(node);
  }, []);

  const [mapEl, setMapEl] = useState<HTMLDivElement | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapError, setMapError] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const skipGeocodeRef = useRef(false);
  const pinUpdateRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    resolveGoogleMapsApiKey().then((key) => {
      if (cancelled) return;
      if (!key) {
        setMapError('Map preview unavailable — enter your address to continue.');
        return;
      }

      loadGoogleMapsScript(key, { libraries: 'places' })
        .then(() => {
          if (!cancelled) setMapsLoaded(true);
        })
        .catch(() => {
          if (!cancelled) setMapError('Could not load map. You can still enter your address.');
        });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const placePin = useCallback(
    (nextLat: number, nextLng: number, opts: { pan?: boolean; zoom?: number } = {}) => {
      if (!window.google?.maps || !mapInstanceRef.current) return;
      const position = { lat: nextLat, lng: nextLng };
      const zoom = opts.zoom ?? (looksLikeStreetAddress(address) ? 20 : 18);

      if (!markerRef.current) {
        markerRef.current = new window.google.maps.Marker({
          position,
          map: mapInstanceRef.current,
          draggable: true,
          title: 'Your home',
          icon: buildLeadMarkerIcon(window.google, { fillColor: HOME_PIN_COLOR, scale: 1.95 }),
        });

        markerRef.current.addListener('dragend', async () => {
          const pos = markerRef.current?.getPosition();
          if (!pos) return;
          pinUpdateRef.current = true;
          setGeocoding(true);
          try {
            const resolved = await reverseGeocodeLatLng(pos.lat(), pos.lng());
            onLocationChange({
              lat: pos.lat(),
              lng: pos.lng(),
              address: resolved?.formattedAddress,
            });
          } finally {
            setGeocoding(false);
            pinUpdateRef.current = false;
          }
        });
      } else {
        markerRef.current.setPosition(position);
        markerRef.current.setMap(mapInstanceRef.current);
      }

      if (opts.pan !== false) {
        mapInstanceRef.current.panTo(position);
        mapInstanceRef.current.setZoom(zoom);
      }
    },
    [address, onLocationChange],
  );

  useEffect(() => {
    if (!mapsLoaded || !mapEl || !window.google?.maps) return;

    if (!mapInstanceRef.current) {
      const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
      mapInstanceRef.current = new window.google.maps.Map(mapEl, {
        center: hasCoords ? { lat: lat!, lng: lng! } : { lat: 39.8283, lng: -98.5795 },
        zoom: hasCoords ? 20 : 4,
        mapTypeId: 'hybrid',
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_BOTTOM },
        gestureHandling: 'greedy',
        tilt: 0,
        streetViewControl: false,
        fullscreenControl: false,
        mapTypeControl: false,
        scrollwheel: true,
      });

      mapInstanceRef.current.addListener('click', async (e: any) => {
        const clickLat = e.latLng?.lat();
        const clickLng = e.latLng?.lng();
        if (clickLat == null || clickLng == null) return;

        pinUpdateRef.current = true;
        placePin(clickLat, clickLng);
        setGeocoding(true);
        try {
          const resolved = await reverseGeocodeLatLng(clickLat, clickLng);
          onLocationChange({
            lat: clickLat,
            lng: clickLng,
            address: resolved?.formattedAddress,
          });
        } finally {
          setGeocoding(false);
          pinUpdateRef.current = false;
        }
      });
    }

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      placePin(lat!, lng!, { pan: !skipGeocodeRef.current });
      skipGeocodeRef.current = false;
    }

    setTimeout(() => {
      if (window.google?.maps?.event && mapInstanceRef.current) {
        window.google.maps.event.trigger(mapInstanceRef.current, 'resize');
      }
    }, 120);
  }, [mapsLoaded, mapEl, lat, lng, placePin, onLocationChange]);

  useEffect(() => {
    if (!mapsLoaded || pinUpdateRef.current) return undefined;

    const q = String(address || '').trim();
    if (q.length < 5) return undefined;

    // Keep Places autocomplete / pin-drag coordinates. Re-geocoding the address
    // string often snaps rural roads and townships to a different map center.
    if (Number.isFinite(lat) && Number.isFinite(lng)) return undefined;

    const runGeocode = debounce(async () => {
      if (pinUpdateRef.current) return;
      setGeocoding(true);
      try {
        const result = await geocodeAddress(q);
        if (!result) return;
        skipGeocodeRef.current = true;
        onLocationChange({
          address: result.formattedAddress,
          lat: result.lat,
          lng: result.lng,
        });
      } finally {
        setGeocoding(false);
      }
    }, 700);

    runGeocode();
    return () => runGeocode.cancel?.();
  }, [address, lat, lng, mapsLoaded, onLocationChange]);

  const showPlaceholder = !mapsLoaded && !mapError;
  const hasPin = Number.isFinite(lat) && Number.isFinite(lng);

  return (
    <div className="space-y-2">
      <div className="h-52 md:h-60 rounded-xl border border-white/10 overflow-hidden relative bg-[#0a1020]">
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

        {showPlaceholder ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/5">
            <MapPin className="text-cyan-400 size-8 animate-pulse" />
            <p className="text-[10px] text-white/40">Loading map…</p>
          </div>
        ) : null}

        {mapError && !mapsLoaded ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/5 px-4 text-center">
            <MapPin className="text-cyan-400/70 size-7" />
            <p className="text-[10px] text-white/45 leading-relaxed">{mapError}</p>
          </div>
        ) : null}

        {mapsLoaded && !hasPin && !geocoding ? (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-black/20">
            <p className="text-[10px] text-white/50 px-4 text-center">
              Enter your address to drop a pin on your home
            </p>
          </div>
        ) : null}

        {geocoding ? (
          <div className="absolute top-2 right-2 rounded-lg bg-navy-dark/90 border border-white/10 px-2 py-1 text-[10px] text-cyan-300 font-bold">
            Locating…
          </div>
        ) : null}
      </div>

      <p className="text-[10px] text-white/40 italic">
        {hasPin
          ? 'Drag the pin or tap the map to fine-tune your home location.'
          : 'Satellite map preview — same pin style as our installer targeting scan.'}
      </p>
    </div>
  );
}
