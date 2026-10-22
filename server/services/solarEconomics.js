/**
 * Shared solar savings / incentives maths for homeowner reports and proposals.
 * Every result carries an `assumptions` object so the UI can show where numbers came from.
 */

import db from '../db.js';
import { fetchPvWatts, fetchUtilityRate, isNrelConfigured } from './nrel.js';
import {
  NATIONAL_AVG_RESIDENTIAL_RATE,
  SOLAR_MODEL_DEFAULTS,
  STATE_AVG_RESIDENTIAL_RATES,
  STATE_AVG_RESIDENTIAL_RATE_AS_OF,
} from '../config/solarIncentivesDefaults.js';

const RATE_CACHE_DAYS = Number(process.env.UTILITY_RATE_CACHE_DAYS) || 90;
const RATE_MISS_CACHE_DAYS = 3;
const MIN_PLAUSIBLE_RATE = 0.04;
const MAX_PLAUSIBLE_RATE = 0.8;

export const OWNERSHIP_TYPES = ['cash', 'loan', 'lease', 'ppa'];
export const THIRD_PARTY_OWNERSHIP = new Set(['lease', 'ppa']);
const LEASE_DISCOUNT_RATE_PCT = Number(process.env.LEASE_DISCOUNT_RATE_PCT) || 7;

const round4 = (n) => Number((Math.round(n * 10000) / 10000).toFixed(4));

export function normalizeOwnership(value) {
  const v = String(value || '').toLowerCase().trim();
  if (v === 'lease_ppa' || v === 'lease/ppa') return 'lease';
  return OWNERSHIP_TYPES.includes(v) ? v : 'cash';
}

export function normalizeSegment(value) {
  return String(value || '').toLowerCase() === 'commercial' ? 'commercial' : 'residential';
}

