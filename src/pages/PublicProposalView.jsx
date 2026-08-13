import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_BASE } from '../config.js';

export default function PublicProposalView() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Interactive ROI State
  const [financingType, setFinancingType] = useState('cash');
  const [includeItc30, setIncludeItc30] = useState(true);
  const [batteryType, setBatteryType] = useState('none');
  const [batteryCount, setBatteryCount] = useState(1);
  const [loanTermYears, setLoanTermYears] = useState(20);
  const [loanInterestRate, setLoanInterestRate] = useState(5.99);
  const [downPayment, setDownPayment] = useState(0);

  // E-Sign Modal State
  const [showSignModal, setShowSignModal] = useState(false);
  const [signedName, setSignedName] = useState('');
  const [signedEmail, setSignedEmail] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [submittingSign, setSubmittingSign] = useState(false);
  const [signedSuccess, setSignedSuccess] = useState(false);
  const [signError, setSignError] = useState('');

  // Canvas Ref for Signature
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);

  const fetchProposal = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/proposals/public/${slug}`);
      if (!res.ok) {
        throw new Error('Proposal not found or expired.');
      }
      const result = await res.json();
      setData(result);
      const p = result.proposal;
      if (p) {
        setFinancingType(p.financing_type || 'cash');
        setIncludeItc30(Boolean(p.include_itc_30));
        setBatteryType(p.battery_type || 'none');
        setBatteryCount(p.battery_count || 1);
        setLoanTermYears(p.loan_term_years || 20);
        setLoanInterestRate(Number(p.loan_interest_rate) || 5.99);
        setDownPayment(Number(p.down_payment) || 0);
        if (p.status === 'signed') {
          setSignedSuccess(true);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  // Recalculate ROI dynamically
  const p = data?.proposal || {};
  const lead = data?.lead || {};
  const solar = lead.solar || {};

  const grossCost = Number(p.gross_cost || 25500);
  const batteryUnitCost = batteryType === 'tesla_powerwall' ? 11500 : batteryType === 'enphase_iq' ? 6500 : 0;
  const batteryTotalCost = batteryUnitCost * (batteryType !== 'none' ? batteryCount : 0);
  const totalGrossCost = grossCost + batteryTotalCost;

  const itc30Deduction = includeItc30 ? totalGrossCost * 0.30 : 0;
  const stateRebate = Number(p.state_rebate || 1000);
  const netSystemCost = Math.max(0, totalGrossCost - itc30Deduction - stateRebate);

  const systemSizeKw = Number(p.system_size_kw || 8.5);
  const annualProdKwh = systemSizeKw * 1400;
  const baseRate = 0.22;
  const escalation = Number(p.utility_escalation || 4.5) / 100;

  let cumulative25yrUtility = 0;
  let rate = baseRate;
  for (let yr = 1; yr <= 25; yr++) {
    cumulative25yrUtility += annualProdKwh * rate;
    rate *= (1 + escalation);
  }

  const est25yrSavings = Math.round(cumulative25yrUtility - netSystemCost);
  const yr1Savings = Math.round(annualProdKwh * baseRate);
  const paybackYears = (netSystemCost / Math.max(1, yr1Savings)).toFixed(1);

  let monthlyPayment = 0;
  if (financingType === 'loan') {
    const ratePerMonth = (loanInterestRate / 100) / 12;
    const numMonths = loanTermYears * 12;
    const principal = Math.max(0, netSystemCost - downPayment);
    if (ratePerMonth > 0 && numMonths > 0) {
      monthlyPayment = Math.round((principal * ratePerMonth * Math.pow(1 + ratePerMonth, numMonths)) / (Math.pow(1 + ratePerMonth, numMonths) - 1));
    }
  } else if (financingType === 'lease') {
    monthlyPayment = Math.round((netSystemCost / (20 * 12)) * 0.85);
  }

  // Canvas Drawing Handlers
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSignSubmit = async () => {
    if (!signedName.trim()) {
      setSignError('Please enter your full legal name.');
      return;
    }
    if (!agreedTerms) {
      setSignError('Please check the legal consent checkbox.');
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      setSignError('Canvas signature error.');
      return;
    }
    const signatureData = canvas.toDataURL('image/png');
    if (signatureData.length < 500) {
      setSignError('Please draw your digital signature inside the box.');
      return;
    }

    setSubmittingSign(true);
    setSignError('');

    try {
      const res = await fetch(`${API_BASE}/api/proposals/public/${slug}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signedName: signedName.trim(),
          signedEmail: signedEmail.trim(),
          signatureData
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to submit signature');
      setSignedSuccess(true);
      setShowSignModal(false);
      await fetchProposal();
    } catch (err) {
      setSignError(err.message);
    } finally {
      setSubmittingSign(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#060914] min-h-screen flex flex-col items-center justify-center gap-3 text-primary">
        <span className="material-symbols-outlined text-4xl animate-spin">sync</span>
        <p className="font-mono text-xs uppercase tracking-widest text-slate-300">Loading Solar Proposal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#060914] min-h-screen flex items-center justify-center p-4">
        <div className="glass-card max-w-md w-full p-8 rounded-2xl border border-red-500/30 text-center space-y-4">
          <span className="material-symbols-outlined text-5xl text-red-400">error</span>
          <h2 className="text-xl font-bold text-white">Proposal Not Available</h2>
          <p className="text-xs text-slate-400">{error}</p>
          <Link to="/" className="inline-block bg-primary text-on-primary font-bold px-4 py-2 rounded-xl text-xs">
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#060914] min-h-screen text-slate-100 font-sans antialiased selection:bg-primary/30">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-[#080C1D]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-3.5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-xl">bolt</span>
          </div>
          <div>
            <h1 className="font-bold text-white text-sm tracking-tight">{p.company_name || 'SolarX Energy Solutions'}</h1>
            <p className="text-[9px] font-mono text-primary uppercase tracking-widest">Verified Rooftop Energy Assessment</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {p.status === 'signed' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
              <span className="material-symbols-outlined text-sm">verified</span>
              Proposal Signed
            </span>
          ) : (
            <button
              onClick={() => setShowSignModal(true)}
              className="bg-primary text-on-primary font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-primary/25 hover:brightness-110 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-base">draw</span>
              Sign & Approve Proposal
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Success Banner if Signed */}
        {signedSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-emerald-400">check_circle</span>
            <div>
              <p className="font-bold text-sm">Proposal Signed & Approved!</p>
              <p className="text-xs text-slate-300">
                Thank you, {p.signed_name || lead.owner_name}. Your signed proposal has been received. Your installer will contact you to schedule the site survey.
              </p>
            </div>
          </div>
        )}

        {/* Hero Banner: Customer & Property Overview */}
        <section className="glass-card rounded-2xl p-6 sm:p-8 border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            <div className="md:col-span-2 space-y-2">
              <span className="px-3 py-1 rounded-full bg-primary/15 text-primary border border-primary/30 font-bold text-[10px] uppercase tracking-wider">
                Personalized Solar Assessment
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Solar Proposal for {lead.owner_name || 'Homeowner'}
              </h2>
              <p className="text-xs text-slate-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-primary">location_on</span>
                {lead.address}
              </p>
            </div>

            <div className="glass-card p-4 rounded-xl border border-white/10 flex flex-col justify-center items-center text-center">
              <span className="text-[9px] text-slate-400 font-mono uppercase tracking-widest">AI Solar Score</span>
              <span className="text-3xl font-black text-primary font-mono mt-1">{lead.lead_score || 85}/100</span>
              <span className="text-[10px] text-emerald-400 font-semibold mt-1">Excellent Rooftop Exposure</span>
            </div>
          </div>
        </section>

        {/* Satellite Map & Roof Specs */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card rounded-2xl overflow-hidden border border-white/10 h-64 sm:h-80 relative">
            {lead.image_url ? (
              <img src={lead.image_url} alt="Rooftop Satellite" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center text-slate-500">
                <span className="material-symbols-outlined text-5xl">satellite_alt</span>
                <span className="text-xs mt-2">Satellite Rooftop Analysis</span>
              </div>
            )}
            <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-md px-3 py-1 rounded-lg text-[10px] text-white font-mono">
              Google Satellite Rooftop Imagery
            </div>
          </div>

          <div className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col justify-between space-y-4">
            <h3 className="font-bold text-white text-sm uppercase tracking-wider font-mono">Rooftop System Specs</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <p className="text-[9px] text-slate-400 font-mono uppercase">System Capacity</p>
                <p className="text-sm font-bold text-white font-mono mt-0.5">{systemSizeKw} kW DC</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <p className="text-[9px] text-slate-400 font-mono uppercase">Module Count</p>
                <p className="text-sm font-bold text-white font-mono mt-0.5">{p.panel_count || 20} Panels</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <p className="text-[9px] text-slate-400 font-mono uppercase">Annual Production</p>
                <p className="text-sm font-bold text-white font-mono mt-0.5">{annualProdKwh.toLocaleString()} kWh</p>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <p className="text-[9px] text-slate-400 font-mono uppercase">CO₂ Offset</p>
                <p className="text-sm font-bold text-white font-mono mt-0.5">{(systemSizeKw * 0.72).toFixed(1)} Tons/yr</p>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Calculated using NREL solar irradiance data and high-efficiency Tier-1 monocrystalline PV modules.
            </p>
          </div>
        </section>

        {/* INTERACTIVE SOLAR ROI CALCULATOR */}
        <section className="glass-card rounded-2xl p-6 sm:p-8 border border-primary/30 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <span className="text-[9px] font-mono text-primary uppercase tracking-widest font-bold">Live Interactive Financials</span>
              <h3 className="text-xl font-bold text-white mt-1">Solar ROI & Financing Calculator</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Payment Option:</span>
              <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                {['cash', 'loan', 'lease'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setFinancingType(mode)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                      financingType === mode ? 'bg-primary text-on-primary shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ROI Metrics Cards */}
            <div className="space-y-3">
              <div className="p-5 rounded-xl bg-gradient-to-br from-primary/20 to-slate-900 border border-primary/40 space-y-1">
                <p className="text-[9px] font-mono text-primary uppercase font-bold tracking-widest">25-Year Net Savings</p>
                <p className="text-3xl font-black text-primary font-mono">${est25yrSavings.toLocaleString()}</p>
                <p className="text-[10px] text-slate-300">Estimated cumulative electric bill savings after system payback.</p>
              </div>

              {financingType !== 'cash' && (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                  <p className="text-[9px] font-mono text-slate-400 uppercase">Estimated Monthly Payment</p>
                  <p className="text-2xl font-bold text-white font-mono">${monthlyPayment} / mo</p>
                  <p className="text-[10px] text-slate-400">Replaces your existing utility power bill.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <p className="text-[8px] font-mono text-slate-400 uppercase">Net System Cost</p>
                  <p className="text-base font-bold text-white font-mono mt-0.5">${netSystemCost.toLocaleString()}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <p className="text-[8px] font-mono text-slate-400 uppercase">Payback Period</p>
                  <p className="text-base font-bold text-white font-mono mt-0.5">{paybackYears} Years</p>
                </div>
              </div>
            </div>

            {/* Interactive ROI Toggles */}
            <div className="lg:col-span-2 space-y-5">
              {/* Federal Tax Credit & State Incentive */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <h4 className="font-bold text-white text-xs uppercase font-mono tracking-wider">Tax Credits & Incentives</h4>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-white">30% Federal Investment Tax Credit (ITC)</p>
                    <p className="text-[10px] text-slate-400">Lowers cost by ${Math.round(itc30Deduction).toLocaleString()}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={includeItc30}
                    onChange={(e) => setIncludeItc30(e.target.checked)}
                    className="w-5 h-5 rounded accent-primary cursor-pointer"
                  />
                </div>
              </div>

              {/* Battery Add-On Selection */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-white text-xs uppercase font-mono tracking-wider">Battery Storage Add-On</h4>
                  {batteryType !== 'none' && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-mono">Count:</span>
                      <select
                        value={batteryCount}
                        onChange={(e) => setBatteryCount(Number(e.target.value))}
                        className="bg-surface-container-low border border-glass-stroke rounded text-xs px-2 py-0.5 text-white"
                      >
                        <option value={1}>1 Battery</option>
                        <option value={2}>2 Batteries</option>
                        <option value={3}>3 Batteries</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'none', label: 'No Battery', sub: 'Grid-tied only' },
                    { id: 'tesla_powerwall', label: 'Tesla Powerwall 3', sub: '13.5 kWh Backup' },
                    { id: 'enphase_iq', label: 'Enphase IQ 5P', sub: '5.0 kWh Storage' }
                  ].map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setBatteryType(b.id)}
                      className={`p-3 rounded-xl text-left border transition-all ${
                        batteryType === b.id
                          ? 'border-primary bg-primary/10 text-white'
                          : 'border-white/5 bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      <p className="font-bold text-xs">{b.label}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">{b.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Loan Sliders (If Loan selected) */}
              {financingType === 'loan' && (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                  <h4 className="font-bold text-white text-xs uppercase font-mono tracking-wider">Solar Loan Parameters</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-400 font-mono uppercase">Loan Term: {loanTermYears} Years</label>
                      <input
                        type="range"
                        min={10}
                        max={25}
                        step={5}
                        value={loanTermYears}
                        onChange={(e) => setLoanTermYears(Number(e.target.value))}
                        className="w-full mt-2 accent-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-mono uppercase">APR Interest Rate: {loanInterestRate}%</label>
                      <input
                        type="range"
                        min={2.99}
                        max={9.99}
                        step={0.5}
                        value={loanInterestRate}
                        onChange={(e) => setLoanInterestRate(Number(e.target.value))}
                        className="w-full mt-2 accent-primary"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* E-SIGN ACCEPTANCE CALL TO ACTION */}
        <section className="glass-card rounded-2xl p-8 border border-white/10 text-center space-y-4">
          <h3 className="text-xl font-bold text-white">Ready to Lock In Your Solar Savings?</h3>
          <p className="text-xs text-slate-300 max-w-xl mx-auto">
            Approve your proposal online to reserve your 30% Federal Tax Credit rate and schedule your site survey.
          </p>
          {p.status === 'signed' ? (
            <button disabled className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold px-8 py-3 rounded-xl text-sm opacity-80 cursor-not-allowed">
              ✓ Proposal Signed on {new Date(p.signed_at).toLocaleDateString()}
            </button>
          ) : (
            <button
              onClick={() => setShowSignModal(true)}
              className="bg-primary text-on-primary font-extrabold px-8 py-3.5 rounded-xl text-sm shadow-xl shadow-primary/30 hover:brightness-110 active:scale-95 transition-all"
            >
              Click Here to Sign & Accept Proposal
            </button>
          )}
        </section>
      </main>

      {/* DIGITAL SIGNATURE (E-SIGN) MODAL */}
      {showSignModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0A0E23] border border-glass-stroke rounded-2xl p-6 shadow-2xl space-y-4 text-left">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Electronic Signature (E-Sign)</h3>
                <p className="text-[10px] text-slate-400 font-mono">Proposal #{slug}</p>
              </div>
              <button onClick={() => setShowSignModal(false)} className="text-slate-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {signError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                {signError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Full Legal Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={signedName}
                  onChange={(e) => setSignedName(e.target.value)}
                  className="w-full mt-1 bg-surface-container-low border border-glass-stroke rounded-xl p-2.5 text-white focus:outline-none focus:border-primary text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="e.g. john@example.com"
                  value={signedEmail}
                  onChange={(e) => setSignedEmail(e.target.value)}
                  className="w-full mt-1 bg-surface-container-low border border-glass-stroke rounded-xl p-2.5 text-white focus:outline-none focus:border-primary text-xs"
                />
              </div>

              {/* Canvas Signature Pad */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Draw Digital Signature Below</label>
                  <button type="button" onClick={clearCanvas} className="text-[10px] text-primary hover:underline font-mono">
                    Clear Signature
                  </button>
                </div>
                <div className="border border-glass-stroke bg-[#060914] rounded-xl overflow-hidden">
                  <canvas
                    ref={canvasRef}
                    width={460}
                    height={140}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-36 cursor-crosshair touch-none"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2 pt-1 text-[11px] text-slate-300">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="mt-0.5 rounded accent-primary cursor-pointer"
                />
                <span>I confirm that I am authorized to accept this solar proposal and agree that my electronic signature is legally binding.</span>
              </label>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowSignModal(false)}
                className="px-4 py-2 rounded-xl bg-white/5 text-white font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingSign}
                onClick={handleSignSubmit}
                className="px-5 py-2 rounded-xl bg-primary text-on-primary font-bold text-xs shadow-lg hover:brightness-110 disabled:opacity-50"
              >
                {submittingSign ? 'Submitting Signature...' : 'Submit & Complete E-Sign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
