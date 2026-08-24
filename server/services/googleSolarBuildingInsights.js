import { trackedFetch } from './apiUsage.js';
import { enrichWithNrel } from './nrel.js';

const isKeyValid = (key) =>
  key && String(key).trim() !== '' && !String(key).toLowerCase().includes('your_');

function orientationLabel(azimuth) {
  if (azimuth >= 337.5 || azimuth < 22.5) return 'North-Facing';
  if (azimuth < 67.5) return 'Northeast-Facing';
  if (azimuth < 112.5) return 'East-Facing';
  if (azimuth < 157.5) return 'Southeast-Facing';
  if (azimuth < 202.5) return 'South-Facing (Optimal)';
  if (azimuth < 247.5) return 'Southwest-Facing';
  if (azimuth < 292.5) return 'West-Facing';
  return 'Northwest-Facing';
}

/**
 * Google Solar buildingInsights — shared with installer property enrichment.
 */
export async function fetchGoogleSolarBuildingInsights(lat, lng) {
  if (!isKeyValid(process.env.GOOGLE_SOLAR_API_KEY)) {
    return { googleSolarHit: false };
  }

  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) {
    return { googleSolarHit: false };
  }

  try {
    const solarUrl = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${nLat}&location.longitude=${nLng}&key=${process.env.GOOGLE_SOLAR_API_KEY}`;
    const response = await trackedFetch('google_solar', solarUrl);
    if (!response.ok) {
      return { googleSolarHit: false };
    }

    const solarData = await response.json();
    const pot = solarData.solarPotential;
    if (!pot) {
      return { googleSolarHit: false, center: solarData.center || null };
    }

    const wholeRoof = pot.wholeRoofStats || {};
    const buildingStats = pot.buildingStats || {};
    const panelWatts = pot.panelCapacityWatts || 400;
    const panelCount = pot.maxArrayPanelsCount || 0;
    const systemKw = Number(((panelCount * panelWatts) / 1000).toFixed(1));
    const totalRoofSqFt = Math.round((wholeRoof.areaMeters2 || 0) * 10.764);
    const usableRoofSqFt = Math.round(totalRoofSqFt * 0.7);
    const segments = pot.roofSegmentStats || [];
    const primarySegment = segments.length
      ? segments.reduce(
          (a, b) => (b.stats?.areaMeters2 > a.stats?.areaMeters2 ? b : a),
          segments[0],
        )
      : null;

    let roofTiltDeg = 20;
    let roofAzimuthDeg = 180;
    if (primarySegment) {
      roofTiltDeg = Number(primarySegment.pitchDegrees) || 20;
      roofAzimuthDeg = Number(primarySegment.azimuthDegrees) || 180;
    }

    const bestConfig =
      pot.solarPanelConfigs?.length > 0
        ? pot.solarPanelConfigs[pot.solarPanelConfigs.length - 1]
        : null;
    const annualProductionKwh =
      bestConfig?.yearlyEnergyDcKwh != null
        ? Math.round(bestConfig.yearlyEnergyDcKwh)
        : Math.round((pot.maxSunshineHoursPerYear || 0) * systemKw);

    const roofToBuildingRatio =
      wholeRoof.areaMeters2 / (buildingStats.areaMeters2 || wholeRoof.areaMeters2 || 1);
    let existingSolarStatus = 'No panels detected';
    let existingSolarLikely = false;
    if (roofToBuildingRatio > 1.3 && segments.length > 15) {
      existingSolarStatus = 'Possible — elevated roof structures detected';
      existingSolarLikely = true;
    } else if (segments.length > 20) {
      existingSolarStatus = 'Likely — multiple elevated segments found';
      existingSolarLikely = true;
    }

    const minSunshine = wholeRoof.sunshineQuantiles?.[0];
    const maxSunshine = wholeRoof.sunshineQuantiles?.[10];
    let shadingLabel = 'Unknown';
    if (minSunshine != null && maxSunshine) {
      const shadingPct = Math.round((1 - minSunshine / maxSunshine) * 100);
      if (shadingPct < 20) shadingLabel = `Minimal (${shadingPct}%)`;
      else if (shadingPct < 40) shadingLabel = `Moderate (${shadingPct}%)`;
      else shadingLabel = `Significant (${shadingPct}%)`;
    }

    const imgDate = solarData.imageryDate || {};
    const imageryDateStr = imgDate.year
      ? `${imgDate.month}/${imgDate.day}/${imgDate.year}`
      : null;

    const solarDetails = {
      recommendedSize: `${systemKw} kW`,
      estimatedPanels: panelCount,
      annualProduction: `${annualProductionKwh.toLocaleString('en-US')} kWh`,
      totalRoofArea: `${totalRoofSqFt.toLocaleString('en-US')} sq ft`,
      usableRoofArea: `${usableRoofSqFt.toLocaleString('en-US')} sq ft`,
      orientation: `${orientationLabel(roofAzimuthDeg)} (${Math.round(roofAzimuthDeg)}°)`,
      pitch: `${(primarySegment?.pitchDegrees || 18).toFixed?.(1) || 18}° primary pitch`,
      shading: shadingLabel,
      existingSolar: existingSolarStatus,
      imageryDate: imageryDateStr,
      imageryQuality: solarData.imageryQuality || 'MEDIUM',
      roofSegments: segments.length,
      productionSource: 'Google Solar API',
    };

    return {
      googleSolarHit: true,
      center: solarData.center || null,
      panelCount,
      panelWatts,
      solarPanelConfigs: pot.solarPanelConfigs || [],
      roofMaxSystemKw: systemKw,
      roofMaxAnnualProductionKwh: annualProductionKwh,
      systemKw,
      annualProductionKwh,
      totalRoofSqFt,
      usableRoofSqft: usableRoofSqFt,
      roofTiltDeg,
      roofAzimuthDeg,
      orientation: solarDetails.orientation,
      pitch: solarDetails.pitch,
      shading: shadingLabel,
      existingSolarStatus,
      existingSolarLikely,
      imageryDate: imageryDateStr,
      imageryQuality: solarData.imageryQuality || 'MEDIUM',
      solarDetails,
    };
  } catch (err) {
    console.error('[Google Solar] buildingInsights failed:', err.message || err);
    return { googleSolarHit: false };
  }
}

export async function enrichSolarWithNrel(lat, lng, googleResult) {
  if (!googleResult?.googleSolarHit || !googleResult.systemKw) {
    return googleResult;
  }

  try {
    const nrel = await enrichWithNrel({
      lat,
      lng,
      sizeKw: googleResult.systemKw,
      tiltDegrees: googleResult.roofTiltDeg,
      azimuthDegrees: googleResult.roofAzimuthDeg,
      solarDetails: googleResult.solarDetails || {},
    });

    const annualProductionKwh = nrel.annualKwh ?? googleResult.annualProductionKwh;
    return {
      ...googleResult,
      annualProductionKwh,
      ratePerKwh: nrel.ratePerKwh ?? null,
      year25Savings: nrel.savings ?? null,
      solarDetails: nrel.solarDetails || googleResult.solarDetails,
      nrelCapacityFactor: nrel.solarDetails?.nrelCapacityFactor || null,
      productionSource: nrel.solarDetails?.productionSource || 'Google Solar + NREL',
    };
  } catch (err) {
    console.error('[Homeowner enrich] NREL failed:', err.message || err);
    return googleResult;
  }
}

/**
 * Scale Google Solar max-roof array down to the homeowner's bill/usage.
 * Max array on a large building otherwise shows $0 remaining bill and 100%+ coverage.
 */
export function sizeSolarSystemToBill({
  maxSystemKw,
  maxAnnualProductionKwh,
  maxPanelCount,
  solarPanelConfigs,
  panelWatts = 400,
  monthlyBill,
  ratePerKwh = 0.16,
} = {}) {
  const bill = Math.max(50, Number(monthlyBill) || 250);
  const rate = Number(ratePerKwh) || 0.16;
  const annualUsageKwh = Math.round(((bill * 12) / rate) * 0.95);
  const targetKwh = Math.round(annualUsageKwh * 0.9);
  const maxKw = Number(maxSystemKw) || 0;
  const maxProd = Number(maxAnnualProductionKwh) || 0;
  const maxPanels = Number(maxPanelCount) || Math.max(8, Math.round(maxKw / 0.4));
  const configs = Array.isArray(solarPanelConfigs) ? solarPanelConfigs : [];

  if (configs.length && annualUsageKwh > 0) {
    const sorted = [...configs].sort(
      (a, b) => Number(a.yearlyEnergyDcKwh || 0) - Number(b.yearlyEnergyDcKwh || 0),
    );
    const fit =
      sorted.find((c) => Number(c.yearlyEnergyDcKwh || 0) >= targetKwh) ||
      sorted[sorted.length - 1];
    const panels = Number(fit.panelsCount) || maxPanels;
    const kwh = Math.round(Number(fit.yearlyEnergyDcKwh) || 0);
    const kw = Number(((panels * (Number(panelWatts) || 400)) / 1000).toFixed(1));
    return {
      bill,
      rate,
      annualUsageKwh,
      systemKw: kw,
      annualProductionKwh: kwh,
      panelCount: panels,
      roofMaxSystemKw: maxKw || kw,
      roofMaxAnnualProductionKwh: maxProd || kwh,
      sizedToBill: true,
    };
  }

  if (!(maxKw > 0 && maxProd > 0 && annualUsageKwh > 0)) {
    return {
      bill,
      rate,
      annualUsageKwh,
      systemKw: maxKw || null,
      annualProductionKwh: maxProd || null,
      panelCount: maxPanels || null,
      sizedToBill: false,
    };
  }

  const kwhPerKw = maxProd / maxKw;
  const systemKw = Number(Math.min(maxKw, Math.max(3.5, targetKwh / kwhPerKw)).toFixed(1));
  const ratio = systemKw / maxKw;
  return {
    bill,
    rate,
    annualUsageKwh,
    systemKw,
    annualProductionKwh: Math.round(systemKw * kwhPerKw),
    panelCount: Math.max(8, Math.round(maxPanels * ratio)),
    roofMaxSystemKw: maxKw,
    roofMaxAnnualProductionKwh: maxProd,
    sizedToBill: systemKw < maxKw * 0.98,
  };
}

export function computeReportSavings({
  monthlyBill,
  annualProductionKwh,
  ratePerKwh = 0.16,
}) {
  const bill = Math.max(50, Number(monthlyBill) || 250);
  const annualBill = bill * 12;
  const rate = Number(ratePerKwh) || 0.16;
  const annualUsageKwh = bill > 0 ? Math.round((annualBill / rate) * 0.95) : 0;
  const production = Math.max(0, Number(annualProductionKwh) || 0);
  const coveragePct =
    annualUsageKwh > 0
      ? Math.min(98, Math.max(0, Math.round((production / annualUsageKwh) * 100)))
      : null;
  const year1Offset = Math.min(annualBill * 0.92, production * rate);
  const year1Savings = Math.round(year1Offset);
  const year5Savings = Math.round(year1Savings * 4.6);
  const year10Savings = Math.round(year1Savings * 9.2);
  const year25Savings =
    annualProductionKwh && rate
      ? Math.round(production * rate * 25)
      : Math.round(year1Savings * 21);
  const estSolarPayment = Math.round(Math.max(0, bill - year1Savings / 12));

  return {
    ratePerKwh: rate,
    annualUsageKwh,
    coveragePct,
    year1Savings,
    year5Savings,
    year10Savings,
    year25Savings,
    estSolarPayment,
  };
}
