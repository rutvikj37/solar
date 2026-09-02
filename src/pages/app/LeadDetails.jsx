import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import CrmPushPanel from '../../components/CrmPushPanel';
import SolarProposalModal from '../../components/SolarProposalModal';
import LeadStatusBadge from '../../components/leads/LeadStatusBadge';
import { API_BASE } from '../../config.js';
import { apiService } from '../../services/api.js';
import { formatLeadGeneratedAt } from '../../lib/formatDate.js';
import { buildLeadMarkerIcon } from '../../lib/mapMarkers.js';
import { resolveGoogleMapsApiKey } from '../../lib/mapsKey.js';
import FullPageLoader from '../../components/layout/FullPageLoader.jsx';
import {
  emailToastFromSearchParams,
  fetchEmailIntegration,
} from '../../lib/emailIntegrations.js';
import { fetchMe, isAdminRole, peekAuthSessionCache, getToken } from '../../lib/auth.js';
import { downloadLeadSharePdf, shareLeadToWhatsApp } from '../../utils/leadSharePdf.js';
import {
  STATUS_OPTIONS,
  LOST_REASONS,
  getStatusLabel,
  getLeadScore,
  getSolarScore,
  getNextBestAction,
} from '../../lib/leads.js';
import {
  fetchPipelineStages,
  stagesToStatusOptions,
  stagesToStatusConfig,
  DEFAULT_PIPELINE_STAGE_LIST,
} from '../../lib/pipelineApi.js';

const API = API_BASE;
const GMAPS_SCRIPT_ID = 'google-maps-script';

const LEAD_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'details', label: 'Lead Details' },
  { id: 'property', label: 'Property' },
  { id: 'outreach', label: 'Outreach' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'activity', label: 'Activity' },
  { id: 'notes', label: 'Notes' },
  { id: 'files', label: 'Files' },
];

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

