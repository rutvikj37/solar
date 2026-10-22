import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import UpgradeModal from '../../components/UpgradeModal';
import LeadManagerPanel from '../../components/LeadManagerPanel';
import MapModePill from '../../components/map/MapModePill';
import MapFilterBar from '../../components/map/MapFilterBar';
import AskHeraFab from '../../components/map/AskHeraFab';
import PropertyDrawer from '../../components/map/PropertyDrawer';
import BulkScanDialog from '../../components/map/BulkScanDialog';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../config.js';
import { buildScoreMarkerIcon, verifiedMarkerScore, markerTitle } from '../../lib/mapMarkers.js';

function propertyMarkerIcon(google, prop, selected) {
  const score = verifiedMarkerScore(prop);
  return buildScoreMarkerIcon(google, {
    score: score || 0,
    existingSolarLikely: !!prop?.existingSolarLikely,
    selected,
    unscored: score == null,
  });
}
import { resolveGoogleMapsApiKey } from '../../lib/mapsKey.js';
import {
  PROPERTY_DATA_UNAVAILABLE,
  resolvePropertyDataMessage,
} from '../../lib/propertyDataMessages.js';

/** Ask Hera chat stub — off for launch until chat is built. Set VITE_ENABLE_ASK_HERA=true to show. */
const ENABLE_ASK_HERA = import.meta.env.VITE_ENABLE_ASK_HERA === 'true';

