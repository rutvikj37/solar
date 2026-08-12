/**
 * Extra solar lead fields: weather pattern, tree coverage, estimated electricity bill.
 * Uses Google Solar shade signals, Open-Meteo climate, and NREL utility rates.
 */

import { logApiCall } from './apiUsage.js';

const WEATHER_TIMEOUT_MS = 2500;

function isMissing(v) {
  if (v == null) return true;
  const s = String(v).trim();
  return !s || s === 'Not Available' || s === 'N/A' || s === 'undefined';
}

/** Map roof sunshine variation % → tree / shade coverage label. */
export function labelTreeCoverage(shadingPct) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(shadingPct) || 0)));
  if (pct < 20) return `Low (${pct}%)`;
  if (pct < 40) return `Moderate (${pct}%)`;
  if (pct < 60) return `High (${pct}%)`;
  return `Heavy (${pct}%)`;
}

/** Derive tree coverage from an existing Shading string like "Significant (79%)". */
export function treeCoverageFromShading(shading) {
  if (isMissing(shading)) return null;
  const m = String(shading).match(/(\d+)\s*%/);
  if (!m) return null;
  return labelTreeCoverage(Number(m[1]));
}

/**
 * Build weather pattern from NREL monthly solar radiation (kWh/m²/day).
 */
export function weatherPatternFromSolradMonthly(solradMonthly) {
  if (!Array.isArray(solradMonthly) || solradMonthly.length < 12) return null;
  const vals = solradMonthly.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
  if (vals.length < 6) return null;

  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const peakIdx = solradMonthly.findIndex((v) => Number(v) === max);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const peakMonth = months[peakIdx] || 'summer';
  const seasonality = avg > 0 ? (max - min) / avg : 0;

  let intensity = 'Moderate sun';
  if (avg >= 5.5) intensity = 'High sun';
  else if (avg < 3.5) intensity = 'Lower sun';

  let season = 'steady year-round';
  if (seasonality >= 0.45) season = `strong ${peakMonth} peak`;
  else if (seasonality >= 0.25) season = `mild ${peakMonth} peak`;

  return `${intensity} · ${season}`;
}

/**
 * Open-Meteo past-90-day climate summary (no API key).
 */
export async function fetchWeatherPattern(lat, lng) {
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null;

  const params = new URLSearchParams({
    latitude: String(nLat),
    longitude: String(nLng),
    daily: 'precipitation_sum,shortwave_radiation_sum,cloud_cover_mean',
    past_days: '90',
    forecast_days: '1',
    timezone: 'auto'
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEATHER_TIMEOUT_MS);
  const started = Date.now();

  try {
    const res = await fetch(url, { signal: controller.signal });
    await logApiCall('open_meteo', res.ok, Date.now() - started);
    if (!res.ok) return null;
    const data = await res.json();
    const daily = data.daily || {};
    const precip = (daily.precipitation_sum || []).filter((v) => v != null);
    const rad = (daily.shortwave_radiation_sum || []).filter((v) => v != null);
    const cloud = (daily.cloud_cover_mean || []).filter((v) => v != null);
    if (!precip.length && !rad.length && !cloud.length) return null;

    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
    const avgPrecip = avg(precip);
    const avgRad = avg(rad);
    const avgCloud = avg(cloud);

    const parts = [];
    if (avgRad != null) {
      // Open-Meteo daily shortwave_radiation_sum is MJ/m² (typical sunny day ~20–28)
      if (avgRad >= 22) parts.push('High irradiance');
      else if (avgRad >= 14) parts.push('Moderate irradiance');
      else parts.push('Lower irradiance');
    }
    if (avgCloud != null) {
      if (avgCloud < 35) parts.push('mostly clear');
      else if (avgCloud < 60) parts.push('partly cloudy');
      else parts.push('often cloudy');
    }
    if (avgPrecip != null) {
      if (avgPrecip < 1) parts.push('dry');
      else if (avgPrecip < 3) parts.push('light rain');
      else parts.push('wetter');
    }

    return parts.length ? parts.join(' · ') : null;
  } catch (err) {
    await logApiCall('open_meteo', false, Date.now() - started);
    if (err.name !== 'AbortError') {
      console.error('[Open-Meteo] Weather pattern error:', err.message);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Estimate monthly electricity bill from rate + home size / default usage.
 * @returns {{ label: string, monthlyKwh: number, monthlyBill: number } | null}
 */
export function estimateElectricityBill({ ratePerKwh, livingAreaSqFt, annualProductionKwh }) {
  const rate = Number(ratePerKwh);
  if (!Number.isFinite(rate) || rate <= 0) return null;

  let monthlyKwh = 1000; // US residential default
  const living = Number(livingAreaSqFt);
  if (Number.isFinite(living) && living > 200) {
    monthlyKwh = Math.round(Math.min(2500, Math.max(400, living * 0.55)));
  } else if (Number.isFinite(annualProductionKwh) && annualProductionKwh > 0) {
    monthlyKwh = Math.round(Math.min(2000, Math.max(500, (annualProductionKwh / 12) * 0.85)));
  }

  const monthlyBill = Math.round(monthlyKwh * rate);
  return {
    label: `~$${monthlyBill.toLocaleString('en-US')}/mo`,
    monthlyKwh,
    monthlyBill
  };
}

function parseLivingAreaSqFt(livingArea) {
  if (livingArea == null) return 0;
  const n = parseFloat(String(livingArea).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function parseAnnualKwh(annualProduction) {
  if (annualProduction == null) return 0;
  const n = parseInt(String(annualProduction).replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function parseRateFromSolar(solar) {
  const raw = solar?.electricityRate || '';
  const m = String(raw).match(/\$?([\d.]+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Fill weatherPattern, treeCoverage, estimatedElectricityBill on a solar object.
 * Safe to call on existing leads (only fills missing fields).
 */
export async function ensureSolarExtraFields(solar, { lat, lng, livingArea, ratePerKwh } = {}) {
  const next = { ...(solar || {}) };
  let changed = false;

  if (isMissing(next.treeCoverage)) {
    const fromShade = treeCoverageFromShading(next.shading);
    if (fromShade) {
      next.treeCoverage = fromShade;
      changed = true;
    }
  }

  if (isMissing(next.weatherPattern)) {
    let pattern = weatherPatternFromSolradMonthly(next.solradMonthly);
    if (!pattern && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      pattern = await fetchWeatherPattern(lat, lng);
    }
    if (pattern) {
      next.weatherPattern = pattern;
      changed = true;
    }
  }

  if (isMissing(next.estimatedElectricityBill)) {
    let rate = Number(ratePerKwh);
    if (!Number.isFinite(rate) || rate <= 0) rate = parseRateFromSolar(next);
    if (!Number.isFinite(rate) || rate <= 0) rate = 0.18;
    const bill = estimateElectricityBill({
      ratePerKwh: rate,
      livingAreaSqFt: parseLivingAreaSqFt(livingArea),
      annualProductionKwh: parseAnnualKwh(next.annualProduction)
    });
    if (bill) {
      next.estimatedElectricityBill = bill.label;
      changed = true;
    }
  }

  return { solar: next, changed };
}
