import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import SolarProposalModal from '../../components/SolarProposalModal';
import LeadProposalPanel from '../../components/leads/LeadProposalPanel.jsx';
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
import { useAuth } from '../../context/AuthContext.jsx';
import PlanUpgradeGate from '../../components/PlanUpgradeGate.jsx';
import { downloadLeadSharePdf, shareLeadToWhatsApp } from '../../utils/leadSharePdf.js';
import {
  STATUS_OPTIONS,
  LOST_REASONS,
  CALL_OUTCOMES,
  getStatusLabel,
  getLeadScore,
  getSolarScore,
  getNextBestAction,
  getLeadImageUrl,
} from '../../lib/leads.js';
import {
  fetchPipelineStages,
  stagesToStatusOptions,
  stagesToStatusConfig,
  DEFAULT_PIPELINE_STAGE_LIST,
} from '../../lib/pipelineApi.js';
import LeadFollowUpsPanel from '../../components/leads/LeadFollowUpsPanel.jsx';
import EmailSequenceBuilder from '../../components/leads/EmailSequenceBuilder.jsx';

const API = API_BASE;
const GMAPS_SCRIPT_ID = 'google-maps-script';

const LEAD_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'details', label: 'Details' },
  { id: 'outreach', label: 'Outreach' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'activity', label: 'Activity' },
  { id: 'notes', label: 'Notes' },
  { id: 'followups', label: 'Follow Ups' },
  { id: 'files', label: 'Files' },
  { id: 'property', label: 'Property' },
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
    <div className="flex items-start justify-between gap-3 py-2 border-b border-glass-stroke last:border-0">
      <span className="text-on-surface-variant shrink-0">{label}</span>
      <span className="text-on-surface font-semibold text-right break-words max-w-[60%]">{shown}</span>
    </div>
  );
}

function pickContactField(...candidates) {
  for (const raw of candidates) {
    if (raw == null) continue;
    const v = String(raw).trim();
    if (!v || v === 'Not Available' || v === 'N/A' || v === 'undefined' || v === 'null') continue;
    return v;
  }
  return null;
}

