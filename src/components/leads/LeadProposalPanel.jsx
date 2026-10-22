import React, { useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../../config.js';
import { authHeaders, getToken } from '../../lib/auth.js';

const STEPS = [
  { id: 1, label: 'System & Pricing' },
  { id: 2, label: 'Customer Info' },
  { id: 3, label: 'Preview' },
  { id: 4, label: 'Send' },
];

const FINANCING_OPTIONS = [
  { id: 'loan', label: 'Loan (7.99% APR)', rate: 7.99 },
  { id: 'cash', label: 'Cash', rate: 0 },
  { id: 'lease', label: 'Lease', rate: 0 },
  { id: 'ppa', label: 'PPA', rate: 0 },
];

const inputCls =
  'mt-1.5 w-full rounded-xl border border-glass-stroke bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/50 placeholder:text-on-surface-variant';

function parseNumber(raw, fallback = 0) {
  if (raw == null || raw === '' || raw === 'Not Available') return fallback;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const n = Number(String(raw).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

function estimateMonthlyLoanPayment(principal, annualRatePct, years = 20) {
  const p = Math.max(0, Number(principal) || 0);
  const r = (Number(annualRatePct) || 0) / 100 / 12;
  const n = years * 12;
  if (p <= 0) return 0;
  if (r <= 0) return Math.round(p / n);
  const payment = (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return Math.round(payment);
}

function buildDefaults(lead) {
  const solar = lead?.solar || {};
  const systemSizeKw = parseNumber(solar.recommendedSize, parseNumber(lead?.roof_size, 2000) / 250 || 8.4);
  const annualProduction = parseNumber(solar.annualProduction, Math.round(systemSizeKw * 1275));
  const savings25 = parseNumber(solar.twentyFiveYearSavings, lead?.estimated_savings || systemSizeKw * 3800);
  const annualSavings = Math.round(savings25 / 25) || Math.round(systemSizeKw * 250);
  const systemPrice = Math.round(systemSizeKw * 2950);
  const financing = 'loan';
  const rate = 7.99;
  const monthlyPayment = estimateMonthlyLoanPayment(systemPrice * 0.7, rate);

  return {
    systemSizeKw: Number(systemSizeKw.toFixed(1)),
    annualProduction,
    annualSavings,
    systemPrice,
    financing,
    monthlyPayment,
  };
}

function Field({ label, tip, children }) {
  return (
    <label className="block text-xs font-semibold text-on-surface">
      <span className="inline-flex items-center gap-1">
        {label}
        {tip && (
          <span
            className="material-symbols-outlined text-[14px] text-on-surface-variant cursor-help"
            title={tip}
          >
            info
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-glass-stroke last:border-0">
      <span className="text-[11px] text-on-surface-variant">{label}</span>
      <span className="text-[12px] font-semibold text-on-surface text-right font-mono">{value}</span>
    </div>
  );
}

/**
 * Lead 360 Proposal tab — create/configure proposal UI matching CRM mockups.
 */
export default function LeadProposalPanel({
  lead,
  leadId,
  displayName,
  phoneDisplay,
  emailDisplay,
  proposalEngagement,
  proposalEvents,
  onOpenPreview,
  onRefresh,
}) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => buildDefaults(lead));
  const [busy, setBusy] = useState('');
  const [shareableUrl, setShareableUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setForm(buildDefaults(lead));
  }, [lead?.id, lead?.solar?.recommendedSize, lead?.estimated_savings]);

  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;
    fetch(`${API_BASE}/api/proposals/lead/${leadId}`, { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.proposal) return;
        const p = data.proposal;
        if (p.slug) setShareableUrl(`${window.location.origin}/proposal/${p.slug}`);
        setForm((prev) => ({
          ...prev,
          systemSizeKw: parseNumber(p.system_size_kw, prev.systemSizeKw),
          systemPrice: parseNumber(p.gross_cost, prev.systemPrice),
          financing: p.financing_type || prev.financing,
          monthlyPayment:
            p.financing_type === 'loan'
              ? estimateMonthlyLoanPayment(
                  parseNumber(p.gross_cost, prev.systemPrice) * 0.7,
                  parseNumber(p.loan_interest_rate, 7.99),
                )
              : p.financing_type === 'cash'
                ? 0
                : prev.monthlyPayment,
        }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const financingMeta = useMemo(
    () => FINANCING_OPTIONS.find((f) => f.id === form.financing) || FINANCING_OPTIONS[0],
    [form.financing],
  );

  const updateField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'systemSizeKw') {
        const kw = parseNumber(value, prev.systemSizeKw);
        next.annualProduction = Math.round(kw * 1275);
        next.annualSavings = Math.round(kw * 250);
        next.systemPrice = Math.round(kw * 2950);
        if (prev.financing === 'loan') {
          next.monthlyPayment = estimateMonthlyLoanPayment(next.systemPrice * 0.7, 7.99);
        }
      }
      if (key === 'systemPrice' && prev.financing === 'loan') {
        next.monthlyPayment = estimateMonthlyLoanPayment(parseNumber(value, prev.systemPrice) * 0.7, 7.99);
      }
      if (key === 'financing') {
        if (value === 'cash') next.monthlyPayment = 0;
        else if (value === 'loan') {
          next.monthlyPayment = estimateMonthlyLoanPayment(parseNumber(next.systemPrice) * 0.7, 7.99);
        } else {
          next.monthlyPayment = Math.round(parseNumber(next.systemPrice) / 240);
        }
      }
      return next;
    });
  };

  const statusBadge = proposalEngagement?.signedAt
    ? { label: 'Accepted', cls: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' }
    : proposalEngagement?.viewCount > 0
      ? {
          label: `Viewed ${proposalEngagement.viewCount}×`,
          cls: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
        }
      : proposalEngagement || shareableUrl
        ? { label: 'Sent', cls: 'bg-sky-500/15 text-sky-700 border-sky-500/30' }
        : { label: 'Draft', cls: 'bg-surface-container text-on-surface-variant border-glass-stroke' };

  const createOrUpdateProposal = async () => {
    if (!getToken()) throw new Error('Please log in.');
    const panelCount = Math.max(1, Math.ceil(parseNumber(form.systemSizeKw) * 2.8));
    const res = await fetch(`${API_BASE}/api/proposals`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        leadId: Number(leadId),
        systemSizeKw: parseNumber(form.systemSizeKw),
        panelCount,
        grossCost: parseNumber(form.systemPrice),
        financingType: form.financing,
        loanInterestRate: form.financing === 'loan' ? 7.99 : 5.99,
        batteryType: 'none',
        batteryCount: 0,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save proposal');
    const fullUrl = `${window.location.origin}${data.shareableUrl}`;
    setShareableUrl(fullUrl);
    return fullUrl;
  };

  const handleSendProposal = async () => {
    setBusy('send');
    setMessage('');
    try {
      const url = await createOrUpdateProposal();
      await navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      setMessage('Proposal link created and copied.');
      setStep(4);
      onRefresh?.();
    } catch (err) {
      setMessage(err.message || 'Could not send proposal');
    } finally {
      setBusy('');
    }
  };

  const handleEmail = async () => {
    try {
      const url = shareableUrl || (await createOrUpdateProposal());
      const to = encodeURIComponent(emailDisplay || lead?.email || '');
      const subject = encodeURIComponent(`Solar proposal — ${lead?.address || 'your property'}`);
      const body = encodeURIComponent(
        `Hi ${displayName || 'there'},\n\nHere is your solar proposal for ${lead?.address || 'your property'}:\n${url}\n`,
      );
      window.open(`mailto:${to}?subject=${subject}&body=${body}`, '_blank');
      onRefresh?.();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const handlePreview = () => {
    setStep(3);
    onOpenPreview?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-on-surface">Create Proposal</h3>
          <p className="text-[11px] text-on-surface-variant mt-0.5">Step {step} of 4</p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${statusBadge.cls}`}>
          {statusBadge.label}
        </span>
      </div>

      <div className="flex items-start gap-1 sm:gap-2 overflow-x-auto custom-scrollbar pb-1">
        {STEPS.map((s, idx) => {
          const active = step === s.id;
          const done = step > s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className="flex items-center gap-2 min-w-0 shrink-0"
            >
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border ${
                  active
                    ? 'bg-primary text-on-primary border-primary'
                    : done
                      ? 'bg-primary/15 text-primary border-primary/40'
                      : 'bg-surface-container text-on-surface-variant border-glass-stroke'
                }`}
              >
                {done ? <span className="material-symbols-outlined text-sm">check</span> : s.id}
              </span>
              <span
                className={`text-[11px] font-semibold hidden sm:inline ${
                  active ? 'text-on-surface' : 'text-on-surface-variant'
                }`}
              >
                {s.label}
              </span>
              {idx < STEPS.length - 1 && (
                <span className="w-6 sm:w-10 h-px bg-glass-stroke mx-1 hidden sm:block" />
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-4">
        <div className="crm-panel p-4 sm:p-5 space-y-4">
          {step === 1 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="System Size (kW)" tip="Recommended system size from rooftop analysis">
                  <input
                    className={inputCls}
                    type="number"
                    step="0.1"
                    min="1"
                    value={form.systemSizeKw}
                    onChange={(e) => updateField('systemSizeKw', e.target.value)}
                  />
                </Field>
                <Field label="Est. Production (kWh / year)" tip="Modeled annual production">
                  <input
                    className={inputCls}
                    type="number"
                    value={form.annualProduction}
                    onChange={(e) => updateField('annualProduction', e.target.value)}
                  />
                </Field>
                <Field label="Est. Savings ($ / year)" tip="Estimated year-1 utility savings">
                  <input
                    className={inputCls}
                    type="number"
                    value={form.annualSavings}
                    onChange={(e) => updateField('annualSavings', e.target.value)}
                  />
                </Field>
                <Field label="System Price" tip="Gross installed system price before incentives">
                  <input
                    className={inputCls}
                    type="number"
                    value={form.systemPrice}
                    onChange={(e) => updateField('systemPrice', e.target.value)}
                  />
                </Field>
                <Field label="Financing Option" tip="How the homeowner will pay">
                  <select
                    className={inputCls}
                    value={form.financing}
                    onChange={(e) => updateField('financing', e.target.value)}
                  >
                    {FINANCING_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Est. Payment ($ / month)" tip="Estimated monthly payment">
                  <input
                    className={inputCls}
                    type="number"
                    value={form.monthlyPayment}
                    onChange={(e) => updateField('monthlyPayment', e.target.value)}
                  />
                </Field>
              </div>

              <div className="rounded-xl border border-primary/25 bg-primary/10 px-3.5 py-3 flex items-start gap-2">
                <span className="material-symbols-outlined text-amber-400 text-base mt-0.5">auto_awesome</span>
                <p className="text-[12px] text-on-surface leading-relaxed">
                  <span className="font-bold">AI Suggestion:</span> Based on this system size and location,
                  this proposal has a high approval probability.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold px-4 py-2.5 hover:brightness-110"
                >
                  Next: Customer Info
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-glass-stroke bg-surface-container p-3">
                  <p className="text-[9px] uppercase text-on-surface-variant mb-1">Customer</p>
                  <p className="text-sm font-semibold text-on-surface">{displayName}</p>
                </div>
                <div className="rounded-xl border border-glass-stroke bg-surface-container p-3">
                  <p className="text-[9px] uppercase text-on-surface-variant mb-1">Address</p>
                  <p className="text-sm font-semibold text-on-surface break-words">{lead?.address || '—'}</p>
                </div>
                <div className="rounded-xl border border-glass-stroke bg-surface-container p-3">
                  <p className="text-[9px] uppercase text-on-surface-variant mb-1">Phone</p>
                  <p className="text-sm font-semibold text-on-surface font-mono">
                    {phoneDisplay || 'Not available'}
                  </p>
                </div>
                <div className="rounded-xl border border-glass-stroke bg-surface-container p-3">
                  <p className="text-[9px] uppercase text-on-surface-variant mb-1">Email</p>
                  <p className="text-sm font-semibold text-on-surface break-all">
                    {emailDisplay || 'Not available'}
                  </p>
                </div>
              </div>
              <div className="flex justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-xl border border-glass-stroke px-4 py-2.5 text-xs font-bold text-on-surface-variant hover:bg-surface-container"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold px-4 py-2.5"
                >
                  Next: Preview
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-on-surface-variant">
                Review the interactive proposal document, then continue to send a public link.
              </p>
              <button
                type="button"
                onClick={handlePreview}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary/15 border border-primary/30 text-primary text-xs font-bold px-4 py-2.5 hover:bg-primary/20"
              >
                <span className="material-symbols-outlined text-base">visibility</span>
                Open proposal preview
              </button>
              <div className="flex justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-xl border border-glass-stroke px-4 py-2.5 text-xs font-bold text-on-surface-variant"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold px-4 py-2.5"
                >
                  Next: Send
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-on-surface-variant">
                Generate a tracked public link and share it by email or WhatsApp.
              </p>
              {shareableUrl && (
                <div className="rounded-xl border border-glass-stroke bg-surface-container p-3 break-all text-[11px] font-mono text-on-surface">
                  {shareableUrl}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={handleSendProposal}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-on-primary text-xs font-bold px-4 py-2.5 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">link</span>
                  {busy === 'send' ? 'Creating…' : copied ? 'Link copied' : 'Create & copy link'}
                </button>
                <button
                  type="button"
                  onClick={handleEmail}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-glass-stroke text-xs font-bold px-4 py-2.5 text-on-surface hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-base">mail</span>
                  Email proposal
                </button>
                <button
                  type="button"
                  onClick={handlePreview}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-glass-stroke text-xs font-bold px-4 py-2.5 text-on-surface hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                  Preview / PDF
                </button>
              </div>
              {message && <p className="text-[11px] text-primary font-semibold">{message}</p>}
              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded-xl border border-glass-stroke px-4 py-2.5 text-xs font-bold text-on-surface-variant"
              >
                Back
              </button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="crm-panel p-4">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
              Proposal Summary
            </h4>
            <SummaryRow label="System Size" value={`${form.systemSizeKw} kW`} />
            <SummaryRow
              label="Est. Production"
              value={`${Number(form.annualProduction).toLocaleString()} kWh / year`}
            />
            <SummaryRow
              label="Est. Savings"
              value={`$${Number(form.annualSavings).toLocaleString()} / year`}
            />
            <SummaryRow
              label="System Price"
              value={`$${Number(form.systemPrice).toLocaleString()}`}
            />
            <SummaryRow label="Financing" value={financingMeta.label} />
            <SummaryRow
              label="Est. Payment"
              value={
                form.financing === 'cash'
                  ? 'Paid in full'
                  : `$${Number(form.monthlyPayment).toLocaleString()} / month`
              }
            />
          </div>

          <div className="crm-panel p-4 space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">
              Actions
            </h4>
            <button
              type="button"
              disabled={!!busy}
              onClick={handleSendProposal}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 text-primary text-xs font-bold px-3 py-2.5 hover:bg-primary/15 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">send</span>
              Send Proposal
            </button>
            <button
              type="button"
              onClick={handlePreview}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-glass-stroke text-on-surface text-xs font-bold px-3 py-2.5 hover:bg-surface-container"
            >
              <span className="material-symbols-outlined text-base">download</span>
              Download PDF
            </button>
          </div>
        </div>
      </div>

      <div className="crm-panel p-4 sm:p-5 space-y-3">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          Engagement tracking
        </h4>
        {proposalEngagement ? (
          <>
            <div className="rounded-xl border border-primary/25 bg-primary/10 p-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-on-surface">
                  Viewed {proposalEngagement.viewCount || 0} time
                  {(proposalEngagement.viewCount || 0) === 1 ? '' : 's'}
                </p>
                {proposalEngagement.viewCount > 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    High engagement — recommended: follow up today.
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              {[
                ['Status', proposalEngagement.status],
                ['Views', proposalEngagement.viewCount],
                ['Downloads', proposalEngagement.downloadCount],
                ['Financing', proposalEngagement.financingViewedAt ? 'Viewed' : '—'],
                ['Equipment', proposalEngagement.equipmentViewedAt ? 'Viewed' : '—'],
                ['Accepted', proposalEngagement.signedAt ? 'Yes' : '—'],
              ].map(([label, value]) => (
                <div key={label} className="p-2.5 rounded-lg bg-surface-container border border-glass-stroke">
                  <p className="text-on-surface-variant uppercase text-[9px]">{label}</p>
                  <p className="text-on-surface font-bold capitalize font-mono">{value ?? '—'}</p>
                </div>
              ))}
            </div>
            {proposalEvents?.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                {proposalEvents.slice(0, 12).map((ev) => (
                  <div key={ev.id} className="flex justify-between gap-2 text-[10px]">
                    <span className="text-primary font-bold uppercase">
                      {String(ev.event_type || '').replace(/_/g, ' ')}
                    </span>
                    <span className="text-on-surface-variant">
                      {new Date(ev.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-[11px] text-on-surface-variant">
            No proposal sent yet. Create a link above to start tracking opens, financing views, and
            acceptance.
          </p>
        )}
      </div>
    </div>
  );
}
