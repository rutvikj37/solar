import { geocodeAddressCoordinates } from '../coordinateService.js';
import {
  enrichSolarWithNrel,
  fetchGoogleSolarBuildingInsights,
} from '../googleSolarBuildingInsights.js';
import {
  computeHomeownerSavings,
  getHomeownerIncentiveSummary,
  resolveAnnualProduction,
  resolveUtilityRate,
  stateFromAddress,
} from '../solarEconomics.js';
import { SOLAR_MODEL_DEFAULTS } from '../../config/solarIncentivesDefaults.js';

const STEP_BUDGET_MS = 7000;

function isValidCoord(lat, lng) {
  const a = Number(lat);
  const b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) && (a !== 0 || b !== 0);
}

function withTimeout(promise, ms, fallback) {
  let timer;
  return Promise.race([
    promise.catch(() => fallback()),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallback()), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * Utility rate + production + savings + incentive summary for the homeowner report.
 * `googleProductionKwh` is the roof-model production when Google Solar matched the roof.
 */
export async function buildHomeownerEconomics({ address, monthlyBill, lat = null, lng = null, googleProductionKwh = null }) {
  const state = stateFromAddress(address);
  const rate = await withTimeout(
    resolveUtilityRate({ lat, lng, state }),
    STEP_BUDGET_MS,
    () => resolveUtilityRate({ state }),
  );

  let annualProductionKwh = Number(googleProductionKwh) > 0 ? Number(googleProductionKwh) : null;
  let production = annualProductionKwh
    ? { source: 'google_solar', label: 'Google Solar roof model' }
    : null;
  let sizedSystemKw = null;

  if (!annualProductionKwh) {
    const sizing = computeHomeownerSavings({ monthlyBill, ratePerKwh: rate.ratePerKwh });
    sizedSystemKw = sizing.sizedSystemKw;
    if (sizedSystemKw) {
      const fallback = () => ({
        annualKwh: Math.round(sizedSystemKw * SOLAR_MODEL_DEFAULTS.fallbackYieldKwhPerKw),
        source: 'national_average',
        label: `US average yield (${SOLAR_MODEL_DEFAULTS.fallbackYieldKwhPerKw} kWh per kW per year)`,
      });
      production = await withTimeout(
        resolveAnnualProduction({ lat, lng, systemKw: sizedSystemKw }),
        STEP_BUDGET_MS,
        fallback,
      );
      annualProductionKwh = production.annualKwh;
      const localYield = annualProductionKwh / sizedSystemKw;
      if (sizing.annualUsageKwh && localYield > 0) {
        sizedSystemKw = Math.max(3, Math.round(((sizing.annualUsageKwh * 0.9) / localYield) * 10) / 10);
        annualProductionKwh = Math.round(sizedSystemKw * localYield);
      }
    }
  }

  const savings = computeHomeownerSavings({ monthlyBill, ratePerKwh: rate.ratePerKwh, annualProductionKwh });
  let incentives = { owned: [], thirdParty: [] };
  try {
    incentives = await getHomeownerIncentiveSummary({ state });
  } catch {
    /* incentives are informational only */
  }

  return {
    state,
    rate,
    sizedSystemKw,
    savings,
    assumptions: {
      state,
      utilityRate: rate.ratePerKwh,
      utilityRateSource: rate.source,
      utilityRateLabel: rate.label,
      utilityRateAsOf: rate.asOf || null,
      annualUsageKwh: savings.annualUsageKwh,
      annualProductionKwh: savings.annualProductionKwh,
      productionSource: production?.source || null,
      productionLabel: production?.label || null,
      sizedSystemKw,
      escalationPct: SOLAR_MODEL_DEFAULTS.utilityEscalationPct,
      degradationPct: SOLAR_MODEL_DEFAULTS.panelDegradationPct,
      exportCredit: 'Savings capped at your current usage; exported power is not counted.',
      incentivesOwned: incentives.owned,
      incentivesThirdParty: incentives.thirdParty,
      incentivesNote:
        'Savings shown exclude tax credits. The federal residential credit (§25D) ended after 2025; state incentives and lease/PPA pricing vary.',
    },
  };
}

/**
 * Resolve coordinates, Google Solar, NREL, and savings for a homeowner inquiry.
 */
export async function enrichHomeownerInquiry({
  address,
  monthlyBill,
  propertyLat,
  propertyLng,
}) {
  let lat = Number(propertyLat);
  let lng = Number(propertyLng);
  let coordSource = 'form_pin';

  if (!isValidCoord(lat, lng)) {
    const geocoded = await geocodeAddressCoordinates(String(address || '').trim());
    if (geocoded) {
      lat = geocoded.lat;
      lng = geocoded.lng;
      coordSource = geocoded.source || 'geocode';
    }
  }

  if (!isValidCoord(lat, lng)) {
    const econ = await buildHomeownerEconomics({ address, monthlyBill });
    return {
      enriched: false,
      coordSource: 'none',
      dataSources: { solar: 'unavailable', production: 'estimated', utilityRate: econ.rate.source },
      ratePerKwh: econ.rate.ratePerKwh,
      savingsEstimate: { ...econ.savings, systemKw: econ.sizedSystemKw },
      assumptions: econ.assumptions,
    };
  }

  let solar = await fetchGoogleSolarBuildingInsights(lat, lng);

  if (solar.center?.latitude != null && solar.center?.longitude != null) {
    lat = solar.center.latitude;
    lng = solar.center.longitude;
    coordSource = 'google_solar_center';
  }

  if (solar.googleSolarHit) {
    solar = await enrichSolarWithNrel(lat, lng, solar);
  }

  const econ = await buildHomeownerEconomics({
    address,
    monthlyBill,
    lat,
    lng,
    googleProductionKwh: solar.googleSolarHit ? solar.annualProductionKwh : null,
  });
  const savings = { ...econ.savings, ratePerKwh: econ.rate.ratePerKwh };

  const co2TonsYear =
    solar.annualProductionKwh > 0
      ? Math.round(((solar.annualProductionKwh * 0.92) / 1000) * 10) / 10
      : null;

  return {
    enriched: Boolean(solar.googleSolarHit),
    googleSolarHit: Boolean(solar.googleSolarHit),
    lat,
    lng,
    coordSource,
    panelCount: solar.panelCount ?? null,
    systemKw: solar.systemKw ?? null,
    usableRoofSqft: solar.usableRoofSqft ?? null,
    totalRoofSqft: solar.totalRoofSqFt ?? null,
    annualProductionKwh: solar.annualProductionKwh ?? null,
    orientation: solar.orientation ?? null,
    pitch: solar.pitch ?? null,
    shading: solar.shading ?? null,
    existingSolarStatus: solar.existingSolarStatus ?? null,
    existingSolarLikely: Boolean(solar.existingSolarLikely),
    imageryDate: solar.imageryDate ?? null,
    imageryQuality: solar.imageryQuality ?? null,
    ratePerKwh: savings.ratePerKwh,
    coveragePct: savings.coveragePct,
    year1Savings: savings.year1Savings,
    year5Savings: savings.year5Savings,
    year10Savings: savings.year10Savings,
    year25Savings: savings.year25Savings,
    estSolarPayment: savings.estSolarPayment,
    savingsEstimate: solar.googleSolarHit ? null : { ...econ.savings, systemKw: econ.sizedSystemKw },
    assumptions: econ.assumptions,
    co2TonsYear,
    co2Tons25: co2TonsYear != null ? Math.round(co2TonsYear * 23 * 10) / 10 : null,
    treesEquiv: co2TonsYear != null ? Math.round(co2TonsYear * 16) : null,
    milesOffset:
      solar.annualProductionKwh > 0
        ? Math.round(solar.annualProductionKwh * 0.92 * 2.1)
        : null,
    solarDetails: solar.solarDetails || null,
    nrelCapacityFactor: solar.nrelCapacityFactor || null,
    productionSource: solar.productionSource || (solar.googleSolarHit ? 'Google Solar' : 'estimated'),
    dataSources: {
      coordinates: coordSource,
      solar: solar.googleSolarHit ? 'Google Solar API' : 'unavailable',
      production: solar.productionSource || 'estimated',
      utilityRate: econ.rate.source,
    },
    enrichedAt: new Date().toISOString(),
  };
}

/**
 * Build homeowner report payload from DB lead row.
 */
export function buildHomeownerReportPayload(lead) {
  if (!lead) return null;

  let enrichment = null;
  if (lead.enrichment_json) {
    try {
      enrichment =
        typeof lead.enrichment_json === 'object'
          ? lead.enrichment_json
          : JSON.parse(lead.enrichment_json);
    } catch {
      enrichment = null;
    }
  }

  const roofMatch = String(lead.project_details || '').match(/Roof:\s*([^\.]+)/i);

  return {
    firstName: String(lead.homeowner_name || '').split(/\s+/)[0] || '',
    lastName: String(lead.homeowner_name || '').split(/\s+/).slice(1).join(' ') || '',
    address: lead.address,
    monthlyBill: lead.monthly_bill != null ? Number(lead.monthly_bill) : null,
    timeline: lead.installation_timeline,
    roofType: roofMatch ? roofMatch[1].trim() : null,
    propertyType: lead.property_type,
    propertyLat: lead.latitude != null ? Number(lead.latitude) : enrichment?.lat,
    propertyLng: lead.longitude != null ? Number(lead.longitude) : enrichment?.lng,
    leadCode: lead.lead_code,
    opportunityScore: Number(lead.opportunity_score) || 0,
    leadScore: Number(lead.opportunity_score) || 0,
    leadScoreTier: (() => {
      try {
        const b =
          typeof lead.score_breakdown === 'object'
            ? lead.score_breakdown
            : lead.score_breakdown
              ? JSON.parse(lead.score_breakdown)
              : null;
        return b?.leadScoreTier || null;
      } catch {
        return null;
      }
    })(),
    solarPotentialScore:
      lead.solar_potential_score != null ? Number(lead.solar_potential_score) : 0,
    listedInMarketplace: lead.status === 'bidding' || lead.status === 'no_bid_expanding',
    marketplaceStatus: lead.status,
    billRange: lead.bill_range,
    estimatedSolarKw: lead.estimated_solar_kw != null ? Number(lead.estimated_solar_kw) : enrichment?.systemKw,
    estimatedRoofSqft:
      lead.estimated_roof_sqft != null ? Number(lead.estimated_roof_sqft) : enrichment?.usableRoofSqft,
    solarPotentialLabel: lead.solar_potential_label,
    enrichment,
    enrichmentSource: enrichment?.googleSolarHit ? 'google_solar' : 'estimated',
    satelliteImageUrl: lead.lead_code
      ? `/api/marketplace/report-image/${encodeURIComponent(lead.lead_code)}`
      : null,
  };
}

/** Attach signed report access + signed satellite URL onto a homeowner payload. */
export function attachSignedReportAccess(payload, access) {
  if (!payload || !access?.exp || !access?.sig) return payload;
  const out = { ...payload, reportAccess: access };
  if (out.satelliteImageUrl && !String(out.satelliteImageUrl).includes('sig=')) {
    const sep = String(out.satelliteImageUrl).includes('?') ? '&' : '?';
    out.satelliteImageUrl = `${out.satelliteImageUrl}${sep}exp=${encodeURIComponent(access.exp)}&sig=${encodeURIComponent(access.sig)}`;
  }
  return out;
}
