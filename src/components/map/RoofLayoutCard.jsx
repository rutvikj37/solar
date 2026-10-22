import React, { useEffect, useState } from 'react';
import { API_BASE } from '../../config.js';
import { authHeaders } from '../../lib/auth.js';
import RoofLayoutOverlay from '../solar/RoofLayoutOverlay.jsx';

// Must match GET /api/properties/satellite-image (zoom 20, 640x360 logical px).
const IMAGE_FRAME = { zoom: 20, width: 640, height: 360 };

const STATUS_COPY = {
  not_configured: 'Roof layout needs a Google Solar API key on the server.',
  no_coverage: 'Google Solar has no roof model for this building yet.',
  budget_exhausted: 'Daily roof-analysis limit reached. Try again tomorrow.',
  unavailable: 'Roof analysis is temporarily unavailable.',
};

/** Satellite image with Google Solar roof segments + best-N panel layout drawn on top. */
export default function RoofLayoutCard({ lat, lng, defaultPanels = null }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [layout, setLayout] = useState(null);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [panelCount, setPanelCount] = useState(null);
  const [showSegments, setShowSegments] = useState(true);
  const [showPanels, setShowPanels] = useState(true);

  const latNum = Number(lat);
  const lngNum = Number(lng);
  const valid = Number.isFinite(latNum) && Number.isFinite(lngNum) && (latNum !== 0 || lngNum !== 0);

  useEffect(() => {
    if (!valid) {
      setStatus('unavailable');
      return undefined;
    }
    let cancelled = false;
    let objectUrl = null;
    setStatus('loading');
    setLayout(null);
    setImageSrc(null);
    const q = `lat=${encodeURIComponent(latNum)}&lng=${encodeURIComponent(lngNum)}`;
    (async () => {
      try {
        const [layoutRes, imageRes] = await Promise.all([
          fetch(`${API_BASE}/api/properties/roof-layout?${q}`, { headers: authHeaders() }),
          fetch(`${API_BASE}/api/properties/satellite-image?${q}`, { headers: authHeaders() }),
        ]);
        if (cancelled) return;
        const data = layoutRes.ok ? await layoutRes.json() : { status: 'unavailable' };
        if (imageRes.ok) {
          const blob = await imageRes.blob();
          if (!cancelled && blob.type.startsWith('image/') && blob.size > 0) {
            objectUrl = URL.createObjectURL(blob);
            setImageSrc(objectUrl);
          }
        }
        if (cancelled) return;
        if (data.status === 'ok' && data.layout) {
          setLayout(data.layout);
          const preferred = Number(defaultPanels) > 0 ? Number(defaultPanels) : data.layout.maxPanels;
          setPanelCount(Math.min(data.layout.maxPanels, preferred));
          setStatus('ok');
        } else {
          setStatus(data.status || 'unavailable');
          setMessage(data.message || '');
        }
      } catch {
        if (!cancelled) setStatus('unavailable');
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [valid, latNum, lngNum, defaultPanels]);

  const frame = valid ? { ...IMAGE_FRAME, centerLat: latNum, centerLng: lngNum } : null;
  const panelWatts = layout?.panelCapacityWatts || 400;
  const shownPanels = layout ? Math.min(layout.maxPanels, panelCount ?? layout.maxPanels) : 0;
  const shownKw = Math.round(((shownPanels * panelWatts) / 1000) * 10) / 10;
  const shownKwh = layout
    ? Math.round(layout.panels.slice(0, shownPanels).reduce((s, p) => s + (Number(p.yearlyEnergyDcKwh) || 0), 0))
    : 0;

  return (
    <div className="space-y-3 bg-white/5 glass-card rounded-xl p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-semibold">
          Roof layout
        </h4>
        {status === 'ok' && (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setShowSegments((v) => !v)}
              className={`rounded-md px-2 py-0.5 text-[9px] font-bold border ${
                showSegments ? 'border-primary/40 bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant'
              }`}
            >
              Segments
            </button>
            <button
              type="button"
              onClick={() => setShowPanels((v) => !v)}
              className={`rounded-md px-2 py-0.5 text-[9px] font-bold border ${
                showPanels ? 'border-primary/40 bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant'
              }`}
            >
              Panels
            </button>
          </div>
        )}
      </div>

      <div className="relative h-52 rounded-lg overflow-hidden bg-surface-container">
        {imageSrc ? (
          <img src={imageSrc} alt="Roof satellite view" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span
              className={`material-symbols-outlined text-3xl text-on-surface-variant ${status === 'loading' ? 'animate-spin' : ''}`}
            >
              {status === 'loading' ? 'progress_activity' : 'satellite_alt'}
            </span>
          </div>
        )}
        {status === 'ok' && imageSrc && (
          <RoofLayoutOverlay
            layout={layout}
            frame={frame}
            panelCount={shownPanels}
            showSegments={showSegments}
            showPanels={showPanels}
          />
        )}
      </div>

      {status === 'ok' && layout ? (
        <>
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-on-surface-variant">Panels shown</span>
              <span className="text-on-surface font-semibold">
                {shownPanels} of {layout.maxPanels} · {shownKw} kW · ~{shownKwh.toLocaleString()} kWh/yr DC
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={Math.max(1, layout.maxPanels)}
              value={shownPanels}
              onChange={(e) => setPanelCount(Number(e.target.value))}
              className="w-full accent-primary"
              aria-label="Number of panels"
            />
          </div>
          <div className="divide-y divide-glass-stroke/50 text-[11px] max-h-40 overflow-y-auto custom-scrollbar">
            {layout.segments
              .filter((s) => s.areaMeters2)
              .slice(0, 12)
              .map((s) => (
                <div key={s.index} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="flex items-center gap-2 text-on-surface-variant">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                    Segment {s.index + 1}: {s.facing || '—'}-facing, {s.pitchDegrees ?? '—'}° pitch
                  </span>
                  <span className="text-on-surface font-semibold shrink-0">
                    {s.sunshineHoursPerYear ? `${s.sunshineHoursPerYear.toLocaleString()} sun-hrs` : ''}
                  </span>
                </div>
              ))}
          </div>
          <p className="text-[10px] text-on-surface-variant">
            Google Solar model{layout.imageryDate ? ` · imagery ${formatImageryDate(layout.imageryDate)}` : ''}. Segment
            outlines are bounding boxes; panels are placed best-first.
          </p>
        </>
      ) : status !== 'loading' ? (
        <p className="text-[11px] text-on-surface-variant">{message || STATUS_COPY[status] || STATUS_COPY.unavailable}</p>
      ) : null}
    </div>
  );
}

function formatImageryDate(d) {
  if (!d || typeof d !== 'object') return '';
  return [d.month, d.day, d.year].filter(Boolean).join('/');
}