function Card({ title, children, action = null, className = '' }) {
  return (
    <div className={`glass-card rounded-xl p-5 border border-glass-stroke ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 mb-3">
          {title ? (
            <h3 className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-widest">
              {title}
            </h3>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export default function LeadDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareError, setShareError] = useState('');
  const shareMenuRef = useRef(null);
  const [lead, setLead] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [conversationNotes, setConversationNotes] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [apptAt, setApptAt] = useState('');
  const [busy, setBusy] = useState('');
  const [googleMapsKey, setGoogleMapsKey] = useState('');
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [dripEnrollments, setDripEnrollments] = useState([]);
  const [emailIntegration, setEmailIntegration] = useState(null);
  const [emailQuota, setEmailQuota] = useState(null);
  const [emailMsg, setEmailMsg] = useState('');
  const [mapEl, setMapEl] = useState(null);
  const [isAdmin, setIsAdmin] = useState(() => isAdminRole(peekAuthSessionCache(getToken())?.role));
  const [lostReason, setLostReason] = useState('');
  const [outreachOptOut, setOutreachOptOut] = useState(false);
  const [pipelineStages, setPipelineStages] = useState(DEFAULT_PIPELINE_STAGE_LIST);
  const [proposalEngagement, setProposalEngagement] = useState(null);
  const [proposalEvents, setProposalEvents] = useState([]);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const statusOptions = useMemo(
    () => stagesToStatusOptions(pipelineStages) || STATUS_OPTIONS,
    [pipelineStages],
  );
  const statusConfigMap = useMemo(() => stagesToStatusConfig(pipelineStages), [pipelineStages]);
  const stageLabel = (key) => statusConfigMap[key]?.label || getStatusLabel(key);

  const tabParam = searchParams.get('tab') || 'overview';
  const activeTab = LEAD_TABS.some((t) => t.id === tabParam) ? tabParam : 'overview';

  const setTab = (tabId) => {
    const next = new URLSearchParams(searchParams);
    if (tabId === 'overview') next.delete('tab');
    else next.set('tab', tabId);
    setSearchParams(next, { replace: true });
  };

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
        headers: { Authorization: `Bearer ${t}` },
      });
      if (response.ok) {
        const data = await response.json();
        setLead(data);
        setNote(data.notes || '');
        setFollowUpAt(
          data.follow_up_at ? new Date(data.follow_up_at).toISOString().slice(0, 16) : '',
        );
        setNextAction(data.next_action || '');
        setConversationNotes(data.conversation_notes || '');
        setEmailBody(
          `Hi ${data.owner_name || 'there'},\n\nWe analyzed the solar potential at ${data.address} and estimate ~$${Number(data.estimated_savings || 0).toLocaleString('en-US')} in 25-year savings.\n\nWould you like to book a free site survey?\n`,
        );
        try {
          setOutreachOptOut(localStorage.getItem(`lead_outreach_optout_${data.id}`) === '1');
        } catch {
          setOutreachOptOut(false);
        }
      }

      const actRes = await fetch(`${API}/api/leads/${id}/activities`, {
        headers: { Authorization: `Bearer ${t}` },
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

      try {
        const quotaRes = await fetch(`${API}/api/email/usage`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        if (quotaRes.ok) setEmailQuota(await quotaRes.json());
        else setEmailQuota(null);
      } catch {
        setEmailQuota(null);
      }

      try {
        const stagesData = await fetchPipelineStages();
        if (stagesData?.stages?.length) setPipelineStages(stagesData.stages);
      } catch {
        /* keep defaults */
      }

      try {
        const propRes = await fetch(`${API}/api/proposals/lead/${id}`, {
          headers: { Authorization: `Bearer ${t}` },
        });
        if (propRes.ok) {
          const propData = await propRes.json();
          setProposalEngagement(propData.engagement || null);
          setProposalEvents(propData.events || []);
        } else {
          setProposalEngagement(null);
          setProposalEvents([]);
        }
      } catch {
        setProposalEngagement(null);
        setProposalEvents([]);
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
    if (!lead || searchParams.get('proposal') !== '1') return;
    setShowProposalModal(true);
    const next = new URLSearchParams(searchParams);
    next.delete('proposal');
    next.set('tab', 'proposal');
    setSearchParams(next, { replace: true });
  }, [lead, searchParams, setSearchParams]);

  useEffect(() => {
    const msg = emailToastFromSearchParams(searchParams, setSearchParams);
    if (msg) {
      setEmailMsg(msg);
      fetchEmailIntegration()
        .then(setEmailIntegration)
        .catch(() => {});
    }
  }, [searchParams, setSearchParams]);

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

  useEffect(() => {
    if (!lead || !mapsLoaded || !googleMapsKey || !mapEl || !window.google?.maps) {
      if (!mapEl) {
        mapInstanceRef.current = null;
        markerRef.current = null;
        setMapReady(false);
      }
      return;
    }
    if (activeTab !== 'overview' && activeTab !== 'property') return;

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
          mapTypeControl: false,
        });
        mapInstanceRef.current = map;
        markerRef.current = new window.google.maps.Marker({
          position: center,
          map,
          title: lead.address,
          icon: buildLeadMarkerIcon(window.google, { fillColor: '#FF3B30', scale: 1.8 }),
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
            icon: buildLeadMarkerIcon(window.google, { fillColor: '#FF3B30', scale: 1.8 }),
          });
        }
      }

      setMapReady(true);
      setMapError('');
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
  }, [lead, mapsLoaded, googleMapsKey, mapEl, activeTab]);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token()}`,
  });

  const handleStatus = async (status) => {
    if (status === 'lost' && !lostReason) {
      alert('Select a lost reason before marking Lost (needed for analytics).');
      setTab('details');
      return;
    }
    setBusy('status');
    const res = await fetch(`${API}/api/leads/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setLead(await res.json());
      if (status === 'lost' && lostReason) {
        await fetch(`${API}/api/leads/${id}/activities`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ type: 'note', content: `Lost reason: ${lostReason}` }),
        });
      }
      await load();
    }
    setBusy('');
  };

  const handleSaveNote = async () => {
    setBusy('note');
    await fetch(`${API}/api/leads/${id}/activities`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ type: 'note', content: note }),
    });
    await load();
    setBusy('');
  };

  const handleSaveFollowUp = async () => {
    setBusy('followup');
    try {
      const res = await fetch(`${API}/api/leads/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          followUpAt: followUpAt || null,
          nextAction,
          conversationNotes,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save follow-up');
      }
      setLead(await res.json());
    } catch (err) {
      alert(err.message || 'Failed to save follow-up');
    } finally {
      setBusy('');
    }
  };

  const handleEmail = async () => {
    if (outreachOptOut) {
      setEmailMsg('This lead opted out of outreach.');
      return;
    }
    if (!emailBody.trim()) {
      setEmailMsg('Write a message before sending.');
      return;
    }
    if (!lead?.email || lead.email === 'Not Available') {
      setEmailMsg('This lead has no email address.');
      return;
    }
    if (!emailIntegration?.connected) {
      setEmailMsg('Connect your mailbox in Integrations before sending.');
      return;
    }
    if (emailQuota && !emailQuota.unlimited && Number(emailQuota.remaining) <= 0) {
      setEmailMsg('Monthly email limit reached. Upgrade your plan to send more.');
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
      setEmailMsg(
        data.simulated
          ? 'Email simulated (check your connected mailbox).'
          : `Email sent from ${emailIntegration.fromEmail || 'your connected mailbox'}.`,
      );
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
        location: lead.address,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Failed');
    } else {
      await load();
      alert('Appointment booked');
      setTab('appointments');
    }
    setBusy('');
  };

  const toggleOptOut = () => {
    const next = !outreachOptOut;
    setOutreachOptOut(next);
    try {
      localStorage.setItem(`lead_outreach_optout_${id}`, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  const nba = useMemo(() => (lead ? getNextBestAction(lead) : null), [lead]);

  const runNbaCta = () => {
    if (!nba) return;
    if (nba.cta === 'call' && lead?.phone && lead.phone !== 'Not Available') {
      window.location.href = `tel:${lead.phone}`;
      return;
    }
    if (nba.cta === 'outreach') setTab('outreach');
    else if (nba.cta === 'appointment') setTab('appointments');
    else if (nba.cta === 'proposal') {
      setTab('proposal');
      setShowProposalModal(true);
    } else setTab('details');
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
  const displayScore = getLeadScore(lead);
  const solarScore = getSolarScore(lead);
  const solar = lead.solar || {};
  const propExtra = lead.propertyExtra || {};
  const lat = parseFloat(lead.latitude);
  const lng = parseFloat(lead.longitude);
  const phoneOk = lead.phone && lead.phone !== 'Not Available';
  const emailOk = lead.email && lead.email !== 'Not Available';

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
    [
      'Electricity Rate',
      solar.electricityRate
        ? `${solar.electricityRate}${solar.utilityName ? ` · ${solar.utilityName}` : ''}`
        : null,
    ],
    ['Production Source', solar.productionSource],
  ];

  const registryRows = [
    ['Parcel', lead.parcel_id || propExtra.parcelNumber],
    ['Mailing Address', lead.mailing_address || propExtra.mailingAddress],
    [
      'Owner Occupied',
      lead.owner_occupied === 1 ? 'Yes' : lead.owner_occupied === 0 ? 'No' : propExtra.ownerOccupied,
    ],
    ['Property Type', propExtra.propertyType],
    ['Year Built', propExtra.yearBuilt],
    ['Living Area', propExtra.livingArea],
    ['Lot Size', propExtra.lotSize],
    ['Stories', propExtra.stories],
    ['Property Value', money(lead.property_value)],
    ['Tax Assessed', propExtra.taxAssessedValue],
    ['Last Sale', propExtra.lastSaleDate],
    ['Last Sale Price', propExtra.lastSalePrice],
  ];

  const MapBlock = ({ heightClass = 'h-[280px] sm:h-[340px]' }) => (
    <div className="glass-card rounded-2xl overflow-hidden border border-glass-stroke">
      <div className={`relative w-full ${heightClass} bg-[#0B1220]`}>
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
  );

  return (
    <>
      <div className="w-full max-w-6xl mx-auto space-y-4 pb-8 text-xs">
        <div className="pt-2">
          <Link
            to="/my-leads"
            className="text-primary hover:text-white transition-colors inline-flex items-center gap-2 text-xs font-semibold font-label-mono uppercase tracking-wider"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back to Leads CRM
          </Link>
        </div>

        {/* Lead 360 header */}
        <div className="glass-card rounded-2xl border border-glass-stroke p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-headline-lg text-2xl font-bold text-white truncate">{displayName}</h2>
                <LeadStatusBadge status={lead.status} configMap={statusConfigMap} />
              </div>
              <p className="text-on-surface-variant break-words">{lead.address}</p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-glass-stroke text-[11px] font-bold text-white">
                  Lead Score <span className="font-mono text-primary">{displayScore}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-bold text-emerald-300">
                  Solar Score <span className="font-mono">{solarScore != null ? solarScore : '—'}</span>
                </span>
                {formatLeadGeneratedAt(lead.created_at) && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-primary/90">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    Generated {formatLeadGeneratedAt(lead.created_at)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center shrink-0">
              {phoneOk && (
                <a
                  href={`tel:${lead.phone}`}
                  className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white font-bold py-2 px-3 rounded-lg text-xs"
                >
                  <span className="material-symbols-outlined text-base">call</span>
                  Call
                </a>
              )}
              <button
                type="button"
                onClick={() => setTab('outreach')}
                className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white font-bold py-2 px-3 rounded-lg text-xs"
              >
                <span className="material-symbols-outlined text-base">mail</span>
                Email
              </button>
              <button
                type="button"
                onClick={handleShareWhatsApp}
                disabled={busy === 'share-wa'}
                className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white font-bold py-2 px-3 rounded-lg text-xs disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">chat</span>
                WhatsApp
              </button>

              <div className="relative" ref={shareMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShareError('');
                    setShowShareMenu((v) => !v);
                  }}
                  disabled={busy === 'share-pdf' || busy === 'share-wa'}
                  className="bg-white/10 hover:bg-white/15 text-white font-bold py-2 px-3 rounded-lg text-xs flex items-center gap-1.5"
                  title="More share options"
                  aria-expanded={showShareMenu}
                  aria-haspopup="menu"
                >
                  <span
                    className={`material-symbols-outlined text-base${
                      busy === 'share-pdf' || busy === 'share-wa' ? ' animate-spin' : ''
                    }`}
                  >
                    {busy === 'share-pdf' || busy === 'share-wa' ? 'progress_activity' : 'more_horiz'}
                  </span>
                  More
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
                        <span className="text-[10px] text-on-surface-variant">SpaceToRoof.com branded sheet</span>
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
                type="button"
                onClick={() => {
                  setTab('proposal');
                  setShowProposalModal(true);
                }}
                className="bg-primary text-on-primary font-bold py-2 px-3.5 rounded-lg text-xs flex items-center gap-1.5 shadow-md hover:brightness-110"
              >
                <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                Create & send proposal
              </button>

              <CrmPushPanel leadId={id} leadName={displayName} onPushed={() => load()} />

              <select
                value={lead.status || 'new'}
                onChange={(e) => handleStatus(e.target.value)}
                disabled={busy === 'status'}
                className="bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white text-xs"
                aria-label="Change pipeline stage"
              >
                {!statusOptions.includes(lead.status || 'new') && lead.status ? (
                  <option value={lead.status}>{lead.status}</option>
                ) : null}
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {stageLabel(s)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {shareError && <p className="text-[11px] text-red-400">{shareError}</p>}

          {/* Next Best Action */}
          {nba && (
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">
                  Next Best Action
                </p>
                <p className="text-sm font-bold text-white">{nba.title}</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">{nba.detail}</p>
              </div>
              <button
                type="button"
                onClick={runNbaCta}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold hover:brightness-110"
              >
                {nba.ctaLabel}
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          )}

          {dripEnrollments.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center p-3 rounded-xl bg-primary/10 border border-primary/25">
              <span className="material-symbols-outlined text-primary text-base">reorder</span>
              <span className="text-xs font-bold text-white">Active Drip:</span>
              {dripEnrollments.map((e) => (
                <Link
                  key={e.id}
                  to="/drip"
                  className="px-2 py-1 rounded-lg bg-white/10 text-primary text-[10px] font-bold hover:bg-white/15"
                >
                  {e.campaignName} · Step {e.currentStep}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto custom-scrollbar border-b border-glass-stroke pb-px">
          {LEAD_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 px-3.5 py-2.5 text-[11px] font-bold border-b-2 transition-colors ${
                activeTab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab panels — same APIs / actions as before, reorganized */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <MapBlock />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Lead Score', value: `${displayScore}/100`, accent: false },
                {
                  label: '25-yr Savings',
                  value: displayVal(solar.twentyFiveYearSavings, money(lead.estimated_savings)),
                  accent: true,
                },
                { label: 'System Size', value: displayVal(solar.recommendedSize) },
                { label: 'Annual Production', value: displayVal(solar.annualProduction) },
              ].map((k) => (
                <div key={k.label} className="glass-card rounded-xl p-4 border border-glass-stroke">
                  <p className="text-[9px] text-on-surface-variant uppercase font-label-mono tracking-wider">
                    {k.label}
                  </p>
                  <p
                    className={`text-base font-bold mt-1.5 truncate font-mono tabular-nums ${
                      k.accent ? 'text-primary' : 'text-white'
                    }`}
                  >
                    {k.value}
                  </p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card title="Lead Intelligence">
                <div className="space-y-2 text-[12px]">
                  <p className="text-white">
                    Lead Score: <span className="font-mono font-bold">{displayScore}/100</span>
                  </p>
                  <p className="text-white">
                    Solar Potential:{' '}
                    <span className="font-mono font-bold">
                      {solarScore != null ? `${solarScore}/100` : displayVal(solar.potential || lead.solar_potential)}
                    </span>
                  </p>
                  <p className="text-on-surface-variant">
                    Phone: {phoneOk ? 'Available' : 'Missing'} · Email: {emailOk ? 'Available' : 'Missing'}
                  </p>
                  <p className="text-on-surface-variant leading-relaxed mt-2">
                    High-potential rooftop opportunity. Use Next Best Action to move this lead through the pipeline
                    without leaving Lead 360.
                  </p>
                </div>
              </Card>
              <Card title="Customer Snapshot">
                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-white/5">
                    <p className="text-[9px] text-on-surface-variant uppercase mb-1">Phone</p>
                    <p className="text-white font-mono font-semibold break-all">{phoneOk ? lead.phone : '—'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5">
                    <p className="text-[9px] text-on-surface-variant uppercase mb-1">Email</p>
                    <p className="text-white font-semibold break-all">{emailOk ? lead.email : '—'}</p>
                  </div>
                  {lead.follow_up_at && (
                    <p className="text-[11px] text-amber-300">
                      Follow-up {formatLeadGeneratedAt(lead.follow_up_at)}
                      {lead.next_action ? ` · ${lead.next_action}` : ''}
                    </p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'details' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Contact">
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-white/5">
                  <p className="text-[9px] text-on-surface-variant uppercase mb-1">Name</p>
                  <p className="text-white font-semibold">{displayName}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <p className="text-[9px] text-on-surface-variant uppercase mb-1">Phone</p>
                  <p className="text-white font-mono font-semibold break-all">{phoneOk ? lead.phone : '—'}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <p className="text-[9px] text-on-surface-variant uppercase mb-1">Email</p>
                  <p className="text-white font-semibold break-all">{emailOk ? lead.email : '—'}</p>
                </div>
                <div className="p-3 rounded-lg bg-white/5">
                  <p className="text-[9px] text-on-surface-variant uppercase mb-1">Address</p>
                  <p className="text-white break-words">{lead.address}</p>
                </div>
                {lead.notes ? (
                  <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <p className="text-[9px] text-amber-400/80 uppercase mb-1">Enrichment note</p>
                    <p className="text-on-surface-variant text-[11px] leading-relaxed">{lead.notes}</p>
                  </div>
                ) : null}
              </div>
            </Card>
            <Card title="Lead Management">
              <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-3">
                Change stage
                <select
                  value={lead.status || 'new'}
                  onChange={(e) => handleStatus(e.target.value)}
                  disabled={busy === 'status'}
                  className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white text-xs"
                >
                  {!statusOptions.includes(lead.status || 'new') && lead.status ? (
                    <option value={lead.status}>{lead.status}</option>
                  ) : null}
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>
                      {stageLabel(s)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-3">
                Lost reason (required when marking Lost)
                <select
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white text-xs"
                >
                  <option value="">Select reason…</option>
                  {LOST_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <div className="space-y-3">
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider">
                  Schedule follow-up
                  <input
                    type="datetime-local"
                    className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white text-xs"
                    value={followUpAt}
                    onChange={(e) => setFollowUpAt(e.target.value)}
                  />
                </label>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider">
                  Next action
                  <input
                    type="text"
                    className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white text-xs"
                    placeholder="e.g. Send proposal, call back, site visit"
                    value={nextAction}
                    onChange={(e) => setNextAction(e.target.value)}
                  />
                </label>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider">
                  What they talked about
                  <textarea
                    className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white text-xs min-h-[80px]"
                    placeholder="Conversation notes…"
                    value={conversationNotes}
                    onChange={(e) => setConversationNotes(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleSaveFollowUp}
                  disabled={busy === 'followup'}
                  className="bg-primary text-on-primary px-4 py-2 rounded-lg font-bold text-xs disabled:opacity-50"
                >
                  {busy === 'followup' ? 'Saving…' : 'Save follow-up'}
                </button>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'property' && (
          <div className="space-y-4">
            <MapBlock heightClass="h-[300px] sm:h-[400px]" />
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card
                title="Solar Analysis"
                action={
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                    {displayVal(solar.potential || lead.solar_potential, 'Rated')} ·{' '}
                    {displayVal(solar.estimatedPanels, '0')} panels
                  </span>
                }
              >
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
              </Card>
              <Card title="Property Registry">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                  {registryRows.map(([label, value]) => (
                    <SpecRow key={label} label={label} value={value} />
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'outreach' && (
          <div className="space-y-4">
            <Card
              title="Outreach controls"
              action={
                <button
                  type="button"
                  onClick={toggleOptOut}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${
                    outreachOptOut
                      ? 'bg-red-500/15 text-red-300 border-red-500/30'
                      : 'bg-white/5 text-on-surface-variant border-glass-stroke'
                  }`}
                >
                  {outreachOptOut ? 'Opted out' : 'Allow outreach · Opt out'}
                </button>
              }
            >
              <p className="text-[11px] text-on-surface-variant mb-3">
                Send from your connected mailbox. Drip sequences stay on Drip Workflows — enrollments still show above.
              </p>
              {dripEnrollments.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-3">
                  {dripEnrollments.map((e) => (
                    <Link
                      key={e.id}
                      to="/drip"
                      className="px-2 py-1 rounded-lg bg-primary/15 text-primary text-[10px] font-bold"
                    >
                      {e.campaignName} · Step {e.currentStep}
                    </Link>
                  ))}
                </div>
              ) : (
                <Link to="/drip" className="text-[11px] text-primary font-bold hover:underline">
                  Open Drip Workflows to start a sequence →
                </Link>
              )}
            </Card>

            <Card title="Send Email">
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className="text-[10px] text-on-surface-variant font-semibold text-right ml-auto">
                  {emailQuota?.unlimited
                    ? 'Unlimited plan emails'
                    : emailQuota
                      ? `${emailQuota.remaining ?? 0} / ${emailQuota.limit ?? 0} left`
                      : 'Plan quota'}
                  {emailIntegration?.connected ? (
                    <span className="block text-green-400 mt-0.5">From: {emailIntegration.fromEmail}</span>
                  ) : (
                    <span className="block text-amber-400 mt-0.5">Mailbox not connected</span>
                  )}
                </span>
              </div>

              {outreachOptOut ? (
                <p className="text-[11px] text-red-300">Outreach paused for this lead (opt-out).</p>
              ) : emailIntegration?.connected ? (
                <>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed mb-2">
                    Emails send from your inbox. Replies come back to you. Uses your plan email quota.
                  </p>
                  <textarea
                    className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white min-h-[100px]"
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                  />
                  {emailMsg && (
                    <p
                      className={`text-[11px] mt-2 ${
                        emailMsg.toLowerCase().includes('sent') ||
                        emailMsg.toLowerCase().includes('success') ||
                        emailMsg.toLowerCase().includes('connected')
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}
                    >
                      {emailMsg}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleEmail}
                    disabled={
                      busy === 'email' ||
                      (emailQuota && !emailQuota.unlimited && Number(emailQuota.remaining) <= 0)
                    }
                    className="mt-3 w-full bg-white/10 text-white py-2 rounded-lg font-bold disabled:opacity-50"
                  >
                    {busy === 'email' ? 'Sending...' : 'Send Email'}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Connect your mailbox in Integrations to send from your inbox. Replies come back to you.
                  </p>
                  {emailMsg && (
                    <p
                      className={`text-[11px] mt-2 ${
                        emailMsg.toLowerCase().includes('connected') ||
                        emailMsg.toLowerCase().includes('success')
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}
                    >
                      {emailMsg}
                    </p>
                  )}
                  <Link
                    to="/integrations#email"
                    className="inline-flex w-full items-center justify-center bg-primary text-on-primary py-3 rounded-xl font-bold text-sm hover:brightness-110 mt-3"
                  >
                    Open Integrations
                  </Link>
                </>
              )}
            </Card>

            <Card title="WhatsApp">
              <p className="text-[11px] text-on-surface-variant mb-3">
                Share the lead PDF and summary via WhatsApp (same share flow as before).
              </p>
              <button
                type="button"
                onClick={handleShareWhatsApp}
                disabled={busy === 'share-wa' || outreachOptOut}
                className="bg-secondary/20 text-secondary border border-secondary/30 px-4 py-2 rounded-lg font-bold disabled:opacity-50"
              >
                {busy === 'share-wa' ? 'Opening…' : 'Share to WhatsApp'}
              </button>
            </Card>
          </div>
        )}

        {activeTab === 'appointments' && (
          <Card title="Book Site Survey">
            <p className="text-[11px] text-on-surface-variant mb-3">
              Booking sets lead stage to Appointment (existing automation). Manage all appointments from the global
              Appointments page.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1 w-full">
                <label className="font-label-mono text-[9px] text-on-surface-variant uppercase">Date & time</label>
                <input
                  type="datetime-local"
                  className="w-full mt-1 bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white"
                  value={apptAt}
                  onChange={(e) => setApptAt(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={handleBookAppt}
                disabled={busy === 'appt'}
                className="bg-secondary/20 text-secondary border border-secondary/30 px-4 py-2 rounded-lg font-bold shrink-0"
              >
                Book Appointment
              </button>
              <Link
                to="/appointments"
                className="text-primary font-bold hover:underline py-2 shrink-0 text-center"
              >
                All Appointments →
              </Link>
              {isAdmin && (
                <Link to="/ai-calling" className="text-primary font-bold hover:underline py-2 shrink-0">
                  AI Voice Calling →
                </Link>
              )}
            </div>
          </Card>
        )}

        {activeTab === 'proposal' && (
          <div className="space-y-4">
            <Card title="Proposal">
              <p className="text-[11px] text-on-surface-variant mb-4">
                Create and send proposals with the existing proposal builder. Public sign still marks the lead Won.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowProposalModal(true)}
                  className="bg-primary text-on-primary font-bold py-2.5 px-4 rounded-lg text-xs flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                  Create & send proposal
                </button>
                <CrmPushPanel leadId={id} leadName={displayName} onPushed={() => load()} />
              </div>
            </Card>

            <Card title="Proposal tracking">
              {proposalEngagement ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-primary/25 bg-primary/10 p-3">
                    <p className="text-sm font-bold text-white">{proposalEngagement.summary}</p>
                    {proposalEngagement.viewCount > 0 && (
                      <p className="text-[11px] text-amber-300 mt-1">
                        High engagement — recommended: follow up today.
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                    <div className="p-2.5 rounded-lg bg-white/5">
                      <p className="text-on-surface-variant uppercase text-[9px]">Status</p>
                      <p className="text-white font-bold capitalize">{proposalEngagement.status}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white/5">
                      <p className="text-on-surface-variant uppercase text-[9px]">Views</p>
                      <p className="text-white font-bold font-mono">{proposalEngagement.viewCount}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white/5">
                      <p className="text-on-surface-variant uppercase text-[9px]">Downloads</p>
                      <p className="text-white font-bold font-mono">{proposalEngagement.downloadCount}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white/5">
                      <p className="text-on-surface-variant uppercase text-[9px]">Financing</p>
                      <p className="text-white font-bold">
                        {proposalEngagement.financingViewedAt ? 'Viewed' : '—'}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white/5">
                      <p className="text-on-surface-variant uppercase text-[9px]">Equipment</p>
                      <p className="text-white font-bold">
                        {proposalEngagement.equipmentViewedAt ? 'Viewed' : '—'}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white/5">
                      <p className="text-on-surface-variant uppercase text-[9px]">Accepted</p>
                      <p className="text-white font-bold">
                        {proposalEngagement.signedAt ? 'Yes' : '—'}
                      </p>
                    </div>
                  </div>
                  {proposalEvents.length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                      {proposalEvents.slice(0, 12).map((ev) => (
                        <div key={ev.id} className="flex justify-between gap-2 text-[10px]">
                          <span className="text-primary font-bold uppercase">{ev.event_type.replace(/_/g, ' ')}</span>
                          <span className="text-on-surface-variant">
                            {new Date(ev.created_at).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {proposalEngagement.viewCount > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setNextAction('Follow up — proposal viewed');
                        setTab('details');
                      }}
                      className="bg-white/10 text-white px-3 py-2 rounded-lg text-xs font-bold"
                    >
                      Follow Up
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-on-surface-variant">
                  No proposal yet. Create one to start tracking opens, financing views, and acceptance.
                </p>
              )}
            </Card>
          </div>
        )}

        {activeTab === 'activity' && (
          <Card title="Activity timeline">
            <div className="space-y-3 max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
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
          </Card>
        )}

        {activeTab === 'notes' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card title="Internal Notes" className="lg:col-span-2">
              <p className="text-[11px] text-on-surface-variant mb-3">
                Add and manage notes visible only to your team.
              </p>
              <textarea
                className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-white min-h-[120px]"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={busy === 'note'}
                className="mt-3 bg-primary text-on-primary px-4 py-2 rounded-lg font-bold"
              >
                {busy === 'note' ? 'Saving…' : 'Add Note'}
              </button>
              <div className="mt-5 space-y-3 max-h-72 overflow-y-auto custom-scrollbar">
                {activities
                  .filter((a) => a.type === 'note')
                  .map((a) => (
                    <div key={a.id} className="p-3 rounded-lg bg-white/5 border border-glass-stroke">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-bold text-primary uppercase">Internal Note</span>
                        <span className="text-[10px] text-on-surface-variant">
                          {new Date(a.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-white whitespace-pre-wrap break-words">{a.content}</p>
                    </div>
                  ))}
              </div>
            </Card>
            <Card title="Privacy">
              <div className="flex gap-2 items-start">
                <span className="material-symbols-outlined text-primary text-xl">lock</span>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  These notes are visible only to team members with access to this lead.
                </p>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'files' && (
          <Card title="Files">
            <p className="text-[11px] text-on-surface-variant mb-3">
              Download the shareable lead PDF. Proposal PDFs are created from the Proposal tab.
            </p>
            <button
              type="button"
              onClick={handleDownloadSharePdf}
              disabled={busy === 'share-pdf'}
              className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-white font-bold py-2 px-3 rounded-lg text-xs disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">picture_as_pdf</span>
              {busy === 'share-pdf' ? 'Preparing…' : 'Download lead PDF'}
            </button>
          </Card>
        )}
      </div>

      <SolarProposalModal
        show={showProposalModal}
        onClose={() => setShowProposalModal(false)}
        lead={lead}
      />
    </>
  );
}