export function normalizeStateCode(value) {
  const s = String(value || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : null;
}

export function stateFromAddress(address = '') {
  const text = String(address || '');
  const m = text.match(/\b([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/) || text.match(/,\s*([A-Za-z]{2})\s*(?:,|$)/);
  return m ? normalizeStateCode(m[1]) : null;
}

function rateCacheKey(lat, lng) {
  return `${Number(lat).toFixed(2)},${Number(lng).toFixed(2)}`;
}

function fallbackRate(state) {
  const code = normalizeStateCode(state);
  if (code && STATE_AVG_RESIDENTIAL_RATES[code]) {
    return {
      ratePerKwh: STATE_AVG_RESIDENTIAL_RATES[code],
      source: 'state_average',
      label: `${code} average residential rate (EIA, approx.)`,
      utilityName: null,
      asOf: STATE_AVG_RESIDENTIAL_RATE_AS_OF,
    };
  }
  return {
    ratePerKwh: NATIONAL_AVG_RESIDENTIAL_RATE,
    source: 'national_average',
    label: 'US average residential rate (EIA, approx.)',
    utilityName: null,
    asOf: STATE_AVG_RESIDENTIAL_RATE_AS_OF,
  };
}

function nrelRateResult(rate, utilityName) {
  return {
    ratePerKwh: round4(rate),
    source: 'nrel',
    label: utilityName
      ? `NREL utility rate lookup — ${utilityName} (historical average; verify against a current bill)`
      : 'NREL utility rate lookup (historical average; verify against a current bill)',
    utilityName: utilityName || null,
    asOf: null,
  };
}

/**
 * Residential $/kWh at a location. Order: cached/live NREL lookup → state average → US average.
 * UTILITY_RATE_SOURCE=state_average skips NREL entirely.
 */
export async function resolveUtilityRate({ lat, lng, state } = {}) {
  const preferNrel = String(process.env.UTILITY_RATE_SOURCE || 'nrel').toLowerCase() !== 'state_average';
  const hasCoords = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && lat !== null && lng !== null;

  if (preferNrel && hasCoords && isNrelConfigured()) {
    const key = rateCacheKey(lat, lng);
    try {
      const [rows] = await db.query(
        'SELECT rate_per_kwh, utility_name, source FROM utility_rate_cache WHERE cache_key = ? AND expires_at > NOW() LIMIT 1',
        [key],
      );
      if (rows.length) {
        const row = rows[0];
        if (row.source === 'nrel' && row.rate_per_kwh != null) {
          return nrelRateResult(Number(row.rate_per_kwh), row.utility_name);
        }
        return fallbackRate(state);
      }
    } catch (err) {
      console.warn('[solarEconomics] rate cache read failed:', err.message);
    }

    let live = null;
    try {
      live = await fetchUtilityRate(Number(lat), Number(lng));
    } catch {
      live = null;
    }
    const rate = Number(live?.ratePerKwh);
    const plausible = Number.isFinite(rate) && rate >= MIN_PLAUSIBLE_RATE && rate <= MAX_PLAUSIBLE_RATE;
    try {
      await db.query(
        `INSERT INTO utility_rate_cache (cache_key, rate_per_kwh, utility_name, source, fetched_at, expires_at)
         VALUES (?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? DAY))
         ON DUPLICATE KEY UPDATE rate_per_kwh = VALUES(rate_per_kwh), utility_name = VALUES(utility_name),
           source = VALUES(source), fetched_at = VALUES(fetched_at), expires_at = VALUES(expires_at)`,
        [
          key,
          plausible ? rate : null,
          plausible ? String(live.utilityName || '').slice(0, 255) || null : null,
          plausible ? 'nrel' : 'miss',
          plausible ? RATE_CACHE_DAYS : RATE_MISS_CACHE_DAYS,
        ],
      );
    } catch (err) {
      console.warn('[solarEconomics] rate cache write failed:', err.message);
    }
    if (plausible) return nrelRateResult(rate, live.utilityName);
  }

  return fallbackRate(state);
}

function parseNumber(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const n = parseFloat(String(value).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** kWh/kW/yr from a lead's stored solar_json (Google Solar sizing), when present. */
export function yieldFromSolarJson(solar = {}) {
  const prod = parseNumber(solar.annualProduction);
  const kw = parseNumber(solar.recommendedSize);
  if (prod && kw && kw > 0) {
    const y = prod / kw;
    if (y > 500 && y < 2500) {
      return {
        yieldKwhPerKw: y,
        source: String(solar.productionSource || '').includes('NREL') ? 'nrel_pvwatts' : 'google_solar',
      };
    }
  }
  return null;
}

/**
 * Annual AC production for `systemKw`. Order: known site yield → NREL PVWatts → national fallback yield.
 */
export async function resolveAnnualProduction({ lat, lng, systemKw, knownYield = null, allowPvWatts = true } = {}) {
  const kw = Math.max(0.5, Number(systemKw) || 0);
  if (knownYield?.yieldKwhPerKw) {
    return {
      annualKwh: Math.round(kw * knownYield.yieldKwhPerKw),
      yieldKwhPerKw: Math.round(knownYield.yieldKwhPerKw),
      source: knownYield.source || 'google_solar',
      label: knownYield.source === 'nrel_pvwatts' ? 'NREL PVWatts site model' : 'Google Solar roof model',
    };
  }
  const hasCoords = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && lat !== null && lng !== null;
  if (allowPvWatts && hasCoords && isNrelConfigured()) {
    try {
      const pv = await fetchPvWatts({ lat: Number(lat), lng: Number(lng), systemCapacityKw: kw });
      if (pv?.annualKwh > 0) {
        return {
          annualKwh: pv.annualKwh,
          yieldKwhPerKw: Math.round(pv.annualKwh / kw),
          source: 'nrel_pvwatts',
          label: 'NREL PVWatts v8 (20° tilt, south-facing, 14% losses)',
        };
      }
    } catch {
      /* fall through */
    }
  }
  const y = SOLAR_MODEL_DEFAULTS.fallbackYieldKwhPerKw;
  return {
    annualKwh: Math.round(kw * y),
    yieldKwhPerKw: y,
    source: 'national_average',
    label: `US average yield (${y} kWh per kW per year)`,
  };
}

function rowApplies(row, { state, segment, ownership }) {
  const ownerships = String(row.ownership || '').split(',').map((s) => s.trim().toLowerCase());
  if (!ownerships.includes(ownership)) return false;
  if (row.segment !== 'any' && row.segment !== segment) return false;
  if (row.jurisdiction !== 'US' && row.jurisdiction !== state) return false;
  return true;
}

export async function listIncentives({ includeDisabled = false } = {}) {
  const [rows] = await db.query(
    `SELECT id, code, jurisdiction, label, segment, ownership, kind, amount, cap_amount, enabled,
            DATE_FORMAT(as_of, '%Y-%m-%d') AS as_of, DATE_FORMAT(expires_on, '%Y-%m-%d') AS expires_on, notes, updated_at
     FROM solar_incentives ${includeDisabled ? '' : 'WHERE enabled = 1'}
     ORDER BY jurisdiction = 'US' DESC, jurisdiction, code`,
  );
  return rows;
}

export async function getApplicableIncentives({ state, segment, ownership } = {}) {
  const ctx = {
    state: normalizeStateCode(state),
    segment: normalizeSegment(segment),
    ownership: normalizeOwnership(ownership),
  };
  let rows = [];
  try {
    rows = await listIncentives();
  } catch (err) {
    console.warn('[solarEconomics] incentives unavailable:', err.message);
    return [];
  }
  const today = new Date().toISOString().slice(0, 10);
  return rows.filter((r) => rowApplies(r, ctx) && (!r.expires_on || r.expires_on >= today));
}

/**
 * Dollar value of each incentive. Owner-claimed credits reduce net cost (cash/loan);
 * for lease/PPA every credit is claimed by the third-party owner and only lowers pricing.
 */
export function computeIncentiveAmounts({ incentives = [], grossCost, systemKw, ownership }) {
  const thirdParty = THIRD_PARTY_OWNERSHIP.has(normalizeOwnership(ownership));
  const items = incentives.map((row) => {
    const amount = Number(row.amount) || 0;
    let value = 0;
    if (row.kind === 'percent') value = grossCost * amount;
    else if (row.kind === 'per_watt') value = (Number(systemKw) || 0) * 1000 * amount;
    else value = amount;
    const cap = row.cap_amount != null ? Number(row.cap_amount) : null;
    if (cap != null && cap >= 0) value = Math.min(value, cap);
    return {
      code: row.code,
      label: row.label,
      jurisdiction: row.jurisdiction,
      kind: row.kind,
      rate: amount,
      cap,
      amount: Math.round(Math.max(0, value)),
      claimedBy: thirdParty ? 'third_party' : 'owner',
      asOf: row.as_of || null,
      notes: row.notes || null,
    };
  });
  const ownerTotal = items.filter((i) => i.claimedBy === 'owner').reduce((s, i) => s + i.amount, 0);
  const thirdPartyTotal = items.filter((i) => i.claimedBy === 'third_party').reduce((s, i) => s + i.amount, 0);
  const asOfDates = items.map((i) => i.asOf).filter(Boolean).sort();
  return {
    items,
    ownerTotal,
    thirdPartyTotal,
    asOf: asOfDates.length ? asOfDates[asOfDates.length - 1] : null,
  };
}

/**
 * Bill savings by year: production (degrading) valued at the escalating retail rate,
 * capped at household usage when known (exports are not credited).
 */
export function projectSavings({
  annualProductionKwh,
  ratePerKwh,
  annualUsageKwh = null,
  escalationPct = SOLAR_MODEL_DEFAULTS.utilityEscalationPct,
  degradationPct = SOLAR_MODEL_DEFAULTS.panelDegradationPct,
  years = SOLAR_MODEL_DEFAULTS.analysisYears,
}) {
  const perYear = [];
  let cumulative = 0;
  const esc = (Number(escalationPct) || 0) / 100;
  const deg = (Number(degradationPct) || 0) / 100;
  for (let y = 1; y <= years; y += 1) {
    const prod = (Number(annualProductionKwh) || 0) * Math.pow(1 - deg, y - 1);
    const offset = annualUsageKwh ? Math.min(prod, annualUsageKwh) : prod;
    const rate = (Number(ratePerKwh) || 0) * Math.pow(1 + esc, y - 1);
    const savings = offset * rate;
    cumulative += savings;
    perYear.push({ year: y, savings, cumulative });
  }
  const at = (n) => Math.round(perYear[Math.min(n, perYear.length) - 1]?.cumulative || 0);
  return {
    year1: Math.round(perYear[0]?.savings || 0),
    cumulative5: at(5),
    cumulative10: at(10),
    cumulative25: at(25),
    total: Math.round(cumulative),
    perYear,
  };
}

function amortizedMonthly(principal, annualRatePct, years) {
  const r = (Number(annualRatePct) || 0) / 100 / 12;
  const n = Math.max(1, Math.round((Number(years) || 0) * 12));
  if (principal <= 0) return 0;
  if (r <= 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function batteryCostFor({ batteryType, batteryCount, batteryCost }) {
  if (batteryCost != null && Number(batteryCost) > 0) return Number(batteryCost);
  const count = Number(batteryCount || 1);
  if (batteryType === 'tesla_powerwall' || batteryType === 'tesla_pw3') return 11500 * count;
  if (batteryType === 'enphase_iq' || batteryType === 'enphase_iq5p') return 6500 * count;
  return 0;
}

/**
 * Pure proposal maths once rate, production and incentives are resolved.
 * Response keeps the legacy roi fields (grossCost, netCost, est25yrSavings, paybackYears, monthlyPayment, year1Savings).
 */
export function computeProposalEconomics({
  systemKw,
  grossCost,
  batteryCost = 0,
  ownership = 'cash',
  segment = 'residential',
  state = null,
  loanTermYears = 20,
  loanInterestRate = 5.99,
  downPayment = 0,
  otherRebates = 0,
  escalationPct = SOLAR_MODEL_DEFAULTS.utilityEscalationPct,
  rate,
  production,
  incentives = [],
}) {
  const own = normalizeOwnership(ownership);
  const totalGross = Math.max(0, (Number(grossCost) || 0) + (Number(batteryCost) || 0));
  const rebates = Math.max(0, Number(otherRebates) || 0);
  const credits = computeIncentiveAmounts({ incentives, grossCost: totalGross, systemKw, ownership: own });
  const years = SOLAR_MODEL_DEFAULTS.analysisYears;
  const savings = projectSavings({
    annualProductionKwh: production.annualKwh,
    ratePerKwh: rate.ratePerKwh,
    escalationPct,
    years,
  });

  let netCost;
  let monthlyPayment = 0;
  let totalPayments = 0;
  let upfront = 0;
  let paybackYears = null;
  let ppaRatePerKwh = null;

  if (THIRD_PARTY_OWNERSHIP.has(own)) {
    // Third-party owner claims credits; homeowner pays a fixed monthly amount over the analysis period.
    const financed = Math.max(0, totalGross - credits.thirdPartyTotal - rebates);
    monthlyPayment = amortizedMonthly(financed, LEASE_DISCOUNT_RATE_PCT, years);
    totalPayments = monthlyPayment * 12 * years;
    netCost = 0;
    if (own === 'ppa' && production.annualKwh > 0) {
      ppaRatePerKwh = round4((monthlyPayment * 12) / production.annualKwh);
    }
  } else {
    netCost = Math.max(0, totalGross - credits.ownerTotal - rebates);
    if (own === 'loan') {
      upfront = Math.max(0, Number(downPayment) || 0);
      const principal = Math.max(0, totalGross - upfront);
      monthlyPayment = amortizedMonthly(principal, loanInterestRate, loanTermYears);
      totalPayments = monthlyPayment * 12 * (Number(loanTermYears) || 0);
    } else {
      upfront = totalGross;
    }
    const hit = savings.perYear.find((y) => y.cumulative >= netCost);
    paybackYears = netCost <= 0 ? 0 : hit ? hit.year : null;
    if (hit && hit.year > 1) {
      const prev = savings.perYear[hit.year - 2];
      paybackYears = Number((prev.year + (netCost - prev.cumulative) / Math.max(1, hit.savings)).toFixed(1));
    } else if (hit) {
      paybackYears = Number((netCost / Math.max(1, hit.savings)).toFixed(1));
    }
  }

  let est25yrSavings;
  if (own === 'cash') est25yrSavings = savings.total - netCost;
  else if (own === 'loan') est25yrSavings = savings.total - upfront - totalPayments + credits.ownerTotal + rebates;
  else est25yrSavings = savings.total - totalPayments;

  const assumptions = {
    ownership: own,
    segment: normalizeSegment(segment),
    state: normalizeStateCode(state),
    utilityRate: rate.ratePerKwh,
    utilityRateSource: rate.source,
    utilityRateLabel: rate.label,
    utilityRateAsOf: rate.asOf || null,
    annualProductionKwh: production.annualKwh,
    yieldKwhPerKw: production.yieldKwhPerKw,
    productionSource: production.source,
    productionLabel: production.label,
    escalationPct: Number(escalationPct),
    degradationPct: SOLAR_MODEL_DEFAULTS.panelDegradationPct,
    analysisYears: years,
    exportCredit: 'Production valued at the retail rate (full net metering). Actual export credit varies by utility.',
    incentivesAsOf: credits.asOf,
    leaseDiscountRatePct: THIRD_PARTY_OWNERSHIP.has(own) ? LEASE_DISCOUNT_RATE_PCT : null,
    disclaimer:
      'Estimates only. Incentive eligibility depends on tax liability and current law; confirm with a tax professional.',
  };

  return {
    grossCost: Math.round(totalGross),
    incentives: credits.items,
    incentivesTotal: THIRD_PARTY_OWNERSHIP.has(own) ? credits.thirdPartyTotal : credits.ownerTotal,
    ownerIncentivesTotal: credits.ownerTotal,
    thirdPartyIncentivesTotal: credits.thirdPartyTotal,
    otherRebates: Math.round(rebates),
    stateRebate: Math.round(rebates),
    itc30: 0,
    netCost: Math.round(netCost),
    upfrontCost: Math.round(upfront),
    est25yrSavings: Math.round(est25yrSavings),
    paybackYears,
    monthlyPayment: Math.round(monthlyPayment),
    ppaRatePerKwh,
    year1Savings: savings.year1,
    lifetimeBillSavings: savings.total,
    annualProductionKwh: production.annualKwh,
    utilityRate: rate.ratePerKwh,
    assumptions,
  };
}

/**
 * Resolve inputs (rate, production, incentives) for a proposal and run the maths.
 * `lead` may carry latitude/longitude/address/solar_json; `inputs` mirrors proposal fields.
 */
export async function buildProposalEconomics({ lead = {}, inputs = {}, cached = {} } = {}) {
  const lat = lead.latitude != null ? Number(lead.latitude) : null;
  const lng = lead.longitude != null ? Number(lead.longitude) : null;
  const state = normalizeStateCode(inputs.state) || normalizeStateCode(cached.state) || stateFromAddress(lead.address);
  const ownership = normalizeOwnership(inputs.financingType);
  const segment = normalizeSegment(inputs.segment);
  const systemKw = Number(inputs.systemSizeKw) || 8.5;

  let solar = lead.solar_json;
  if (typeof solar === 'string') {
    try { solar = JSON.parse(solar); } catch { solar = {}; }
  }

  const rate = cached.utilityRate != null && cached.rateSource
    ? { ratePerKwh: Number(cached.utilityRate), source: cached.rateSource, label: cached.rateLabel, asOf: cached.rateAsOf || null }
    : await resolveUtilityRate({ lat, lng, state });
  const knownYield = cached.yieldKwhPerKw
    ? { yieldKwhPerKw: Number(cached.yieldKwhPerKw), source: cached.productionSource }
    : yieldFromSolarJson(solar || {});
  const production = cached.yieldKwhPerKw && cached.productionLabel
    ? {
        annualKwh: Math.round(systemKw * Number(cached.yieldKwhPerKw)),
        yieldKwhPerKw: Number(cached.yieldKwhPerKw),
        source: cached.productionSource,
        label: cached.productionLabel,
      }
    : await resolveAnnualProduction({ lat, lng, systemKw, knownYield });
  const incentives = await getApplicableIncentives({ state, segment, ownership });

  return computeProposalEconomics({
    systemKw,
    grossCost: inputs.grossCost != null ? Number(inputs.grossCost) : 25500,
    batteryCost: batteryCostFor(inputs),
    ownership,
    segment,
    state,
    loanTermYears: inputs.loanTermYears || 20,
    loanInterestRate: inputs.loanInterestRate || 5.99,
    downPayment: inputs.downPayment || 0,
    otherRebates: inputs.stateRebate || 0,
    escalationPct: inputs.utilityEscalation != null && inputs.utilityEscalation !== ''
      ? Number(inputs.utilityEscalation)
      : SOLAR_MODEL_DEFAULTS.utilityEscalationPct,
    rate,
    production,
    incentives,
  });
}

/** Cached-input snapshot stored on the proposal so public views don't re-query NREL. */
export function assumptionsSnapshot(roi) {
  const a = roi.assumptions || {};
  return {
    state: a.state,
    utilityRate: a.utilityRate,
    rateSource: a.utilityRateSource,
    rateLabel: a.utilityRateLabel,
    rateAsOf: a.utilityRateAsOf,
    yieldKwhPerKw: a.yieldKwhPerKw,
    productionSource: a.productionSource,
    productionLabel: a.productionLabel,
  };
}

/**
 * Homeowner report savings (bill offset, no financing). `annualProductionKwh` may be null
 * when there is no roof model — then the system is sized to ~90% of usage at `yieldKwhPerKw`.
 */
export function computeHomeownerSavings({
  monthlyBill,
  ratePerKwh,
  annualProductionKwh = null,
  yieldKwhPerKw = SOLAR_MODEL_DEFAULTS.fallbackYieldKwhPerKw,
  escalationPct = SOLAR_MODEL_DEFAULTS.utilityEscalationPct,
}) {
  const bill = Math.max(0, Number(monthlyBill) || 0);
  const rate = Number(ratePerKwh) || NATIONAL_AVG_RESIDENTIAL_RATE;
  const annualUsageKwh = bill > 0 ? Math.round((bill * 12) / rate) : null;
  let production = Number(annualProductionKwh) || 0;
  let sizedSystemKw = null;
  if (!production && annualUsageKwh) {
    sizedSystemKw = Math.max(3, Math.round(((annualUsageKwh * 0.9) / yieldKwhPerKw) * 10) / 10);
    production = Math.round(sizedSystemKw * yieldKwhPerKw);
  }
  const s = projectSavings({ annualProductionKwh: production, ratePerKwh: rate, annualUsageKwh, escalationPct });
  return {
    annualUsageKwh,
    annualProductionKwh: production,
    sizedSystemKw,
    coveragePct: annualUsageKwh ? Math.min(100, Math.round((production / annualUsageKwh) * 100)) : null,
    year1Savings: s.year1,
    year5Savings: s.cumulative5,
    year10Savings: s.cumulative10,
    year25Savings: s.cumulative25,
    estSolarPayment: Math.round(Math.max(0, bill - s.year1 / 12)),
  };
}

export async function getHomeownerIncentiveSummary({ state, segment = 'residential' } = {}) {
  const owned = await getApplicableIncentives({ state, segment, ownership: 'cash' });
  const tpo = await getApplicableIncentives({ state, segment, ownership: 'lease' });
  const pick = (rows) =>
    rows.map((r) => ({
      code: r.code,
      label: r.label,
      jurisdiction: r.jurisdiction,
      kind: r.kind,
      rate: Number(r.amount),
      cap: r.cap_amount != null ? Number(r.cap_amount) : null,
      asOf: r.as_of,
      notes: r.notes,
    }));
  return { owned: pick(owned), thirdParty: pick(tpo) };
}
