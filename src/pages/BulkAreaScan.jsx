import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UpgradeModal from '../components/UpgradeModal';
import LocationSearchField from '../components/LocationSearchField.jsx';
import { API_BASE } from '../config.js';

export default function BulkAreaScan() {
  const [searchMode, setSearchMode] = useState('zip');
  const [zip, setZip] = useState('');
  const [areaQuery, setAreaQuery] = useState('');
  const [resolvedArea, setResolvedArea] = useState(null);
  const [scanError, setScanError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [radius, setRadius] = useState(5);
  const [homesToScan, setHomesToScan] = useState(15);
  const [useMinSqFt, setUseMinSqFt] = useState(false);
  const [minSqFt, setMinSqFt] = useState(1500);
  const [singleFamily, setSingleFamily] = useState(true);
  const [skipPaneled, setSkipPaneled] = useState(true);
  const [leadCredits, setLeadCredits] = useState(26);
  const [unlimitedCredits, setUnlimitedCredits] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('solar_token');
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchCredits = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setLeadCredits(data.credits);
          setUnlimitedCredits(
            !!data.unlimitedCredits ||
              ['admin', 'platform_admin', 'super_admin'].includes(data.user?.role)
          );
        }
      } catch (err) {
        console.error('Error fetching credits:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCredits();
  }, [navigate]);

  const creditCost = homesToScan;

  const handleStartScan = async (e) => {
    e.preventDefault();
    setScanError('');

    let scanZip = zip.trim();
    let lat = null;
    let lng = null;
    let areaLabel = '';

    if (searchMode === 'zip') {
      if (!/^\d{5}(-\d{4})?$/.test(scanZip)) {
        setScanError('Enter a valid 5-digit ZIP code.');
        return;
      }
      areaLabel = `ZIP ${scanZip}`;
    } else {
      if (!areaQuery.trim()) {
        setScanError('Search and select an area from the suggestions.');
        return;
      }
      if (!resolvedArea) {
        setScanError('Pick a location from the dropdown to confirm your search area.');
        return;
      }
      setSubmitting(true);
      try {
        const resolved = resolvedArea;
        setResolvedArea(resolved);
        lat = resolved.lat;
        lng = resolved.lng;
        scanZip = resolved.zip || '';
        areaLabel = resolved.shortLabel || areaQuery.trim();
      } catch (err) {
        setScanError(err.message || 'Could not find that area.');
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
    }

    if (!unlimitedCredits && leadCredits < creditCost) {
      setShowUpgradeModal(true);
      return;
    }

    navigate('/generate', {
      state: {
        fromBulkScan: true,
        zip: scanZip,
        lat,
        lng,
        areaLabel,
        radius,
        radiusUnit: 'miles',
        homesToScan,
        leadCreditCost: creditCost,
        minSqFt: useMinSqFt ? minSqFt : 0,
        singleFamily,
        skipPaneled,
      },
    });
  };

  const radiusHint =
    searchMode === 'zip'
      ? 'Homes within this distance of the ZIP center.'
      : 'Homes within this distance of the searched area center.';

  const targetSummary =
    searchMode === 'zip'
      ? zip.trim()
        ? `ZIP ${zip.trim()}`
        : 'ZIP not set'
      : resolvedArea?.shortLabel || areaQuery.trim() || 'Area not set';

  const targetReady =
    searchMode === 'zip' ? /^\d{5}/.test(zip.trim()) : Boolean(resolvedArea || areaQuery.trim().length >= 3);

  return (
    <>
      <div className="mb-stack-lg">
        <h2 className="font-headline-lg text-2xl md:text-headline-lg font-bold text-primary">Bulk Area Scan</h2>
        <p className="text-on-surface-variant text-sm mt-1">
          Scan by ZIP code or search any city, neighborhood, or address — then unlock multiple solar prospects at once.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <div className="lg:col-span-7 glass-card p-6 md:p-8 rounded-xl relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/10 blur-3xl rounded-full"></div>

          <form onSubmit={handleStartScan} className="space-y-6 text-xs">
            <h3 className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-widest font-semibold mb-4">
              Scan Parameters
            </h3>

            <LocationSearchField
              mode={searchMode}
              onModeChange={(next) => {
                setSearchMode(next);
                setScanError('');
                setResolvedArea(null);
              }}
              zip={zip}
              onZipChange={setZip}
              areaQuery={areaQuery}
              onAreaQueryChange={setAreaQuery}
              resolvedArea={resolvedArea}
              onAreaResolved={setResolvedArea}
              radius={radius}
              onRadiusChange={setRadius}
              radiusHint={radiusHint}
            />

            {scanError && (
              <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {scanError}
              </p>
            )}

            <div className="space-y-2">
              <div className="flex justify-between items-center text-[11px] text-on-surface-variant font-medium">
                <label htmlFor="homesToScan">Homes to scan</label>
                <span className="text-primary font-bold">{homesToScan}</span>
              </div>
              <input
                id="homesToScan"
                type="range"
                min="1"
                max="50"
                step="1"
                value={homesToScan}
                onChange={(e) => setHomesToScan(Number(e.target.value))}
                className="w-full accent-primary h-1 rounded-lg appearance-none cursor-pointer bg-surface-container-high"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-[11px] text-on-surface-variant font-medium">
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    id="toggleMinSqFt"
                    checked={useMinSqFt}
                    onChange={(e) => setUseMinSqFt(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-glass-stroke bg-surface-container-low text-primary focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="toggleMinSqFt" className="cursor-pointer">
                    Filter by Min Roof Area
                  </label>
                </div>
                <span className="text-primary font-bold">
                  {useMinSqFt ? `${minSqFt} sq ft` : 'Any Size (Default)'}
                </span>
              </div>
              <input
                type="range"
                min="1000"
                max="10000"
                step="500"
                disabled={!useMinSqFt}
                value={minSqFt}
                onChange={(e) => setMinSqFt(Number(e.target.value))}
                className={`w-full accent-primary h-1 rounded-lg appearance-none mt-2 ${
                  useMinSqFt
                    ? 'cursor-pointer bg-surface-container-high'
                    : 'cursor-not-allowed opacity-30 bg-surface-container-highest'
                }`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 p-3 bg-surface/30 rounded-xl border border-glass-stroke cursor-pointer">
                <input
                  type="checkbox"
                  checked={singleFamily}
                  onChange={(e) => setSingleFamily(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-glass-stroke bg-surface-container-low text-primary focus:ring-0"
                />
                <span className="text-white text-[11px] font-semibold">Single-family only</span>
              </label>
              <label className="flex items-center gap-2 p-3 bg-surface/30 rounded-xl border border-glass-stroke cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipPaneled}
                  onChange={(e) => setSkipPaneled(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-glass-stroke bg-surface-container-low text-primary focus:ring-0"
                />
                <span className="text-white text-[11px] font-semibold">Skip paneled homes</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-on-primary font-bold py-3 rounded-lg mt-4 hover:brightness-110 active:scale-[0.98] transition-all text-xs disabled:opacity-50"
            >
              {submitting ? 'Locating area…' : 'Initiate Bulk Area Scan'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-stack-md">
          <div className="glass-card p-6 rounded-xl space-y-4">
            <h4 className="font-label-mono text-[10px] text-on-surface-variant uppercase tracking-widest font-semibold">
              Scan Cost Calculator
            </h4>

            <div className="flex justify-between items-baseline py-2 border-b border-glass-stroke/50">
              <span className="text-xs text-on-surface-variant">Homes to scan</span>
              <span className="text-sm font-semibold text-white">up to {homesToScan}</span>
            </div>

            <div className="flex justify-between items-baseline py-2 border-b border-glass-stroke/50">
              <span className="text-xs text-on-surface-variant">Target</span>
              <span
                className={`text-sm font-semibold text-right max-w-[60%] truncate flex items-center gap-1 justify-end ${
                  targetReady ? 'text-white' : 'text-on-surface-variant'
                }`}
                title={targetSummary}
              >
                {targetReady && (
                  <span className="material-symbols-outlined text-green-400 text-sm shrink-0">check_circle</span>
                )}
                {targetSummary}
              </span>
            </div>

            <div className="flex justify-between items-baseline py-2 border-b border-glass-stroke/50">
              <span className="text-xs text-on-surface-variant">Radius</span>
              <span className="text-sm font-semibold text-white">
                {radius} mile{radius === 1 ? '' : 's'}
              </span>
            </div>

            <div className="flex justify-between items-baseline py-2 border-b border-glass-stroke/50">
              <span className="text-xs text-on-surface-variant">Credit Cost per Lead Row</span>
              <span className="text-sm font-semibold text-white">1 Credit</span>
            </div>

            <div className="flex justify-between items-baseline py-2 border-b border-glass-stroke/50">
              <span className="text-xs text-on-surface-variant font-bold">Estimated Credits required</span>
              <span className="text-base font-bold text-primary">{creditCost} Credits</span>
            </div>

            <div className="p-3 bg-secondary/5 rounded-lg border border-secondary/20 flex gap-3 text-xs leading-normal mt-2">
              <span className="material-symbols-outlined text-secondary text-base">info</span>
              <div>
                <p className="text-white font-bold">Balance status</p>
                <p className="text-on-surface-variant text-[11px] mt-0.5">
                  {unlimitedCredits ? (
                    'Admin account — scans run with unlimited credits (no package required).'
                  ) : (
                    <>
                      You have{' '}
                      <span className="text-primary font-bold">
                        {loading ? '...' : `${leadCredits} credits`}
                      </span>{' '}
                      remaining. Scan requires up to {creditCost} credits.
                    </>
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/billing#plans')}
              className="w-full border border-secondary text-secondary hover:bg-secondary/10 font-bold py-2 rounded-lg transition-all text-xs"
            >
              Buy Lead Credits
            </button>
          </div>

          <div className="glass-card p-6 rounded-xl bg-gradient-to-br from-primary/5 to-transparent flex flex-col justify-center text-center">
            <span className="material-symbols-outlined text-primary text-[28px] opacity-40 mb-2">auto_awesome</span>
            <p className="font-button text-xs text-white font-semibold mb-1">CRM Direct Syncing</p>
            <p className="text-[10px] text-on-surface-variant leading-relaxed max-w-[240px] mx-auto">
              Any scan outputs can be synced automatically to Salesforce or HubSpot instantly after extraction.
            </p>
          </div>
        </div>
      </div>
      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        credits={leadCredits}
        message={`Bulk scan requires at least ${creditCost} credits. Subscribe to a monthly plan for more lead credits.`}
      />
    </>
  );
}
