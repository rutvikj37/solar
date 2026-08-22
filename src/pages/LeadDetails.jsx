import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import CrmPushPanel from '../components/CrmPushPanel';
import SolarProposalModal from '../components/SolarProposalModal';
import { API_BASE } from '../config.js';
import { apiService } from '../services/api.js';
import { formatLeadGeneratedAt } from '../lib/formatDate.js';
import { buildLeadMarkerIcon } from '../lib/mapMarkers.js';
import { resolveGoogleMapsApiKey } from '../lib/mapsKey.js';
import FullPageLoader from '../components/FullPageLoader.jsx';
import { fetchEmailIntegration } from '../lib/emailIntegrations.js';
import { fetchMe, isAdminRole, peekAuthSessionCache, getToken } from '../lib/auth.js';

const API = API_BASE;
const STATUS_OPTIONS = ['new', 'contacted', 'appointment', 'proposal', 'won', 'lost', 'qualified', 'in_progress'];
const GMAPS_SCRIPT_ID = 'google-maps-script';

function money(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return 'Not Available';
  return `$${v.toLocaleString('en-US')}`;
}

function displayVal(v, fallback = '—') {
  if (v === null || v === undefined || v === '') return fallback;
  const s = String(v).trim();
  if (!s || s === 'N/A' || s === 'Not Available' || s === 'undefined') return fallback;
  return s;
}

