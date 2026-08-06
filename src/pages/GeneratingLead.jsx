import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { API_BASE } from '../config.js';
import { formatLeadGeneratedAt } from '../lib/formatDate.js';

export default function GeneratingLead() {
  const [progress, setProgress] = useState(38);
  const [step, setStep] = useState(1);
  const [step1Progress, setStep1Progress] = useState(75);
  const [step2Progress, setStep2Progress] = useState(0);
  const [step3Progress, setStep3Progress] = useState(0);
  const [error, setError] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [createdLeads, setCreatedLeads] = useState([]);

  const navigate = useNavigate();
  const location = useLocation();
  const apiCompletedRef = useRef(false);
  const apiErrorRef = useRef(null);

  const state = location.state || {};
  const {
    zip,
    lat,
    lng,
    radius,
    radiusUnit,
    minSqFt,
    intentLevel,
    leadCreditCost,
    homesToScan,
    singleFamily,
    skipPaneled,
    minSavings
  } = state || {};

  useEffect(() => {
    const token = localStorage.getItem('solar_token');
    if (!token) {
      navigate('/login');
      return;
    }

    const runBulkScan = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/leads/bulk-scan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            zip,
            lat,
            lng,
            radius,
            radiusUnit: radiusUnit || (lat && lng ? 'meters' : 'miles'),
            minSqFt,
            intentLevel,
            leadCreditCost: homesToScan || leadCreditCost,
            homesToScan: homesToScan || leadCreditCost,
            singleFamily,
            skipPaneled,
            minSavings
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Bulk scan execution failed');
        }

        const data = await response.json();
        setScanResult(data);
        setCreatedLeads(Array.isArray(data.leads) ? data.leads : []);
        apiCompletedRef.current = true;
        // Jump progress to complete so summary (with leads) shows immediately
        setProgress(100);
      } catch (err) {
        console.error('Bulk scan API error:', err);
        apiErrorRef.current = err.message;
        setError(err.message);
      }
    };

    runBulkScan();
  }, [
    zip,
    lat,
    lng,
    radius,
    radiusUnit,
    minSqFt,
    intentLevel,
    leadCreditCost,
    homesToScan,
    singleFamily,
    skipPaneled,
    minSavings,
    navigate
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }

        if (prev >= 95 && !apiCompletedRef.current && !apiErrorRef.current) {
          return 95;
        }

        if (apiErrorRef.current) {
          clearInterval(timer);
          return prev;
        }

        const nextVal = prev + Math.floor(Math.random() * 4) + 1;
        return nextVal > 100 ? 100 : nextVal;
      });
    }, 200);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (progress < 60) {
      setStep(1);
      setStep1Progress(Math.floor(75 + (progress / 60) * 25));
    } else if (progress < 85) {
      setStep(2);
      setStep1Progress(100);
      setStep2Progress(Math.floor(((progress - 60) / 25) * 100));
    } else {
      setStep(3);
      setStep1Progress(100);
      setStep2Progress(100);
      setStep3Progress(Math.floor(((progress - 85) / 15) * 100));
    }

    // Show summary as soon as API finishes (progress already at 100)
    if (progress === 100 && apiCompletedRef.current) {
      setShowSummary(true);
    }
  }, [progress]);

  const strokeDashoffset = 552.92 - (progress / 100) * 552.92;
  const reasons = scanResult?.skippedReasons || {};
  const reasonEntries = Object.entries(reasons).filter(([, n]) => Number(n) > 0);

  const radiusLabel =
    radius != null
      ? radiusUnit === 'meters' || (lat && lng && !radiusUnit)
        ? `${radius}m`
        : `${radius} mile${Number(radius) === 1 ? '' : 's'}`
      : null;

  return (
    <AppLayout>
      <section className="flex-grow flex flex-col items-center justify-center py-10 px-4">
        {error ? (
          <div className="max-w-md w-full text-center glass-card p-8 rounded-xl border border-red-500/20 shadow-2xl bg-red-950/10 backdrop-blur-md">
            <span className="material-symbols-outlined text-red-400 text-5xl mb-4">error</span>
            <h2 className="font-headline-lg text-xl font-bold text-white mb-2">Scan Failed</h2>
            <p className="text-on-surface-variant text-xs mb-6 leading-relaxed">{error}</p>
            <button
              onClick={() => navigate('/bulk-scan')}
              className="bg-primary text-on-primary font-bold px-6 py-2 rounded-lg hover:brightness-110 active:scale-95 transition-all text-xs"
            >
              Adjust Parameters
            </button>
          </div>
        ) : showSummary && scanResult ? (
          <div className="max-w-lg w-full glass-card p-8 rounded-xl border border-glass-stroke text-left">
            <div className="text-center mb-6">
              <span className="material-symbols-outlined text-primary text-5xl mb-3">task_alt</span>
              <h2 className="font-headline-lg text-xl font-bold text-white mb-1">Bulk Scan Complete</h2>
              <p className="text-on-surface-variant text-xs">
                ZIP <span className="text-primary font-bold">{zip || '—'}</span>
                {radiusLabel ? <> · radius {radiusLabel}</> : null}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs mb-5">
              <div className="p-3 rounded-lg bg-white/5 border border-glass-stroke">
                <p className="text-on-surface-variant text-[10px] uppercase tracking-wider">Leads saved</p>
                <p className="text-white text-xl font-bold mt-1">{scanResult.leadsCount || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-glass-stroke">
                <p className="text-on-surface-variant text-[10px] uppercase tracking-wider">With contact</p>
                <p className="text-white text-xl font-bold mt-1">{scanResult.withContact || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-glass-stroke">
                <p className="text-on-surface-variant text-[10px] uppercase tracking-wider">Property-only</p>
                <p className="text-white text-xl font-bold mt-1">{scanResult.withoutContact || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-glass-stroke">
                <p className="text-on-surface-variant text-[10px] uppercase tracking-wider">Skipped</p>
                <p className="text-white text-xl font-bold mt-1">{scanResult.skipped || 0}</p>
              </div>
            </div>

            {reasonEntries.length > 0 && (
              <div className="mb-6">
                <p className="font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-2">
                  Skip reasons
                </p>
                <ul className="space-y-1.5 text-xs">
                  {reasonEntries.map(([key, count]) => (
                    <li
                      key={key}
                      className="flex justify-between py-1.5 px-2 rounded bg-white/[0.03] border border-glass-stroke/50"
                    >
                      <span className="text-on-surface-variant">{key}</span>
                      <span className="text-white font-semibold">{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {createdLeads.length > 0 && (
              <div className="mb-6">
                <p className="font-label-mono text-[9px] text-on-surface-variant uppercase tracking-widest mb-2">
                  Leads generated now
                </p>
                <ul className="max-h-64 overflow-y-auto space-y-2 custom-scrollbar">
                  {createdLeads.map((lead) => (
                    <li
                      key={lead.id}
                      className="flex items-start justify-between gap-3 py-2.5 px-3 rounded-lg bg-white/[0.04] border border-glass-stroke/60"
                    >
                      <div className="min-w-0">
                        <p className="text-white text-xs font-semibold truncate">
                          {lead.owner_name || 'N/A'}
                        </p>
                        <p className="text-[10px] text-on-surface-variant truncate mt-0.5">
                          {lead.address || 'No address'}
                        </p>
                        <p className="text-[9px] text-primary/90 mt-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">schedule</span>
                          {formatLeadGeneratedAt(lead.created_at) || 'Just now'}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-[10px] text-white font-bold">{lead.lead_score ?? '—'}/100</p>
                        <Link
                          to={`/lead/${lead.id}`}
                          className="text-primary text-[10px] font-semibold hover:underline"
                        >
                          Open
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => navigate('/my-leads')}
                className="flex-1 bg-primary text-on-primary font-bold py-2.5 rounded-lg hover:brightness-110 text-xs"
              >
                Open My Leads
              </button>
              <button
                onClick={() => navigate('/bulk-scan')}
                className="flex-1 border border-glass-stroke text-white font-bold py-2.5 rounded-lg hover:bg-white/5 text-xs"
              >
                Scan Again
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="max-w-2xl w-full text-center mb-8">
              <h2 className="font-headline-xl text-2xl md:text-headline-xl font-bold text-white mb-2">
                Lead Creation in Progress
              </h2>
              <p className="text-on-surface-variant text-sm md:text-body-lg">
                Enriching solar coordinates and homeowner profiles for ZIP code{' '}
                <span className="text-primary font-bold">{zip || '90210'}</span>
                {radiusLabel ? (
                  <>
                    {' '}
                    within <span className="text-primary font-bold">{radiusLabel}</span>
                  </>
                ) : null}
                .
              </p>
            </div>

            <div className="relative mb-12 flex justify-center">
              <div className="relative w-40 h-40 md:w-48 md:h-48 flex items-center justify-center">
                <svg className="w-full h-full progress-ring" height="100%" width="100%" viewBox="0 0 192 192">
                  <circle
                    className="text-white/5"
                    cx="96"
                    cy="96"
                    fill="transparent"
                    r="88"
                    stroke="currentColor"
                    strokeWidth="6"
                  ></circle>
                  <circle
                    className="text-primary transition-all duration-300"
                    cx="96"
                    cy="96"
                    fill="transparent"
                    r="88"
                    stroke="currentColor"
                    strokeDasharray="552.92"
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    strokeWidth="6"
                  />
                </svg>

                <div className="absolute inset-4 rounded-full overflow-hidden bg-surface-elevated/40 backdrop-blur-md border border-glass-stroke flex items-center justify-center shadow-inner">
                  <div className="scan-line"></div>
                  <div className="text-center">
                    <span className="font-label-mono text-[9px] text-primary uppercase tracking-[0.2em] block mb-0.5">
                      Enriching
                    </span>
                    <span className="font-headline-md text-xl md:text-headline-md font-bold text-white">
                      {progress}%
                    </span>
                  </div>
                </div>
                <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl pulse-animation -z-10"></div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl text-left">
              <div
                className={`glass-card p-5 rounded-xl flex flex-col gap-3 relative overflow-hidden transition-all duration-300 ${
                  step === 1 ? 'border-primary/50' : 'opacity-60'
                }`}
              >
                {step === 1 && <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>}
                <div className="flex justify-between items-start">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                      step >= 1
                        ? 'bg-primary/20 text-primary border-primary/30'
                        : 'bg-white/5 text-on-surface-variant border-glass-stroke'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">solar_power</span>
                  </div>
                  <span
                    className={`font-label-mono text-[8px] px-2 py-0.5 rounded border ${
                      progress >= 60
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-primary/10 text-primary border-primary/20 animate-pulse'
                    }`}
                  >
                    {progress >= 60 ? 'COMPLETE' : 'SCANNING'}
                  </span>
                </div>
                <div>
                  <h3 className="font-headline-md text-sm md:text-base font-bold text-white">Google Solar API</h3>
                  <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">
                    Analyzing roof pitch, azimuth, and shading models.
                  </p>
                </div>
                <div className="mt-2 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${step1Progress}%` }}></div>
                </div>
              </div>

              <div
                className={`glass-card p-5 rounded-xl flex flex-col gap-3 relative overflow-hidden transition-all duration-300 ${
                  step === 2 ? 'border-primary/50' : 'opacity-60'
                }`}
              >
                {step === 2 && <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>}
                <div className="flex justify-between items-start">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                      step >= 2
                        ? 'bg-primary/20 text-primary border-primary/30'
                        : 'bg-white/5 text-on-surface-variant border-glass-stroke'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">home_work</span>
                  </div>
                  <span
                    className={`font-label-mono text-[8px] px-2 py-0.5 rounded border ${
                      progress >= 85
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : step === 2
                          ? 'bg-primary/10 text-primary border-primary/20 animate-pulse'
                          : 'bg-white/5 text-on-surface-variant border-glass-stroke'
                    }`}
                  >
                    {progress >= 85 ? 'COMPLETE' : step === 2 ? 'SCANNING' : 'PENDING'}
                  </span>
                </div>
                <div>
                  <h3 className="font-headline-md text-sm md:text-base font-bold text-white">RentCast Property</h3>
                  <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">
                    Fetching tax records, ownership history, and market value.
                  </p>
                </div>
                <div className="mt-2 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${step2Progress}%` }}></div>
                </div>
              </div>

              <div
                className={`glass-card p-5 rounded-xl flex flex-col gap-3 relative overflow-hidden transition-all duration-300 ${
                  step === 3 ? 'border-primary/50' : 'opacity-60'
                }`}
              >
                {step === 3 && <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>}
                <div className="flex justify-between items-start">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                      step === 3
                        ? 'bg-primary/20 text-primary border-primary/30'
                        : 'bg-white/5 text-on-surface-variant border-glass-stroke'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">contact_page</span>
                  </div>
                  <span
                    className={`font-label-mono text-[8px] px-2 py-0.5 rounded border ${
                      progress >= 100
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : step === 3
                          ? 'bg-primary/10 text-primary border-primary/20 animate-pulse'
                          : 'bg-white/5 text-on-surface-variant border-glass-stroke'
                    }`}
                  >
                    {progress >= 100 ? 'COMPLETE' : step === 3 ? 'SCANNING' : 'PENDING'}
                  </span>
                </div>
                <div>
                  <h3 className="font-headline-md text-sm md:text-base font-bold text-white">Contact Enrichment</h3>
                  <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">
                    Tracerfy skip-trace, then Apollo fallback for name, email, and phone.
                  </p>
                </div>
                <div className="mt-2 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${step3Progress}%` }}></div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-3 py-2 px-5 glass-card rounded-full border-glass-stroke">
              <span className="material-symbols-outlined text-primary text-base">info</span>
              <span className="text-[11px] text-on-surface-variant">
                {progress === 100 && apiCompletedRef.current ? (
                  <span className="text-green-400 font-bold">Preparing results summary…</span>
                ) : (
                  <>
                    Estimated completion time:{' '}
                    <span className="text-white font-medium">
                      {progress >= 95 ? 'Enriching contacts...' : `${Math.ceil((100 - progress) / 3)} seconds`}
                    </span>
                  </>
                )}
              </span>
            </div>
          </>
        )}
      </section>
    </AppLayout>
  );
}
