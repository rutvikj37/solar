import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sun,
  Zap,
  DollarSign,
  MapPin,
  TrendingUp,
  Leaf,
  ShieldCheck,
  BarChart3,
  Download,
  Printer,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  buildSolarReportEstimates,
  mapValidationToFitRows,
} from '@/lib/solarReportEstimates.js';
import { downloadSolarReportPdf } from '@/utils/solarReportPdf.js';
import { printElement } from '@/utils/printElement.js';
import { API_BASE } from '@/config.js';

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center">
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/35">{label}</p>
      <p className="mt-2 text-2xl md:text-3xl font-black text-white tracking-tight">{value}</p>
      {sub ? <p className="mt-1 text-[10px] text-white/40 font-medium">{sub}</p> : null}
    </div>
  );
}

function SavingsPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-center min-w-[100px]">
      <p className="text-[9px] font-black uppercase tracking-widest text-emerald-300/70">{label}</p>
      <p className="mt-1 text-lg font-black text-emerald-300">{value}</p>
    </div>
  );
}

export function SolarReport({ data }: { data: Record<string, unknown> }) {
  const navigate = useNavigate();
  const reportRef = useRef<HTMLDivElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState('');
  if (!data) return null;

  const estimates = buildSolarReportEstimates(data);
  const fit = mapValidationToFitRows(
    Array.isArray(data.validationChecks) ? data.validationChecks : [],
    estimates,
  );
  const leadCode = String(data.leadCode || 'Pending');
  const address = String(data.address || 'Your property');
  const roofType = String(data.roofType || 'Roof assessed');
  const reportDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const enriched = estimates.googleSolarHit || data.enrichmentSource === 'google_solar';
  const satelliteImageUrl = data.satelliteImageUrl
    ? `${API_BASE}${String(data.satelliteImageUrl)}`
    : '/roof-aerial.jpg';

  const handleDownloadPdf = async () => {
    if (pdfBusy || leadCode === 'Pending') return;
    setPdfBusy(true);
    setPdfError('');
    try {
      await downloadSolarReportPdf(leadCode, { address, download: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not download PDF';
      setPdfError(message);
      await printElement(reportRef.current, { title: `Solar Report ${leadCode}` });
    } finally {
      setPdfBusy(false);
    }
  };

  const handlePrint = () => {
    printElement(reportRef.current, { title: `Solar Report ${leadCode}` });
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen bg-[#060B17] text-white">
      <div
        data-print-hide
        className="sticky top-0 z-30 border-b border-white/10 bg-[#060B17]/90 backdrop-blur-md"
      >
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-400/80">
            SpaceToRoof Report
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={pdfBusy || leadCode === 'Pending'}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-sm font-bold hover:bg-cyan-500/25 transition-all disabled:opacity-50"
            >
              <Download className="size-4" />
              {pdfBusy ? 'Preparing…' : 'Download PDF'}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm font-bold hover:bg-white/10 transition-all"
            >
              <Printer className="size-4" />
              Print
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 text-sm font-bold hover:bg-white/10 transition-all"
            >
              ← Home
            </button>
          </div>
        </div>
        {pdfError ? (
          <p className="max-w-5xl mx-auto px-4 md:px-6 pb-2 text-[11px] text-amber-300/90">
            {pdfError} — opened print dialog as fallback. Choose &quot;Save as PDF&quot; if needed.
          </p>
        ) : null}
      </div>

      <div ref={reportRef} className="py-10 px-4 md:px-6">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
        className="max-w-5xl mx-auto space-y-8"
      >
        {/* Header — estimator-style title block */}
        <motion.div variants={itemVariants} className="pt-8 space-y-3 text-center md:text-left">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-400/80">
            SpaceToRoof Property Estimate
          </p>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">
            Your personalized solar snapshot
          </h1>
          <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-2 text-sm text-white/50">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4 text-cyan-400 shrink-0" />
              {address}
            </span>
            <span className="hidden md:inline text-white/20">·</span>
            <span>{reportDate}</span>
            <span className="hidden md:inline text-white/20">·</span>
            <span className="font-mono text-cyan-400/90 text-xs">Lead ID {leadCode}</span>
          </div>
        </motion.div>

        {/* Hero stats — system snapshot (reference-inspired layout, our fields) */}
        <motion.div
          variants={itemVariants}
          className="glass-form-container rounded-[28px] p-6 md:p-8 border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-transparent to-transparent"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40 mb-5">
            Estimated system snapshot
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <StatTile label="Panels" value={String(estimates.panelCount)} sub={enriched ? 'roof modeled' : 'estimated count'} />
            <StatTile label="System size" value={`${estimates.systemKw} kW`} sub={enriched ? 'satellite modeled' : 'estimated DC'} />
            <StatTile
              label="Coverage"
              value={`${estimates.coveragePct}%`}
              sub="of electricity usage"
            />
            <StatTile
              label="Annual output"
              value={`${estimates.annualProduction.toLocaleString()}`}
              sub={enriched ? 'kWh / year modeled' : 'kWh / year est.'}
            />
          </div>

          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/35 mb-3">
              Cumulative savings vs paying grid electricity (estimate)
            </p>
            <div className="flex flex-wrap gap-3">
              <SavingsPill label="Year 1" value={`$${estimates.year1Savings.toLocaleString()}`} />
              <SavingsPill label="Year 5" value={`$${estimates.year5Savings.toLocaleString()}`} />
              <SavingsPill label="Year 10" value={`$${estimates.year10Savings.toLocaleString()}`} />
              <SavingsPill label="Year 25" value={`$${estimates.year25Savings.toLocaleString()}`} />
            </div>
            <p className="mt-3 text-[10px] text-white/30 italic">
              Based on ${estimates.bill}/mo bill · ~${estimates.ratePerKwh.toFixed(2)}/kWh ·{' '}
              {estimates.systemKw} kW system · Illustrative only.
            </p>
          </div>
        </motion.div>

        {/* Submission status — no verification details shown to homeowner */}
        <motion.div
          variants={itemVariants}
          className="glass-form-container rounded-[28px] p-6 md:p-7 border border-cyan-500/25 bg-cyan-500/5"
        >
          <div className="flex flex-col md:flex-row gap-4 md:items-start">
            <div className="size-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="size-6 text-cyan-400" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-black uppercase tracking-tight">
                Your solar report is ready
              </h2>
              <p className="text-sm text-white/65 leading-relaxed">
                {String(
                  data.qualificationMessage ||
                    'Thank you! Your inquiry was received and is under review. A qualified installer will reach out once your request is approved.',
                )}
              </p>
              <p className="text-[10px] font-black uppercase tracking-wider text-cyan-400/80">
                Lead Score · {estimates.opportunityScore} / 100
                {estimates.leadScoreTier ? ` · ${estimates.leadScoreTier}` : ''}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Your Solar Fit — scored factors like reference PDF section 2 */}
        <motion.div variants={itemVariants} className="glass-form-container rounded-[28px] p-6 md:p-8">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:w-1/3 text-center lg:text-left">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-400 mb-2">
                Your lead score
              </p>
              <h2 className="text-xl font-black leading-snug">
                How likely you are to become a solar customer:
                <span className="text-white/70"> scored </span>
                {String(estimates.fitLabel || 'Moderate').toLowerCase()}.
              </h2>
              <div className="mt-6 inline-flex flex-col items-center lg:items-start">
                <div className="size-32 rounded-full border-[10px] border-white/10 border-t-cyan-400 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black">{estimates.opportunityScore}</span>
                  <span className="text-[10px] font-bold text-white/40 uppercase">/ 100</span>
                </div>
                <p className="mt-3 text-xs text-white/45 max-w-xs">
                  Purchase intent, ownership, bill, and personal details (0–100).
                  {estimates.solarPotentialScore != null && (
                    <>
                      {' '}
                      Solar potential for installers: {estimates.solarPotentialScore}/100.
                    </>
                  )}
                </p>
                <details className="mt-4 text-left max-w-xs mx-auto lg:mx-0">
                  <summary className="text-[10px] font-bold uppercase tracking-wider text-cyan-400/80 cursor-pointer">
                    How this score is calculated
                  </summary>
                  <ul className="mt-2 space-y-1 text-[11px] text-white/55 list-disc pl-4">
                    <li>Purchase intent — up to 20</li>
                    <li>Ownership + roof — up to 15</li>
                    <li>Electricity bill — up to 15</li>
                    <li>Personal information — up to 50</li>
                  </ul>
                </details>
              </div>
            </div>

            <div className="lg:flex-1 space-y-4">
              {fit.rows.map((row) => {
                const pct = Math.min(100, Math.round((row.score / row.max) * 100));
                return (
                  <div key={row.label} className="space-y-1.5">
                    <div className="flex justify-between gap-3 text-xs">
                      <span className="font-bold text-white/80">{row.label}</span>
                      <span className="font-black text-cyan-400 shrink-0">
                        {Math.min(row.max, row.score)}/{row.max}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8 }}
                        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
                      />
                    </div>
                    <p className="text-[11px] text-white/40">{row.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Cost of waiting + monthly comparison */}
        <motion.div variants={itemVariants} className="grid md:grid-cols-2 gap-6">
          <div className="glass-form-container rounded-[28px] p-6 space-y-5">
            <h3 className="text-sm font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp className="size-4" /> The cost of waiting
            </h3>
            <p className="text-xs text-white/45 leading-relaxed">
              Utility rates historically rise ~3.4%/year. If that pattern holds, your monthly bill
              without solar could look like this:
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/5 p-3 border border-white/10">
                <p className="text-[9px] uppercase tracking-widest text-white/35">Today</p>
                <p className="text-xl font-black mt-1">${estimates.bill}</p>
                <p className="text-[9px] text-white/30">/mo</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3 border border-white/10">
                <p className="text-[9px] uppercase tracking-widest text-white/35">In ~10 yrs</p>
                <p className="text-xl font-black mt-1">${estimates.bill2036}</p>
                <p className="text-[9px] text-white/30">/mo est.</p>
              </div>
              <div className="rounded-xl bg-white/5 p-3 border border-white/10">
                <p className="text-[9px] uppercase tracking-widest text-white/35">In ~25 yrs</p>
                <p className="text-xl font-black mt-1">${estimates.bill2051}</p>
                <p className="text-[9px] text-white/30">/mo est.</p>
              </div>
            </div>
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-cyan-300/80">
                Est. loss from waiting 1 year
              </p>
              <p className="text-2xl font-black text-white mt-1">
                ${estimates.year1Savings.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="glass-form-container rounded-[28px] p-6 space-y-5">
            <h3 className="text-sm font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
              <DollarSign className="size-4" /> Monthly bill comparison (estimate)
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-sm text-white/50">You pay today</span>
                <span className="text-xl font-black">${estimates.bill}/mo</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-white/10">
                <span className="text-sm text-white/50">Est. after solar</span>
                <span className="text-xl font-black text-emerald-400">
                  ~${estimates.estSolarPayment}/mo
                </span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-sm text-white/50">Est. monthly savings</span>
                <span className="text-xl font-black text-cyan-400">
                  ~${Math.max(0, estimates.bill - estimates.estSolarPayment)}/mo
                </span>
              </div>
            </div>
            <p className="text-[10px] text-white/30 italic">
              Final pricing comes from installer proposals after marketplace bidding — not shown
              here.
            </p>
          </div>
        </motion.div>

        {/* Energy + property row */}
        <motion.div variants={itemVariants} className="grid md:grid-cols-2 gap-6">
          <div className="glass-form-container rounded-[28px] p-6 space-y-4">
            <h3 className="text-sm font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
              <BarChart3 className="size-4" /> Energy generation (estimate)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-[9px] uppercase tracking-widest text-white/35">Year 1 output</p>
                <p className="text-2xl font-black text-cyan-400 mt-1">
                  {estimates.annualProduction.toLocaleString()}
                </p>
                <p className="text-[10px] text-white/35">kWh produced</p>
              </div>
              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-[9px] uppercase tracking-widest text-white/35">Per panel</p>
                <p className="text-2xl font-black text-white mt-1">
                  {estimates.kwhPerPanel.toLocaleString()}
                </p>
                <p className="text-[10px] text-white/35">kWh/panel/yr est.</p>
              </div>
            </div>
            <p className="text-[11px] text-white/40 leading-relaxed">
              Based on {estimates.systemKw} kW system and ~{estimates.sunHours.toLocaleString()}{' '}
              production hours/year. Output declines slightly over time due to normal panel
              degradation.
            </p>
          </div>

          <div className="glass-form-container rounded-[28px] p-6 space-y-4">
            <h3 className="text-sm font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
              <Sun className="size-4" /> Property snapshot
            </h3>
            <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 bg-navy-dark/50">
              <img
                src={satelliteImageUrl}
                alt="Roof satellite view"
                className="w-full h-full object-cover brightness-[0.85]"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (img.src !== `${window.location.origin}/roof-aerial.jpg`) {
                    img.src = '/roof-aerial.jpg';
                  }
                }}
              />
              <div className="absolute bottom-2 left-2 right-2 flex justify-between text-[9px] font-black uppercase tracking-widest">
                <span className="px-2 py-1 rounded bg-navy-dark/80 border border-white/10">
                  {roofType}
                </span>
                <span className="px-2 py-1 rounded bg-navy-dark/80 border border-white/10">
                  {data.billRange || `$${estimates.bill}/mo`}
                </span>
              </div>
              {enriched && estimates.imageryDate ? (
                <span className="absolute top-2 right-2 px-2 py-1 rounded bg-navy-dark/80 border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/70">
                  Imagery {estimates.imageryDate}
                </span>
              ) : null}
            </div>
            {enriched && (estimates.orientation || estimates.pitch || estimates.shading) ? (
              <div className="grid grid-cols-1 gap-2 text-xs">
                {estimates.orientation ? (
                  <div className="flex justify-between">
                    <span className="text-white/40 uppercase tracking-widest">Orientation</span>
                    <span className="text-right max-w-[60%]">{estimates.orientation}</span>
                  </div>
                ) : null}
                {estimates.pitch ? (
                  <div className="flex justify-between">
                    <span className="text-white/40 uppercase tracking-widest">Pitch</span>
                    <span>{estimates.pitch}</span>
                  </div>
                ) : null}
                {estimates.shading ? (
                  <div className="flex justify-between">
                    <span className="text-white/40 uppercase tracking-widest">Shading</span>
                    <span>{estimates.shading}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="flex justify-between text-xs font-bold">
              <span className="text-white/40 uppercase tracking-widest">Timeline</span>
              <span>{String(data.timeline || 'Not specified')}</span>
            </div>
          </div>
        </motion.div>

        {/* Environmental impact — light touch like reference */}
        <motion.div variants={itemVariants} className="glass-form-container rounded-[28px] p-6 md:p-8">
          <h3 className="text-sm font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2 mb-5">
            <Leaf className="size-4" /> Environmental impact (estimate)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatTile label="Trees equivalent" value={String(estimates.treesEquiv)} sub="per year est." />
            <StatTile
              label="Driving offset"
              value={`${estimates.milesOffset.toLocaleString()} mi`}
              sub="per year est."
            />
            <StatTile
              label="Clean energy"
              value={`${(estimates.annualProduction * 25 / 1000).toFixed(0)}k`}
              sub="kWh over 25 yrs"
            />
            <StatTile label="CO₂ avoided" value={`${estimates.co2Tons25}t`} sub="over 25 yrs est." />
          </div>
        </motion.div>

        <motion.p
          variants={itemVariants}
          className="text-[11px] text-white/25 leading-relaxed text-center px-4"
        >
          This estimate uses your submitted details, qualification scoring, and regional modeling
          assumptions. Actual system size, pricing, savings, and performance vary by roof condition,
          equipment, installer bids, and utility policies. Consult a licensed solar professional
          before making financial decisions. SpaceToRoof does not guarantee savings or installation
          pricing.
        </motion.p>

        <motion.div variants={itemVariants} className="pb-10 flex justify-center gap-3" data-print-hide>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={pdfBusy || leadCode === 'Pending'}
            className="inline-flex items-center gap-2 px-6 py-4 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 font-bold hover:bg-cyan-500/25 transition-all active:scale-95 disabled:opacity-50"
          >
            <Download className="size-4" />
            Download PDF
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-bold hover:bg-white/10 transition-all active:scale-95"
          >
            ← Back to Home
          </button>
        </motion.div>
      </motion.div>
      </div>
    </div>
  );
}