function loadGoogleMapsScript(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve();
      return;
    }
    let script = document.getElementById(GMAPS_SCRIPT_ID);
    if (!script) {
      script = document.createElement('script');
      script.id = GMAPS_SCRIPT_ID;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly&loading=async`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    const onLoad = () => resolve();
    const onError = () => reject(new Error('Google Maps failed to load'));
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    if (window.google?.maps) resolve();
  });
}

function SpecRow({ label, value }) {
  const shown = displayVal(value, null);
  if (!shown) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-white/5 last:border-0">
      <span className="text-on-surface-variant shrink-0">{label}</span>
      <span className="text-white font-semibold text-right break-words max-w-[60%]">{shown}</span>
    </div>
  );
}

export default function LeadDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [crmStatus, setCrmStatus] = useState('idle');
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareError, setShareError] = useState('');
  const shareMenuRef = useRef(null);
  const [lead, setLead] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [apptAt, setApptAt] = useState('');
  const [busy, setBusy] = useState('');
  const [googleMapsKey, setGoogleMapsKey] = useState('');
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [dripEnrollments, setDripEnrollments] = useState([]);
  const [emailIntegration, setEmailIntegration] = useState(null);
  const [emailMsg, setEmailMsg] = useState('');
  const [mapEl, setMapEl] = useState(null);
  const [isAdmin, setIsAdmin] = useState(() => isAdminRole(peekAuthSessionCache(getToken())?.role));
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  // Callback ref so map mounts only after the container exists in the DOM
  const mapContainerRef = useCallback((node) => {
    setMapEl(node);
  }, []);

  const token = () => localStorage.getItem('solar_token');

  const load = async () => {
    const t = token();
    if (!t) {
      navigate('/login');
      return;
    }
    try {
      const key = await resolveGoogleMapsApiKey();
      if (key && !key.toLowerCase().includes('your_')) {
        setGoogleMapsKey(key);
        try {
          await loadGoogleMapsScript(key);
          setMapsLoaded(true);
        } catch (err) {
          console.error(err);
          setMapError('Google Maps failed to load');
        }
      } else {
        setMapError('Google Maps API key is not configured');
      }

      const response = await fetch(`${API}/api/leads/${id}`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLead(data);
        setNote(data.notes || '');
        setEmailBody(
          `Hi ${data.owner_name || 'there'},\n\nWe analyzed the solar potential at ${data.address} and estimate ~$${Number(data.estimated_savings || 0).toLocaleString('en-US')} in 25-year savings.\n\nWould you like to book a free site survey?\n`
        );
      }

      const actRes = await fetch(`${API}/api/leads/${id}/activities`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      if (actRes.ok) setActivities(await actRes.json());

      try {
        const dripData = await apiService.getLeadDripEnrollments(id);
        setDripEnrollments(dripData || []);
      } catch {
        setDripEnrollments([]);
      }

      try {
        setEmailIntegration(await fetchEmailIntegration());
      } catch {
        setEmailIntegration(null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setMapReady(false);
    setMapError('');
    mapInstanceRef.current = null;
    markerRef.current = null;
    load();
  }, [id, navigate]);

  useEffect(() => {
    const cached = peekAuthSessionCache(getToken());
    if (cached) {
      setIsAdmin(isAdminRole(cached.role));
      return;
    }
    let cancelled = false;
    fetchMe().then((data) => {
      if (!cancelled) setIsAdmin(isAdminRole(data?.user?.role));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!showShareMenu) return undefined;
    const onPointerDown = (e) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target)) {
        setShowShareMenu(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [showShareMenu]);

  const handleDownloadSharePdf = async () => {
    if (!lead?.id) return;
    setShareError('');
    setBusy('share-pdf');
    try {
      await downloadLeadSharePdf(lead);
      setShowShareMenu(false);
    } catch (err) {
      setShareError(err.message || 'Could not download PDF');
    } finally {
      setBusy('');
    }
  };

  const handleShareWhatsApp = async () => {
    if (!lead?.id) return;
    setShareError('');
    setBusy('share-wa');
    try {
      const result = await shareLeadToWhatsApp(lead);
      if (result?.method !== 'cancelled') setShowShareMenu(false);
    } catch (err) {
      setShareError(err.message || 'Could not share to WhatsApp');
    } finally {
      setBusy('');
    }
  };

  // Mount Google satellite map once script + lead + DOM container are ready
  useEffect(() => {
    if (!lead || !mapsLoaded || !googleMapsKey || !mapEl || !window.google?.maps) return;

    const lat = parseFloat(lead.latitude);
    const lng = parseFloat(lead.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setMapError('Missing coordinates for this lead');
      return;
    }

    try {
      const center = { lat, lng };
      if (!mapInstanceRef.current) {
        const map = new window.google.maps.Map(mapEl, {
          center,
          zoom: 19,
          mapTypeId: 'satellite',
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_BOTTOM },
          gestureHandling: 'greedy',
          tilt: 0,
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false
        });
        mapInstanceRef.current = map;
        markerRef.current = new window.google.maps.Marker({
          position: center,
          map,
          title: lead.address,
          icon: buildLeadMarkerIcon(window.google, { fillColor: '#FF3B30', scale: 1.8 })
        });
      } else {
        mapInstanceRef.current.setCenter(center);
        mapInstanceRef.current.setZoom(19);
        mapInstanceRef.current.setMapTypeId('satellite');
        if (markerRef.current) {
          markerRef.current.setPosition(center);
        } else {
          markerRef.current = new window.google.maps.Marker({
            position: center,
            map: mapInstanceRef.current,
            title: lead.address,
            icon: buildLeadMarkerIcon(window.google, { fillColor: '#FF3B30', scale: 1.8 })
          });
        }
      }

      setMapReady(true);
      setMapError('');
      // Nudge tiles after layout
      setTimeout(() => {
        if (window.google?.maps?.event && mapInstanceRef.current) {
          window.google.maps.event.trigger(mapInstanceRef.current, 'resize');
          mapInstanceRef.current.setCenter(center);
        }
      }, 150);
    } catch (err) {
      console.error(err);
      setMapError('Could not load Google satellite map');
    }
  }, [lead, mapsLoaded, googleMapsKey, mapEl]);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token()}`
  });

  const handleStatus = async (status) => {
    setBusy('status');
    const res = await fetch(`${API}/api/leads/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      setLead(await res.json());
      await load();
    }
    setBusy('');
  };

  const handleSaveNote = async () => {
    setBusy('note');
    await fetch(`${API}/api/leads/${id}/activities`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ type: 'note', content: note })
    });
    await load();
    setBusy('');
  };

  const handleExport = async () => {
    setCrmStatus('exporting');
    const res = await fetch(`${API}/api/crm/${id}/export-crm`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ target: 'generic' })
    });
    setCrmStatus(res.ok ? 'exported' : 'idle');
    if (res.ok) await load();
  };

  const handleEmail = async () => {
    if (!emailIntegration?.connected) {
      setEmailMsg('Connect your email in Integrations first.');
      return;
    }
    setBusy('email');
    setEmailMsg('');
    try {
      const res = await fetch(`${API}/api/outreach/email`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ leadId: Number(id), message: emailBody }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Email failed');
      setEmailMsg(data.simulated ? 'Email simulated (check server config)' : 'Email sent from your connected address.');
      await load();
    } catch (err) {
      setEmailMsg(err.message || 'Email failed');
    } finally {
      setBusy('');
    }
  };

  const handleBookAppt = async () => {
    if (!apptAt) return alert('Pick a date/time');
    setBusy('appt');
    const res = await fetch(`${API}/api/appointments`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        leadId: Number(id),
        title: `Site Survey — ${lead.owner_name || 'Lead'}`,
        scheduledAt: apptAt,
        location: lead.address
      })
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Failed');
    } else {
      await load();
      alert('Appointment booked');
    }
    setBusy('');
  };

  if (loading) {
    return <FullPageLoader />;
  }

  if (!lead) {
    return (
      <>
        <div className="glass-card rounded-xl p-8 text-center">
          <h3 className="text-white font-bold mb-2">Lead Record Not Found</h3>
          <Link to="/my-leads" className="text-primary text-xs">
            Back to My Leads
          </Link>
        </div>
      </>
    );
  }

  const displayName = lead.owner_name || 'Not Available';
  const displayScore = lead.lead_score || lead.propertyExtra?.aiLeadScore?.overall || 0;
  const solar = lead.solar || {};
  const propExtra = lead.propertyExtra || {};
  const lat = parseFloat(lead.latitude);
  const lng = parseFloat(lead.longitude);

  const solarSpecs = [
    ['Roof Outline', solar.roofOutline],
    ['Total Roof Area', solar.totalRoofArea || (lead.roof_size ? `${Number(lead.roof_size).toLocaleString('en-US')} sq ft` : null)],
    ['Usable Roof Area', solar.usableRoofArea],
    ['Orientation', solar.orientation],
    ['Roof Pitch', solar.pitch],
    ['Annual Sunlight', solar.annualSunlight],
    ['Shading', solar.shading],
    ['Existing Panels', solar.existingSolar],
    ['Imagery Date', solar.imageryDate],
    ['Imagery Quality', solar.imageryQuality],
    ['Building Footprint', solar.buildingFootprint],
    ['Panel Wattage', solar.panelWattage],
    ['Carbon Offset', solar.carbonOffset],
    ['NREL Radiation', solar.nrelSolradAnnual],
    ['Capacity Factor', solar.nrelCapacityFactor],
    ['Electricity Rate', solar.electricityRate ? `${solar.electricityRate}${solar.utilityName ? ` · ${solar.utilityName}` : ''}` : null],
    ['Production Source', solar.productionSource]
  ];

  const registryRows = [
    ['Parcel', lead.parcel_id || propExtra.parcelNumber],
    ['Mailing Address', lead.mailing_address || propExtra.mailingAddress],
    ['Owner Occupied', lead.owner_occupied === 1 ? 'Yes' : lead.owner_occupied === 0 ? 'No' : propExtra.ownerOccupied],
    ['Property Type', propExtra.propertyType],
    ['Year Built', propExtra.yearBuilt],
    ['Living Area', propExtra.livingArea],
    ['Lot Size', propExtra.lotSize],
    ['Stories', propExtra.stories],
    ['Property Value', money(lead.property_value)],
    ['Tax Assessed', propExtra.taxAssessedValue],
    ['Last Sale', propExtra.lastSaleDate],
    ['Last Sale Price', propExtra.lastSalePrice]
  ];

  return (
    <>
      <div className="w-full max-w-6xl mx-auto space-y-5 pb-8 text-xs">
        <div className="pt-2">
          <Link
            to="/my-leads"
            className="text-primary hover:text-white transition-colors inline-flex items-center gap-2 text-xs font-semibold font-label-mono uppercase tracking-wider"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back to My Leads
          </Link>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-headline-lg text-2xl font-bold text-white truncate">{displayName}</h2>
            <p className="text-on-surface-variant mt-1 break-words">{lead.address}</p>
            {formatLeadGeneratedAt(lead.created_at) && (
              <p className="text-[11px] text-primary/90 mt-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">schedule</span>
                Generated {formatLeadGeneratedAt(lead.created_at)}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 items-center shrink-0">
            <div className="relative" ref={shareMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setShareError('');
                  setShowShareMenu((v) => !v);
                }}
                disabled={busy === 'share-pdf' || busy === 'share-wa'}
                className="bg-white/10 hover:bg-white/15 text-white font-bold py-2 px-3 rounded-lg text-xs flex items-center gap-1.5"
                title="Share lead details"
                aria-expanded={showShareMenu}
                aria-haspopup="menu"
              >
                <span className={`material-symbols-outlined text-base${busy === 'share-pdf' || busy === 'share-wa' ? ' animate-spin' : ''}`}>
                  {busy === 'share-pdf' || busy === 'share-wa' ? 'progress_activity' : 'share'}
                </span>
                Share
              </button>
              {showShareMenu && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 z-30 min-w-[220px] rounded-xl border border-glass-stroke bg-[#0F172A] shadow-xl overflow-hidden"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleDownloadSharePdf}
                    disabled={!!busy}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs text-white hover:bg-white/10 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-base text-primary">picture_as_pdf</span>
                    <span>
                      <span className="font-bold block">Download PDF</span>
                      <span className="text-[10px] text-on-surface-variant">SolarX.live branded sheet</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleShareWhatsApp}
                    disabled={!!busy}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs text-white hover:bg-white/10 border-t border-glass-stroke disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-base text-secondary">chat</span>
                    <span>
                      <span className="font-bold block">Share to WhatsApp</span>
                      <span className="text-[10px] text-on-surface-variant">PDF + lead summary</span>
                    </span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowProposalModal(true)}
              className="bg-primary text-on-primary font-bold py-2 px-3.5 rounded-lg text-xs flex items-center gap-1.5 shadow-md hover:brightness-110"
            >
              <span className="material-symbols-outlined text-base">picture_as_pdf</span>
              Download Solar Proposal
            </button>

            <CrmPushPanel leadId={id} leadName={displayName} onPushed={() => load()} />

            <select
              value={lead.status || 'new'}
              onChange={(e) => handleStatus(e.target.value)}
              disabled={busy === 'status'}
              className="bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white text-xs"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {shareError && (
          <p className="text-[11px] text-red-400 -mt-2">{shareError}</p>
        )}

        {dripEnrollments.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center p-3 rounded-xl bg-primary/10 border border-primary/25">
            <span className="material-symbols-outlined text-primary text-base">reorder</span>
            <span className="text-xs font-bold text-white">Active Drip:</span>
            {dripEnrollments.map((e) => (
              <Link
                key={e.id}
                to="/drip-campaigns"
                className="px-2 py-1 rounded-lg bg-white/10 text-primary text-[10px] font-bold hover:bg-white/15"
              >
                {e.campaignName} · Step {e.currentStep}
              </Link>
            ))}
          </div>
        )}

        {/* Google Maps satellite hero */}
        <div className="glass-card rounded-2xl overflow-hidden border border-glass-stroke">
          <div className="relative w-full h-[280px] sm:h-[340px] bg-[#0B1220]">
            <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
            {!mapReady && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#0B1220]/90 pointer-events-none">
                {mapError ? (
                  <>
                    <span className="material-symbols-outlined text-3xl text-on-surface-variant">satellite_alt</span>
                    <p className="text-[11px] text-on-surface-variant px-4 text-center">{mapError}</p>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-3xl text-primary animate-spin">progress_activity</span>
                    <p className="text-[11px] text-on-surface-variant">Loading Google satellite…</p>
                  </>
                )}
              </div>
            )}
            <div className="absolute bottom-3 left-3 z-20 px-2.5 py-1 rounded-lg bg-black/65 text-[10px] text-white font-semibold backdrop-blur-sm">
              Google Satellite · {Number.isNaN(lat) ? '—' : lat.toFixed(5)}, {Number.isNaN(lng) ? '—' : lng.toFixed(5)}
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Lead Score', value: `${displayScore}/100`, accent: false },
            { label: '25-yr Savings', value: displayVal(solar.twentyFiveYearSavings, money(lead.estimated_savings)), accent: true },
            { label: 'System Size', value: displayVal(solar.recommendedSize) },
            { label: 'Annual Production', value: displayVal(solar.annualProduction) }
          ].map((k) => (
            <div key={k.label} className="glass-card rounded-xl p-4 border border-glass-stroke">
              <p className="text-[9px] text-on-surface-variant uppercase font-label-mono tracking-wider">{k.label}</p>
              <p className={`text-base font-bold mt-1.5 truncate font-mono tabular-nums ${k.accent ? 'text-primary' : 'text-white'}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* Left: contact + notes + activity */}
          <div className="xl:col-span-4 space-y-5">
            <div className="glass-card rounded-xl p-5 border border-glass-stroke space-y-3">
              <h3 className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-widest">Contact</h3>
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-white/5">
                  <p className="text-[9px] text-on-surface-variant uppercase mb-1">Phone</p>
                  <p className="text-white font-mono font-semibold break-all">
                    {lead.phone && lead.phone !== 'Not Available' ? lead.phone : '—'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <p className="text-[9px] text-on-surface-variant uppercase mb-1">Email</p>
                  <p className="text-white font-semibold break-all">
                    {lead.email && lead.email !== 'Not Available' ? lead.email : '—'}
                  </p>
                </div>
                {lead.notes ? (
                  <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <p className="text-[9px] text-amber-400/80 uppercase mb-1">Enrichment note</p>
                    <p className="text-on-surface-variant text-[11px] leading-relaxed">{lead.notes}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="glass-card rounded-xl p-5 border border-glass-stroke space-y-3">
              <h3 className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-widest">Notes</h3>
              <textarea
                className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white min-h-[88px]"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                onClick={handleSaveNote}
                disabled={busy === 'note'}
                className="bg-white/10 hover:bg-white/15 text-white px-4 py-2 rounded-lg font-bold"
              >
                Save Note
              </button>
            </div>

            <div className="glass-card rounded-xl p-5 border border-glass-stroke">
              <h3 className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-widest mb-3">Activity</h3>
              <div className="space-y-3 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                {activities.length === 0 && <p className="text-on-surface-variant">No activity yet.</p>}
                {activities.map((a) => (
                  <div key={a.id} className="flex gap-3">
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-primary shrink-0" />
                    <div className="min-w-0">
                      <div className="font-label-mono text-[9px] text-primary uppercase">
                        {a.type} · {new Date(a.created_at).toLocaleString()}
                      </div>
                      <div className="text-on-surface mt-0.5 whitespace-pre-wrap break-words">{a.content}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: solar + registry + outreach */}
          <div className="xl:col-span-8 space-y-5">
            <div className="glass-card rounded-xl p-5 border border-glass-stroke">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-widest">
                  Solar Intelligence
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                  {displayVal(solar.potential || lead.solar_potential, 'Rated')} · {displayVal(solar.estimatedPanels, '0')} panels
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                {solarSpecs.map(([label, value]) => (
                  <SpecRow key={label} label={label} value={value} />
                ))}
                {solarSpecs.every(([, v]) => !displayVal(v, null)) && (
                  <p className="text-on-surface-variant py-2 md:col-span-2">
                    Solar specs are still enriching. Refresh in a moment.
                  </p>
                )}
              </div>
            </div>

            <div className="glass-card rounded-xl p-5 border border-glass-stroke">
              <h3 className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-widest mb-3">
                Property Registry
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                {registryRows.map(([label, value]) => (
                  <SpecRow key={label} label={label} value={value} />
                ))}
              </div>
            </div>

            <div className="glass-card rounded-xl p-5 border border-glass-stroke space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-bold text-white">Send Email</h4>
                {emailIntegration?.connected ? (
                  <span className="text-[10px] text-green-400 font-semibold">
                    From: {emailIntegration.fromEmail}
                  </span>
                ) : (
                  <Link to="/integrations" className="text-[10px] text-primary font-bold hover:underline">
                    Connect email →
                  </Link>
                )}
              </div>
              <textarea
                className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white min-h-[100px]"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                disabled={!emailIntegration?.connected}
              />
              {emailMsg && (
                <p className={`text-[11px] ${emailMsg.includes('sent') || emailMsg.includes('Sent') ? 'text-green-400' : 'text-red-400'}`}>
                  {emailMsg}
                </p>
              )}
              <button
                onClick={handleEmail}
                disabled={busy === 'email' || !emailIntegration?.connected}
                className="w-full bg-white/10 text-white py-2 rounded-lg font-bold disabled:opacity-50"
              >
                {busy === 'email' ? 'Sending...' : 'Send Email'}
              </button>
            </div>

            <div className="glass-card rounded-xl p-5 border border-glass-stroke flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1 w-full">
                <label className="font-label-mono text-[9px] text-on-surface-variant uppercase">Book Site Survey</label>
                <input
                  type="datetime-local"
                  className="w-full mt-1 bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white"
                  value={apptAt}
                  onChange={(e) => setApptAt(e.target.value)}
                />
              </div>
              <button
                onClick={handleBookAppt}
                disabled={busy === 'appt'}
                className="bg-secondary/20 text-secondary border border-secondary/30 px-4 py-2 rounded-lg font-bold shrink-0"
              >
                Book Appointment
              </button>
              {isAdmin && (
                <Link to="/ai-calling" className="text-primary font-bold hover:underline py-2 shrink-0">
                  AI Voice Calling →
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <SolarProposalModal
        show={showProposalModal}
        onClose={() => setShowProposalModal(false)}
        lead={lead}
      />
    </>
  );
}
