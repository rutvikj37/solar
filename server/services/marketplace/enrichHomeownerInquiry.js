import { geocodeAddressCoordinates } from '../coordinateService.js';
import {
  computeReportSavings,
  enrichSolarWithNrel,
  fetchGoogleSolarBuildingInsights,
  sizeSolarSystemToBill,
} from '../googleSolarBuildingInsights.js';

function isValidCoord(lat, lng) {
  const a = Number(lat);
  const b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) && (a !== 0 || b !== 0);
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
    return {
      enriched: false,
      coordSource: 'none',
      dataSources: { solar: 'unavailable', production: 'estimated' },
    };
  }

  let solar = await fetchGoogleSolarBuildingInsights(lat, lng);

  if (solar.center?.latitude != null && solar.center?.longitude != null) {
    lat = solar.center.latitude;
    lng = solar.center.longitude;
    coordSource = 'google_solar_center';
  }

  if (solar.googleSolarHit) {
    const sized = sizeSolarSystemToBill({
      maxSystemKw: solar.roofMaxSystemKw || solar.systemKw,
      maxAnnualProductionKwh: solar.roofMaxAnnualProductionKwh || solar.annualProductionKwh,
      maxPanelCount: solar.panelCount,
      solarPanelConfigs: solar.solarPanelConfigs,
      panelWatts: solar.panelWatts,
      monthlyBill,
      ratePerKwh: solar.ratePerKwh || 0.16,
    });
    solar = {
      ...solar,
      systemKw: sized.systemKw ?? solar.systemKw,
      annualProductionKwh: sized.annualProductionKwh ?? solar.annualProductionKwh,
      panelCount: sized.panelCount ?? solar.panelCount,
      sizedToBill: sized.sizedToBill,
    };
    solar = await enrichSolarWithNrel(lat, lng, solar);
  }

  const savings = computeReportSavings({
    monthlyBill,
    annualProductionKwh: solar.annualProductionKwh,
    ratePerKwh: solar.ratePerKwh || 0.16,
  });

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
    roofMaxSystemKw: solar.roofMaxSystemKw ?? solar.systemKw ?? null,
    roofMaxAnnualProductionKwh: solar.roofMaxAnnualProductionKwh ?? null,
    sizedToBill: Boolean(solar.sizedToBill),
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
    year25Savings: savings.year25Savings ?? solar.year25Savings,
    estSolarPayment: savings.estSolarPayment,
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
      utilityRate: solar.ratePerKwh ? 'NREL Utility Rates' : 'default',
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