function ToggleSwitch({ id, checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
        checked ? 'bg-primary' : 'bg-white/15'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function debounce(fn, wait) {
  let timer = null;
  const debounced = (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return debounced;
}

const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#757575" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] }
];

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function polygonCentroid(points) {
  if (!points?.length) return null;
  let lat = 0;
  let lng = 0;
  for (const p of points) {
    lat += p.lat;
    lng += p.lng;
  }
  return { lat: lat / points.length, lng: lng / points.length };
}

function looksLikeStreetAddress(query) {
  const q = String(query || '').trim();
  if (!q) return false;
  if (/^\d{5}(-\d{4})?$/.test(q)) return false;
  return /^\d+[A-Za-z]?\s+[A-Za-z]/.test(q);
}

function pickBestGeocodeResult(results) {
  if (!Array.isArray(results) || !results.length) return null;
  const locRank = { ROOFTOP: 0, RANGE_INTERPOLATED: 1, GEOMETRIC_CENTER: 2, APPROXIMATE: 3 };
  const typeScore = (types = []) => {
    if (types.includes('street_address') || types.includes('premise') || types.includes('subpremise')) return 0;
    if (types.includes('route')) return 2;
    return 1;
  };
  return [...results].sort((a, b) => {
    const aRank = (locRank[a.geometry?.location_type] ?? 9) + typeScore(a.types) * 0.1;
    const bRank = (locRank[b.geometry?.location_type] ?? 9) + typeScore(b.types) * 0.1;
    return aRank - bRank;
  })[0];
}

export default function InteractiveMap() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { credits: leadCredits, unlimitedCredits, refreshUserData } = useAuth();

  const [zip, setZip] = useState('');
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const selectedPropertyIdRef = useRef(null);
  useEffect(() => {
    selectedPropertyIdRef.current = selectedProperty?.id ?? null;
  }, [selectedProperty?.id]);
  const unlockAbortRef = useRef(null);
  useEffect(() => () => unlockAbortRef.current?.abort(), []);
  const [activeTab, setActiveTab] = useState('Overview');
  const [searching, setSearching] = useState(false);
  const [searchBanner, setSearchBanner] = useState('');
  const [generatedLeadStatus, setGeneratedLeadStatus] = useState('idle');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState('');
  const [upgradeModalTitle, setUpgradeModalTitle] = useState('Upgrade required');
  const [showUpgradeCta, setShowUpgradeCta] = useState(true);
  const [googleMapsKey, setGoogleMapsKey] = useState('');
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapError, setMapError] = useState('');
  const [configStatus, setConfigStatus] = useState('loading');
  const [showWarning, setShowWarning] = useState(true);
  const [mapZoom, setMapZoom] = useState(15);
  const [mapCenter, setMapCenter] = useState({ lat: 34.0736, lng: -118.4004 });
  const [showLeadManager, setShowLeadManager] = useState(() => searchParams.get('leads') === '1');
  const [mapType, setMapType] = useState('hybrid');

  // Polygon Lasso Drawing State
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
  const [lassoMode, setLassoMode] = useState('freehand'); // 'freehand' | 'click'
  const [polygonPath, setPolygonPath] = useState(null);
  const [polygonAreaSqMiles, setPolygonAreaSqMiles] = useState(0);

  const lassoModeRef = useRef(lassoMode);
  useEffect(() => {
    lassoModeRef.current = lassoMode;
  }, [lassoMode]);

  const isLassoDraggingRef = useRef(false);

  // Mission Targeting state
  const [targetingMode, setTargetingMode] = useState(false);
  const [scanPin, setScanPin] = useState(null);
  const [scanRadius, setScanRadius] = useState(800);
  const [homesToScan, setHomesToScan] = useState(15);
  const [minSqFt, setMinSqFt] = useState(0);
  const [useMinSqFt, setUseMinSqFt] = useState(false);
  const [skipPaneled, setSkipPaneled] = useState(true);
  const [aiVision, setAiVision] = useState(true);
  const [singleFamily, setSingleFamily] = useState(true);
  const [cityInput, setCityInput] = useState('');

  // Deploy Scan Modal & Progress
  const [showScanModal, setShowScanModal] = useState(false);
  const [leadsToCapture, setLeadsToCapture] = useState(15);
  const [scanAddress, setScanAddress] = useState('Resolving address...');

  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanFoundLeads, setScanFoundLeads] = useState(0);
  const [leadsRefreshKey, setLeadsRefreshKey] = useState(0);
  const [scanPhase, setScanPhase] = useState('');
  const [isPaused, setIsPaused] = useState(false);

  const [suggestions, setSuggestions] = useState([]);
  const [activeInput, setActiveInput] = useState(null);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const drawingManagerRef = useRef(null);
  const polygonOverlayRef = useRef(null);
  const markersRef = useRef([]);
  const markerByIdRef = useRef(new Map());
  const clustererRef = useRef(null);
  const handleCoordinateClickRef = useRef(null);
  const searchAbortRef = useRef(null);
  const detailAbortRef = useRef(null);
  const initialSearchDoneRef = useRef(false);
  const suggestDebounceRef = useRef(null);
  const selectedMarkerIdRef = useRef(null);
  const scanAbortRef = useRef(null);
  const isDrawingPolygonRef = useRef(false);
  const draftPolygonPointsRef = useRef([]);
  const vertexMarkersRef = useRef([]);

  const [draftPolygonPoints, setDraftPolygonPoints] = useState([]);

  const scanMarkerInstanceRef = useRef(null);
  const scanCircleInstanceRef = useRef(null);

  const targetingModeRef = useRef(targetingMode);
  useEffect(() => {
    targetingModeRef.current = targetingMode;
  }, [targetingMode]);

  useEffect(() => {
    if (!scanPin) {
      setScanAddress('');
      return;
    }
    setScanAddress('Resolving address...');
    if (window.google && window.google.maps) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: scanPin }, (results, status) => {
        if (status === 'OK' && results[0]) {
          setScanAddress(results[0].formatted_address);
        } else {
          setScanAddress(`${scanPin.lat.toFixed(5)}, ${scanPin.lng.toFixed(5)}`);
        }
      });
    } else {
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${scanPin.lat}&lon=${scanPin.lng}&format=json`)
        .then(res => res.json())
        .then(data => {
          setScanAddress(data.display_name || `${scanPin.lat.toFixed(5)}, ${scanPin.lng.toFixed(5)}`);
        })
        .catch(() => {
          setScanAddress(`${scanPin.lat.toFixed(5)}, ${scanPin.lng.toFixed(5)}`);
        });
    }
  }, [scanPin]);

  useEffect(() => {
    let cancelled = false;
    resolveGoogleMapsApiKey().then((key) => {
      if (cancelled) return;
      const isMockKey = key && key.toLowerCase().includes('your_');
      if (key && !isMockKey) {
        setGoogleMapsKey(key);
        setConfigStatus('ready');
        loadGoogleMapsScript(key);
      } else {
        setConfigStatus('fallback');
        setMapError('Google Maps API key is not configured (set GOOGLE_MAPS_API_KEY or VITE_GOOGLE_MAPS_API_KEY).');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadGoogleMapsScript = (apiKey) => {
    if (typeof window.google?.maps?.Map === 'function') {
      setMapsLoaded(true);
      return;
    }
    const scriptId = 'google-maps-script';
    let script = document.getElementById(scriptId);

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,drawing,geometry&v=weekly&loading=async`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
      script.onload = () => setMapsLoaded(true);
      script.onerror = () => {
        setConfigStatus('fallback');
        setMapError('Failed to load Google Maps SDK.');
      };
    } else {
      if (typeof window.google?.maps?.Map === 'function') {
        setMapsLoaded(true);
      } else {
        script.addEventListener('load', () => setMapsLoaded(true));
      }
    }
  };

  useEffect(() => {
    if (!googleMapsKey || !mapRef.current || mapInstanceRef.current) return;

    let timerId = null;
    let isCancelled = false;

    const initMap = () => {
      if (isCancelled || mapInstanceRef.current) return;
      if (!window.google?.maps || typeof window.google.maps.Map !== 'function') {
        timerId = setTimeout(initMap, 100);
        return;
      }

      try {
        const defaultCenter = { lat: 34.0736, lng: -118.4004 };
        const map = new window.google.maps.Map(mapRef.current, {
          center: defaultCenter,
          zoom: 15,
          minZoom: 3,
          maxZoom: 21,
          mapTypeId: mapType === 'satellite' ? 'satellite' : mapType === 'dark' ? 'roadmap' : 'hybrid',
          tilt: 0,
          heading: 0,
          rotateControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
          zoomControl: false,
          scrollwheel: true,
          gestureHandling: 'greedy',
          styles: mapType === 'dark' ? darkMapStyles : undefined
        });

        map.addListener('click', (e) => {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          if (isDrawingPolygonRef.current && lassoModeRef.current === 'click') {
            handleAddPolygonVertex({ lat, lng });
            return;
          }
          if (targetingModeRef.current) {
            setScanPin({ lat, lng });
          } else if (handleCoordinateClickRef.current) {
            handleCoordinateClickRef.current(lat, lng);
          }
        });

        // Freehand Lasso Drag Event Listeners
        map.addListener('mousedown', (e) => {
          if (isDrawingPolygonRef.current && lassoModeRef.current === 'freehand') {
            isLassoDraggingRef.current = true;
            map.setOptions({ draggable: false });
            const pt = { lat: e.latLng.lat(), lng: e.latLng.lng() };
            draftPolygonPointsRef.current = [pt];
            setDraftPolygonPoints([pt]);
            if (polygonOverlayRef.current) polygonOverlayRef.current.setMap(null);
            polygonOverlayRef.current = new window.google.maps.Polygon({
              paths: [pt],
              strokeColor: '#38bdf8',
              strokeOpacity: 0.95,
              strokeWeight: 3,
              fillColor: '#38bdf8',
              fillOpacity: 0.25,
              clickable: false,
              map
            });
          }
        });

        map.addListener('mousemove', (e) => {
          if (isDrawingPolygonRef.current && lassoModeRef.current === 'freehand' && isLassoDraggingRef.current) {
            const pt = { lat: e.latLng.lat(), lng: e.latLng.lng() };
            const points = draftPolygonPointsRef.current;
            const last = points[points.length - 1];
            if (!last || calculateDistance(last.lat, last.lng, pt.lat, pt.lng) > 8) {
              const updated = [...points, pt];
              draftPolygonPointsRef.current = updated;
              setDraftPolygonPoints(updated);
              if (polygonOverlayRef.current) polygonOverlayRef.current.setPath(updated);
            }
          }
        });

        map.addListener('mouseup', () => {
          if (isDrawingPolygonRef.current && lassoModeRef.current === 'freehand' && isLassoDraggingRef.current) {
            isLassoDraggingRef.current = false;
            map.setOptions({ draggable: true });
            if (draftPolygonPointsRef.current.length >= 3) {
              const points = draftPolygonPointsRef.current;
              setIsDrawingPolygon(false);
              isDrawingPolygonRef.current = false;
              setPolygonPath(points);
              setPolygonAreaSqMiles(calculatePolygonSqMiles(points));
              handleSearch(zip, { polygon: points });
            }
          }
        });

        mapInstanceRef.current = map;
        setMapsLoaded(true);
        // Idle on load — no default ZIP / RentCast call until the user searches.
      } catch (err) {
        console.error('Map init error:', err);
        setConfigStatus('fallback');
        setMapError('Error initializing map layout.');
      }
    };

    initMap();

    return () => {
      isCancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [googleMapsKey]);

  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;
    const map = mapInstanceRef.current;
    if (mapType === 'satellite') {
      map.setMapTypeId('satellite');
      map.setOptions({ styles: [] });
    } else if (mapType === 'hybrid') {
      map.setMapTypeId('hybrid');
      map.setOptions({ styles: [] });
    } else if (mapType === 'dark') {
      map.setMapTypeId('roadmap');
      map.setOptions({ styles: darkMapStyles });
    }
  }, [mapType]);

  const calculatePolygonSqMiles = (points) => {
    if (!points || points.length < 3) return 0;
    if (window.google?.maps?.geometry?.spherical) {
      const path = points.map((p) => new window.google.maps.LatLng(p.lat, p.lng));
      const sqMeters = window.google.maps.geometry.spherical.computeArea(path);
      return Number((sqMeters / 2589988.11).toFixed(2));
    }
    let area = 0;
    const R = 3958.8; // Miles
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      const p1 = points[i];
      const p2 = points[j];
      const lat1 = (p1.lat * Math.PI) / 180;
      const lat2 = (p2.lat * Math.PI) / 180;
      const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
      area += dLng * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    area = Math.abs((area * R * R) / 2);
    return Number(area.toFixed(2));
  };

  const handleAddPolygonVertex = (pt) => {
    const updated = [...draftPolygonPointsRef.current, pt];
    draftPolygonPointsRef.current = updated;
    setDraftPolygonPoints(updated);

    if (window.google?.maps && mapInstanceRef.current) {
      const marker = new window.google.maps.Marker({
        position: pt,
        map: mapInstanceRef.current,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#0066FF',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2
        },
        label: {
          text: String(updated.length),
          color: '#FFFFFF',
          fontSize: '9px',
          fontWeight: 'bold'
        }
      });
      vertexMarkersRef.current.push(marker);

      if (!polygonOverlayRef.current) {
        polygonOverlayRef.current = new window.google.maps.Polygon({
          paths: updated,
          strokeColor: '#0066FF',
          strokeOpacity: 0.9,
          strokeWeight: 3,
          fillColor: '#0066FF',
          fillOpacity: 0.25,
          clickable: false,
          map: mapInstanceRef.current
        });
      } else {
        polygonOverlayRef.current.setPath(updated);
      }
    }
  };

  const handleUndoPolygonVertex = () => {
    if (draftPolygonPointsRef.current.length === 0) return;
    const updated = draftPolygonPointsRef.current.slice(0, -1);
    draftPolygonPointsRef.current = updated;
    setDraftPolygonPoints(updated);

    const lastMarker = vertexMarkersRef.current.pop();
    if (lastMarker) lastMarker.setMap(null);

    if (polygonOverlayRef.current) {
      if (updated.length === 0) {
        polygonOverlayRef.current.setMap(null);
        polygonOverlayRef.current = null;
      } else {
        polygonOverlayRef.current.setPath(updated);
      }
    }
  };

  const handleFinishPolygon = () => {
    const points = draftPolygonPointsRef.current;
    if (points.length < 3) return;

    vertexMarkersRef.current.forEach((m) => m.setMap(null));
    vertexMarkersRef.current = [];

    setIsDrawingPolygon(false);
    isDrawingPolygonRef.current = false;
    setPolygonPath(points);
    setPolygonAreaSqMiles(calculatePolygonSqMiles(points));

    if (window.google?.maps && mapInstanceRef.current) {
      const bounds = new window.google.maps.LatLngBounds();
      points.forEach((pt) => bounds.extend(pt));
      if (!bounds.isEmpty()) {
        mapInstanceRef.current.fitBounds(bounds);
      }
    }

    handleSearch(zip, { polygon: points });
  };

  const handleToggleDrawing = () => {
    if (isDrawingPolygon) {
      handleClearPolygon();
    } else {
      setIsDrawingPolygon(true);
      isDrawingPolygonRef.current = true;
      draftPolygonPointsRef.current = [];
      setDraftPolygonPoints([]);
      if (polygonOverlayRef.current) {
        polygonOverlayRef.current.setMap(null);
        polygonOverlayRef.current = null;
      }
    }
  };

  const handleClearPolygon = () => {
    vertexMarkersRef.current.forEach((m) => m.setMap(null));
    vertexMarkersRef.current = [];
    if (polygonOverlayRef.current) {
      polygonOverlayRef.current.setMap(null);
      polygonOverlayRef.current = null;
    }
    if (drawingManagerRef.current) {
      drawingManagerRef.current.setDrawingMode(null);
      drawingManagerRef.current.setMap(null);
      drawingManagerRef.current = null;
    }
    draftPolygonPointsRef.current = [];
    setDraftPolygonPoints([]);
    setPolygonPath(null);
    setPolygonAreaSqMiles(0);
    setIsDrawingPolygon(false);
    isDrawingPolygonRef.current = false;
    handleSearch(zip);
  };

  const clearMapMarkers = () => {
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current.setMap(null);
      clustererRef.current = null;
    }
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    markerByIdRef.current.clear();
  };

  const plotPropertyMarkers = (list, selectedId = null) => {
    if (!mapInstanceRef.current || !window.google?.maps) return;
    clearMapMarkers();
    if (!list.length) return;

    const google = window.google;
    const markers = list.map((prop) => {
      const isSelected = selectedId ? prop.id === selectedId : !!prop.isSearchMatch;
      const marker = new google.maps.Marker({
        position: { lat: prop.lat, lng: prop.lng },
        title: markerTitle(prop),
        optimized: true,
        zIndex: isSelected ? google.maps.Marker.MAX_ZINDEX + 1 : undefined,
        icon: propertyMarkerIcon(google, prop, isSelected)
      });
      marker.addListener('click', () => {
        handleMarkerClick(prop.id, prop);
      });
      markerByIdRef.current.set(prop.id, marker);
      return marker;
    });

    markersRef.current = markers;
    selectedMarkerIdRef.current = selectedId || list.find((p) => p.isSearchMatch)?.id || null;
    clustererRef.current = new MarkerClusterer({
      map: mapInstanceRef.current,
      markers
    });
  };

  const loadVerifiedScores = async (list, signal) => {
    const pending = list.filter(
      (p) => p.scoreSource !== 'verified' && Number.isFinite(p.lat) && Number.isFinite(p.lng),
    );
    if (!pending.length) return;
    const bounds = mapInstanceRef.current?.getBounds?.();
    const inView = bounds ? pending.filter((p) => bounds.contains({ lat: p.lat, lng: p.lng })) : [];
    const ordered = [...inView, ...pending.filter((p) => !inView.includes(p))].slice(0, 40);
    try {
      const token = localStorage.getItem('solar_token');
      const res = await fetch(`${API_BASE}/api/properties/solar-scores`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ items: ordered.map(({ id, lat, lng }) => ({ id, lat, lng })) }),
        signal,
      });
      if (!res.ok) return;
      const { scores = {} } = await res.json();
      const verified = new Map(
        Object.entries(scores).filter(([, s]) => s?.status === 'verified'),
      );
      if (!verified.size) return;
      setProperties((prev) =>
        prev.map((p) => {
          const s = verified.get(p.id);
          if (!s) return p;
          return {
            ...p,
            scoreSource: 'verified',
            solarScore: s.solarScore,
            systemSize: `${s.systemKw} kW`,
            panelsCount: s.panelCount,
            annualProductionKwh: s.annualProductionKwh,
            totalRoofSqFt: s.totalRoofSqFt,
            existingSolar: p.existingSolarLikely && !s.existingSolarLikely ? p.existingSolar : s.existingSolar,
            existingSolarLikely: Boolean(p.existingSolarLikely || s.existingSolarLikely),
          };
        }),
      );
    } catch {
      /* scores are best-effort; pins stay "not scored" */
    }
  };

  const handleSearch = async (zipVal, opts = {}) => {
    let query = (zipVal || '').trim();
    let activePolygon = opts.polygon || polygonPath;
    let useGeo = opts.lat != null && opts.lng != null;
    let searchLat = opts.lat;
    let searchLng = opts.lng;

    // Fetch official ZIP code GeoJSON boundary if 5-digit postal code and no custom polygon active
    if (/^\d{5}$/.test(query) && (!activePolygon || activePolygon.length < 3)) {
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(query)}&country=us&format=json&polygon_geojson=1`
        );
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (Array.isArray(geoData) && geoData[0]?.geojson?.coordinates) {
            const rawCoords = geoData[0].geojson.type === 'MultiPolygon'
              ? geoData[0].geojson.coordinates[0][0]
              : geoData[0].geojson.coordinates[0];
            if (rawCoords && rawCoords.length >= 3) {
              const zipPolygonPoints = rawCoords.map(([lon, lat]) => ({
                lat: parseFloat(lat),
                lng: parseFloat(lon)
              }));
              activePolygon = zipPolygonPoints;
              setPolygonPath(zipPolygonPoints);
              setPolygonAreaSqMiles(calculatePolygonSqMiles(zipPolygonPoints));

              if (polygonOverlayRef.current) polygonOverlayRef.current.setMap(null);
              if (mapInstanceRef.current && window.google?.maps) {
                polygonOverlayRef.current = new window.google.maps.Polygon({
                  paths: zipPolygonPoints,
                  strokeColor: '#38bdf8',
                  strokeOpacity: 0.9,
                  strokeWeight: 3,
                  fillColor: '#38bdf8',
                  fillOpacity: 0.18,
                  clickable: false,
                  map: mapInstanceRef.current
                });
                const bounds = new window.google.maps.LatLngBounds();
                zipPolygonPoints.forEach((pt) => bounds.extend(pt));
                if (!bounds.isEmpty()) mapInstanceRef.current.fitBounds(bounds);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Zip boundary polygon fetch error:', err);
      }
    }

    if (query && !useGeo && window.google?.maps) {
      try {
        const geocoder = new window.google.maps.Geocoder();
        const results = await new Promise((resolve) => {
          geocoder.geocode({ address: query }, (res, status) => {
            if (status === 'OK' && res?.length) resolve(pickBestGeocodeResult(res));
            else resolve(null);
          });
        });
        if (results && results.geometry?.location) {
          searchLat = results.geometry.location.lat();
          searchLng = results.geometry.location.lng();
          useGeo = true;
          if (mapInstanceRef.current && (!activePolygon || activePolygon.length < 3)) {
            mapInstanceRef.current.setCenter({ lat: searchLat, lng: searchLng });
            mapInstanceRef.current.setZoom(looksLikeStreetAddress(query) ? 20 : 15);
          }
        }
      } catch (err) {
        console.error('Client geocode failed:', err);
      }
    }

    if (useGeo && looksLikeStreetAddress(query) && mapInstanceRef.current && (!activePolygon || activePolygon.length < 3)) {
      mapInstanceRef.current.setCenter({ lat: searchLat, lng: searchLng });
      mapInstanceRef.current.setZoom(20);
    }

    if (!query && !useGeo && (!activePolygon || activePolygon.length < 3)) return;

    // Mark that the user has searched so filter changes can re-run (not on first open).
    initialSearchDoneRef.current = true;

    if (searchAbortRef.current) searchAbortRef.current.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setSearching(true);
    setSearchBanner('');
    try {
      const token = localStorage.getItem('solar_token');
      const params = new URLSearchParams({ limit: '60' });
      if (query) params.set('zip', query);
      if (singleFamily) params.set('singleFamily', 'true');
      if (skipPaneled) params.set('skipPaneled', 'true');
      if (activePolygon && activePolygon.length >= 3) {
        params.set('polygon', JSON.stringify(activePolygon));
      } else if (useGeo && !looksLikeStreetAddress(query)) {
        params.set('lat', String(searchLat));
        params.set('lng', String(searchLng));
        params.set('radius', String(opts.radius || scanRadius || 1200));
      }

      const response = await fetch(`${API_BASE}/api/properties?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg =
          resolvePropertyDataMessage(data, { status: response.status }) ||
          data.error ||
          PROPERTY_DATA_UNAVAILABLE;
        setProperties([]);
        setSearchBanner(msg);
        return;
      }

      const props = data.properties || [];
      setProperties(props);
      void loadVerifiedScores(props, controller.signal);
      if (data.error || data.code) {
        const msg = resolvePropertyDataMessage(data, { status: response.status });
        if (msg) setSearchBanner(msg);
      } else if (props.length === 0) {
        setSearchBanner('');
      }

      if (mapInstanceRef.current && data.center) {
        const isAddress = data.searchType === 'address' || looksLikeStreetAddress(query);
        mapInstanceRef.current.setCenter({ lat: data.center.lat, lng: data.center.lng });
        if (isAddress && (!activePolygon || activePolygon.length < 3)) {
          mapInstanceRef.current.setZoom(20);
        }
        plotPropertyMarkers(props, data.matchedPropertyId || null);
        const matched = props.find((p) => p.id === data.matchedPropertyId)
          || props.find((p) => p.isSearchMatch);
        if (isAddress && matched) {
          handleMarkerClick(matched.id, matched);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Search error:', err);
        setProperties([]);
        setSearchBanner(PROPERTY_DATA_UNAVAILABLE);
      }
    } finally {
      if (searchAbortRef.current === controller) setSearching(false);
    }
  };

  const handleMarkerClick = async (propId, previewProp = null) => {
    if (detailAbortRef.current) detailAbortRef.current.abort();
    const controller = new AbortController();
    detailAbortRef.current = controller;

    setSelectedProperty({
      _loading: true,
      id: propId,
      address: previewProp?.address || 'Loading property...',
      solarScore: previewProp?.solarScore || 0,
      solar: {},
      propertyData: {},
      contact: {},
      aiLeadScore: { overall: 0, breakdown: {} },
      isSearchMatch: Boolean(previewProp?.isSearchMatch),
    });
    setActiveTab('Overview');
    setGeneratedLeadStatus('idle');
    try {
      const token = localStorage.getItem('solar_token');
      const response = await fetch(`${API_BASE}/api/properties/${encodeURIComponent(propId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg =
          resolvePropertyDataMessage(data, { status: response.status }) ||
          data.error ||
          PROPERTY_DATA_UNAVAILABLE;
        setSelectedProperty(null);
        setSearchBanner(msg);
        return;
      }
      setSelectedProperty({
        ...data,
        isSearchMatch: Boolean(previewProp?.isSearchMatch || data.isSearchMatch),
      });
      if (data.solarScoreSource === 'verified' && Number(data.solarScore) > 0) {
        setProperties((prev) =>
          prev.map((p) =>
            p.id === propId ? { ...p, scoreSource: 'verified', solarScore: data.solarScore } : p,
          ),
        );
      }
      setGeneratedLeadStatus(data.unlocked ? 'generated' : 'idle');
      const pinLat = Number(data.lat);
      const pinLng = Number(data.lng);
      if (Number.isFinite(pinLat) && Number.isFinite(pinLng)) {
        const marker = markerByIdRef.current.get(propId) || markerByIdRef.current.get(data.id);
        if (marker) marker.setPosition({ lat: pinLat, lng: pinLng });
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setSelectedProperty(null);
        setSearchBanner(PROPERTY_DATA_UNAVAILABLE);
      }
    }
  };

  const handleCoordinateClick = async (latVal, lngVal) => {
    if (detailAbortRef.current) detailAbortRef.current.abort();
    const controller = new AbortController();
    detailAbortRef.current = controller;

    setSelectedProperty({
      _loading: true,
      address: `Scanning ${latVal.toFixed(5)}, ${lngVal.toFixed(5)}...`,
      solarScore: 0,
      solar: {},
      propertyData: {},
      contact: {},
      aiLeadScore: { overall: 0, breakdown: {} }
    });
    setActiveTab('Overview');
    setGeneratedLeadStatus('idle');
    try {
      const token = localStorage.getItem('solar_token');
      const response = await fetch(`${API_BASE}/api/properties/lookup?lat=${latVal}&lng=${lngVal}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg =
          resolvePropertyDataMessage(data, { status: response.status }) ||
          data.error ||
          PROPERTY_DATA_UNAVAILABLE;
        setSelectedProperty(null);
        setSearchBanner(msg);
        return;
      }
      setSelectedProperty(data);
      setGeneratedLeadStatus(data.unlocked ? 'generated' : 'idle');
    } catch (err) {
      if (err.name !== 'AbortError') {
        setSelectedProperty(null);
        setSearchBanner(PROPERTY_DATA_UNAVAILABLE);
      }
    }
  };

  useEffect(() => {
    handleCoordinateClickRef.current = handleCoordinateClick;
  });

  useEffect(() => {
    if (!window.google?.maps) return;
    const prevId = selectedMarkerIdRef.current;
    const nextId = selectedProperty?.id || null;
    if (prevId && prevId !== nextId) {
      const prevMarker = markerByIdRef.current.get(prevId);
      const prevProp = properties.find((p) => p.id === prevId);
      if (prevMarker && prevProp) {
        prevMarker.setIcon(propertyMarkerIcon(window.google, prevProp, false));
        prevMarker.setZIndex(undefined);
      }
    }
    if (nextId) {
      const marker = markerByIdRef.current.get(nextId);
      const prop = properties.find((p) => p.id === nextId) || selectedProperty;
      if (marker && prop) {
        marker.setIcon(propertyMarkerIcon(window.google, prop, true));
        marker.setZIndex(window.google.maps.Marker.MAX_ZINDEX + 1);
      }
    }
    selectedMarkerIdRef.current = nextId;
  }, [selectedProperty?.id, properties]);

  useEffect(() => {
    if (!window.google?.maps) return;
    properties.forEach((p) => {
      const marker = markerByIdRef.current.get(p.id);
      if (!marker) return;
      marker.setIcon(propertyMarkerIcon(window.google, p, p.id === selectedMarkerIdRef.current));
      marker.setTitle(markerTitle(p));
    });
  }, [properties]);

  const resolveScanArea = () => {
    if (polygonPath?.length >= 3) {
      const center = polygonCentroid(polygonPath);
      return {
        zip: zip?.trim() || '',
        lat: center?.lat,
        lng: center?.lng,
        polygon: polygonPath,
      };
    }
    if (zip?.trim()) {
      const center = mapInstanceRef.current?.getCenter?.();
      if (center) {
        return {
          zip: zip.trim(),
          lat: center.lat(),
          lng: center.lng(),
          polygon: null,
        };
      }
      return { zip: zip.trim(), lat: null, lng: null, polygon: null };
    }
    if (scanPin) {
      return { zip: zip?.trim() || '', lat: scanPin.lat, lng: scanPin.lng, polygon: null };
    }
    return null;
  };

  const canBulkScan = Boolean(
    (polygonPath && polygonPath.length >= 3) || zip?.trim()
  );

  const handleExecuteScan = () => {
    const area = resolveScanArea();
    if (!area?.zip && !area?.polygon) {
      setUpgradeModalTitle('Action required');
      setShowUpgradeCta(false);
      setUpgradeMessage('Search a ZIP or draw a territory on the map first.');
      setShowUpgradeModal(true);
      return;
    }

    if (!unlimitedCredits && leadCredits < leadsToCapture) {
      setUpgradeModalTitle('Upgrade required');
      setShowUpgradeCta(true);
      setUpgradeMessage(`Bulk scan requires at least ${leadsToCapture} lead credits.`);
      setShowUpgradeModal(true);
      return;
    }

    setShowScanModal(false);
    navigate('/generate', {
      state: {
        fromMap: true,
        zip: area.zip,
        lat: area.lat,
        lng: area.lng,
        polygon: area.polygon,
        radius: scanRadius,
        radiusUnit: area.polygon ? 'meters' : 'miles',
        homesToScan: leadsToCapture,
        leadCreditCost: leadsToCapture,
        minSqFt: useMinSqFt ? minSqFt : 0,
        singleFamily,
        skipPaneled,
      },
    });
  };

  const handleGenerateLead = async () => {
    if (!selectedProperty) return;
    const requestedId = selectedProperty.id;
    unlockAbortRef.current?.abort();
    const controller = new AbortController();
    unlockAbortRef.current = controller;
    const isStale = () =>
      controller.signal.aborted || selectedPropertyIdRef.current !== requestedId;
    setGeneratedLeadStatus('generating');
    try {
      const token = localStorage.getItem('solar_token');
      const response = await fetch(`${API_BASE}/api/leads/generate`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          propertyId: selectedProperty.id,
          detail: {
            ...selectedProperty,
            // Only enforce search-address match for the searched parcel — neighbors unlock freely.
            expectedAddress:
              selectedProperty.isSearchMatch && looksLikeStreetAddress(zip)
                ? zip.trim()
                : undefined,
            searchQuery: undefined,
          }
        })
      });
      const data = await response.json().catch(() => ({}));
      if (isStale()) {
        // User moved to another property; the unlock may still have spent a credit.
        if (response.ok) refreshUserData();
        return;
      }
      if (response.ok) {
        setGeneratedLeadStatus('generated');
        if (data.detail) {
          setSelectedProperty({ ...data.detail, unlocked: true, leadId: data.leadId });
        }
        await refreshUserData();
      } else if (response.status === 401) {
        setUpgradeModalTitle('Session expired');
        setShowUpgradeCta(false);
        setUpgradeMessage('Your session has expired. Please sign in again to unlock this lead.');
        setShowUpgradeModal(true);
        setGeneratedLeadStatus('idle');
      } else if (response.status === 402) {
        setUpgradeModalTitle('Upgrade required');
        setShowUpgradeCta(true);
        setUpgradeMessage(data.error || 'Not enough credits to unlock this lead.');
        setShowUpgradeModal(true);
        setGeneratedLeadStatus('idle');
      } else if (response.status === 409) {
        setUpgradeModalTitle('Address mismatch');
        setShowUpgradeCta(false);
        setUpgradeMessage(
          data.error ||
            `Address mismatch: searched "${data.searched || ''}" but got "${data.resolved || ''}". Search again.`
        );
        setShowUpgradeModal(true);
        setGeneratedLeadStatus('idle');
      } else if (
        response.status === 503 ||
        data.code === 'PROPERTY_DATA_UNAVAILABLE' ||
        data.mockBlocked
      ) {
        setUpgradeModalTitle('System update');
        setShowUpgradeCta(false);
        setUpgradeMessage(
          resolvePropertyDataMessage(data, { status: response.status }) || PROPERTY_DATA_UNAVAILABLE
        );
        setShowUpgradeModal(true);
        setGeneratedLeadStatus('idle');
      } else {
        setUpgradeModalTitle('Could not unlock lead');
        setShowUpgradeCta(false);
        setUpgradeMessage(data.error || 'Could not unlock this lead. Please try again.');
        setShowUpgradeModal(true);
        setGeneratedLeadStatus('idle');
      }
    } catch (err) {
      if (err?.name === 'AbortError' || isStale()) {
        refreshUserData();
        return;
      }
      setUpgradeModalTitle('Could not unlock lead');
      setShowUpgradeCta(false);
      setUpgradeMessage(err.message || 'Could not unlock this lead. Please try again.');
      setShowUpgradeModal(true);
      setGeneratedLeadStatus('idle');
    } finally {
      if (unlockAbortRef.current === controller) unlockAbortRef.current = null;
    }
  };

  return (
    <>
      <div className="relative h-full w-full min-w-0 min-h-0 overflow-hidden bg-surface-container-lowest">
        <div ref={mapRef} className="absolute inset-0 w-full h-full min-w-0 z-10" />

        {mapError && (
          <div className="absolute top-4 left-4 right-4 z-50 max-w-xl mx-auto pointer-events-auto">
            <div className="rounded-xl border border-amber-400/40 bg-amber-500/15 backdrop-blur-md px-4 py-3 text-xs text-amber-50 flex flex-wrap items-start justify-between gap-2 shadow-xl">
              <div>
                <p className="font-semibold text-amber-100">Map unavailable</p>
                <p className="text-amber-100/80 mt-1 leading-relaxed">{mapError}</p>
                {configStatus === 'fallback' && (
                  <p className="text-[11px] text-amber-100/60 mt-1">
                    Set GOOGLE_MAPS_API_KEY or VITE_GOOGLE_MAPS_API_KEY and restart the API / rebuild.
                  </p>
                )}
              </div>
              <button
                type="button"
                className="text-amber-100/70 hover:text-on-surface text-sm"
                onClick={() => setMapError('')}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {searchBanner && !mapError && (
          <div className="absolute top-4 left-4 right-4 z-50 max-w-xl mx-auto pointer-events-auto">
            <div className="theme-dark-canvas rounded-xl border border-sky-400/35 bg-slate-900/85 backdrop-blur-md px-4 py-3 text-xs text-slate-50 flex flex-wrap items-start justify-between gap-2 shadow-xl">
              <p className="leading-relaxed pr-2">{searchBanner}</p>
              <button
                type="button"
                className="text-slate-300/80 hover:text-white text-sm"
                onClick={() => setSearchBanner('')}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Status telemetry bar removed — keep map UI simple */}

        <button
          type="button"
          onClick={() => setShowLeadManager((v) => !v)}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-40 rounded-xl border border-glass-stroke bg-deep/90 backdrop-blur-md px-2.5 sm:px-3 py-2 text-[10px] sm:text-[11px] font-bold text-white hover:bg-white/10 flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-sm">assignment</span>
          <span className="hidden sm:inline">{showLeadManager ? 'Hide leads' : 'Lead manager'}</span>
          <span className="sm:hidden">{showLeadManager ? 'Hide' : 'Leads'}</span>
        </button>

        {showLeadManager && (
          <div className="absolute top-14 sm:top-16 left-3 right-3 sm:left-auto sm:right-4 z-40 w-auto sm:w-[min(100%,380px)] max-h-[calc(100%-5rem)] overflow-hidden">
            <LeadManagerPanel
              visible={showLeadManager}
              onClose={() => {
                setShowLeadManager(false);
                const next = new URLSearchParams(searchParams);
                next.delete('leads');
                setSearchParams(next, { replace: true });
              }}
            />
          </div>
        )}

        {/* Top Floating Control Bar */}
        <div className="absolute top-3 sm:top-4 left-0 right-0 z-30 flex flex-col items-stretch sm:items-center gap-2 max-w-4xl mx-auto w-full px-3 sm:px-4 pointer-events-none pr-20 sm:pr-4">
          <div className="pointer-events-auto flex flex-col md:flex-row md:items-start justify-between w-full gap-2 min-w-0">
            <MapFilterBar
              zip={zip}
              setZip={setZip}
              onSearch={handleSearch}
              singleFamily={singleFamily}
              setSingleFamily={setSingleFamily}
              skipPaneled={skipPaneled}
              setSkipPaneled={setSkipPaneled}
              isDrawingPolygon={isDrawingPolygon}
              lassoMode={lassoMode}
              setLassoMode={setLassoMode}
              polygonAreaSqMiles={polygonAreaSqMiles}
              onToggleDrawing={handleToggleDrawing}
              onClearPolygon={handleClearPolygon}
              hasPolygon={Boolean(polygonPath && polygonPath.length > 0)}
              canBulkScan={canBulkScan}
              onOpenScanModal={() => setShowScanModal(true)}
            />
            <MapModePill mapType={mapType} onChange={setMapType} />
          </div>

          {/* Territory Builder Toolbar Banner (Flows dynamically below MapFilterBar) */}
          {isDrawingPolygon && (
            <div className="theme-dark-canvas pointer-events-auto bg-[#0A0E23]/95 border border-glass-stroke rounded-2xl p-2.5 shadow-2xl backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 text-white max-w-2xl w-auto">
              <div className="flex items-center gap-2 pl-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse shrink-0" />
                <span className="text-xs font-bold whitespace-nowrap">
                  {lassoMode === 'freehand'
                    ? 'Drag mouse on map to draw freehand lasso boundary'
                    : `Click map to plot boundary (${draftPolygonPoints.length} point${draftPolygonPoints.length === 1 ? '' : 's'})`}
                </span>
              </div>

              <div className="flex items-center gap-2 border-l border-glass-stroke/60 pl-3">
                {lassoMode === 'click' && (
                  <>
                    <button
                      type="button"
                      disabled={draftPolygonPoints.length < 3}
                      onClick={handleFinishPolygon}
                      className="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all shadow-md shrink-0"
                    >
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Finish Territory
                    </button>

                    <button
                      type="button"
                      disabled={draftPolygonPoints.length === 0}
                      onClick={handleUndoPolygonVertex}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all shrink-0"
                    >
                      <span className="material-symbols-outlined text-sm">undo</span>
                      Undo Point
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleClearPolygon}
                  className="px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-bold flex items-center gap-1 transition-all border border-red-500/30 shrink-0"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Floating Scan Territory Pill */}
        {!canBulkScan && !isDrawingPolygon && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
            <div className="glass-card px-4 py-2.5 rounded-full border border-glass-stroke text-[11px] text-on-surface-variant">
              Search a ZIP or draw a territory to bulk scan
            </div>
          </div>
        )}

        {canBulkScan && !isDrawingPolygon && !(polygonPath && polygonPath.length >= 3) && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40">
            <button
              type="button"
              onClick={() => setShowScanModal(true)}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold text-xs px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 border border-emerald-400/50 hover:brightness-110 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-lg">radar</span>
              Scan this area
            </button>
          </div>
        )}

        {polygonPath && polygonPath.length >= 3 && !isDrawingPolygon && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowScanModal(true)}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold text-xs px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 border border-emerald-400/50 hover:brightness-110 active:scale-95 transition-all shadow-emerald-500/25"
            >
              <span className="material-symbols-outlined text-lg">radar</span>
              Scan this area
              {polygonAreaSqMiles > 0 ? ` (${polygonAreaSqMiles} sq mi)` : ''}
            </button>
            <button
              onClick={handleClearPolygon}
              className="p-2.5 rounded-full bg-red-500/80 text-white shadow-xl hover:bg-red-600 transition-all"
              title="Clear Territory Polygon"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        )}

        {/* Selected Property Sidebar Drawer */}
        <PropertyDrawer
          selectedProperty={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          googleMapsKey={googleMapsKey}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          generatedLeadStatus={generatedLeadStatus}
          handleGenerateLead={handleGenerateLead}
          unlimitedCredits={unlimitedCredits}
          leadCredits={leadCredits}
        />

        {/* Bulk Area Scan Dialog */}
        <BulkScanDialog
          show={showScanModal}
          onClose={() => setShowScanModal(false)}
          hasPolygon={Boolean(polygonPath && polygonPath.length >= 3)}
          polygonAreaSqMiles={polygonAreaSqMiles}
          zipLabel={zip?.trim() || scanAddress}
          leadsToCapture={leadsToCapture}
          setLeadsToCapture={setLeadsToCapture}
          leadCredits={leadCredits}
          unlimitedCredits={unlimitedCredits}
          onStartScan={handleExecuteScan}
          useMinSqFt={useMinSqFt}
          setUseMinSqFt={setUseMinSqFt}
          minSqFt={minSqFt}
          setMinSqFt={setMinSqFt}
          singleFamily={singleFamily}
          setSingleFamily={setSingleFamily}
          skipPaneled={skipPaneled}
          setSkipPaneled={setSkipPaneled}
        />

        {ENABLE_ASK_HERA ? (
          <AskHeraFab className="absolute bottom-6 right-6 z-40" />
        ) : null}
      </div>

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        credits={leadCredits}
        message={upgradeMessage}
        title={upgradeModalTitle}
        showUpgradeCta={showUpgradeCta}
      />
    </>
  );
}
