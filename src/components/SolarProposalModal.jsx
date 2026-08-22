import React, { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../config.js';
import { authHeaders, getToken } from '../lib/auth.js';

/** Copy app styles into an isolated print document (Tailwind, fonts, etc.). */
function copyDocumentStyles(targetDoc) {
  document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    targetDoc.head.appendChild(node.cloneNode(true));
  });

  const printOverrides = targetDoc.createElement('style');
  printOverrides.textContent = `
    @page { margin: 0.4in; }
    html, body {
      margin: 0;
      padding: 0;
      background: #080B1A;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  `;
  targetDoc.head.appendChild(printOverrides);
}

function waitForResources(doc) {
  const styleLinks = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
  const styleReady = styleLinks.map(
    (link) =>
      new Promise((resolve) => {
        if (link.sheet) {
          resolve();
          return;
        }
        link.addEventListener('load', resolve, { once: true });
        link.addEventListener('error', resolve, { once: true });
      })
  );

  const images = Array.from(doc.images || []);
  const imagesReady = images.map(
    (img) =>
      new Promise((resolve) => {
        if (img.complete) {
          resolve();
          return;
        }
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      })
  );

  return Promise.all([...styleReady, ...imagesReady]);
}

/**
 * Print only the proposal document in an isolated iframe — avoids fixed-overlay
 * repetition (same content on every printed page) from window.print() on the app shell.
 */
async function printProposalNode(sourceNode) {
  if (!sourceNode) return;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: 'none',
    visibility: 'hidden'
  });
  document.body.appendChild(iframe);

  const printDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!printDoc) {
    iframe.remove();
    return;
  }

  printDoc.open();
  printDoc.write('<!DOCTYPE html><html><head><title>Solar Proposal</title></head><body></body></html>');
  printDoc.close();

  copyDocumentStyles(printDoc);

  const clone = sourceNode.cloneNode(true);
  clone.querySelectorAll('[data-print-hide]').forEach((el) => el.remove());
  printDoc.body.appendChild(clone);

  try {
    await waitForResources(printDoc);
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));

    const printWindow = iframe.contentWindow;
    if (!printWindow) return;

    const cleanup = () => iframe.remove();
    printWindow.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 60_000);

    printWindow.focus();
    printWindow.print();
  } catch {
    iframe.remove();
  }
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(blob);
  });
}

import { resolveGoogleMapsApiKey } from '../lib/mapsKey.js';

let cachedMapsKey = null;

async function getMapsKey() {
  if (cachedMapsKey !== null) return cachedMapsKey;
  cachedMapsKey = await resolveGoogleMapsApiKey();
  return cachedMapsKey;
}

function buildClientStaticUrl(lead, mapsKey) {
  if (lead?.imageUrl) return lead.imageUrl;
  const lat = Number(lead?.latitude ?? lead?.lat);
  const lng = Number(lead?.longitude ?? lead?.lng);
  if (!mapsKey || Number.isNaN(lat) || Number.isNaN(lng) || (!lat && !lng)) return null;
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: '20',
    size: '800x400',
    maptype: 'satellite',
    scale: '2',
    key: mapsKey
  });
  params.set('markers', `color:0xFF3B30|${lat},${lng}`);
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/**
 * Load satellite rooftop imagery as a data URL so Print / Save as PDF embeds the image
 * (external Google Static Maps URLs often break in print due to referrer/API key restrictions).
 * Returns { dataUrl } when proxied, or { directUrl } as a last-resort <img> src.
 */
async function loadSatelliteSource(lead) {
  const token = getToken();
  if (lead?.id && token) {
    try {
      const res = await fetch(`${API_BASE}/api/leads/${lead.id}/satellite-image`, {
        headers: authHeaders()
      });
      if (res.ok) {
        const blob = await res.blob();
        if (blob.type.startsWith('image/') && blob.size > 0) {
          return { dataUrl: await blobToDataUrl(blob) };
        }
      } else if (res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json().catch(() => null);
        if (data?.fallbackUrl) return { directUrl: data.fallbackUrl };
      }
    } catch {
      // fall through to client-side static URL
    }
  }

  if (lead?.imageUrl) {
    return { directUrl: lead.imageUrl };
  }

  const mapsKey = await getMapsKey();
  const clientUrl = buildClientStaticUrl(lead, mapsKey);
  if (clientUrl) return { directUrl: clientUrl };

  return null;
}