function Card({ title, children, action = null, className = '' }) {
  return (
    <div className={`crm-panel p-5 ${className}`}>
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

/** Must live outside LeadDetails — defining it inside caused React #185 (infinite remount + setState). */
function LeadMapBlock({
  mapContainerRef,
  mapReady,
  mapError,
  lat,
  lng,
  heightClass = 'h-[280px] sm:h-[340px]',
}) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-glass-stroke">
      <div className={`relative w-full ${heightClass} bg-surface-container-lowest`}>
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
        {!mapReady && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-surface-container-lowest/90 pointer-events-none">
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
        <div className="theme-dark-canvas absolute bottom-3 left-3 z-20 px-2.5 py-1 rounded-lg bg-black/65 text-[10px] text-white font-semibold backdrop-blur-sm">
          Google Satellite · {Number.isNaN(lat) ? '—' : lat.toFixed(5)}, {Number.isNaN(lng) ? '—' : lng.toFixed(5)}
        </div>
      </div>
    </div>
  );
}

export default function LeadDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: authUser, can, entitlements } = useAuth();
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
  const [leadAppointments, setLeadAppointments] = useState([]);
  const [rescheduleId, setRescheduleId] = useState(null);
  const [rescheduleAt, setRescheduleAt] = useState('');
  const [dripCampaigns, setDripCampaigns] = useState([]);
  const [enrollCampaignId, setEnrollCampaignId] = useState('');
  const [callOutcome, setCallOutcome] = useState('');
  const [saleForm, setSaleForm] = useState({
    saleSystemSizeKw: '',
    saleValue: '',
    saleEquipment: '',
    saleFinancing: '',
    saleClosedAt: '',
    saleRepName: '',
  });
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
    setMapEl((prev) => (prev === node ? prev : node));
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
        setCallOutcome(data.call_outcome || '');
        setSaleForm({
          saleSystemSizeKw: data.sale_system_size_kw ?? '',
          saleValue: data.sale_value ?? '',
          saleEquipment: data.sale_equipment || '',
          saleFinancing: data.sale_financing || '',
          saleClosedAt: data.sale_closed_at
            ? new Date(data.sale_closed_at).toISOString().slice(0, 10)
            : '',
          saleRepName: data.sale_rep_name || '',
        });
        setEmailBody(
          `Hi ${data.owner_name || 'there'},\n\nWe analyzed the solar potential at ${data.address} and estimate ~$${Number(data.estimated_savings || 0).toLocaleString('en-US')} in 25-year savings.\n\nWould you like to book a free site survey?\n`,
        );
        try {
          setOutreachOptOut(Number(data.outreach_opt_out) === 1);
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
        const camps = await apiService.getDripCampaigns();
        const list = Array.isArray(camps) ? camps : camps?.campaigns || [];
        setDripCampaigns(list.filter((c) => String(c.status || 'active').toLowerCase() !== 'archived'));
      } catch {
        setDripCampaigns([]);
      }

      try {
        // Plan without appointments returns 403 — skip the call to avoid console noise.
        if (!can('appointments')) {
          setLeadAppointments([]);
        } else {
          const apptRes = await fetch(`${API}/api/appointments?leadId=${id}`, {
            headers: { Authorization: `Bearer ${t}` },
          });
          if (apptRes.ok) setLeadAppointments(await apptRes.json());
          else setLeadAppointments([]);
        }
      } catch {
        setLeadAppointments([]);
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
        setMapReady((ready) => (ready ? false : ready));
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

      setMapReady((ready) => (ready ? ready : true));
      setMapError((err) => (err ? '' : err));
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
    if (status === 'won') {
      setTab('details');
      // Still allow quick status flip; sale form can be completed on Details tab
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

  const handleSaveFollowUp = async (overrides = null) => {
    setBusy('followup');
    const nextFollow = overrides?.followUpAt !== undefined ? overrides.followUpAt : followUpAt;
    const nextAct = overrides?.nextAction !== undefined ? overrides.nextAction : nextAction;
    try {
      const res = await fetch(`${API}/api/leads/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          followUpAt: nextFollow || null,
          nextAction: nextAct,
          conversationNotes,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save follow-up');
      }
      const updated = await res.json();
      setLead(updated);
      setFollowUpAt(
        updated.follow_up_at ? new Date(updated.follow_up_at).toISOString().slice(0, 16) : '',
      );
      setNextAction(updated.next_action || '');
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
    if (!emailDisplay) {
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

  const handleRescheduleAppt = async (apptId) => {
    if (!rescheduleAt) return alert('Pick a new date/time');
    setBusy('reschedule');
    const res = await fetch(`${API}/api/appointments/${apptId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ scheduledAt: rescheduleAt, status: 'scheduled' }),
    });
    if (!res.ok) {
      alert('Failed to reschedule');
    } else {
      setRescheduleId(null);
      setRescheduleAt('');
      await load();
    }
    setBusy('');
  };

  const handleCancelAppt = async (apptId) => {
    if (!window.confirm('Cancel this appointment?')) return;
    setBusy('cancel-appt');
    const res = await fetch(`${API}/api/appointments/${apptId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status: 'cancelled' }),
    });
    if (!res.ok) alert('Failed to cancel');
    else await load();
    setBusy('');
  };

  const handleEnrollSequence = async () => {
    if (!enrollCampaignId) return alert('Select a sequence');
    if (outreachOptOut) return alert('Lead opted out of outreach');
    setBusy('enroll');
    try {
      await apiService.enrollLeadsInCampaign(enrollCampaignId, { leadIds: [Number(id)] });
      await load();
      alert('Enrolled in sequence');
    } catch (err) {
      alert(err.message || 'Enrollment failed');
    } finally {
      setBusy('');
    }
  };

  const handleCancelEnrollment = async (enrollmentId) => {
    setBusy('unenroll');
    try {
      await apiService.cancelDripEnrollment(enrollmentId);
      await load();
    } catch (err) {
      alert(err.message || 'Could not cancel enrollment');
    } finally {
      setBusy('');
    }
  };

  const handleSaveCallOutcome = async () => {
    if (!callOutcome) return alert('Select a call outcome');
    setBusy('outcome');
    try {
      const res = await fetch(`${API}/api/leads/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ callOutcome }),
      });
      if (!res.ok) throw new Error('Failed to save outcome');
      setLead(await res.json());
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy('');
    }
  };

  const handleSaveConversion = async () => {
    setBusy('conversion');
    try {
      const res = await fetch(`${API}/api/leads/${id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          status: 'won',
          saleSystemSizeKw: saleForm.saleSystemSizeKw,
          saleValue: saleForm.saleValue,
          saleEquipment: saleForm.saleEquipment,
          saleFinancing: saleForm.saleFinancing,
          saleClosedAt: saleForm.saleClosedAt || new Date().toISOString().slice(0, 10),
          saleRepName: saleForm.saleRepName,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save conversion');
      }
      setLead(await res.json());
      await load();
      alert('Sale recorded — lead Closed / Won');
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy('');
    }
  };

  const toggleOptOut = async () => {
    const next = !outreachOptOut;
    setOutreachOptOut(next);
    try {
      const updated = await apiService.setLeadOutreachOptOut(id, next);
      if (updated && typeof updated.outreach_opt_out !== 'undefined') {
        setOutreachOptOut(Number(updated.outreach_opt_out) === 1);
      }
      setLead((prev) => (prev ? { ...prev, outreach_opt_out: next ? 1 : 0 } : prev));
    } catch (err) {
      setOutreachOptOut(!next);
      alert(err.message || 'Failed to update outreach opt-out');
    }
  };

  const nba = useMemo(() => (lead ? getNextBestAction(lead) : null), [lead]);

  const phoneDisplay = useMemo(
    () =>
      pickContactField(
        lead?.phone,
        lead?.propertyExtra?.phone,
        lead?.propertyExtra?.ownerPhone,
        lead?.propertyExtra?.contactPhone,
        lead?.propertyExtra?.contact?.phone,
        lead?.solar?.phone,
      ),
    [lead],
  );
  const emailDisplay = useMemo(
    () =>
      pickContactField(
        lead?.email,
        lead?.propertyExtra?.email,
        lead?.propertyExtra?.ownerEmail,
        lead?.propertyExtra?.contactEmail,
        lead?.propertyExtra?.contact?.email,
        lead?.solar?.email,
      ),
    [lead],
  );

  const runNbaCta = () => {
    if (!nba) return;
    if (nba.cta === 'call' && phoneDisplay) {
      window.location.href = `tel:${phoneDisplay}`;
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
          <h3 className="text-on-surface font-bold mb-2">Lead Record Not Found</h3>
          <Link to="/my-leads" className="text-primary text-xs">
            Back to My Leads
          </Link>
        </div>
      </>
    );
  }

  const displayName = lead.owner_name || 'Not Available';
  const assigneeLabel =
    (authUser?.name && String(authUser.name).trim()) ||
    (authUser?.email && String(authUser.email).trim()) ||
    '—';
  const displayScore = getLeadScore(lead);
  const solarScore = getSolarScore(lead);
  const leadImage = getLeadImageUrl(lead);
  const lastActivityLabel = lead.last_activity_at
    ? formatLeadGeneratedAt(lead.last_activity_at)
    : formatLeadGeneratedAt(lead.updated_at) || '—';
  const solar = lead.solar || {};
  const propExtra = lead.propertyExtra || {};
  const lat = parseFloat(lead.latitude);
  const lng = parseFloat(lead.longitude);
  const phoneOk = Boolean(phoneDisplay);
  const emailOk = Boolean(emailDisplay);

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

  return (
    <>
      <div className="w-full max-w-6xl mx-auto space-y-4 pb-8 text-xs">
        <div className="pt-2">
          <Link
            to="/my-leads"
            className="text-primary hover:text-on-surface transition-colors inline-flex items-center gap-2 text-xs font-semibold font-label-mono uppercase tracking-wider"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back to Leads CRM
          </Link>
        </div>

        {/* Lead 360 header + tabs (single stack so actions never cover the tab bar) */}
        <div className="crm-panel lead-360-shell relative z-0 overflow-visible">
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="w-full lg:w-44 h-36 lg:h-auto rounded-xl overflow-hidden bg-surface-container-lowest border border-glass-stroke shrink-0">
                {leadImage ? (
                  <img src={leadImage} alt="" className="w-full h-full object-cover min-h-[9rem]" />
                ) : (
                  <div className="w-full h-full min-h-[9rem] flex items-center justify-center">
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant">home</span>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-headline-lg text-2xl font-bold text-on-surface truncate">{displayName}</h2>
                  <LeadStatusBadge status={lead.status} configMap={statusConfigMap} />
                </div>
                <p className="text-on-surface-variant break-words text-sm">{lead.address}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                  <div className="inline-flex items-center gap-1.5 min-w-0">
                    <span className="material-symbols-outlined text-base text-on-surface-variant shrink-0">call</span>
                    {phoneOk ? (
                      <a
                        href={`tel:${phoneDisplay}`}
                        className="text-on-surface font-semibold font-mono hover:text-primary break-all"
                      >
                        {phoneDisplay}
                      </a>
                    ) : (
                      <span className="text-on-surface-variant">No phone on file</span>
                    )}
                  </div>
                  <div className="inline-flex items-center gap-1.5 min-w-0">
                    <span className="material-symbols-outlined text-base text-on-surface-variant shrink-0">mail</span>
                    {emailOk ? (
                      <a
                        href={`mailto:${emailDisplay}`}
                        className="text-on-surface font-semibold hover:text-primary break-all"
                      >
                        {emailDisplay}
                      </a>
                    ) : (
                      <span className="text-on-surface-variant">No email on file</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-[11px] font-bold text-sky-300">
                    Lead Score <span className="font-mono">{displayScore}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-bold text-emerald-300">
                    Solar Score <span className="font-mono">{solarScore != null ? solarScore : '—'}</span>
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded-lg bg-white/5 border border-glass-stroke px-3 py-2">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">Stage</p>
                    <p className="text-on-surface font-semibold mt-0.5">{stageLabel(lead.status)}</p>
                  </div>
                  <div className="rounded-lg bg-white/5 border border-glass-stroke px-3 py-2">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">Assignee</p>
                    <p className="text-on-surface font-semibold mt-0.5 truncate" title={assigneeLabel}>
                      {assigneeLabel}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/5 border border-glass-stroke px-3 py-2">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">Last activity</p>
                    <p className="text-on-surface font-semibold mt-0.5">{lastActivityLabel}</p>
                  </div>
                </div>
              </div>

              <div className="lg:w-64 shrink-0">
                {nba ? (
                  <div className="rounded-xl border border-primary/30 bg-primary/10 p-3.5 h-full flex flex-col">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Next Action</p>
                    <p className="text-sm font-bold text-on-surface">{nba.title}</p>
                    <p className="text-[11px] text-on-surface-variant mt-1 flex-1">{nba.detail}</p>
                    {proposalEngagement?.viewCount > 0 && (
                      <p className="text-[10px] text-amber-300 mt-2">
                        Proposal viewed {proposalEngagement.viewCount} time
                        {proposalEngagement.viewCount === 1 ? '' : 's'}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={runNbaCta}
                      className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold hover:brightness-110"
                    >
                      {nba.ctaLabel}
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-glass-stroke bg-white/5 p-3.5 text-[11px] text-on-surface-variant">
                    No next action suggested.
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center pt-1 border-t border-glass-stroke">
              {phoneOk && (
                <a
                  href={`tel:${phoneDisplay}`}
                  className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-on-surface font-bold py-2 px-3 rounded-lg text-xs"
                >
                  <span className="material-symbols-outlined text-base">call</span>
                  Call
                </a>
              )}
              <button
                type="button"
                onClick={() => setTab('outreach')}
                className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-on-surface font-bold py-2 px-3 rounded-lg text-xs"
              >
                <span className="material-symbols-outlined text-base">mail</span>
                Email
              </button>
              <button
                type="button"
                onClick={() => setTab('outreach')}
                className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-on-surface font-bold py-2 px-3 rounded-lg text-xs"
              >
                <span className="material-symbols-outlined text-base">sms</span>
                SMS
              </button>
              <button
                type="button"
                onClick={handleShareWhatsApp}
                disabled={busy === 'share-wa'}
                className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-on-surface font-bold py-2 px-3 rounded-lg text-xs disabled:opacity-50"
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
                  className="bg-white/10 hover:bg-white/15 text-on-surface font-bold py-2 px-3 rounded-lg text-xs flex items-center gap-1.5"
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
                    className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 z-30 min-w-[220px] rounded-xl border border-glass-stroke bg-surface-elevated shadow-xl overflow-hidden"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleDownloadSharePdf}
                      disabled={!!busy}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs text-on-surface hover:bg-white/10 disabled:opacity-50"
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
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs text-on-surface hover:bg-white/10 border-t border-glass-stroke disabled:opacity-50"
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
                className="bg-primary text-on-primary font-bold py-2 px-3.5 rounded-lg text-xs flex items-center gap-1.5 shadow-md hover:brightness-110 ml-auto"
              >
                <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                Create & send proposal
              </button>

              <select
                value={lead.status || 'new'}
                onChange={(e) => handleStatus(e.target.value)}
                disabled={busy === 'status'}
                className="bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface text-xs"
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

            {shareError && <p className="text-[11px] text-red-400">{shareError}</p>}

            {dripEnrollments.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center p-3 rounded-xl bg-primary/10 border border-primary/25">
                <span className="material-symbols-outlined text-primary text-base">reorder</span>
                <span className="text-xs font-bold text-on-surface">Active Drip:</span>
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

          {/* Tabs — inside the same shell, below actions (no overlap / stacking) */}
          <nav
            className="lead-360-tabs relative z-10 flex gap-1 overflow-x-auto custom-scrollbar border-t border-glass-stroke px-2 sm:px-3 pt-1"
            aria-label="Lead sections"
          >
            {LEAD_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 px-3.5 py-2.5 text-[11px] font-bold border-b-2 transition-colors ${
                  activeTab === t.id
                    ? 'border-primary text-primary bg-primary/10 rounded-t-md'
                    : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab panels — same APIs / actions as before, reorganized */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <LeadMapBlock
              mapContainerRef={mapContainerRef}
              mapReady={mapReady}
              mapError={mapError}
              lat={lat}
              lng={lng}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                      k.accent ? 'text-primary' : 'text-on-surface'
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
                  <p className="text-on-surface">
                    Lead Score: <span className="font-mono font-bold">{displayScore}/100</span>
                  </p>
                  <p className="text-on-surface">
                    Solar Potential:{' '}
                    <span className="font-mono font-bold">
                      {solarScore != null ? `${solarScore}/100` : displayVal(solar.potential || lead.solar_potential)}
                    </span>
                  </p>
                  <p className="text-on-surface-variant leading-relaxed mt-2">
                    High-potential rooftop opportunity. Use Next Best Action to move this lead through the pipeline
                    without leaving Lead 360.
                  </p>
                </div>
              </Card>
              <Card title="Customer Snapshot">
                <div className="space-y-2">
                  <div className="p-3 rounded-lg bg-surface-container border border-glass-stroke">
                    <p className="text-[9px] text-on-surface-variant uppercase mb-1">Name</p>
                    <p className="text-on-surface font-semibold break-words">{displayName}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-container border border-glass-stroke">
                    <p className="text-[9px] text-on-surface-variant uppercase mb-1">Phone</p>
                    {phoneOk ? (
                      <a
                        href={`tel:${phoneDisplay}`}
                        className="text-on-surface font-mono font-semibold break-all hover:text-primary inline-flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm text-primary">call</span>
                        {phoneDisplay}
                      </a>
                    ) : (
                      <p className="text-on-surface-variant">Not available</p>
                    )}
                    {lead.phone_type && lead.phone_type !== 'Not Available' && (
                      <p className="text-[10px] text-on-surface-variant mt-1">{lead.phone_type}</p>
                    )}
                  </div>
                  <div className="p-3 rounded-lg bg-surface-container border border-glass-stroke">
                    <p className="text-[9px] text-on-surface-variant uppercase mb-1">Email</p>
                    {emailOk ? (
                      <a
                        href={`mailto:${emailDisplay}`}
                        className="text-on-surface font-semibold break-all hover:text-primary inline-flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-sm text-primary">mail</span>
                        {emailDisplay}
                      </a>
                    ) : (
                      <p className="text-on-surface-variant">Not available</p>
                    )}
                    {lead.email_status && lead.email_status !== 'Not Available' && (
                      <p className="text-[10px] text-on-surface-variant mt-1">{lead.email_status}</p>
                    )}
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
                <div className="p-3 rounded-lg bg-surface-container border border-glass-stroke">
                  <p className="text-[9px] text-on-surface-variant uppercase mb-1">Name</p>
                  <p className="text-on-surface font-semibold">{displayName}</p>
                </div>
                <div className="p-3 rounded-lg bg-surface-container border border-glass-stroke">
                  <p className="text-[9px] text-on-surface-variant uppercase mb-1">Phone</p>
                  {phoneOk ? (
                    <a
                      href={`tel:${phoneDisplay}`}
                      className="text-on-surface font-mono font-semibold break-all hover:text-primary"
                    >
                      {phoneDisplay}
                    </a>
                  ) : (
                    <p className="text-on-surface-variant">Not available</p>
                  )}
                </div>
                <div className="p-3 rounded-lg bg-surface-container border border-glass-stroke">
                  <p className="text-[9px] text-on-surface-variant uppercase mb-1">Email</p>
                  {emailOk ? (
                    <a
                      href={`mailto:${emailDisplay}`}
                      className="text-on-surface font-semibold break-all hover:text-primary"
                    >
                      {emailDisplay}
                    </a>
                  ) : (
                    <p className="text-on-surface-variant">Not available</p>
                  )}
                </div>
                <div className="p-3 rounded-lg bg-surface-container border border-glass-stroke">
                  <p className="text-[9px] text-on-surface-variant uppercase mb-1">Address</p>
                  <p className="text-on-surface break-words">{lead.address}</p>
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
                  className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface text-xs"
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
                  className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface text-xs"
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
                    className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface text-xs"
                    value={followUpAt}
                    onChange={(e) => setFollowUpAt(e.target.value)}
                  />
                </label>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider">
                  Next action
                  <input
                    type="text"
                    className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface text-xs"
                    placeholder="e.g. Send proposal, call back, site visit"
                    value={nextAction}
                    onChange={(e) => setNextAction(e.target.value)}
                  />
                </label>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider">
                  What they talked about
                  <textarea
                    className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface text-xs min-h-[80px]"
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

            <div className="lg:col-span-2">
              <Card title="Closed / Won — Sale details">
                <p className="text-[11px] text-on-surface-variant mb-3">
                  Record final sale details when converting. Saves status as Closed / Won and feeds reporting.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider">
                    Final system size (kW)
                    <input
                      type="number"
                      step="0.1"
                      className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface text-xs"
                      value={saleForm.saleSystemSizeKw}
                      onChange={(e) => setSaleForm((f) => ({ ...f, saleSystemSizeKw: e.target.value }))}
                    />
                  </label>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider">
                    Sale value ($)
                    <input
                      type="number"
                      step="1"
                      className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface text-xs"
                      value={saleForm.saleValue}
                      onChange={(e) => setSaleForm((f) => ({ ...f, saleValue: e.target.value }))}
                    />
                  </label>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider">
                    Equipment
                    <input
                      type="text"
                      className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface text-xs"
                      placeholder="Panels / inverter / battery"
                      value={saleForm.saleEquipment}
                      onChange={(e) => setSaleForm((f) => ({ ...f, saleEquipment: e.target.value }))}
                    />
                  </label>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider">
                    Financing
                    <input
                      type="text"
                      className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface text-xs"
                      placeholder="Cash / Loan / Lease"
                      value={saleForm.saleFinancing}
                      onChange={(e) => setSaleForm((f) => ({ ...f, saleFinancing: e.target.value }))}
                    />
                  </label>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider">
                    Closing date
                    <input
                      type="date"
                      className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface text-xs"
                      value={saleForm.saleClosedAt}
                      onChange={(e) => setSaleForm((f) => ({ ...f, saleClosedAt: e.target.value }))}
                    />
                  </label>
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider">
                    Sales representative
                    <input
                      type="text"
                      className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface text-xs"
                      value={saleForm.saleRepName}
                      onChange={(e) => setSaleForm((f) => ({ ...f, saleRepName: e.target.value }))}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleSaveConversion}
                  disabled={busy === 'conversion'}
                  className="mt-4 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-4 py-2 rounded-lg font-bold text-xs disabled:opacity-50"
                >
                  {busy === 'conversion' ? 'Saving…' : 'Mark as Won & Save Sale'}
                </button>
                {(lead.status === 'won' || lead.sale_value != null) && (
                  <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-[11px] space-y-1">
                    <p className="font-bold text-emerald-300 uppercase tracking-wider text-[10px]">
                      Conversion summary
                    </p>
                    <p className="text-on-surface">
                      Sale value:{' '}
                      <span className="font-mono">
                        {lead.sale_value != null
                          ? `$${Number(lead.sale_value).toLocaleString('en-US')}`
                          : '—'}
                      </span>
                      {' · '}
                      System:{' '}
                      <span className="font-mono">
                        {lead.sale_system_size_kw != null ? `${lead.sale_system_size_kw} kW` : '—'}
                      </span>
                    </p>
                    <p className="text-on-surface-variant">
                      Sales cycle:{' '}
                      {lead.created_at
                        ? `${Math.max(
                            0,
                            Math.round(
                              (new Date(lead.sale_closed_at || Date.now()) -
                                new Date(lead.created_at)) /
                                (1000 * 60 * 60 * 24),
                            ),
                          )} days`
                        : '—'}
                      {lead.sale_rep_name ? ` · Rep: ${lead.sale_rep_name}` : ''}
                      {lead.sale_financing ? ` · ${lead.sale_financing}` : ''}
                    </p>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'property' && (
          <div className="space-y-4">
            <LeadMapBlock
              mapContainerRef={mapContainerRef}
              mapReady={mapReady}
              mapError={mapError}
              lat={lat}
              lng={lng}
              heightClass="h-[300px] sm:h-[400px]"
            />
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-on-surface-variant">
                Build a sequence or send a one-off email. Opt-out and call outcomes stay available below.
              </p>
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
            </div>

            <EmailSequenceBuilder
              leadId={id}
              leadName={displayName}
              address={lead.address || ''}
              campaigns={dripCampaigns}
              enrollments={dripEnrollments}
              optOut={outreachOptOut}
              busy={busy}
              onSaved={async () => {
                await load();
              }}
              onEnrollExisting={async (campaignId) => {
                setEnrollCampaignId(campaignId);
                if (!campaignId) return;
                if (outreachOptOut) return alert('Lead opted out of outreach');
                setBusy('enroll');
                try {
                  await apiService.enrollLeadsInCampaign(campaignId, { leadIds: [Number(id)] });
                  await load();
                  alert('Enrolled in sequence');
                } catch (err) {
                  alert(err.message || 'Enrollment failed');
                } finally {
                  setBusy('');
                }
              }}
              onCancelEnrollment={handleCancelEnrollment}
            />

            <Card title="Send one-off email">
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
                  <textarea
                    className="w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface min-h-[100px]"
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
                    className="mt-3 w-full bg-white/10 text-on-surface py-2 rounded-lg font-bold disabled:opacity-50"
                  >
                    {busy === 'email' ? 'Sending...' : 'Send Email'}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    Connect your mailbox in Integrations to send from your inbox.
                  </p>
                  <Link
                    to="/integrations#email"
                    className="inline-flex w-full items-center justify-center bg-primary text-on-primary py-3 rounded-xl font-bold text-sm hover:brightness-110 mt-3"
                  >
                    Open Integrations
                  </Link>
                </>
              )}
            </Card>

            <Card title="Call outcome">
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <label className="flex-1 text-[10px] text-slate-400 uppercase tracking-wider">
                  Outcome
                  <select
                    value={callOutcome}
                    onChange={(e) => setCallOutcome(e.target.value)}
                    className="mt-1 w-full bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface text-xs"
                  >
                    <option value="">Select…</option>
                    {CALL_OUTCOMES.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={handleSaveCallOutcome}
                  disabled={busy === 'outcome' || !callOutcome}
                  className="bg-white/10 text-on-surface px-4 py-2 rounded-lg font-bold text-xs disabled:opacity-50"
                >
                  {busy === 'outcome' ? 'Saving…' : 'Save Outcome'}
                </button>
              </div>
              {lead.call_outcome && (
                <p className="text-[11px] text-emerald-300 mt-2">Last logged: {lead.call_outcome}</p>
              )}
            </Card>
          </div>
        )}

        {activeTab === 'followups' && (
          <LeadFollowUpsPanel
            lead={lead}
            followUpAt={followUpAt}
            nextAction={nextAction}
            onFollowUpAtChange={setFollowUpAt}
            onNextActionChange={setNextAction}
            onSave={handleSaveFollowUp}
            busy={busy === 'followup'}
            assigneeName={assigneeLabel}
          />
        )}

        {activeTab === 'appointments' && (
          !can('appointments') ? (
            <PlanUpgradeGate
              title="Appointments require Mission Control"
              message={`Upgrade from ${entitlements?.packageName || 'your current plan'} to schedule appointments.`}
              feature="appointments"
              packageName={entitlements?.packageName}
            />
          ) : (
          <div className="space-y-4">
            <Card title="Upcoming & past appointments">
              {leadAppointments.length === 0 ? (
                <p className="text-[11px] text-on-surface-variant">No appointments for this lead yet.</p>
              ) : (
                <div className="space-y-2">
                  {leadAppointments.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 rounded-xl border border-glass-stroke bg-white/[0.03] space-y-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-on-surface">{a.title}</p>
                          <p className="text-[11px] text-on-surface-variant">
                            {a.scheduled_at ? new Date(a.scheduled_at).toLocaleString() : '—'}
                            {a.location ? ` · ${a.location}` : ''}
                          </p>
                          <span
                            className={`inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                              a.status === 'cancelled'
                                ? 'text-red-300 border-red-500/30 bg-red-500/10'
                                : a.status === 'completed'
                                  ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                                  : 'text-primary border-primary/30 bg-primary/10'
                            }`}
                          >
                            {a.status || 'scheduled'}
                          </span>
                        </div>
                        {a.status !== 'cancelled' && (
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setRescheduleId(a.id);
                                setRescheduleAt(
                                  a.scheduled_at
                                    ? new Date(a.scheduled_at).toISOString().slice(0, 16)
                                    : '',
                                );
                              }}
                              className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white/10 text-on-surface"
                            >
                              Reschedule
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelAppt(a.id)}
                              className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-500/15 text-red-300"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                      {rescheduleId === a.id && (
                        <div className="flex flex-col sm:flex-row gap-2 sm:items-end pt-1">
                          <input
                            type="datetime-local"
                            value={rescheduleAt}
                            onChange={(e) => setRescheduleAt(e.target.value)}
                            className="flex-1 bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleRescheduleAppt(a.id)}
                            disabled={busy === 'reschedule'}
                            className="bg-primary text-on-primary px-3 py-2 rounded-lg text-xs font-bold"
                          >
                            Save
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Book Site Survey">
              <p className="text-[11px] text-on-surface-variant mb-3">
                Booking sets lead stage to Appointment (existing automation).
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="flex-1 w-full">
                  <label className="font-label-mono text-[9px] text-on-surface-variant uppercase">Date & time</label>
                  <input
                    type="datetime-local"
                    className="w-full mt-1 bg-surface-container-low border border-glass-stroke rounded-lg py-2 px-3 text-on-surface"
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
          </div>
          )
        )}

        {activeTab === 'proposal' && (
          !can('proposals') ? (
            <PlanUpgradeGate
              title="Proposal maker requires Pioneer or Mission Control"
              message={`Upgrade from ${entitlements?.packageName || 'your current plan'} to create and send solar proposals.`}
              feature="proposals"
              packageName={entitlements?.packageName}
            />
          ) : (
          <LeadProposalPanel
            lead={lead}
            leadId={id}
            displayName={displayName}
            phoneDisplay={phoneDisplay}
            emailDisplay={emailDisplay}
            proposalEngagement={proposalEngagement}
            proposalEvents={proposalEvents}
            onOpenPreview={() => setShowProposalModal(true)}
            onRefresh={() => load()}
          />
          )
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
            <div className="crm-panel p-5 lg:col-span-2 space-y-4">
              <div>
                <h3 className="text-base font-bold text-on-surface">Internal Notes</h3>
                <p className="text-[12px] text-on-surface-variant mt-0.5">
                  Add and manage notes visible only to your team.
                </p>
              </div>
              <div className="rounded-xl border border-glass-stroke bg-surface-container-low/40 p-3 space-y-3">
                <textarea
                  className="w-full bg-transparent border-0 text-on-surface min-h-[100px] text-sm focus:outline-none resize-y"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a new internal note..."
                />
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-glass-stroke">
                  <div className="flex gap-1 text-on-surface-variant">
                    <span className="material-symbols-outlined text-lg">format_size</span>
                    <span className="material-symbols-outlined text-lg">format_list_bulleted</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveNote}
                    disabled={busy === 'note'}
                    className="bg-primary text-on-primary px-4 py-2 rounded-lg font-bold text-xs"
                  >
                    {busy === 'note' ? 'Saving…' : 'Add Note'}
                  </button>
                </div>
              </div>
              <div className="space-y-0 divide-y divide-glass-stroke">
                {activities.filter((a) => a.type === 'note').length === 0 && (
                  <p className="text-[12px] text-on-surface-variant py-4">No notes yet.</p>
                )}
                {activities
                  .filter((a) => a.type === 'note')
                  .map((a) => (
                    <div key={a.id} className="py-4 flex gap-3">
                      <span className="w-9 h-9 rounded-full bg-primary text-on-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                        {(assigneeLabel || 'U').slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-on-surface">{assigneeLabel}</span>
                          <span className="text-[10px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10">
                            Internal Note
                          </span>
                          <span className="text-[10px] text-on-surface-variant ml-auto">
                            {new Date(a.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-on-surface whitespace-pre-wrap break-words">{a.content}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            <div className="crm-panel p-5 h-fit">
              <div className="flex gap-3 items-start">
                <span className="material-symbols-outlined text-on-surface-variant text-2xl">lock</span>
                <div>
                  <h4 className="text-sm font-bold text-on-surface">Internal Only</h4>
                  <p className="text-[12px] text-on-surface-variant leading-relaxed mt-1">
                    These notes are visible only to team members and won&apos;t be shared with the customer.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTab('followups')}
                className="mt-4 text-[12px] font-bold text-primary hover:underline"
              >
                Open Follow Ups →
              </button>
            </div>
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
              className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/15 text-on-surface font-bold py-2 px-3 rounded-lg text-xs disabled:opacity-50"
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
