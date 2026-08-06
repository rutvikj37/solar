import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import AppLayout from '../components/AppLayout';
import UpgradeModal from '../components/UpgradeModal';
import LeadManagerPanel from '../components/LeadManagerPanel';
import MapModePill from '../components/map/MapModePill';
import MapStatusBar from '../components/map/MapStatusBar';
import AskHeraFab from '../components/map/AskHeraFab';
import { API_BASE } from '../config.js';

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

function scoreFillColor(score, existingSolarLikely) {
  if (existingSolarLikely) return '#94a3b8'; // slate — likely paneled
  if (score >= 85) return '#22c55e'; // green — hot
  if (score >= 70) return '#f59e0b'; // amber — warm
  return '#64748b'; // cool
}

function displayValue(value, fallback = 'Not Available') {
  if (value === null || value === undefined || value === '') return fallback;
  const str = String(value).trim();
  if (!str || str === 'N/A' || str === 'undefined' || str === 'null') return fallback;
  return str;
}

function starCountFromScore(score) {
  const n = Number(score) || 0;
  if (n >= 90) return 5;
  if (n >= 75) return 4;
  if (n >= 60) return 3;
  if (n >= 40) return 2;
  if (n > 0) return 1;
  return 0;
}

function buildPropertySatelliteUrl(property, mapsKey) {
  if (property?.imageUrl) return property.imageUrl;
  const lat = Number(property?.lat);
  const lng = Number(property?.lng);
  if (!mapsKey || Number.isNaN(lat) || Number.isNaN(lng) || (!lat && !lng)) return null;
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: '20',
    size: '640x360',
    maptype: 'satellite',
    scale: '2',
    key: mapsKey
  });
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

function contactBadge(meta = {}, contact = {}) {
  const source = meta.contactSource || meta.dataSources?.contact;
  const complete = meta.contactComplete;
  const hasPhone = contact.phone && !['Not Available', 'N/A'].includes(contact.phone);
  const hasEmail = contact.email && !['Not Available', 'N/A'].includes(contact.email);
  if (complete || (hasPhone && hasEmail)) {
    return { label: source && source !== 'unavailable' ? String(source).toUpperCase() : 'VERIFIED', tone: 'green' };
  }
  if (hasPhone || hasEmail) {
    return { label: 'PARTIAL', tone: 'yellow' };
  }
  return { label: 'UNVERIFIED', tone: 'slate' };
}

function buildScoreMarkerIcon(google, { score = 0, existingSolarLikely = false, selected = false }) {
  const fill = selected ? '#38bdf8' : scoreFillColor(score, existingSolarLikely);
  const scale = selected ? 2.4 : 1.9;
  return {
    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
    fillColor: fill,
    fillOpacity: 0.95,
    strokeColor: selected ? '#ffffff' : '#080B1A',
    strokeWeight: selected ? 2.5 : 1.4,
    scale,
    anchor: new google.maps.Point(12, 22),
    labelOrigin: new google.maps.Point(12, 9)
  };
}

const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: "#757575" }]
  },
  {
    featureType: "administrative.country",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }]
  },
  {
    featureType: "administrative.land_parcel",
    stylers: [{ visibility: "off" }]
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#bdbdbd" }]
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }]
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#181818" }]
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }]
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#1b1b1b" }]
  },
  {
    featureType: "road",
    elementType: "geometry.fill",
    stylers: [{ color: "#2c2c2c" }]
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8a8a8a" }]
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#373737" }]
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#3c3c3c" }]
  },
  {
    featureType: "road.highway.controlled_access",
    elementType: "geometry",
    stylers: [{ color: "#4e4e4e" }]
  },
  {
    featureType: "road.local",
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }]
  },
  {
    featureType: "transit",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }]
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#000000" }]
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3d3d3d" }]
  }
];

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const phi1 = lat1 * Math.PI/180;
  const phi2 = lat2 * Math.PI/180;
  const deltaPhi = (lat2-lat1) * Math.PI/180;
  const deltaLambda = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in meters
}