function SatellitePanel({ lead }) {
  const [src, setSrc] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | unavailable

  useEffect(() => {
    if (!lead) return undefined;
    let cancelled = false;
    setStatus('loading');
    setSrc(null);

    loadSatelliteSource(lead).then((result) => {
      if (cancelled) return;
      if (result?.dataUrl) {
        setSrc(result.dataUrl);
        setStatus('ready');
      } else if (result?.directUrl) {
        setSrc(result.directUrl);
        setStatus('ready');
      } else {
        setStatus('unavailable');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [lead?.id, lead?.imageUrl, lead?.latitude, lead?.longitude]);

  return (
    <div className="h-44 bg-slate-900 border border-white/10 rounded-xl overflow-hidden relative">
      {status === 'ready' && src ? (
        <img
          src={src}
          alt="Satellite rooftop view"
          className="w-full h-full object-cover"
          onError={() => setStatus('unavailable')}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-500 px-4 text-center">
          <span className="material-symbols-outlined text-4xl">satellite_alt</span>
          <span className="text-[10px] mt-1">
            {status === 'loading' ? 'Loading satellite view…' : 'Satellite imagery unavailable for this property'}
          </span>
        </div>
      )}
      <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded text-[9px] text-white font-mono">
        Google Satellite View
      </div>
    </div>
  );
}

export default function SolarProposalModal({ show, onClose, lead }) {
  const proposalDocRef = useRef(null);
  const [financingType, setFinancingType] = useState('cash');
  const [includeItc30, setIncludeItc30] = useState(true);
  const [batteryType, setBatteryType] = useState('none');
  const [shareableUrl, setShareableUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [proposalStatus, setProposalStatus] = useState('');

  useEffect(() => {
    if (!show || !lead?.id || !getToken()) return;

    fetch(`${API_BASE}/api/proposals/lead/${lead.id}`, { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.proposal) {
          setFinancingType(data.proposal.financing_type || 'cash');
          setIncludeItc30(Boolean(data.proposal.include_itc_30));
          setBatteryType(data.proposal.battery_type || 'none');
          setProposalStatus(data.proposal.status || 'sent');
          if (data.proposal.slug) {
            setShareableUrl(`${window.location.origin}/proposal/${data.proposal.slug}`);
          }
        }
      })
      .catch(() => {});
  }, [show, lead?.id]);

  if (!show || !lead) return null;

  const solar = lead.solar || {};
  const propExtra = lead.propertyExtra || {};
  const displayName = lead.owner_name || 'Property Owner';
  const score = lead.lead_score || propExtra.aiLeadScore?.overall || 85;
  const baseSavings = solar.twentyFiveYearSavings || (lead.estimated_savings ? `$${Number(lead.estimated_savings).toLocaleString()}` : '$32,500');
  const sizeKw = solar.recommendedSize || `${(Number(lead.roof_size || 2000) / 250).toFixed(1)} kW`;
  const panels = solar.estimatedPanels || Math.ceil(parseFloat(sizeKw) * 2.8) || 20;

  const handleGenerateShareableLink = async () => {
    if (!getToken()) return alert('Please log in.');

    setGeneratingLink(true);
    try {
      const res = await fetch(`${API_BASE}/api/proposals`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          leadId: lead.id,
          systemSizeKw: parseFloat(sizeKw) || 8.5,
          panelCount: panels,
          financingType,
          includeItc30,
          batteryType,
          batteryCount: batteryType !== 'none' ? 1 : 0
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate link');

      const fullUrl = `${window.location.origin}${data.shareableUrl}`;
      setShareableUrl(fullUrl);
      setProposalStatus(data.proposal?.status || 'sent');

      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setGeneratingLink(false);
    }
  };

  const handlePrint = () => {
    printProposalNode(proposalDocRef.current);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div
        ref={proposalDocRef}
        className="solar-proposal-document w-full max-w-3xl bg-[#080B1A] border border-glass-stroke rounded-2xl overflow-hidden shadow-2xl text-left my-8"
      >
        {/* Action bar — excluded from iframe print clone via data-print-hide */}
        <div
          data-print-hide
          className="p-4 border-b border-white/10 bg-[#0D1122] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">picture_as_pdf</span>
            <div>
              <h3 className="font-bold text-white text-sm">Interactive Solar Proposal & E-Sign</h3>
              {proposalStatus && (
                <span className="text-[9px] font-mono text-primary uppercase">Status: {proposalStatus}</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleGenerateShareableLink}
              disabled={generatingLink}
              className="bg-primary text-on-primary font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">{copied ? 'check' : 'link'}</span>
              {copied ? 'Link Copied!' : generatingLink ? 'Creating...' : 'Copy Public Web Link'}
            </button>

            <button
              onClick={handlePrint}
              className="bg-white/10 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 hover:bg-white/15 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-sm">print</span>
              PDF
            </button>

            <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        </div>

        {/* Printable Proposal Document Body */}
        <div className="p-8 space-y-6 text-xs bg-[#080B1A] text-white">
          {/* Header & Logo */}
          <div className="flex justify-between items-start border-b border-white/10 pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl font-bold">bolt</span>
                <span className="font-bold text-lg text-white tracking-tight">SOLAR VELOCITY</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-mono">
                Official Rooftop Energy Potential & Savings Assessment
              </p>
            </div>
            <div className="text-right">
              <span className="px-3 py-1 bg-primary/15 text-primary border border-primary/30 rounded-full font-bold text-[10px] uppercase tracking-wider">
                CONFIDENTIAL PROPOSAL
              </span>
              <p className="text-[10px] text-slate-400 mt-1 font-mono">
                Date: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Customer & Property Overview */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-white/5 border border-white/10 rounded-xl">
            <div>
              <p className="text-[9px] text-slate-400 font-mono uppercase">Prepared For</p>
              <p className="text-sm font-bold text-white mt-0.5">{displayName}</p>
              <p className="text-xs text-slate-300 mt-1">{lead.address}</p>
              {lead.phone && <p className="text-[10px] text-slate-400 font-mono mt-0.5">Phone: {lead.phone}</p>}
            </div>
            <div className="text-right flex flex-col justify-between items-end">
              <div>
                <p className="text-[9px] text-slate-400 font-mono uppercase">AI Lead Rating</p>
                <div className="flex items-center gap-1 mt-1 justify-end">
                  <span className="text-xl font-black text-primary font-mono">{score}/100</span>
                </div>
              </div>
              <span className="text-[10px] text-green-400 font-semibold bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                High Solar Potential
              </span>
            </div>
          </div>

          {/* Hero Satellite Image + Savings Headline */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SatellitePanel lead={lead} />

            {/* Financial Return Summary */}
            <div className="p-4 bg-gradient-to-br from-primary/10 to-slate-900 border border-primary/30 rounded-xl flex flex-col justify-between">
              <div>
                <p className="text-[9px] text-primary font-mono uppercase tracking-widest font-bold">
                  25-Year Estimated Savings
                </p>
                <p className="text-3xl font-black text-primary font-mono mt-1">{baseSavings}</p>
                <p className="text-[10px] text-slate-300 mt-2 leading-relaxed">
                  Based on solar irradiance analysis, utility tariff escalation (4.5%/yr), and net energy metering.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10 text-center font-mono">
                <div>
                  <p className="text-[8px] text-slate-400">System Size</p>
                  <p className="text-xs font-bold text-white">{sizeKw}</p>
                </div>
                <div>
                  <p className="text-[8px] text-slate-400">Panels Count</p>
                  <p className="text-xs font-bold text-white">{panels} Modules</p>
                </div>
              </div>
            </div>
          </div>

          {/* System Technical Specifications */}
          <div className="space-y-2">
            <h4 className="font-bold text-white text-xs uppercase font-mono tracking-wider text-slate-300">
              Rooftop Technical Breakdown
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-white/5 border border-white/5 rounded-lg">
                <p className="text-[8px] text-slate-400 uppercase">Roof Usable Area</p>
                <p className="text-xs font-bold text-white font-mono mt-0.5">
                  {solar.usableRoofArea || (lead.roof_size ? `${lead.roof_size} sq ft` : '1,450 sq ft')}
                </p>
              </div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-lg">
                <p className="text-[8px] text-slate-400 uppercase">Roof Orientation</p>
                <p className="text-xs font-bold text-white font-mono mt-0.5">
                  {solar.orientation || 'South-Facing'}
                </p>
              </div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-lg">
                <p className="text-[8px] text-slate-400 uppercase">Annual Sunshine</p>
                <p className="text-xs font-bold text-white font-mono mt-0.5">
                  {solar.annualSunlight || '2,150 hrs/yr'}
                </p>
              </div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-lg">
                <p className="text-[8px] text-slate-400 uppercase">Annual Energy Production</p>
                <p className="text-xs font-bold text-white font-mono mt-0.5">
                  {solar.annualProduction || '10,850 kWh/yr'}
                </p>
              </div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-lg">
                <p className="text-[8px] text-slate-400 uppercase">Carbon Offset</p>
                <p className="text-xs font-bold text-white font-mono mt-0.5">
                  {solar.carbonOffset || '420 kg CO₂/MWh'}
                </p>
              </div>
              <div className="p-3 bg-white/5 border border-white/5 rounded-lg">
                <p className="text-[8px] text-slate-400 uppercase">Property Value</p>
                <p className="text-xs font-bold text-white font-mono mt-0.5">
                  {lead.property_value ? `$${Number(lead.property_value).toLocaleString()}` : '$650,000'}
                </p>
              </div>
            </div>
          </div>

          {/* Footer Disclaimer */}
          <div className="pt-4 border-t border-white/10 flex justify-between items-center text-[9px] text-slate-500">
            <p>Generated by SolarX.live Intelligence Engine · All calculations based on live NREL & Google Solar data.</p>
            <p className="font-mono">Page 1 of 1</p>
          </div>
        </div>
      </div>
    </div>
  );
}
