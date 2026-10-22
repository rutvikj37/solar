const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString()}`;

const OWNERSHIP_LABELS = { cash: 'Cash purchase', loan: 'Solar loan', lease: 'Lease', ppa: 'Power purchase agreement (PPA)' };

function incentiveRate(item) {
  if (item.kind === 'percent') {
    const pct = `${Math.round(Number(item.rate) * 100)}%`;
    return item.cap != null ? `${pct}, max ${money(item.cap)}` : pct;
  }
  if (item.kind === 'per_watt') return `$${item.rate}/W`;
  return money(item.rate);
}

/**
 * Incentive lines + modeling assumptions returned by the server economics module (roi.assumptions).
 * tone="dark" for the fixed-dark printable proposal document; default uses theme tokens.
 */
export default function ProposalAssumptions({ roi, tone = 'theme' }) {
  if (!roi?.assumptions) return null;
  const a = roi.assumptions;
  const dark = tone === 'dark';
  const box = dark
    ? 'p-4 bg-white/5 border border-white/10 rounded-xl text-slate-300'
    : 'glass-card p-4 rounded-xl border border-outline-variant text-on-surface-variant';
  const heading = dark ? 'text-white' : 'text-on-surface';
  const muted = dark ? 'text-slate-400' : 'text-on-surface-variant/80';
  const thirdParty = a.ownership === 'lease' || a.ownership === 'ppa';
  const incentives = Array.isArray(roi.incentives) ? roi.incentives : [];

  return (
    <div className={`${box} space-y-3 text-[11px] leading-relaxed`}>
      <h4 className={`font-bold text-xs uppercase tracking-wider ${heading}`}>Incentives &amp; assumptions</h4>

      <div className="space-y-1">
        <p className={`font-semibold ${heading}`}>{OWNERSHIP_LABELS[a.ownership] || a.ownership}</p>
        {incentives.length === 0 ? (
          <p>No incentives configured for this location and ownership type.</p>
        ) : (
          <ul className="space-y-1">
            {incentives.map((item) => (
              <li key={item.code} className="flex justify-between gap-3">
                <span>
                  {item.label} <span className={muted}>({incentiveRate(item)})</span>
                  {item.notes ? <span className={`block ${muted}`}>{item.notes}</span> : null}
                </span>
                <span className={`font-mono shrink-0 ${heading}`}>
                  {item.claimedBy === 'third_party' ? `${money(item.amount)}*` : `−${money(item.amount)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        {thirdParty && roi.thirdPartyIncentivesTotal > 0 ? (
          <p className={muted}>
            * Claimed by the lease/PPA provider, not the homeowner; reflected only as lower monthly pricing.
          </p>
        ) : null}
        {roi.otherRebates > 0 ? (
          <p className="flex justify-between">
            <span>Other rebates</span>
            <span className={`font-mono ${heading}`}>−{money(roi.otherRebates)}</span>
          </p>
        ) : null}
        {a.incentivesAsOf ? <p className={muted}>Incentive data as of {a.incentivesAsOf}.</p> : null}
      </div>

      <ul className={`space-y-0.5 ${muted}`}>
        <li>
          Utility rate: ${Number(a.utilityRate).toFixed(3)}/kWh — {a.utilityRateLabel}
          {a.utilityRateAsOf ? ` (as of ${a.utilityRateAsOf})` : ''}
        </li>
        <li>
          Production: {Number(a.annualProductionKwh).toLocaleString()} kWh/yr — {a.productionLabel}
        </li>
        <li>
          Rate escalation {a.escalationPct}%/yr · panel degradation {a.degradationPct}%/yr · {a.analysisYears}-year
          analysis
        </li>
        {thirdParty && a.leaseDiscountRatePct ? (
          <li>Lease/PPA payment modeled as level payments at {a.leaseDiscountRatePct}% over {a.analysisYears} years.</li>
        ) : null}
        <li>{a.exportCredit}</li>
        <li>{a.disclaimer}</li>
      </ul>
    </div>
  );
}
