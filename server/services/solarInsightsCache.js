/**
 * Persistent Google Solar buildingInsights cache (DB-backed, keyed by rounded lat/lng).
 * Stores a compacted copy of the API response so list scoring, property detail,
 * homeowner reports and roof overlays share one paid lookup per building.
 */
import db from '../db.js';
import { trackedFetch } from './apiUsage.js';

const HIT_TTL_DAYS = Number(process.env.SOLAR_INSIGHTS_CACHE_DAYS) || 180;
const MISS_TTL_DAYS = Number(process.env.SOLAR_INSIGHTS_MISS_CACHE_DAYS) || 30;

const isKeyValid = (key) =>
  Boolean(key && String(key).trim() !== '' && !String(key).toLowerCase().includes('your_'));

export function isGoogleSolarConfigured() {
  return isKeyValid(process.env.GOOGLE_SOLAR_API_KEY);
}

export function solarCacheKey(lat, lng) {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b) || (!a && !b)) return null;
  return `${a.toFixed(5)},${b.toFixed(5)}`;
}

const r6 = (n) => (Number.isFinite(Number(n)) ? Math.round(Number(n) * 1e6) / 1e6 : null);

/** Keep only fields our parsers and overlays use (raw responses can be hundreds of KB). */
export function compactBuildingInsights(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const pot = raw.solarPotential || null;
  return {
    name: raw.name || null,
    center: raw.center || null,
    boundingBox: raw.boundingBox || null,
    imageryDate: raw.imageryDate || null,
    imageryQuality: raw.imageryQuality || null,
    postalCode: raw.postalCode || null,
    administrativeArea: raw.administrativeArea || null,
    solarPotential: pot
      ? {
          maxArrayPanelsCount: pot.maxArrayPanelsCount ?? null,
          maxArrayAreaMeters2: pot.maxArrayAreaMeters2 ?? null,
          maxSunshineHoursPerYear: pot.maxSunshineHoursPerYear ?? null,
          carbonOffsetFactorKgPerMwh: pot.carbonOffsetFactorKgPerMwh ?? null,
          panelCapacityWatts: pot.panelCapacityWatts ?? null,
          panelHeightMeters: pot.panelHeightMeters ?? null,
          panelWidthMeters: pot.panelWidthMeters ?? null,
          panelLifetimeYears: pot.panelLifetimeYears ?? null,
          wholeRoofStats: pot.wholeRoofStats || null,
          buildingStats: pot.buildingStats || null,
          roofSegmentStats: (pot.roofSegmentStats || []).map((s) => ({
            pitchDegrees: s.pitchDegrees,
            azimuthDegrees: s.azimuthDegrees,
            stats: s.stats
              ? { areaMeters2: s.stats.areaMeters2, groundAreaMeters2: s.stats.groundAreaMeters2, sunshineQuantiles: s.stats.sunshineQuantiles }
              : null,
            center: s.center || null,
            boundingBox: s.boundingBox || null,
            planeHeightAtCenterMeters: s.planeHeightAtCenterMeters ?? null,
          })),
          solarPanelConfigs: (pot.solarPanelConfigs || []).map((c) => ({
            panelsCount: c.panelsCount,
            yearlyEnergyDcKwh: c.yearlyEnergyDcKwh,
          })),
          // [lat, lng, orientation(0=LANDSCAPE,1=PORTRAIT), segmentIndex, yearlyEnergyDcKwh]
          solarPanelsCompact: (pot.solarPanels || []).map((p) => [
            r6(p.center?.latitude),
            r6(p.center?.longitude),
            p.orientation === 'PORTRAIT' ? 1 : 0,
            p.segmentIndex ?? 0,
            Math.round(p.yearlyEnergyDcKwh || 0),
          ]),
        }
      : null,
  };
}

async function readCache(key) {
  try {
    const [rows] = await db.query(
      `SELECT status, payload_json, fetched_at FROM solar_insights_cache
       WHERE cache_key = ? AND expires_at > NOW() LIMIT 1`,
      [key],
    );
    if (!rows.length) return null;
    const row = rows[0];
    return {
      status: row.status,
      data: row.payload_json ? JSON.parse(row.payload_json) : null,
      fetchedAt: row.fetched_at,
    };
  } catch (err) {
    if (err?.code !== 'ER_NO_SUCH_TABLE') console.error('[SolarCache] read failed:', err.message);
    return null;
  }
}

async function writeCache(key, lat, lng, status, data) {
  const days = status === 'hit' ? HIT_TTL_DAYS : MISS_TTL_DAYS;
  try {
    await db.query(
      `INSERT INTO solar_insights_cache (cache_key, lat, lng, status, payload_json, fetched_at, expires_at)
       VALUES (?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL ? DAY))
       ON DUPLICATE KEY UPDATE status = VALUES(status), payload_json = VALUES(payload_json),
         fetched_at = NOW(), expires_at = VALUES(expires_at)`,
      [key, Number(lat), Number(lng), status, data ? JSON.stringify(data) : null, days],
    );
  } catch (err) {
    console.error('[SolarCache] write failed:', err.message);
  }
}

const inflight = new Map();

/**
 * Compact buildingInsights for a location.
 * @param {{ allowFetch?: boolean }} opts allowFetch=false → cache only (no API spend)
 * @returns {Promise<{ data: object|null, status: 'hit'|'miss'|'not_cached'|'not_configured'|'error', cached: boolean }>}
 */