export default function InteractiveMap() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [zip, setZip] = useState('');
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [searching, setSearching] = useState(false);
  const [leadCredits, setLeadCredits] = useState(26);
  const [unlimitedCredits, setUnlimitedCredits] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [generatedLeadStatus, setGeneratedLeadStatus] = useState('idle'); // idle, generating, generated
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState('');
  const [googleMapsKey, setGoogleMapsKey] = useState('');
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapError, setMapError] = useState('');
  const [configStatus, setConfigStatus] = useState('loading'); // loading | ready | fallback
  const [showWarning, setShowWarning] = useState(true);
  const [mapZoom, setMapZoom] = useState(15);
  const [mapCenter, setMapCenter] = useState({ lat: 34.0736, lng: -118.4004 });
  const showLeadManager = searchParams.get('leads') === '1';

  // Mission Targeting Mode states
  const [targetingMode, setTargetingMode] = useState(false);
  const [scanPin, setScanPin] = useState(null); // { lat, lng }
  const [scanRadius, setScanRadius] = useState(800); // meters
  const [homesToScan, setHomesToScan] = useState(15);
  const [minSqFt, setMinSqFt] = useState(0);
  const [useMinSqFt, setUseMinSqFt] = useState(false);
  const [skipPaneled, setSkipPaneled] = useState(true);
  const [aiVision, setAiVision] = useState(true);
  const [singleFamily, setSingleFamily] = useState(true);
  const [minSavings, setMinSavings] = useState('Any');
  const [cityInput, setCityInput] = useState('');
  const [mapType, setMapType] = useState('hybrid'); // 'satellite', 'hybrid', 'dark'

  // Deploy Scan Bot Modal States
  const [showScanModal, setShowScanModal] = useState(false);
  const [leadsToCapture, setLeadsToCapture] = useState(15);
  const [scanPackage, setScanPackage] = useState('data'); // 'data' or 'ai'
  const [scanAddress, setScanAddress] = useState('Resolving address...');

  // Active Scan Simulation States
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanFoundLeads, setScanFoundLeads] = useState(0);
  const [leadsRefreshKey, setLeadsRefreshKey] = useState(0);
  const [scanPhase, setScanPhase] = useState(''); // fetching | enriching | done | error
  const [isPaused, setIsPaused] = useState(false);
  const [campaignStats, setCampaignStats] = useState({
    called: 0,
    positive: 0,
    callback: 0,
    negative: 0,
    noAnswer: 0,
    spent: '0.00',
    answerRate: 0,
    conversion: 0,
    costPerPositive: '-'
  });

  const isPausedRef = useRef(isPaused);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Google Places Autocomplete states
  const [suggestions, setSuggestions] = useState([]);
  const [activeInput, setActiveInput] = useState(null); // 'main' or 'city'

  // Reverse Geocoding Effect to fetch scan address
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
      // Fallback reverse geocoding via Nominatim
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

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
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
  
  // Mission Targeting refs for markers & circles
  const scanMarkerInstanceRef = useRef(null);
  const scanCircleInstanceRef = useRef(null);
  
  const targetingModeRef = useRef(targetingMode);
  useEffect(() => {
    targetingModeRef.current = targetingMode;
  }, [targetingMode]);

  // Dynamic stats calculation for properties inside the current radius
  const scannedStats = useMemo(() => {
    if (!scanPin || !properties.length) {
      return { eligible: 0, paneled: 0 };
    }

    let eligible = 0;
    let paneled = 0;

    properties.forEach(prop => {
      const dist = calculateDistance(scanPin.lat, scanPin.lng, prop.lat, prop.lng);
      if (dist <= scanRadius) {
        const isPaneled = !!prop.existingSolarLikely;
        if (isPaneled) {
          paneled++;
        } else {
          eligible++;
        }
      }
    });

    return { eligible, paneled };
  }, [scanPin, scanRadius, properties]);

  const handleInputChange = (val, inputType) => {
    if (inputType === 'main') {
      setZip(val);
    } else {
      setCityInput(val);
    }
    setActiveInput(inputType);

    if (suggestDebounceRef.current) {
      suggestDebounceRef.current.cancel();
    }

    if (!val || val.trim() === '') {
      setSuggestions([]);
      return;
    }

    suggestDebounceRef.current = debounce(() => {
      if (window.google && window.google.maps && window.google.maps.places) {
        const service = new window.google.maps.places.AutocompleteService();
        service.getPlacePredictions({
          input: val,
          componentRestrictions: { country: 'us' }
        }, (predictions, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
            setSuggestions(predictions);
          } else {
            fallbackSuggestions(val);
          }
        });
      } else {
        fallbackSuggestions(val);
      }
    }, 280);
    suggestDebounceRef.current();
  };

  const fallbackSuggestions = (val) => {
    const cleanVal = val.trim();
    
    // 1. If it's a numeric ZIP code (e.g., 5 digits)
    if (/^\d+$/.test(cleanVal)) {
      if (cleanVal.length === 5) {
        fetch(`https://api.zippopotam.us/us/${cleanVal}`)
          .then(res => {
            if (!res.ok) throw new Error('Not found');
            return res.json();
          })
          .then(data => {
            if (data && data.places && data.places[0]) {
              const place = data.places[0];
              const mainText = cleanVal;
              const secondaryText = `${place['place name']}, ${place['state abbreviation']}, USA`;
              
              setSuggestions([{
                place_id: `zip-${cleanVal}`,
                description: `${mainText}, ${secondaryText}`,
                types: ['postal_code'],
                structured_formatting: {
                  main_text: mainText,
                  secondary_text: secondaryText
                },
                lat: parseFloat(place.latitude),
                lng: parseFloat(place.longitude),
                zip: cleanVal
              }]);
            }
          })
          .catch(() => {
            queryNominatim(cleanVal);
          });
        return;
      }
    }

    // 2. Otherwise, query Nominatim
    queryNominatim(cleanVal);
  };

  const queryNominatim = (val) => {
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&countrycodes=us&format=json&addressdetails=1&limit=5`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const mapped = data
            .filter(item => {
              if (/^\d+$/.test(val)) {
                return (item.address?.postcode && item.address.postcode.includes(val)) || item.display_name.includes(val);
              }
              return true;
            })
            .map(item => {
              const parts = item.display_name.split(',');
              const mainText = parts[0] ? parts[0].trim() : '';
              const secondaryText = parts.slice(1).map(p => p.trim()).join(', ');
              const isPostal = item.address?.postcode === mainText || item.class === 'boundary';
              
              return {
                place_id: item.place_id.toString(),
                description: item.display_name,
                types: isPostal ? ['postal_code'] : ['geocode'],
                structured_formatting: {
                  main_text: mainText,
                  secondary_text: secondaryText
                },
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                zip: item.address?.postcode || ''
              };
            });
          setSuggestions(mapped);
        }
      })
      .catch(err => {
        console.error('Nominatim autocomplete error:', err);
        setSuggestions([]);
      });
  };

  const handleSuggestionClick = (prediction) => {
    setSuggestions([]);
    setActiveInput(null);
    if (activeInput === 'main') {
      setZip(prediction.structured_formatting.main_text);
    } else {
      setCityInput(prediction.structured_formatting.main_text);
    }

    if (prediction.lat && prediction.lng) {
      const latVal = prediction.lat;
      const lngVal = prediction.lng;
      const zipVal = prediction.zip;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.setCenter({ lat: latVal, lng: lngVal });
        mapInstanceRef.current.setZoom(18);
      }

      if (targetingModeRef.current) {
        setScanPin({ lat: latVal, lng: lngVal });
      }

      if (zipVal) {
        setZip(zipVal);
        handleSearch(zipVal);
      }
      return;
    }

    if (window.google && window.google.maps) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: prediction.description }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const latVal = results[0].geometry.location.lat();
          const lngVal = results[0].geometry.location.lng();
          
          let zipVal = '';
          results[0].address_components.forEach(c => {
            if (c.types.includes('postal_code')) zipVal = c.long_name;
          });

          if (mapInstanceRef.current) {
            mapInstanceRef.current.setCenter({ lat: latVal, lng: lngVal });
            mapInstanceRef.current.setZoom(18);
          }

          if (targetingModeRef.current) {
            setScanPin({ lat: latVal, lng: lngVal });
          }

          if (zipVal) {
            setZip(zipVal);
            handleSearch(zipVal);
          }
        }
      });
    }
  };

  // Register global shortcuts for right-sidebar tools
  useEffect(() => {
    window.locateMe = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const pos = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            if (mapInstanceRef.current) {
              mapInstanceRef.current.setCenter(pos);
              mapInstanceRef.current.setZoom(18);
            }
            setScanPin(pos);
          },
          (err) => {
            console.error('Geolocation error:', err);
            alert('Could not access your location. Please check browser permissions.');
          }
        );
      } else {
        alert('Geolocation is not supported by your browser.');
      }
    };

    window.exportCSV = () => {
      const token = localStorage.getItem('solar_token');
      if (token) {
        window.open(`${API_BASE}/api/leads/export-csv?token=${token}`, '_blank');
      }
    };

    // Auto-trigger locate action if redirected from another page
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'locate') {
      setTimeout(() => {
        if (typeof window.locateMe === 'function') window.locateMe();
      }, 1500);
    }

    return () => {
      delete window.locateMe;
      delete window.exportCSV;
    };
  }, [mapsLoaded]);

  const openLeadManager = () => {
    setTargetingMode(false);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('leads', '1');
      next.delete('action');
      return next;
    }, { replace: false });
  };

  const closeLeadManager = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('leads');
      return next;
    }, { replace: true });
  };

  const enterTargetingMode = () => {
    closeLeadManager();
    setSelectedProperty(null);
    setScanPin(null);
    setTargetingMode(true);
  };

  const exitTargetingMode = () => {
    setTargetingMode(false);
  };

  const openLeadManagerRef = useRef(openLeadManager);
  openLeadManagerRef.current = openLeadManager;

  useEffect(() => {
    window.openLeadManager = () => openLeadManagerRef.current();
    return () => {
      delete window.openLeadManager;
    };
  }, []);

  useEffect(() => {
    if (showLeadManager) setTargetingMode(false);
  }, [showLeadManager]);

  // Live zoom / center for status bar
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapsLoaded) return undefined;

    const syncView = () => {
      const center = map.getCenter?.();
      if (center) {
        setMapCenter({ lat: center.lat(), lng: center.lng() });
      }
      const z = map.getZoom?.();
      if (typeof z === 'number') setMapZoom(z);
    };

    syncView();
    const listeners = [
      map.addListener('idle', syncView),
      map.addListener('center_changed', syncView),
      map.addListener('zoom_changed', syncView)
    ];

    return () => {
      listeners.forEach((l) => {
        if (window.google?.maps?.event) {
          window.google.maps.event.removeListener(l);
        }
      });
    };
  }, [mapsLoaded, configStatus]);

  // Keep zoom gestures enabled even if the map instance was created earlier
  useEffect(() => {
    if (!mapInstanceRef.current || !mapsLoaded) return;
    mapInstanceRef.current.setOptions({
      scrollwheel: true,
      gestureHandling: 'greedy',
      disableDoubleClickZoom: false,
      keyboardShortcuts: true,
      zoomControl: false,
      minZoom: 3,
      maxZoom: 21
    });
  }, [mapsLoaded]);

  // Handle map type changes dynamically
  useEffect(() => {
    if (mapInstanceRef.current && window.google && window.google.maps) {
      if (mapType === 'dark') {
        mapInstanceRef.current.setMapTypeId(window.google.maps.MapTypeId.ROADMAP);
        mapInstanceRef.current.setOptions({ styles: darkMapStyles });
      } else if (mapType === 'satellite') {
        mapInstanceRef.current.setMapTypeId(window.google.maps.MapTypeId.SATELLITE);
        mapInstanceRef.current.setOptions({ styles: [] });
      } else {
        mapInstanceRef.current.setMapTypeId(window.google.maps.MapTypeId.HYBRID);
        mapInstanceRef.current.setOptions({ styles: [] });
      }
    }
  }, [mapType, mapsLoaded]);

  // 1. Fetch Config & Load Google Maps API Script (do not search yet — wait for map shell)
  useEffect(() => {
    const token = localStorage.getItem('solar_token');
    if (!token) {
      navigate('/login');
      return;
    }

    fetch(`${API_BASE}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setLeadCredits(data.credits);
        setUnlimitedCredits(!!data.unlimitedCredits || ['admin', 'platform_admin', 'super_admin'].includes(data.user?.role));
      })
      .catch(console.error);

    fetch(`${API_BASE}/api/config`)
      .then(res => res.json())
      .then(data => {
        const key = data.googleMapsApiKey;
        const isMockKey = key && key.toLowerCase().includes('your_');
        if (key && key.trim() !== '' && !isMockKey) {
          setGoogleMapsKey(key);
          setConfigStatus('ready');
          loadGoogleMapsScript(key);
        } else {
          setConfigStatus('fallback');
          setMapError('Google Maps API key is not configured in server/.env. Running in premium fallback mode.');
        }
      })
      .catch(err => {
        console.error('Config fetch error:', err);
        setConfigStatus('fallback');
        setMapError('Failed to retrieve maps configuration from backend.');
      });

    return () => {
      if (suggestDebounceRef.current) suggestDebounceRef.current.cancel();
      if (searchAbortRef.current) searchAbortRef.current.abort();
      if (detailAbortRef.current) detailAbortRef.current.abort();
    };
  }, [navigate]);

  const loadGoogleMapsScript = (apiKey) => {
    window.gm_authFailure = () => {
      console.warn('Google Maps auth failure: Invalid key. Falling back to rooftop view.');
      setMapError('Invalid Google Maps API Key. Running in premium fallback mode.');
      setGoogleMapsKey('');
      setConfigStatus('fallback');
    };

    if (window.google && window.google.maps) {
      setMapsLoaded(true);
      return;
    }

    const scriptId = 'google-maps-script';
    let script = document.getElementById(scriptId);

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);

      script.onload = () => {
        setMapsLoaded(true);
      };

      script.onerror = () => {
        setConfigStatus('fallback');
        setMapError('Failed to load Google Maps JavaScript SDK. Please check your network.');
      };
    } else if (window.google && window.google.maps) {
      setMapsLoaded(true);
    } else {
      const onLoad = () => setMapsLoaded(true);
      const onError = () => {
        setConfigStatus('fallback');
        setMapError('Failed to load Google Maps JavaScript SDK. Please check your network.');
      };
      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', onError, { once: true });
    }
  };

  // 2. Initialize Real Google Map — paint shell first at moderate zoom
  useEffect(() => {
    if (mapsLoaded && googleMapsKey && mapRef.current && !mapInstanceRef.current) {
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
          // Custom +/- controls are in the UI (left of legend); keep scroll/pinch zoom on
          zoomControl: false,
          scrollwheel: true,
          disableDoubleClickZoom: false,
          gestureHandling: 'greedy',
          keyboardShortcuts: true,
          isFractionalZoomEnabled: true,
          styles: mapType === 'dark' ? darkMapStyles : undefined
        });

        map.addListener('click', (e) => {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          if (targetingModeRef.current) {
            setScanPin({ lat, lng });
          } else if (handleCoordinateClickRef.current) {
            handleCoordinateClickRef.current(lat, lng);
          }
        });

        mapInstanceRef.current = map;
        // One initial search only after map is ready (avoids duplicate fetches)
        if (!initialSearchDoneRef.current) {
          initialSearchDoneRef.current = true;
          handleSearch(zip || '90210');
        }
      } catch (err) {
        console.error('Map init error:', err);
        setConfigStatus('fallback');
        setMapError('Error initializing Google Maps layout: ' + err.message);
      }
    }
  }, [mapsLoaded, googleMapsKey]);

  // 3. Search & Plottings — denser pins with score colors + clustering
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

  const plotPropertyMarkers = (list) => {
    if (!mapInstanceRef.current || !window.google?.maps) return;
    clearMapMarkers();
    if (!list.length) return;

    const google = window.google;
    const markers = list.map((prop) => {
      const likelyPaneled = !!prop.existingSolarLikely;
      const marker = new google.maps.Marker({
        position: { lat: prop.lat, lng: prop.lng },
        title: `${prop.address} · Score ${prop.solarScore}${likelyPaneled ? ' · Possible solar' : ''}`,
        optimized: true,
        icon: buildScoreMarkerIcon(google, {
          score: prop.solarScore || 0,
          existingSolarLikely: likelyPaneled,
          selected: false
        }),
        label: {
          text: String(prop.solarScore || ''),
          color: '#0b1220',
          fontSize: '9px',
          fontWeight: '700'
        }
      });
      marker.__propId = prop.id;
      marker.__propMeta = prop;
      marker.addListener('click', () => {
        highlightSelectedMarker(prop.id);
        handleMarkerClick(prop.id, prop);
      });
      markerByIdRef.current.set(prop.id, marker);
      return marker;
    });

    markersRef.current = markers;
    clustererRef.current = new MarkerClusterer({
      map: mapInstanceRef.current,
      markers
    });
  };

  const highlightSelectedMarker = (propId) => {
    selectedMarkerIdRef.current = propId || null;
    const google = window.google;
    if (!google?.maps) return;
    markerByIdRef.current.forEach((marker, id) => {
      const meta = marker.__propMeta || {};
      const selected = propId != null && id === propId;
      marker.setIcon(
        buildScoreMarkerIcon(google, {
          score: meta.solarScore || 0,
          existingSolarLikely: !!meta.existingSolarLikely,
          selected
        })
      );
      marker.setZIndex(selected ? 999 : undefined);
    });
  };

  const handleSearch = async (zipVal, opts = {}) => {
    const query = (zipVal || '').trim();
    const useGeo = opts.lat != null && opts.lng != null;

    if (!query && !useGeo) return;

    if (searchAbortRef.current) searchAbortRef.current.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setSearching(true);
    try {
      const token = localStorage.getItem('solar_token');
      const params = new URLSearchParams({ limit: '60' });
      if (query) params.set('zip', query);
      if (useGeo) {
        params.set('lat', String(opts.lat));
        params.set('lng', String(opts.lng));
        params.set('radius', String(opts.radius || scanRadius || 800));
      }
      // Apply targeting filters to list pins when in targeting mode
      if (opts.applyFilters || targetingModeRef.current) {
        if (singleFamily) params.set('singleFamily', 'true');
        if (skipPaneled) params.set('skipPaneled', 'true');
        if (minSavings && minSavings !== 'Any') params.set('minSavings', minSavings);
      }

      const response = await fetch(`${API_BASE}/api/properties?${params.toString()}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        signal: controller.signal
      });
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      setProperties(data.properties || []);

      if (mapInstanceRef.current && data.center) {
        const pos = { lat: data.center.lat, lng: data.center.lng };
        mapInstanceRef.current.setCenter(pos);
        mapInstanceRef.current.setZoom((data.properties || []).length > 40 ? 15 : 16);
        plotPropertyMarkers(data.properties || []);
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Search error:', err);
    } finally {
      if (searchAbortRef.current === controller) setSearching(false);
    }
  };

  // 4. Fetch details — show panel immediately; cancel in-flight lookups
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
      aiLeadScore: { overall: 0, breakdown: {} }
    });
    setActiveTab('Overview');
    setLoadingDetails(true);
    setGeneratedLeadStatus('idle');
    try {
      const token = localStorage.getItem('solar_token');
      const response = await fetch(`${API_BASE}/api/properties/${encodeURIComponent(propId)}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        signal: controller.signal
      });
      if (!response.ok) throw new Error('Failed to fetch details');
      const data = await response.json();
      setSelectedProperty(data);
      setActiveTab('Overview');
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
        setSelectedProperty(null);
      }
    } finally {
      if (detailAbortRef.current === controller) setLoadingDetails(false);
    }
  };

  // Click anywhere on map rooftop coordinates to fetch details
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
    setLoadingDetails(true);
    setGeneratedLeadStatus('idle');
    try {
      const token = localStorage.getItem('solar_token');
      const response = await fetch(`${API_BASE}/api/properties/lookup?lat=${latVal}&lng=${lngVal}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        signal: controller.signal
      });
      if (!response.ok) throw new Error('Failed to fetch details for location');
      const data = await response.json();
      setSelectedProperty(data);
      setActiveTab('Overview');
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Coordinate click error:', err);
        setSelectedProperty(null);
      }
    } finally {
      if (detailAbortRef.current === controller) setLoadingDetails(false);
    }
  };

  // Keep ref in sync so Google Maps click listener always calls the latest version
  useEffect(() => {
    handleCoordinateClickRef.current = handleCoordinateClick;
  });

  // Draw/update circle and marker overlays on Google Map in Mission Targeting Mode
  useEffect(() => {
    if (mapInstanceRef.current && window.google && window.google.maps) {
      if (!scanPin) {
        if (scanMarkerInstanceRef.current) {
          scanMarkerInstanceRef.current.setMap(null);
          scanMarkerInstanceRef.current = null;
        }
        if (scanCircleInstanceRef.current) {
          scanCircleInstanceRef.current.setMap(null);
          scanCircleInstanceRef.current = null;
        }
        return;
      }

      // Create or update scan pin marker
      if (!scanMarkerInstanceRef.current) {
        scanMarkerInstanceRef.current = new window.google.maps.Marker({
          position: scanPin,
          map: mapInstanceRef.current,
          icon: {
            path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            scale: 6,
            fillColor: '#3B82F6',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
          },
          draggable: true
        });

        // Add dragend listener to update coordinates
        scanMarkerInstanceRef.current.addListener('dragend', (e) => {
          setScanPin({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        });
      } else {
        scanMarkerInstanceRef.current.setPosition(scanPin);
      }

      // Create or update scan circle
      if (!scanCircleInstanceRef.current) {
        scanCircleInstanceRef.current = new window.google.maps.Circle({
          strokeColor: '#3B82F6',
          strokeOpacity: 0.8,
          strokeWeight: 1.5,
          fillColor: '#3B82F6',
          fillOpacity: 0.12,
          map: mapInstanceRef.current,
          center: scanPin,
          radius: scanRadius
        });
      } else {
        scanCircleInstanceRef.current.setCenter(scanPin);
        scanCircleInstanceRef.current.setRadius(scanRadius);
      }
    }
  }, [scanPin, scanRadius]);

  // Clean up scan overlays when targetingMode is disabled
  useEffect(() => {
    if (!targetingMode) {
      if (scanMarkerInstanceRef.current) {
        scanMarkerInstanceRef.current.setMap(null);
        scanMarkerInstanceRef.current = null;
      }
      if (scanCircleInstanceRef.current) {
        scanCircleInstanceRef.current.setMap(null);
        scanCircleInstanceRef.current = null;
      }
      setScanPin(null);
    }
  }, [targetingMode]);

  const handleInitiateBulkScan = () => {
    if (!scanPin) {
      alert("Please click on the map to drop a scan pin first.");
      return;
    }
    setLeadsToCapture(homesToScan);
    setShowScanModal(true);
  };

  const handleExecuteScan = async () => {
    setShowScanModal(false);
    if (!scanPin) {
      alert('Please drop a scan pin on the map first.');
      return;
    }
    if (!unlimitedCredits && leadCredits < leadsToCapture) {
      setUpgradeMessage(
        `Bulk scan requires at least ${leadsToCapture} credits. Subscribe to a monthly plan for more lead credits.`
      );
      setShowUpgradeModal(true);
      return;
    }

    if (mapInstanceRef.current && scanPin) {
      mapInstanceRef.current.setCenter(scanPin);
      mapInstanceRef.current.setZoom(17);
    }

    if (scanAbortRef.current) scanAbortRef.current.abort();
    const controller = new AbortController();
    scanAbortRef.current = controller;

    setIsScanning(true);
    setScanProgress(8);
    setScanFoundLeads(0);
    setScanPhase('fetching');
    setIsPaused(false);
    setCampaignStats({
      called: 0,
      positive: 0,
      callback: 0,
      negative: 0,
      noAnswer: 0,
      spent: '0.00',
      answerRate: 0,
      conversion: 0,
      costPerPositive: '-'
    });

    // Soft indeterminate progress while awaiting real bulk-scan (no fake completion)
    let tick = 8;
    const progressTimer = setInterval(() => {
      if (isPausedRef.current) return;
      tick = Math.min(92, tick + Math.random() * 4 + 1);
      setScanProgress(Math.floor(tick));
      if (tick > 35 && tick < 70) setScanPhase('enriching');
    }, 900);

    const token = localStorage.getItem('solar_token');
    try {
      setScanPhase('fetching');
      const response = await fetch(`${API_BASE}/api/leads/bulk-scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          zip: zip || '',
          lat: scanPin.lat,
          lng: scanPin.lng,
          radius: scanRadius,
          radiusUnit: 'meters',
          minSqFt: useMinSqFt ? minSqFt : 0,
          intentLevel: 'All',
          leadCreditCost: leadsToCapture,
          homesToScan: leadsToCapture,
          skipPaneled,
          singleFamily,
          minSavings
        })
      });

      const data = await response.json().catch(() => ({}));
      clearInterval(progressTimer);

      if (!response.ok) {
        setScanPhase('error');
        setScanProgress(100);
        setIsScanning(false);
        alert(data.error || 'Bulk scan failed');
        return;
      }

      setScanPhase('done');
      setScanProgress(100);
      setScanFoundLeads(data.leadsCount || 0);
      setCampaignStats((prev) => ({
        ...prev,
        spent: ((data.leadsCount || 0) * (scanPackage === 'ai' ? 1.2 : 0.5)).toFixed(2)
      }));

      // Refresh credits
      try {
        const meRes = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (meRes.ok) {
          const me = await meRes.json();
          if (me.credits !== undefined) setLeadCredits(me.credits);
          setUnlimitedCredits(!!me.unlimitedCredits || ['admin', 'platform_admin', 'super_admin'].includes(me.user?.role));
        }
      } catch (_) {
        /* ignore */
      }

      // Refresh pins around the pin territory with the same filters
      await handleSearch(zip || '', {
        lat: scanPin.lat,
        lng: scanPin.lng,
        radius: scanRadius,
        applyFilters: true
      });

      setIsScanning(false);
      setLeadsRefreshKey((k) => k + 1);
      openLeadManager();

      const contactBit =
        typeof data.withContact === 'number'
          ? ` (${data.withContact} with contact, ${data.withoutContact || 0} property-only)`
          : '';
      // Soft notice — Lead Manager opens with fresh leads immediately
      console.info(
        `Scan complete — ${data.leadsCount || 0} leads saved${contactBit}.` +
          (data.skipped ? ` ${data.skipped} skipped by filters/duplicates.` : '')
      );
    } catch (err) {
      clearInterval(progressTimer);
      if (err.name === 'AbortError') {
        setIsScanning(false);
        setScanPhase('');
        return;
      }
      console.error('Bulk scan execution failed:', err);
      setScanPhase('error');
      setIsScanning(false);
      alert(err.message || 'Bulk scan failed');
    }
  };

  // Generate Lead action
  const handleGenerateLead = async () => {
    if (!selectedProperty) return;
    if (!unlimitedCredits && leadCredits <= 0) {
      setUpgradeMessage(
        "You've used your free credits. Subscribe to a monthly plan to keep generating leads."
      );
      setShowUpgradeModal(true);
      return;
    }
    setGeneratedLeadStatus('generating');
    try {
      const token = localStorage.getItem('solar_token');
      const response = await fetch(`${API_BASE}/api/leads/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          propertyId: selectedProperty.id,
          detail: selectedProperty
        })
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 402) {
          setUpgradeMessage(data.error);
          setShowUpgradeModal(true);
          setGeneratedLeadStatus('idle');
          return;
        }
        throw new Error(data.error || 'Failed to generate lead');
      }
      
      setGeneratedLeadStatus('generated');
      setLeadCredits(prev => Math.max(0, prev - 1));
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (err) {
      alert(err.message);
      setGeneratedLeadStatus('idle');
    }
  };

  return (
    <AppLayout>
      <div className="relative h-full w-full overflow-hidden bg-surface-container-lowest">
        
        {/* Map container always mounted so Google Maps can attach without remount thrash */}
        <div
          ref={mapRef}
          className={`w-full h-full z-10 touch-pan-x touch-pan-y ${configStatus === 'ready' && !mapError ? '' : 'invisible absolute inset-0 pointer-events-none'}`}
          style={{ touchAction: 'pan-x pan-y' }}
        />

        {/* Lightweight shell while config / Maps SDK loads */}
        {(configStatus === 'loading' || (configStatus === 'ready' && !mapsLoaded && !mapError)) && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-surface-container-lowest">
            <span className="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
            <p className="text-xs text-on-surface-variant font-semibold">Loading map…</p>
          </div>
        )}

        {/* Active scan progress chip (Google Maps mode) */}
        {isScanning && mapsLoaded && googleMapsKey && !mapError && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 bg-deep border border-primary text-white p-2.5 rounded-xl shadow-xl text-center flex flex-col items-center min-w-[170px] pointer-events-none select-none">
            <span className="font-bold text-[9px] truncate max-w-[150px] text-slate-300">{scanAddress}</span>
            <div className="flex gap-2 text-[9px] mt-1.5 font-bold justify-between w-full">
              <span className="text-white">{scanFoundLeads} Leads found</span>
              <span className="text-primary">{scanProgress}%</span>
            </div>
          </div>
        )}

        {/* Fallback static canvas only when Maps unavailable */}
        {(configStatus === 'fallback' || (mapError && !googleMapsKey)) && (
          <div 
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = (e.clientX - rect.left) / rect.width;
              const y = (e.clientY - rect.top) / rect.height;
              const clickedLat = 34.0736 + (0.5 - y) * 0.03;
              const clickedLng = -118.4004 + (x - 0.5) * 0.04;
              if (targetingMode) {
                setScanPin({ lat: clickedLat, lng: clickedLng });
              } else {
                handleCoordinateClick(clickedLat, clickedLng);
              }
            }}
            className={`absolute inset-0 w-full h-full bg-cover bg-center cursor-pointer z-10 ${
              mapType === 'dark' ? 'brightness-[40%] contrast-[130%] grayscale-[80%]' : 'brightness-[85%] grayscale-[10%]'
            }`}
            style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBGD2L8HVyXoGN5-K4M1oZyxbZYTrbZv8No351Ghwc2JNdXRRn2YQE1hv8PlXbPTCPqJWknp1zGNhd5fByadCXhOLoQ9x1rDkkMYkslbGHcbsGb43V6BD2S37xi35gqb79-7HZ8n-4MSFuylNS98qT_xnXUd30j4xoKlval4qXhvopw-BmHHCHo_5vQBq4Sk20oQ_NB9M3LsBo7KUMvaES1DjylnRYX3PEU0bnpm2Gaw_mUrLxmLqyR')" }}
          >
            {properties.map((prop, i) => {
              const topVal = 30 + (Math.sin(i * 9) + 1) * 20;
              const leftVal = 20 + (Math.cos(i * 11) + 1) * 30;

              return (
                <div 
                  key={prop.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkerClick(prop.id, prop);
                  }}
                  style={{ top: `${topVal}%`, left: `${leftVal}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                >
                  <span className={`material-symbols-outlined text-[36px] drop-shadow-[0_0_8px_rgba(0,0,0,0.8)] transition-all ${
                    selectedProperty?.id === prop.id ? 'text-secondary scale-110' : 'text-primary hover:text-white'
                  }`} style={{ fontVariationSettings: "'FILL' 1" }}>
                    location_on
                  </span>
                </div>
              );
            })}

            {targetingMode && scanPin && (
              <div 
                style={{ 
                  position: 'absolute',
                  top: `${((34.0736 - scanPin.lat) / 0.03 + 0.5) * 100}%`, 
                  left: `${((scanPin.lng - -118.4004) / 0.04 + 0.5) * 100}%` 
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none flex items-center justify-center"
              >
                <div 
                  className="rounded-full border-2 border-primary bg-primary/10 flex-shrink-0"
                  style={{
                    width: `${scanRadius * 0.4}px`,
                    height: `${scanRadius * 0.4}px`
                  }}
                />
                <span className="material-symbols-outlined text-[36px] text-primary absolute" style={{ fontVariationSettings: "'FILL' 1" }}>
                  target
                </span>
              </div>
            )}

            {mapError && showWarning && (
              <div className="absolute top-20 left-6 right-6 z-30 glass-card p-4 rounded-xl border border-red-500/20 shadow-2xl bg-red-950/20 backdrop-blur-md max-w-md mx-auto text-center relative">
                <button 
                  onClick={() => setShowWarning(false)}
                  className="absolute top-3 right-3 text-on-surface-variant hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
                <div className="flex items-center gap-2 text-red-400 font-bold mb-1 justify-center text-xs">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  Google Maps SDK Offline
                </div>
                <p className="text-[10px] text-on-surface-variant leading-relaxed">
                  {mapError} Insert your key in `server/.env` to unlock panned panning and zoom.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Search overlay spinner on live map */}
        {searching && configStatus === 'ready' && !mapError && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 glass-card px-4 py-2 rounded-full flex items-center gap-2 text-xs border border-glass-stroke">
            <span className="material-symbols-outlined text-sm text-primary animate-spin">sync</span>
            <span className="text-on-surface-variant font-semibold">Finding properties…</span>
          </div>
        )}

        {/* Floating Left Targeting toggle button */}
        <button
          onClick={() => {
            if (isScanning) return;
            if (targetingMode) {
              exitTargetingMode();
            } else {
              enterTargetingMode();
            }
          }}
          disabled={isScanning}
          className={`absolute top-6 left-6 z-30 flex items-center gap-2 px-3 py-2.5 rounded-xl border shadow-xl text-xs font-bold transition-all ${
            isScanning
              ? 'bg-primary/10 border-primary/20 text-primary opacity-50 cursor-not-allowed'
              : targetingMode 
                ? 'bg-primary text-on-primary border-primary hover:brightness-110'
                : 'glass-card text-white border-glass-stroke hover:bg-white/10'
          }`}
        >
          <span className="material-symbols-outlined text-base">radar</span>
          {isScanning ? 'Scan In Progress...' : targetingMode ? 'Exit Scan Mode' : 'Targeting Tools'}
        </button>

        {/* Lead Manager floating overlay — mutual exclusion with Mission Targeting */}
        <div
          className={`absolute top-20 left-6 bottom-20 w-[min(100%-3rem,360px)] z-[42] transition-all duration-300 ease-in-out ${
            showLeadManager
              ? 'translate-x-0 opacity-100'
              : '-translate-x-full opacity-0 pointer-events-none'
          }`}
        >
          <LeadManagerPanel
            onClose={closeLeadManager}
            refreshKey={leadsRefreshKey}
            visible={showLeadManager}
          />
        </div>

        {/* Mission Targeting Left-side Panel */}
        <div className={`absolute top-20 left-6 bottom-20 w-80 z-40 bg-surface-elevated/95 backdrop-blur-2xl border border-glass-stroke rounded-2xl shadow-2xl flex flex-col transition-all duration-300 ease-in-out ${
          targetingMode && !showLeadManager ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'
        }`}>
          <div className="p-4 border-b border-glass-stroke flex justify-between items-center bg-white/5 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">target</span>
              <h3 className="font-headline-md text-sm font-bold text-white leading-tight">Mission Targeting</h3>
            </div>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
              isScanning 
                ? 'bg-primary/20 text-primary' 
                : scanPin 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-primary/20 text-primary animate-pulse'
            }`}>
              {isScanning ? 'TARGET LOCKED' : scanPin ? 'READY' : 'PIN NEEDED'}
            </span>
          </div>

          <div className={`flex-1 overflow-y-auto p-4 custom-scrollbar text-[11px] space-y-4 transition-opacity ${isScanning ? 'opacity-40 pointer-events-none' : ''}`}>
            {/* Step 1: PICK A CITY */}
            <div className="space-y-1 relative">
              <label className="text-on-surface-variant block font-semibold text-[10px] uppercase tracking-wider">1. PICK A CITY / ZIP</label>
              <div className="relative flex items-center">
                <input 
                  type="text" 
                  placeholder="e.g. Scottsdale, AZ or 90210"
                  value={cityInput}
                  onChange={(e) => handleInputChange(e.target.value, 'city')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch(cityInput);
                    }
                  }}
                  className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 pr-10 focus:outline-none focus:border-primary text-white text-xs placeholder:text-on-surface-variant/30"
                />
                <button 
                  onClick={() => handleSearch(cityInput)}
                  className="absolute right-2 text-primary hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
              {/* Dropdown Suggestions */}
              {suggestions.length > 0 && activeInput === 'city' && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 glass-card border border-glass-stroke rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-glass-stroke/30 custom-scrollbar text-xs">
                  {suggestions.map((s) => {
                    const isPostal = s.types.includes('postal_code') || s.types.includes('locality');
                    return (
                      <div 
                        key={s.place_id}
                        onClick={() => handleSuggestionClick(s)}
                        className="p-3 hover:bg-white/5 cursor-pointer flex items-center gap-3 transition-colors text-left"
                      >
                        <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                          <span className="material-symbols-outlined text-sm">
                            {isPostal ? 'home' : 'location_on'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white truncate text-[11px]">
                            {s.structured_formatting.main_text}
                          </p>
                          <p className="text-on-surface-variant text-[9px] truncate">
                            {s.structured_formatting.secondary_text}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-[9px] text-on-surface-variant/60 leading-normal">
                Press Enter to center the map on this area.
              </p>
            </div>

            {/* Step 2: PIN A NEIGHBORHOOD */}
            <div className="space-y-1">
              <label className="text-on-surface-variant block font-semibold text-[10px] uppercase tracking-wider">2. PIN A NEIGHBORHOOD</label>
              <div className="p-3 bg-surface-container-low rounded-lg border border-glass-stroke space-y-2">
                <p className="text-[10px] text-on-surface-variant leading-relaxed">
                  Click anywhere on the map to drop your scan pin. The circle represents your scan boundary.
                </p>
                {scanPin ? (
                  <div className="text-[10px] text-green-400 font-mono font-semibold flex items-center gap-1.5 pt-1">
                    <span className="material-symbols-outlined text-xs">location_on</span>
                    Target: {scanPin.lat.toFixed(5)}, {scanPin.lng.toFixed(5)}
                  </div>
                ) : (
                  <div className="text-[10px] text-primary font-mono font-semibold flex items-center gap-2 pt-1">
                    <span className="material-symbols-outlined text-base text-primary">error</span>
                    <span>No scan pin dropped yet.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: SCAN PARAMETERS */}
            <div className="space-y-3 pt-2 border-t border-glass-stroke/50">
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-semibold">
                  <span className="text-on-surface-variant">SCAN RADIUS</span>
                  <span className="text-primary font-bold">{scanRadius}m</span>
                </div>
                <input 
                  type="range" 
                  min="100" 
                  max="1600" 
                  step="50"
                  value={scanRadius}
                  onChange={(e) => setScanRadius(Number(e.target.value))}
                  className="w-full accent-primary h-1 bg-surface-container-high rounded-lg appearance-none cursor-pointer mt-1"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-semibold">
                  <span className="text-on-surface-variant">HOMES TO SCAN</span>
                  <span className="text-primary font-bold">{homesToScan}</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="50" 
                  step="1"
                  value={homesToScan}
                  onChange={(e) => setHomesToScan(Number(e.target.value))}
                  className="w-full accent-primary h-1 bg-surface-container-high rounded-lg appearance-none cursor-pointer mt-1"
                />
              </div>
            </div>

            {/* Advanced Settings */}
            <div className="space-y-2 pt-2 border-t border-glass-stroke/50">
              <span className="text-on-surface-variant block font-semibold text-[10px] uppercase tracking-wider">ADVANCED SETTINGS</span>
              
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="skipPaneled" className="text-on-surface-variant text-[11px] cursor-pointer">Skip Paneled Homes</label>
                  <ToggleSwitch
                    id="skipPaneled"
                    checked={skipPaneled}
                    onChange={setSkipPaneled}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <label htmlFor="aiVision" className="text-on-surface-variant text-[11px] cursor-pointer">AI Vision Verification</label>
                  <ToggleSwitch
                    id="aiVision"
                    checked={aiVision}
                    onChange={setAiVision}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <label htmlFor="singleFamily" className="text-on-surface-variant text-[11px] cursor-pointer">Single-Family Only</label>
                  <ToggleSwitch
                    id="singleFamily"
                    checked={singleFamily}
                    onChange={setSingleFamily}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <label htmlFor="minSavings" className="text-on-surface-variant text-[11px]">Min Savings</label>
                  <select 
                    id="minSavings"
                    value={minSavings} 
                    onChange={(e) => setMinSavings(e.target.value)}
                    className="bg-surface-container-low border border-glass-stroke rounded-lg py-1 px-2 focus:outline-none focus:border-primary text-white text-[10px]"
                  >
                    <option value="Any">Any</option>
                    <option value="$10,000">$10,000</option>
                    <option value="$20,000">$20,000</option>
                    <option value="$30,000">$30,000</option>
                  </select>
                </div>

                <div className="flex justify-between items-center gap-2">
                  <label htmlFor="useMinSqFt" className="text-on-surface-variant text-[11px] cursor-pointer">Min Roof Area</label>
                  <div className="flex items-center gap-2">
                    <ToggleSwitch
                      id="useMinSqFt"
                      checked={useMinSqFt}
                      onChange={setUseMinSqFt}
                    />
                    <input
                      type="number"
                      min="500"
                      step="100"
                      disabled={!useMinSqFt}
                      value={minSqFt || 1500}
                      onChange={(e) => setMinSqFt(Number(e.target.value) || 0)}
                      className="w-20 bg-surface-container-low border border-glass-stroke rounded-lg py-1 px-2 text-white text-[10px] disabled:opacity-40"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: INITIATE SCAN */}
            <div className="space-y-3 pt-3 border-t border-glass-stroke/50">
              <label className="text-on-surface-variant block font-semibold text-[10px] uppercase tracking-wider">3. Initiate Scan</label>
              
              {/* Cost Summary Box */}
              <div className="bg-surface-container-low border border-glass-stroke p-3 rounded-xl space-y-1.5 text-[11px] leading-relaxed">
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant">Package</span>
                  <span className="text-white font-semibold">{scanPackage === 'ai' ? 'AI Call + Data' : 'Lead Only'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant">{homesToScan} homes × ${scanPackage === 'ai' ? '1.20' : '0.50'}</span>
                  <span className="text-white font-semibold">${(homesToScan * (scanPackage === 'ai' ? 1.2 : 0.5)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-green-400">
                  <span>- 10 free leads (gift)</span>
                  <span>-$5.00</span>
                </div>
                <div className="border-t border-glass-stroke/50 pt-1.5 mt-1 flex justify-between items-center font-bold text-primary text-xs">
                  <span>Charged now</span>
                  <span>${Math.max(0, homesToScan * (scanPackage === 'ai' ? 1.2 : 0.5) - 5).toFixed(2)}</span>
                </div>
              </div>

              {/* Card Warning */}
              <div className="p-2.5 bg-yellow-500/5 rounded-lg border border-yellow-500/20 flex gap-2 text-[10px] text-yellow-500 leading-normal">
                <span className="material-symbols-outlined text-xs flex-shrink-0 mt-0.5">warning</span>
                <span>No card on file. Add one to enable scans beyond free credit.</span>
              </div>

              {/* Data Lead vs AI Call choice cards */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setScanPackage('data')}
                  className={`p-2.5 rounded-lg border-2 flex flex-col text-left transition-all ${
                    scanPackage === 'data'
                      ? 'border-primary bg-primary/10'
                      : 'border-glass-stroke bg-surface/20 hover:border-primary/40'
                  }`}
                >
                  <span className="text-white font-bold text-[11px]">Data Lead</span>
                  <span className="text-on-surface-variant text-[9px] mt-0.5">$0.50 / lead</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScanPackage('ai')}
                  className={`p-2.5 rounded-lg border-2 flex flex-col text-left transition-all ${
                    scanPackage === 'ai'
                      ? 'border-primary bg-primary/10'
                      : 'border-glass-stroke bg-surface/20 hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-white font-bold text-[11px]">AI Call</span>
                  </div>
                  <span className="text-on-surface-variant text-[9px] mt-0.5 font-medium">$1.20 / lead</span>
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-glass-stroke bg-white/5 rounded-b-2xl flex flex-col gap-3">
            <button 
              onClick={handleInitiateBulkScan}
              disabled={!scanPin || isScanning}
              className="w-full bg-primary text-on-primary font-bold py-2.5 rounded-lg hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-primary/20"
            >
              <span className="material-symbols-outlined text-sm">radar</span>
              {isScanning ? 'SCAN IN PROGRESS...' : 'RUN AI SATELLITE SCAN'}
            </button>
            
            {/* Stats display at the bottom */}
            <div className="grid grid-cols-2 gap-2 text-center border-t border-glass-stroke/50 pt-2 text-[10px]">
              <div>
                <p className="text-on-surface-variant font-medium tracking-wider uppercase">LEAD CREDITS</p>
                <p className="text-white text-base font-bold font-mono mt-0.5">{unlimitedCredits ? '∞' : leadCredits}</p>
                <p className="text-on-surface-variant/60 text-[9px] mt-0.5">{unlimitedCredits ? 'Admin — unlimited' : 'Credits left'}</p>
              </div>
              <div className="border-l border-glass-stroke/50 flex flex-col justify-center">
                <p className="text-on-surface-variant font-medium tracking-wider uppercase">PANELED</p>
                        <p className="text-white text-base font-bold font-mono mt-0.5">{scannedStats.paneled}</p>
              </div>
            </div>
          </div>
        </div>
        {/* Floating Top: scan status, map modes (always-on), or search */}
        {isScanning ? (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 bg-deep/95 border border-primary/20 px-6 py-2.5 rounded-2xl shadow-xl flex flex-col items-center gap-0.5 text-center min-w-[300px] select-none">
            <span className="text-primary font-black text-xs uppercase tracking-widest flex items-center gap-1.5 justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
              {scanPhase === 'enriching' ? 'ENRICHING LEADS' : scanPhase === 'done' ? 'SCAN COMPLETE' : 'FETCHING CANDIDATES'}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {scanPhase === 'enriching'
                ? 'Running solar + owner contact enrichment…'
                : 'Loading properties inside your pin radius…'}
              {' '}({scanProgress}%)
            </span>
          </div>
        ) : (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 w-[calc(100%-48px)] max-w-md pointer-events-none">
            <div className="pointer-events-auto">
              <MapModePill mapType={mapType} onChange={setMapType} />
            </div>
            {!targetingMode && (
              <div className="w-full glass-card p-3 rounded-xl border border-glass-stroke shadow-xl flex items-center gap-3 relative pointer-events-auto">
                <span className="material-symbols-outlined text-on-surface-variant text-base">travel_explore</span>
                <input 
                  type="text"
                  placeholder="Enter ZIP code / pincode..."
                  value={zip}
                  onChange={(e) => handleInputChange(e.target.value, 'main')}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(zip)}
                  className="flex-1 bg-transparent border-none text-white text-xs focus:outline-none placeholder:text-on-surface-variant/40"
                />
                <button 
                  onClick={() => handleSearch(zip)}
                  disabled={searching}
                  className="bg-primary text-on-primary text-[10px] font-bold px-3 py-1.5 rounded-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1"
                >
                  {searching && <span className="material-symbols-outlined text-xs animate-spin">sync</span>}
                  Search
                </button>
                {suggestions.length > 0 && activeInput === 'main' && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 glass-card border border-glass-stroke rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-glass-stroke/30 custom-scrollbar text-xs">
                    {suggestions.map((s) => {
                      const isPostal = s.types.includes('postal_code') || s.types.includes('locality');
                      return (
                        <div 
                          key={s.place_id}
                          onClick={() => handleSuggestionClick(s)}
                          className="p-3 hover:bg-white/5 cursor-pointer flex items-center gap-3 transition-colors text-left font-semibold text-slate-300"
                        >
                          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                            <span className="material-symbols-outlined text-sm">
                              {isPostal ? 'home' : 'location_on'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white truncate text-[11px]">
                              {s.structured_formatting.main_text}
                            </p>
                            <p className="text-on-surface-variant text-[9px] truncate">
                              {s.structured_formatting.secondary_text}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ACTIVE CAMPAIGNS floating panel — clear fixed nav sidebar (+ detail drawer when open) */}
        {isScanning && (
          <div className={`absolute top-20 w-[260px] z-[38] bg-deep/95 border border-white/5 rounded-2xl p-4 shadow-2xl flex flex-col text-slate-300 text-xs text-left animate-fade-in ${
            selectedProperty ? 'right-6 lg:right-[732px]' : 'right-6 lg:right-[276px]'
          }`}>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[9px] text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
                <span>ACTIVE CAMPAIGNS</span>
              </div>
            </div>
            
            <div className="p-2.5 bg-white/5 border border-white/5 rounded-lg flex justify-between items-center mb-4">
              <span className="font-semibold truncate max-w-[150px] text-[10px] text-white">{scanAddress || 'Resolving address...'}</span>
              <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 text-[8px] font-bold tracking-wide">ACTIVE</span>
            </div>

            {scanPackage === 'ai' ? (
              <div className="space-y-2 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Called</span>
                  <span className="text-white font-semibold font-mono">{campaignStats.called} / {leadsToCapture} ({Math.round((campaignStats.called/leadsToCapture)*100)}%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">✔ Positive</span>
                  <span className="text-green-400 font-bold font-mono">{campaignStats.positive}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">↻ Callback</span>
                  <span className="text-yellow-400 font-bold font-mono">{campaignStats.callback}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">✖ Negative</span>
                  <span className="text-red-400 font-bold font-mono">{campaignStats.negative}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">No answer</span>
                  <span className="text-white font-mono">{campaignStats.noAnswer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Skipped (no phone)</span>
                  <span className="text-white font-mono">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Answer rate</span>
                  <span className="text-white font-mono">{campaignStats.answerRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Conversion</span>
                  <span className="text-white font-mono">{campaignStats.conversion}%</span>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-2">
                  <span className="text-slate-500">Spent / Cap</span>
                  <span className="text-white font-semibold font-mono">${campaignStats.spent} / ${(leadsToCapture * 1.20).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cost / positive</span>
                  <span className="text-white font-mono">{campaignStats.costPerPositive}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Parallel calls</span>
                  <span className="text-white font-mono">1</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Scanned</span>
                  <span className="text-white font-semibold font-mono">{scanFoundLeads} / {leadsToCapture} ({scanProgress}%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Enriched Leads</span>
                  <span className="text-green-400 font-bold font-mono">{scanFoundLeads}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Skipped (no details)</span>
                  <span className="text-white font-mono">0</span>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-2">
                  <span className="text-slate-500">Spent / Cap</span>
                  <span className="text-white font-semibold font-mono">${campaignStats.spent} / ${(leadsToCapture * 0.50).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Parallel threads</span>
                  <span className="text-white font-mono">4</span>
                </div>
              </div>
            )}

            {/* Campaign Controls */}
            <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-white/5 text-[9px] font-bold">
              <button 
                onClick={() => setIsPaused(!isPaused)}
                className="py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white border border-white/5 transition-all flex items-center justify-center gap-1 active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[12px]">{isPaused ? 'play_arrow' : 'pause'}</span>
                {isPaused ? 'RESUME' : 'PAUSE'}
              </button>
              <button 
                onClick={() => {
                  if (scanAbortRef.current) scanAbortRef.current.abort();
                  setIsScanning(false);
                  setIsPaused(false);
                  setScanPhase('');
                }}
                className="py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all flex items-center justify-center gap-1 active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-[12px]">close</span>
                CANCEL
              </button>
            </div>
          </div>
        )}

        {/* Left Side: zoom + legend — shift right of Mission Targeting / Lead Manager when open */}
        <div
          className={`absolute bottom-16 z-30 flex flex-col gap-2 transition-all duration-300 ${
            targetingMode || showLeadManager ? 'left-[min(100%-3rem,380px)] sm:left-[380px]' : 'left-6'
          }`}
        >
          <div className="glass-card rounded-xl border border-glass-stroke shadow-xl overflow-hidden flex flex-col w-10">
            <button
              type="button"
              title="Zoom in"
              aria-label="Zoom in"
              onClick={() => {
                const map = mapInstanceRef.current;
                if (!map) return;
                const next = Math.min(21, (map.getZoom() || 15) + 1);
                map.setZoom(next);
              }}
              className="h-10 flex items-center justify-center text-white hover:bg-white/10 active:bg-white/15 transition-colors border-b border-glass-stroke"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
            </button>
            <button
              type="button"
              title="Zoom out"
              aria-label="Zoom out"
              onClick={() => {
                const map = mapInstanceRef.current;
                if (!map) return;
                const next = Math.max(3, (map.getZoom() || 15) - 1);
                map.setZoom(next);
              }}
              className="h-10 flex items-center justify-center text-white hover:bg-white/10 active:bg-white/15 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">remove</span>
            </button>
          </div>
          {/* Credits already shown inside Mission Targeting — avoid duplicate overlap */}
          {!targetingMode && !showLeadManager && (
            <div className="glass-card p-4 rounded-xl border border-glass-stroke shadow-xl text-xs max-w-[220px]">
              <p className="font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest leading-none mb-1.5">LEAD CREDITS</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-primary">{unlimitedCredits ? '∞' : leadCredits}</span>
                <span className="text-[10px] text-on-surface-variant">{unlimitedCredits ? 'Admin unlimited' : 'Credits left'}</span>
              </div>
            </div>
          )}
          <div className="glass-card p-3 rounded-xl border border-glass-stroke shadow-xl text-[10px] max-w-[220px] space-y-1.5">
            <p className="font-label-mono text-[8px] text-on-surface-variant uppercase tracking-widest">Pin legend</p>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" /> Hot score ≥85</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" /> Warm 70–84</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#64748b]" /> Cool &lt;70</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#94a3b8]" /> Possible existing solar</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]" /> Selected</div>
          </div>
        </div>

        {/* Premium Right-side Sliding Panel — above status/FAB; offset on lg so it clears the fixed nav sidebar */}
        <div className={`absolute top-0 right-0 lg:right-[276px] h-full w-full sm:w-[440px] z-[45] bg-surface-elevated/95 backdrop-blur-2xl border-l border-glass-stroke shadow-2xl flex flex-col transition-transform duration-300 ease-in-out transform ${
          selectedProperty ? 'translate-x-0' : 'translate-x-full'
        }`}>
          {selectedProperty && selectedProperty._loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 relative">
              <button
                onClick={() => {
                  setSelectedProperty(null);
                  selectedMarkerIdRef.current = null;
                  highlightSelectedMarker(null);
                }}
                className="absolute top-4 right-4 bg-background/60 backdrop-blur-md hover:bg-white/10 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
              <span className="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
              <p className="text-sm text-on-surface-variant font-semibold">Scanning property...</p>
            </div>
          ) : selectedProperty ? (
            <>
              {/* Header Image & Close button — live satellite tile for this lat/lng */}
              <div className="h-36 relative bg-surface-container overflow-hidden">
                {(() => {
                  const satUrl = buildPropertySatelliteUrl(selectedProperty, googleMapsKey);
                  return satUrl ? (
                    <img
                      className="w-full h-full object-cover"
                      alt="Property satellite"
                      src={satUrl}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                      <span className="material-symbols-outlined text-4xl text-slate-600">satellite_alt</span>
                    </div>
                  );
                })()}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1C2433] via-transparent to-transparent"></div>
                <button 
                  onClick={() => {
                    setSelectedProperty(null);
                    selectedMarkerIdRef.current = null;
                    highlightSelectedMarker(null);
                  }}
                  className="absolute top-4 right-4 bg-background/60 backdrop-blur-md hover:bg-white/10 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
                <div className="absolute bottom-3 left-4 right-14">
                  <h3 className="font-headline-md text-base font-bold text-white leading-tight">
                    {displayValue(selectedProperty.address?.split?.(',')?.[0], 'Unknown address')}
                  </h3>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">
                    {displayValue(selectedProperty.address?.split?.(',')?.slice(1).join(','), '')}
                  </p>
                </div>
              </div>

              {/* Responsive Tabs navigation bar */}
              <div className="flex border-b border-glass-stroke text-[11px] font-semibold bg-white/5">
                {['Overview', 'Solar', 'Property', 'Contact'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3 text-center transition-all ${
                      activeTab === tab 
                        ? 'text-primary border-b-2 border-primary bg-primary/5 font-bold' 
                        : 'text-on-surface-variant hover:text-white'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Scrollable Tab Content wrapper */}
              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar text-xs space-y-5">
                
                {/* TAB 1: OVERVIEW */}
                {activeTab === 'Overview' && (
                  <div className="space-y-4">
                    {/* Quick Summary Card */}
                    <div className="glass-card p-4 rounded-xl border-l-4 border-l-primary space-y-3 bg-white/5">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-label-mono text-primary font-bold uppercase tracking-wider">Quick Summary</span>
                        <span className="text-yellow-500 font-semibold flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span
                              key={i}
                              className={`material-symbols-outlined text-xs ${i < starCountFromScore(selectedProperty.aiLeadScore?.overall || selectedProperty.solarScore) ? 'text-yellow-500' : 'text-white/15'}`}
                              style={i < starCountFromScore(selectedProperty.aiLeadScore?.overall || selectedProperty.solarScore) ? { fontVariationSettings: "'FILL' 1" } : undefined}
                            >
                              star
                            </span>
                          ))}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[9px] text-on-surface-variant uppercase font-label-mono">Solar Score</p>
                          <p className="text-sm font-bold text-white">{displayValue(selectedProperty.solarScore, '0')}/100</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-on-surface-variant uppercase font-label-mono">Estimated System</p>
                          <p className="text-sm font-bold text-white">{displayValue(selectedProperty.solar?.recommendedSize)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-on-surface-variant uppercase font-label-mono">Estimated Savings</p>
                          <p className="text-sm font-bold text-primary">{displayValue(selectedProperty.solar?.twentyFiveYearSavings)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-on-surface-variant uppercase font-label-mono">Property Value</p>
                          <p className="text-sm font-bold text-white">{displayValue(selectedProperty.propertyData?.propertyValue)}</p>
                        </div>
                      </div>
                    </div>

                    {/* AI Lead score breakdowns */}
                    <div className="glass-card p-4 rounded-xl space-y-3 bg-white/5">
                      <h4 className="font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-semibold">AI Lead Score Analysis</h4>
                      <div className="flex items-center gap-4">
                        <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
                          <svg className="w-full h-full -rotate-90">
                            <circle className="text-white/5" cx="28" cy="28" fill="transparent" r="24" stroke="currentColor" strokeWidth="3" />
                            <circle className="text-primary" cx="28" cy="28" fill="transparent" r="24" stroke="currentColor" strokeDasharray="150.8" strokeDashoffset={150.8 - ((selectedProperty.aiLeadScore?.overall || 0) / 100) * 150.8} strokeWidth="3" />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center font-bold text-white font-mono text-sm">
                            {displayValue(selectedProperty.aiLeadScore?.overall, '0')}
                          </div>
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-white font-bold">{displayValue(selectedProperty.aiLeadScore?.label, 'Score Pending')}</p>
                          <p className="text-[10px] text-on-surface-variant">{displayValue(selectedProperty.aiLeadScore?.summary, 'Lead score is calculated from live solar, property, and contact enrichment.')}</p>
                        </div>
                      </div>

                      <div className="space-y-2 border-t border-glass-stroke/50 pt-3 mt-2 text-[10px] leading-relaxed">
                        <div className="flex justify-between">
                          <span className="text-on-surface-variant">Solar Suitability</span>
                          <span className="text-white font-semibold">{displayValue(selectedProperty.aiLeadScore?.breakdown?.solarSuitability, '0')}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-on-surface-variant">Roof Size & Azimuth</span>
                          <span className="text-white font-semibold">{displayValue(selectedProperty.aiLeadScore?.breakdown?.roofSize, '0')}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-on-surface-variant">Sunlight Exposure</span>
                          <span className="text-white font-semibold">{displayValue(selectedProperty.aiLeadScore?.breakdown?.sunlightExposure, '0')}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-on-surface-variant">Property Value Weight</span>
                          <span className="text-white font-semibold">{displayValue(selectedProperty.aiLeadScore?.breakdown?.propertyValue, '0')}%</span>
                        </div>
                      </div>
                      {selectedProperty.enrichmentMeta?.dataSources && (
                        <p className="text-[9px] text-on-surface-variant/70 pt-1 border-t border-glass-stroke/30">
                          Sources: solar {selectedProperty.enrichmentMeta.dataSources.solar}
                          {' · '}property {selectedProperty.enrichmentMeta.dataSources.property}
                          {' · '}contact {selectedProperty.enrichmentMeta.dataSources.contact}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: SOLAR */}
                {activeTab === 'Solar' && (
                  <div className="space-y-3">
                    <div className="bg-white/5 glass-card rounded-xl p-4 space-y-1">
                      <h4 className="font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-semibold mb-2">Solar Potential Specs</h4>
                      <div className="divide-y divide-glass-stroke/50 text-[11px]">
                        <div className="flex justify-between py-2"><span className="text-on-surface-variant">Roof Outline</span><span className="text-white font-semibold">{displayValue(selectedProperty.solar?.roofOutline)}</span></div>
                        <div className="flex justify-between py-2"><span className="text-on-surface-variant">Total Roof Area</span><span className="text-white font-semibold">{displayValue(selectedProperty.solar?.totalRoofArea)}</span></div>
                        <div className="flex justify-between py-2"><span className="text-on-surface-variant">Usable Roof Area</span><span className="text-white font-semibold">{displayValue(selectedProperty.solar?.usableRoofArea)}</span></div>
                        <div className="flex justify-between py-2"><span className="text-on-surface-variant">Roof Orientation</span><span className="text-white font-semibold">{displayValue(selectedProperty.solar?.orientation)}</span></div>
                        <div className="flex justify-between py-2"><span className="text-on-surface-variant">Roof Pitch</span><span className="text-white font-semibold">{displayValue(selectedProperty.solar?.pitch)}</span></div>
                        <div className="flex justify-between py-2"><span className="text-on-surface-variant">Annual Sunlight</span><span className="text-white font-semibold">{displayValue(selectedProperty.solar?.annualSunlight)}</span></div>
                        <div className="flex justify-between py-2"><span className="text-on-surface-variant">Shading Analysis</span><span className="text-white font-semibold">{displayValue(selectedProperty.solar?.shading)}</span></div>
                        <div className="flex justify-between py-2"><span className="text-on-surface-variant">Estimated Panels</span><span className="text-white font-semibold">{displayValue(selectedProperty.solar?.estimatedPanels, '0')} Panels</span></div>
                        <div className="flex justify-between py-2"><span className="text-on-surface-variant">Annual Production</span><span className="text-white font-semibold">{displayValue(selectedProperty.solar?.annualProduction)}</span></div>
                        {selectedProperty.solar?.productionSource && (
                          <div className="flex justify-between py-2"><span className="text-on-surface-variant">Production Source</span><span className="text-primary font-semibold">{selectedProperty.solar.productionSource}</span></div>
                        )}
                        {selectedProperty.solar?.nrelSolradAnnual && selectedProperty.solar.nrelSolradAnnual !== 'N/A' && (
                          <div className="flex justify-between py-2"><span className="text-on-surface-variant">NREL Solar Radiation</span><span className="text-white font-semibold">{selectedProperty.solar.nrelSolradAnnual}</span></div>
                        )}
                        {selectedProperty.solar?.nrelCapacityFactor && selectedProperty.solar.nrelCapacityFactor !== 'N/A' && (
                          <div className="flex justify-between py-2"><span className="text-on-surface-variant">NREL Capacity Factor</span><span className="text-white font-semibold">{selectedProperty.solar.nrelCapacityFactor}</span></div>
                        )}
                        {selectedProperty.solar?.electricityRate && (
                          <div className="flex justify-between py-2"><span className="text-on-surface-variant">Local Electricity Rate</span><span className="text-white font-semibold">{selectedProperty.solar.electricityRate}{selectedProperty.solar.utilityName ? ` · ${selectedProperty.solar.utilityName}` : ''}</span></div>
                        )}
                        <div className="flex justify-between py-2">
                          <span className="text-on-surface-variant">Existing Panels</span>
                          <span className={`font-semibold ${
                            selectedProperty.solar?.existingSolar?.includes('No') ? 'text-green-400' : 
                            selectedProperty.solar?.existingSolar?.includes('Likely') ? 'text-red-400' : 'text-yellow-400'
                          }`}>{displayValue(selectedProperty.solar?.existingSolar)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Enriched Satellite Data */}
                    {selectedProperty.solar?.imageryDate && selectedProperty.solar.imageryDate !== 'Not Available' && (
                      <div className="bg-white/5 glass-card rounded-xl p-4 space-y-1">
                        <h4 className="font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-semibold mb-2">Satellite Intelligence</h4>
                        <div className="divide-y divide-glass-stroke/50 text-[11px]">
                          <div className="flex justify-between py-2"><span className="text-on-surface-variant">Imagery Date</span><span className="text-white font-semibold">{displayValue(selectedProperty.solar?.imageryDate)}</span></div>
                          <div className="flex justify-between py-2"><span className="text-on-surface-variant">Imagery Quality</span>
                            <span className={`font-semibold ${selectedProperty.solar?.imageryQuality === 'HIGH' ? 'text-green-400' : 'text-yellow-400'}`}>{displayValue(selectedProperty.solar?.imageryQuality)}</span>
                          </div>
                          <div className="flex justify-between py-2"><span className="text-on-surface-variant">Building Footprint</span><span className="text-white font-semibold">{displayValue(selectedProperty.solar?.buildingFootprint)}</span></div>
                          <div className="flex justify-between py-2"><span className="text-on-surface-variant">Panel Wattage</span><span className="text-white font-semibold">{displayValue(selectedProperty.solar?.panelWattage)}</span></div>
                          <div className="flex justify-between py-2"><span className="text-on-surface-variant">Carbon Offset</span><span className="text-primary font-semibold">{displayValue(selectedProperty.solar?.carbonOffset)}</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: PROPERTY */}
                {activeTab === 'Property' && (
                  <div className="space-y-3 bg-white/5 glass-card rounded-xl p-4">
                    <h4 className="font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-semibold mb-2">
                      {selectedProperty.enrichmentMeta?.usedMockPropertyFallback ? 'Offline Dev Record' : 'Property Records'}
                    </h4>
                    <div className="divide-y divide-glass-stroke/50 text-[11px]">
                      <div className="flex justify-between py-2"><span className="text-on-surface-variant">Owner Name</span><span className="text-white font-semibold">{displayValue(selectedProperty.propertyData?.ownerName)}</span></div>
                      <div className="flex justify-between py-2"><span className="text-on-surface-variant">Owner Occupied</span><span className="text-white font-semibold">{displayValue(selectedProperty.propertyData?.ownerOccupied)}</span></div>
                      <div className="flex justify-between py-2"><span className="text-on-surface-variant">Property Type</span><span className="text-white font-semibold">{displayValue(selectedProperty.propertyType)}</span></div>
                      <div className="flex justify-between py-2"><span className="text-on-surface-variant">Year Built</span><span className="text-white font-semibold">{displayValue(selectedProperty.yearBuilt)}</span></div>
                      <div className="flex justify-between py-2"><span className="text-on-surface-variant">Property Value</span><span className="text-white font-semibold">{displayValue(selectedProperty.propertyData?.propertyValue)}</span></div>
                      <div className="flex justify-between py-2"><span className="text-on-surface-variant">Tax Assessed Value</span><span className="text-white font-semibold">{displayValue(selectedProperty.propertyData?.taxAssessedValue)}</span></div>
                      <div className="flex justify-between py-2"><span className="text-on-surface-variant">Parcel Number</span><span className="text-white font-semibold font-mono text-[10px]">{displayValue(selectedProperty.propertyData?.parcelNumber)}</span></div>
                      <div className="flex justify-between py-2"><span className="text-on-surface-variant">Last Sale Date</span><span className="text-white font-semibold">{displayValue(selectedProperty.propertyData?.lastSaleDate)}</span></div>
                      <div className="flex justify-between py-2"><span className="text-on-surface-variant">Last Sale Price</span><span className="text-white font-semibold">{displayValue(selectedProperty.propertyData?.lastSalePrice)}</span></div>
                      <div className="flex justify-between py-2"><span className="text-on-surface-variant">Living Area</span><span className="text-white font-semibold">{displayValue(selectedProperty.livingArea)}</span></div>
                      <div className="flex justify-between py-2"><span className="text-on-surface-variant">Lot Size</span><span className="text-white font-semibold">{displayValue(selectedProperty.lotSize)}</span></div>
                      <div className="flex justify-between py-2"><span className="text-on-surface-variant">Stories</span><span className="text-white font-semibold">{displayValue(selectedProperty.stories)}</span></div>
                    </div>
                  </div>
                )}

                {/* TAB 4: CONTACT */}
                {activeTab === 'Contact' && (() => {
                  const badge = contactBadge(selectedProperty.enrichmentMeta, selectedProperty.contact);
                  const toneClass = badge.tone === 'green'
                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                    : badge.tone === 'yellow'
                      ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                      : 'bg-slate-500/10 text-slate-400 border-slate-500/20';
                  const sourceTitle = selectedProperty.enrichmentMeta?.contactSource
                    || selectedProperty.enrichmentMeta?.dataSources?.contact
                    || 'Contact';
                  return (
                  <div className="space-y-4">
                    <div className="bg-white/5 glass-card rounded-xl p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-semibold">
                          {String(sourceTitle).toUpperCase()} CONTACTS
                        </h4>
                        <span className={`${toneClass} border text-[9px] font-bold px-2 py-0.5 rounded font-label-mono`}>{badge.label}</span>
                      </div>
                      <div className="divide-y divide-glass-stroke/50 text-[11px]">
                        <div className="flex justify-between py-2"><span className="text-on-surface-variant">Primary Owner</span><span className="text-white font-semibold">{displayValue(selectedProperty.propertyData?.ownerName)}</span></div>
                        <div className="flex justify-between py-2"><span className="text-on-surface-variant">Verified Phone</span><span className="text-white font-semibold">{displayValue(selectedProperty.contact?.phone)}</span></div>
                        <div className="flex justify-between py-2"><span className="text-on-surface-variant">Verified Email</span><span className="text-white font-semibold truncate max-w-[200px]">{displayValue(selectedProperty.contact?.email)}</span></div>
                        <div className="flex justify-between py-2"><span className="text-on-surface-variant">LinkedIn Bio</span><span className="text-primary hover:underline font-semibold font-mono text-[10px] truncate max-w-[180px]">{displayValue(selectedProperty.contact?.linkedIn)}</span></div>
                        <div className="flex justify-between py-2"><span className="text-on-surface-variant">Confidence Score</span><span className="text-white font-semibold">{displayValue(selectedProperty.contact?.confidenceScore)}</span></div>
                        {selectedProperty.contact?.emailStatus && selectedProperty.contact.emailStatus !== 'Not Available' && (
                          <div className="flex justify-between py-2"><span className="text-on-surface-variant">Email Status</span><span className="text-white font-semibold">{selectedProperty.contact.emailStatus}</span></div>
                        )}
                        {selectedProperty.contact?.phoneType && selectedProperty.contact.phoneType !== 'Not Available' && (
                          <div className="flex justify-between py-2"><span className="text-on-surface-variant">Phone Type</span><span className="text-white font-semibold">{selectedProperty.contact.phoneType}</span></div>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })()}
              </div>

              {/* Sticky bottom Action Pane */}
              <div className="p-4 border-t border-glass-stroke bg-surface-elevated flex flex-col gap-2">
                <button 
                  onClick={handleGenerateLead}
                  disabled={generatedLeadStatus !== 'idle' || (!unlimitedCredits && leadCredits <= 0)}
                  className={`w-full font-button font-bold text-xs py-2.5 rounded-lg text-center active:scale-98 transition-all flex items-center justify-center gap-2 ${
                    generatedLeadStatus === 'generated' 
                      ? 'bg-green-500 text-white' 
                      : generatedLeadStatus === 'generating' 
                        ? 'bg-primary/50 text-white cursor-not-allowed' 
                        : 'bg-primary text-on-primary hover:brightness-110 shadow-lg shadow-primary/20'
                  }`}
                >
                  {generatedLeadStatus === 'generating' ? (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                      Locking in Lead data...
                    </>
                  ) : generatedLeadStatus === 'generated' ? (
                    <>
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Lead Saved to Pipeline!
                    </>
                  ) : (
                    'Generate Lead'
                  )}
                </button>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <button className="border border-glass-stroke hover:bg-white/5 py-2 rounded-lg text-center text-white font-semibold transition-colors">
                    Save Property
                  </button>
                  <button className="border border-glass-stroke hover:bg-white/5 py-2 rounded-lg text-center text-white font-semibold transition-colors">
                    Download Report
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Bottom telemetry status strip */}
        <MapStatusBar
          feedLive={mapsLoaded && !!googleMapsKey && !mapError}
          zoom={mapZoom}
          lat={mapCenter.lat}
          lng={mapCenter.lng}
          className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-[35] px-2 max-w-[calc(100%-8rem)] ${
            selectedProperty ? 'lg:mr-[220px]' : 'lg:mr-[130px]'
          }`}
        />

        {/* Ask Hera FAB — clear Sidebar + property drawer */}
        <AskHeraFab
          className={`absolute bottom-14 z-[36] transition-all ${
            selectedProperty
              ? 'right-4 sm:right-6 lg:right-[732px]'
              : 'right-4 sm:right-6 lg:right-[292px]'
          }`}
        />

      </div>

      {/* DEPLOY SCAN BOT MODAL */}
      {showScanModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-[440px] bg-deep border border-white/5 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[#e1e2ea] text-xs">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-white/5 flex justify-between items-start">
              <div className="flex gap-3">
                <span className="material-symbols-outlined text-primary text-2xl mt-0.5">radar</span>
                <div className="text-left">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">DEPLOY SCAN BOT</h3>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[300px] truncate">{scanAddress || 'Resolving address...'}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowScanModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors"
              >
                <span className="material-symbols-outlined text-sm leading-none block">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 text-left flex-grow overflow-y-auto">
              {/* Area Row */}
              <div className="flex items-center justify-between p-3.5 bg-white/5 border border-white/5 rounded-lg text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-primary">location_on</span>
                  <span className="font-semibold text-[11px]">Area</span>
                </div>
                <span className="font-mono text-white text-[11px]">~{((scanRadius * 2) / 1000).toFixed(1)}km × {((scanRadius * 2) / 1000).toFixed(1)}km</span>
              </div>

              {/* Leads Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>LEADS TO CAPTURE</span>
                  <span className="text-primary font-mono text-[11px] font-bold">{leadsToCapture} leads</span>
                </div>
                <input 
                  type="range"
                  min="1"
                  max="100"
                  value={leadsToCapture}
                  onChange={(e) => setLeadsToCapture(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary outline-none"
                />
                <p className="text-[10px] text-primary font-medium mt-1.5 leading-normal">
                  Free trial — up to 10 leads. Add a payment method to scan more.
                </p>
              </div>

              {/* Package Selection Cards */}
              <div className="space-y-2.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PACKAGE</p>
                
                {/* Card 1: Data Only */}
                <div 
                  onClick={() => setScanPackage('data')}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    scanPackage === 'data' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-white/5 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px]">📋</span>
                      <span className="text-white font-bold text-xs">Data Only</span>
                    </div>
                    <span className="text-primary font-bold text-xs">$0.50<span className="text-[9px] text-slate-400 font-normal">/lead</span></span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 pl-6">Owner name, phone, email. No AI calls.</p>
                </div>

                {/* Card 2: AI Call + Data */}
                <div 
                  onClick={() => setScanPackage('ai')}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    scanPackage === 'ai' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-white/5 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[14px] text-slate-300">phone</span>
                      <span className="text-white font-bold text-xs">AI Call + Data</span>
                    </div>
                    <span className="text-primary font-bold text-xs">$1.20<span className="text-[9px] text-slate-400 font-normal">/lead</span></span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 pl-6">Aria dials qualified leads. TCPA-safe hours.</p>
                </div>
              </div>

              {/* Cost cap panel */}
              <div className="p-4 bg-white/5 border border-white/5 rounded-xl flex justify-between items-center">
                <span className="text-white font-semibold">Total cost cap</span>
                <span className="text-2xl font-black text-primary font-mono">${(leadsToCapture * (scanPackage === 'data' ? 0.5 : 1.2)).toFixed(2)}</span>
              </div>

              <p className="text-[10px] text-slate-500 leading-normal">
                You're charged per lead saved. Contact-complete leads are preferred; property-only leads may fill remaining quota.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/5 bg-[#0A0D16] flex gap-3">
              <button 
                onClick={() => setShowScanModal(false)}
                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 font-bold py-3 rounded-lg text-xs transition-colors"
              >
                CANCEL
              </button>
              <button 
                onClick={handleExecuteScan}
                className="flex-1 bg-primary text-white font-bold py-3 px-6 rounded-lg text-xs hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-primary/20"
              >
                <span className="material-symbols-outlined text-sm leading-none">play_arrow</span>
                START SCAN – ${(leadsToCapture * (scanPackage === 'data' ? 0.5 : 1.2)).toFixed(2)}
              </button>
            </div>

          </div>
        </div>
      )}
      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        credits={leadCredits}
        message={upgradeMessage}
      />
    </AppLayout>
  );
}
