/**
 * NREL / NLR Developer Network APIs
 * - PVWatts v8: annual & monthly PV production estimates
 * - Utility Rates v3: residential electricity rate for savings math
 *
 * Docs: https://developer.nlr.gov/docs/solar/pvwatts/v8/
 */

import { logApiCall } from './apiUsage.js';

const NREL_BASES = [
  process.env.NREL_API_BASE || 'https://developer.nrel.gov',
  'https://developer.nlr.gov',
  'https://developer.nrel.gov'
].filter((v, i, a) => a.indexOf(v) === i);

const NREL_FETCH_TIMEOUT_MS = Number(process.env.NREL_FETCH_TIMEOUT_MS) || 2500;
const NREL_ENRICH_BUDGET_MS = Number(process.env.NREL_ENRICH_BUDGET_MS) || 4000;

async function nrelFetch(pathWithQuery) {
  let lastError = null;
  for (const base of NREL_BASES) {
    const url = `${base}${pathWithQuery.startsWith('/') ? '' : '/'}${pathWithQuery}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NREL_FETCH_TIMEOUT_MS);
    const started = Date.now();
    try {
      const response = await fetch(url, { signal: controller.signal });
      await logApiCall('nrel', response.ok, Date.now() - started);
      if (response.ok) return response;
      const errText = await response.text();
      lastError = new Error(`HTTP ${response.status} from ${base}: ${errText.slice(0, 200)}`);
      console.error(`[NREL] ${lastError.message}`);
    } catch (err) {
      await logApiCall('nrel', false, Date.now() - started);
      lastError = err;
      const reason = err.name === 'AbortError' ? `timeout ${NREL_FETCH_TIMEOUT_MS}ms` : err.message;
      console.error(`[NREL] Fetch failed for ${base}: ${reason}`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error('NREL request failed');
}

function withBudget(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} budget exceeded (${ms}ms)`)), ms);
    })
  ]);
}

function isKeyValid(key) {
  return key && String(key).trim() !== '' && !String(key).toLowerCase().includes('your_');
}

function getApiKey() {
  return process.env.NREL_API_KEY || process.env.NLR_API_KEY || '';
}

/**
 * Estimate PV system production via PVWatts v8.
 * @param {{ lat: number, lng: number, systemCapacityKw: number, tilt?: number, azimuth?: number, losses?: number }} opts
 */
export async function fetchPvWatts({
  lat,
  lng,
  systemCapacityKw = 8,
  tilt = 20,
  azimuth = 180,
  losses = 14
}) {
  const apiKey = getApiKey();
  if (!isKeyValid(apiKey)) {
    return null;
  }

  const capacity = Math.max(0.5, Math.min(500, Number(systemCapacityKw) || 8));
  const params = new URLSearchParams({
    api_key: apiKey,
    lat: String(lat),
    lon: String(lng),
    system_capacity: String(capacity),
    azimuth: String(Number.isFinite(azimuth) ? azimuth : 180),
    tilt: String(Number.isFinite(tilt) ? tilt : 20),
    array_type: '1', // Fixed (roof mount)
    module_type: '0', // Standard
    losses: String(losses),
    timeframe: 'monthly'
  });

  console.log(`[NREL PVWatts] Querying lat=${lat}, lon=${lng}, capacity=${capacity} kW`);

  try {
    const response = await nrelFetch(`/api/pvwatts/v8.json?${params.toString()}`);
    const data = await response.json();
    if (data.errors && data.errors.length) {
      console.error('[NREL PVWatts] API errors:', data.errors);
      return null;
    }

    const outputs = data.outputs || {};
    const annualKwh = Math.round(outputs.ac_annual || 0);
    const capacityFactor = outputs.capacity_factor != null
      ? Number(outputs.capacity_factor)
      : null;
    const solradAnnual = outputs.solrad_annual != null
      ? Number(outputs.solrad_annual)
      : null;
    const monthly = Array.isArray(outputs.ac_monthly)
      ? outputs.ac_monthly.map((v) => Math.round(v))
      : [];

    return {
      annualKwh,
      capacityFactor,
      solradAnnual,
      monthlyAcKwh: monthly,
      systemCapacityKw: capacity,
      stationInfo: data.station_info || null,
      version: data.version || '8'
    };
  } catch (err) {
    console.error('[NREL PVWatts] Error:', err.message);
    return null;
  }
}

/**
 * Residential utility rate ($/kWh) near lat/lng.
 */