export async function getBuildingInsights(lat, lng, { allowFetch = true } = {}) {
  const key = solarCacheKey(lat, lng);
  if (!key) return { data: null, status: 'error', cached: false };

  const cached = await readCache(key);
  if (cached) return { data: cached.data, status: cached.status, cached: true };
  if (!allowFetch) return { data: null, status: 'not_cached', cached: false };
  if (!isGoogleSolarConfigured()) return { data: null, status: 'not_configured', cached: false };

  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    try {
      const url = `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${Number(lat)}&location.longitude=${Number(lng)}&key=${process.env.GOOGLE_SOLAR_API_KEY}`;
      const res = await trackedFetch('google_solar', url);
      if (res.status === 404) {
        await writeCache(key, lat, lng, 'miss', null);
        return { data: null, status: 'miss', cached: false };
      }
      if (!res.ok) return { data: null, status: 'error', cached: false };
      const compact = compactBuildingInsights(await res.json());
      const status = compact?.solarPotential ? 'hit' : 'miss';
      await writeCache(key, lat, lng, status, compact);
      return { data: compact, status, cached: false };
    } catch (err) {
      console.error('[SolarCache] fetch failed:', err.message || err);
      return { data: null, status: 'error', cached: false };
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/** Same base formula as the property detail view (before NREL capacity-factor bump). */
export function solarScoreFromPanels(panelCount) {
  const n = Number(panelCount) || 0;
  if (n <= 0) return 0;
  return Math.min(99, Math.floor(65 + (n > 40 ? 30 : n * 0.7)));
}

/** Summary metrics for map list items / markers. */
export function summarizeBuildingInsights(data) {
  const pot = data?.solarPotential;
  if (!pot) return null;
  const panelWatts = pot.panelCapacityWatts || 400;
  const panelCount = pot.maxArrayPanelsCount || 0;
  const systemKw = Number(((panelCount * panelWatts) / 1000).toFixed(1));
  const configs = pot.solarPanelConfigs || [];
  const best = configs.length ? configs[configs.length - 1] : null;
  const annualProductionKwh = best?.yearlyEnergyDcKwh
    ? Math.round(best.yearlyEnergyDcKwh)
    : Math.round((pot.maxSunshineHoursPerYear || 0) * systemKw);
  const wholeRoof = pot.wholeRoofStats || {};
  const buildingStats = pot.buildingStats || {};
  const segments = pot.roofSegmentStats || [];
  const ratio = (wholeRoof.areaMeters2 || 0) / (buildingStats.areaMeters2 || wholeRoof.areaMeters2 || 1);
  let existingSolar = 'No panels detected';
  let existingSolarLikely = false;
  if (ratio > 1.3 && segments.length > 15) {
    existingSolar = 'Possible — elevated roof structures detected';
    existingSolarLikely = true;
  } else if (segments.length > 20) {
    existingSolar = 'Likely — multiple elevated segments found';
    existingSolarLikely = true;
  }
  return {
    solarScore: solarScoreFromPanels(panelCount),
    systemKw,
    panelCount,
    annualProductionKwh,
    totalRoofSqFt: Math.round((wholeRoof.areaMeters2 || 0) * 10.764),
    sunshineHoursPerYear: Math.round(pot.maxSunshineHoursPerYear || 0),
    roofSegments: segments.length,
    existingSolar,
    existingSolarLikely,
    imageryQuality: data.imageryQuality || null,
  };
}

/**
 * Cached-only summaries for many points in one query (no API spend).
 * @param {{ lat: number, lng: number }[]} points
 * @returns {Promise<Map<string, object|null>>} cacheKey → summary (null = cached miss)
 */
export async function getCachedSummaries(points) {
  const keys = [...new Set(points.map((p) => solarCacheKey(p.lat, p.lng)).filter(Boolean))];
  const out = new Map();
  if (!keys.length) return out;
  try {
    const [rows] = await db.query(
      `SELECT cache_key, status, payload_json FROM solar_insights_cache
       WHERE cache_key IN (?) AND expires_at > NOW()`,
      [keys],
    );
    for (const row of rows) {
      let summary = null;
      if (row.status === 'hit' && row.payload_json) {
        try {
          summary = summarizeBuildingInsights(JSON.parse(row.payload_json));
        } catch {
          summary = null;
        }
      }
      out.set(row.cache_key, summary);
    }
  } catch (err) {
    if (err?.code !== 'ER_NO_SUCH_TABLE') console.error('[SolarCache] batch read failed:', err.message);
  }
  return out;
}

/** Per-user daily budget for paid list-score lookups (in-memory; resets on restart / UTC day). */
const budget = new Map();
export function takeSolarFetchBudget(userId, wanted) {
  const limit = Number(process.env.SOLAR_SCORE_DAILY_FETCH_LIMIT) || 150;
  const day = new Date().toISOString().slice(0, 10);
  const k = `${userId}:${day}`;
  const used = budget.get(k) || 0;
  const grant = Math.max(0, Math.min(wanted, limit - used));
  budget.set(k, used + grant);
  if (budget.size > 5000) budget.clear();
  return { grant, remaining: Math.max(0, limit - used - grant), limit };
}
