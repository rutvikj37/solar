import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../../config.js';
import { authHeaders } from '../../lib/auth.js';

function LockedValue() {
  return (
    <span className="inline-flex items-center gap-1 text-slate-500 font-semibold">
      <span className="material-symbols-outlined text-sm">lock</span>
      Unlock to view
    </span>
  );
}

function displayValue(value, fallback = 'Not Available') {
  if (value === null || value === undefined || value === '') return fallback;
  const str = String(value).trim();
  if (!str || str === 'N/A' || str === 'undefined' || str === 'null') return fallback;
  return str;
}

function FieldValue({ unlocked, value, fallback = 'Not Available' }) {
  if (!unlocked) return <LockedValue />;
  return displayValue(value, fallback);
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

function PropertySatelliteHeader({ property }) {
  const [src, setSrc] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | unavailable

  useEffect(() => {
    if (!property) return undefined;
    let cancelled = false;
    setStatus('loading');
    setSrc(null);

    const lat = Number(property.lat);
    const lng = Number(property.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng) || (!lat && !lng)) {
      setStatus('unavailable');
      return undefined;
    }

    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/properties/satellite-image?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
          { headers: authHeaders() }
        );
        if (cancelled) return;
        if (res.ok) {
          const blob = await res.blob();
          if (blob.type.startsWith('image/') && blob.size > 0) {
            setSrc(URL.createObjectURL(blob));
            setStatus('ready');
            return;
          }
        }
        setStatus('unavailable');
      } catch {
        if (!cancelled) setStatus('unavailable');
      }
    })();

    return () => {
      cancelled = true;
      setSrc((prev) => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [property?.id, property?.lat, property?.lng]);

  if (status === 'ready' && src) {
    return (
      <img
        className="w-full h-full object-cover"
        alt="Property satellite"
        src={src}
        onError={() => setStatus('unavailable')}
      />
    );
  }

  if (status === 'loading') {
    return (
      <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col items-center justify-center gap-2">
        <span className="material-symbols-outlined text-3xl text-primary animate-spin">progress_activity</span>
        <span className="text-[10px] text-slate-500">Loading satellite…</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
      <span className="material-symbols-outlined text-4xl text-slate-600">satellite_alt</span>
    </div>
  );
}

export default function PropertyDrawer({
  selectedProperty,
  onClose,
  googleMapsKey,
  activeTab,
  setActiveTab,
  generatedLeadStatus,
  handleGenerateLead,
  unlimitedCredits,
  leadCredits
}) {
  const [displayProperty, setDisplayProperty] = useState(selectedProperty);
  const [open, setOpen] = useState(Boolean(selectedProperty));

  useEffect(() => {
    if (selectedProperty) {
      setDisplayProperty(selectedProperty);
      const id = requestAnimationFrame(() => setOpen(true));
      return () => cancelAnimationFrame(id);
    }
    setOpen(false);
    const timer = setTimeout(() => setDisplayProperty(null), 280);
    return () => clearTimeout(timer);
  }, [selectedProperty]);

  if (!displayProperty) return null;

  const unlocked = displayProperty.unlocked === true;

  return (
    <div
      className={`absolute top-0 right-0 lg:right-[276px] h-full w-full sm:w-[440px] z-[45] bg-surface-elevated/98 border-l border-glass-stroke shadow-2xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] transform will-change-transform ${
        open ? 'translate-x-0' : 'translate-x-full pointer-events-none'
      }`}
    >
      {displayProperty._loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-background/60 hover:bg-white/10 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
          <span className="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
          <p className="text-sm text-on-surface-variant font-semibold">Scanning property...</p>
        </div>
      ) : (
        <>
          {/* Header Image & Close button */}
          <div className="h-36 relative bg-surface-container overflow-hidden">
            <PropertySatelliteHeader property={displayProperty} />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1C2433] via-transparent to-transparent"></div>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 bg-background/60 hover:bg-white/10 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
            <div className="absolute bottom-3 left-4 right-14">
              <h3 className="font-headline-md text-base font-bold text-white leading-tight">
                {displayValue(displayProperty.address?.split?.(',')?.[0], 'Unknown address')}
              </h3>
              <p className="text-[10px] text-on-surface-variant mt-0.5">
                {displayValue(displayProperty.address?.split?.(',')?.slice(1).join(','), '')}
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
            {/* OVERVIEW */}
            {activeTab === 'Overview' && (
              <div className="space-y-4">
                <div className="glass-card p-4 rounded-xl border-l-4 border-l-primary space-y-3 bg-white/5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-label-mono text-primary font-bold uppercase tracking-wider">
                      Quick Summary
                    </span>
                    <span className="text-yellow-500 font-semibold flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span
                          key={i}
                          className={`material-symbols-outlined text-xs ${
                            i < starCountFromScore(displayProperty.aiLeadScore?.overall || displayProperty.solarScore)
                              ? 'text-yellow-500'
                              : 'text-white/15'
                          }`}
                          style={
                            i < starCountFromScore(displayProperty.aiLeadScore?.overall || displayProperty.solarScore)
                              ? { fontVariationSettings: "'FILL' 1" }
                              : undefined
                          }
                        >
                          star
                        </span>
                      ))}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[9px] text-on-surface-variant uppercase font-label-mono">Solar Score</p>
                      <p className="text-sm font-bold text-white">
                        {displayValue(displayProperty.solarScore, '0')}/100
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] text-on-surface-variant uppercase font-label-mono">Estimated System</p>
                      <p className="text-sm font-bold text-white">
                        {displayValue(displayProperty.solar?.recommendedSize)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] text-on-surface-variant uppercase font-label-mono">Estimated Savings</p>
                      <p className="text-sm font-bold text-primary">
                        {displayValue(displayProperty.solar?.twentyFiveYearSavings)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] text-on-surface-variant uppercase font-label-mono">Property Value</p>
                      <p className="text-sm font-bold text-white">
                        <FieldValue unlocked={unlocked} value={displayProperty.propertyData?.propertyValue} />
                      </p>
                    </div>
                  </div>
                </div>

                <div className="glass-card p-4 rounded-xl space-y-3 bg-white/5">
                  <h4 className="font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-semibold">
                    AI Lead Score Analysis
                  </h4>
                  <div className="flex items-center gap-4">
                    <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
                      <svg className="w-full h-full -rotate-90">
                        <circle
                          className="text-white/5"
                          cx="28"
                          cy="28"
                          fill="transparent"
                          r="24"
                          stroke="currentColor"
                          strokeWidth="3"
                        />
                        <circle
                          className="text-primary"
                          cx="28"
                          cy="28"
                          fill="transparent"
                          r="24"
                          stroke="currentColor"
                          strokeDasharray="150.8"
                          strokeDashoffset={
                            150.8 - ((displayProperty.aiLeadScore?.overall || 0) / 100) * 150.8
                          }
                          strokeWidth="3"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center font-bold text-white font-mono text-sm">
                        {displayValue(displayProperty.aiLeadScore?.overall, '0')}
                      </div>
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-white font-bold">
                        {displayValue(displayProperty.aiLeadScore?.label, 'Score Pending')}
                      </p>
                      <p className="text-[10px] text-on-surface-variant">
                        {displayValue(
                          displayProperty.aiLeadScore?.summary,
                          'Lead score is calculated from live solar, property, and contact enrichment.'
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SOLAR */}
            {activeTab === 'Solar' && (
              <div className="space-y-4">
                <div className="bg-white/5 glass-card rounded-xl p-4 space-y-1">
                  <h4 className="font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-semibold mb-2">
                    Solar Potential Specs
                  </h4>
                  <div className="divide-y divide-glass-stroke/50 text-[11px]">
                    <div className="flex justify-between py-2">
                      <span className="text-on-surface-variant">Roof Outline</span>
                      <span className="text-white font-semibold">
                        {displayValue(displayProperty.solar?.roofOutline)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-on-surface-variant">Total Roof Area</span>
                      <span className="text-white font-semibold">
                        {displayValue(displayProperty.solar?.totalRoofArea)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-on-surface-variant">Usable Roof Area</span>
                      <span className="text-white font-semibold">
                        {displayValue(displayProperty.solar?.usableRoofArea)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-on-surface-variant">Roof Orientation</span>
                      <span className="text-white font-semibold">
                        {displayValue(displayProperty.solar?.orientation)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-on-surface-variant">Roof Pitch</span>
                      <span className="text-white font-semibold">
                        {displayValue(displayProperty.solar?.pitch)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-on-surface-variant">Annual Sunlight</span>
                      <span className="text-white font-semibold">
                        {displayValue(displayProperty.solar?.annualSunlight)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-on-surface-variant">Estimated Panels</span>
                      <span className="text-white font-semibold">
                        {displayValue(displayProperty.solar?.estimatedPanels, '0')} Panels
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PROPERTY */}
            {activeTab === 'Property' && (
              <div className="space-y-3 bg-white/5 glass-card rounded-xl p-4">
                <h4 className="font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-semibold mb-2">
                  Property Records
                </h4>
                <div className="divide-y divide-glass-stroke/50 text-[11px]">
                  <div className="flex justify-between py-2">
                    <span className="text-on-surface-variant">Owner Name</span>
                    <span className="text-white font-semibold">
                      <FieldValue unlocked={unlocked} value={displayProperty.propertyData?.ownerName} />
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-on-surface-variant">Owner Occupied</span>
                    <span className="text-white font-semibold">
                      <FieldValue unlocked={unlocked} value={displayProperty.propertyData?.ownerOccupied} />
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-on-surface-variant">Property Type</span>
                    <span className="text-white font-semibold">{displayValue(displayProperty.propertyType)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-on-surface-variant">Year Built</span>
                    <span className="text-white font-semibold">{displayValue(displayProperty.yearBuilt)}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-on-surface-variant">Property Value</span>
                    <span className="text-white font-semibold">
                      <FieldValue unlocked={unlocked} value={displayProperty.propertyData?.propertyValue} />
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* CONTACT */}
            {activeTab === 'Contact' && (
              <div className="space-y-3 bg-white/5 glass-card rounded-xl p-4">
                <h4 className="font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest font-semibold mb-2">
                  Owner Contacts
                </h4>
                {!unlocked ? (
                  <div className="py-6 flex flex-col items-center text-center gap-2">
                    <span className="material-symbols-outlined text-3xl text-slate-500">lock</span>
                    <p className="text-sm font-bold text-white">Owner contact is locked</p>
                    <p className="text-[11px] text-on-surface-variant max-w-[260px]">
                      Unlock this lead to reveal phone, email, and owner records. Solar preview stays free.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-glass-stroke/50 text-[11px]">
                    <div className="flex justify-between py-2">
                      <span className="text-on-surface-variant">Phone</span>
                      <span className="text-white font-semibold font-mono">
                        {displayValue(displayProperty.contact?.phone)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-on-surface-variant">Email</span>
                      <span className="text-white font-semibold">
                        {displayValue(displayProperty.contact?.email)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action CTA */}
          <div className="p-4 border-t border-glass-stroke bg-white/5 space-y-2">
            <button
              onClick={handleGenerateLead}
              disabled={generatedLeadStatus === 'generating' || generatedLeadStatus === 'generated'}
              className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg ${
                generatedLeadStatus === 'generated'
                  ? 'bg-green-500 text-white'
                  : 'bg-primary text-on-primary hover:brightness-110'
              }`}
            >
              {generatedLeadStatus === 'generating' ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                  Unlocking Lead...
                </>
              ) : generatedLeadStatus === 'generated' ? (
                <>
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Lead Saved To Dashboard!
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">bolt</span>
                  Unlock Full Lead ({unlimitedCredits ? '0 credits' : '1 credit'})
                </>
              )}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/marketplace"
                className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-wider text-slate-200 hover:bg-white/10 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">gavel</span>
                Marketplace bids
              </Link>
              <Link
                to={
                  unlocked && displayProperty.leadId
                    ? `/lead/${displayProperty.leadId}?proposal=1`
                    : '/my-leads'
                }
                className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-white/10 bg-white/5 text-[10px] font-bold uppercase tracking-wider text-slate-200 hover:bg-white/10 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">description</span>
                {unlocked ? 'Create quotation' : 'My leads'}
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