export async function fetchUtilityRate(lat, lng) {
  const apiKey = getApiKey();
  if (!isKeyValid(apiKey)) {
    return null;
  }

  const params = new URLSearchParams({
    api_key: apiKey,
    lat: String(lat),
    lon: String(lng)
  });

  console.log(`[NREL Utility Rates] Querying lat=${lat}, lon=${lng}`);

  try {
    const response = await nrelFetch(`/api/utility_rates/v3.json?${params.toString()}`);
    const data = await response.json();
    const outputs = data.outputs || {};
    const residential = outputs.residential;
    if (residential != null && !Number.isNaN(Number(residential))) {
      return {
        ratePerKwh: Number(residential),
        utilityName: outputs.utility_name || outputs.utility || 'Local utility',
        companyId: outputs.company_id || null
      };
    }
    return null;
  } catch (err) {
    console.error('[NREL Utility Rates] Error:', err.message);
    return null;
  }
}

/**
 * Enrich solar details with NREL PVWatts + utility rate.
 * Mutates and returns { solarDetails, savings, annualKwh, ratePerKwh }.
 */
export async function enrichWithNrel({
  lat,
  lng,
  sizeKw,
  tiltDegrees,
  azimuthDegrees,
  solarDetails,
  defaultRate = 0.18
}) {
  const capacity = parseFloat(sizeKw) || 8;
  const tilt = Number.isFinite(tiltDegrees) ? tiltDegrees : 20;
  const azimuth = Number.isFinite(azimuthDegrees) ? azimuthDegrees : 180;

  let pv = null;
  let utility = null;
  try {
    // Cap total NREL wait so map property clicks aren't blocked 10s+ when NREL is slow/down
    const pair = await withBudget(
      Promise.all([
        fetchPvWatts({
          lat,
          lng,
          systemCapacityKw: capacity,
          tilt,
          azimuth
        }).catch((err) => {
          console.error('[NREL PVWatts] Error:', err.message);
          return null;
        }),
        fetchUtilityRate(lat, lng).catch(() => null)
      ]),
      NREL_ENRICH_BUDGET_MS,
      'NREL enrich'
    );
    pv = pair[0];
    utility = pair[1];
  } catch (err) {
    console.warn(`[NREL] Skipping enrichment: ${err.message}`);
    return { solarDetails, savings: null, annualKwh: null, ratePerKwh: defaultRate };
  }

  if (!pv && !utility) {
    return { solarDetails, savings: null, annualKwh: null, ratePerKwh: defaultRate };
  }

  const ratePerKwh = utility?.ratePerKwh || defaultRate;
  let annualKwh = null;
  let savings = null;
  const next = { ...solarDetails };

  if (pv && pv.annualKwh > 0) {
    annualKwh = pv.annualKwh;
    savings = Math.round(annualKwh * ratePerKwh * 25);
    next.annualProduction = `${annualKwh.toLocaleString()} kWh (NREL PVWatts)`;
    next.twentyFiveYearSavings = `$${savings.toLocaleString()}`;
    next.nrelCapacityFactor = pv.capacityFactor != null
      ? `${pv.capacityFactor.toFixed(1)}%`
      : 'N/A';
    next.nrelSolradAnnual = pv.solradAnnual != null
      ? `${pv.solradAnnual.toFixed(2)} kWh/m²/day`
      : 'N/A';
    if (pv.solradAnnual != null) {
      next.annualSunlight = `${Math.round(pv.solradAnnual * 365)} peak-sun hrs/yr (NREL)`;
    }
    next.productionSource = 'NREL PVWatts v8';
    console.log(`[NREL PVWatts] ${annualKwh} kWh/yr, CF=${pv.capacityFactor}, rate=$${ratePerKwh}/kWh`);
  } else {
    // Fall back to Google/existing production figure for savings when PVWatts is unavailable
    const parsed = parseInt(String(solarDetails.annualProduction || '').replace(/[^\d]/g, ''), 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      annualKwh = parsed;
    }
  }

  if (utility) {
    next.electricityRate = `$${ratePerKwh.toFixed(3)}/kWh`;
    next.utilityName = utility.utilityName;
  }

  if (annualKwh != null && (pv || utility)) {
    savings = Math.round(annualKwh * ratePerKwh * 25);
    next.twentyFiveYearSavings = `$${savings.toLocaleString()}`;
    if (!pv) {
      next.productionSource = next.productionSource || 'Google Solar + NREL utility rate';
    }
  }

  return { solarDetails: next, savings, annualKwh, ratePerKwh };
}
