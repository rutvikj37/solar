import db from '../db.js';

const PROVIDERS = [
  { id: 'google_maps', label: 'Google Maps / Geocoding', envKeys: ['GOOGLE_MAPS_API_KEY'] },
  { id: 'google_solar', label: 'Google Solar', envKeys: ['GOOGLE_SOLAR_API_KEY'] },
  { id: 'rentcast', label: 'RentCast', envKeys: ['RENTCAST_API_KEY', 'ATTOM_API_KEY'] },
  { id: 'tracerfy', label: 'Tracerfy', envKeys: ['TRACERFY_API_KEY'] },
  { id: 'apollo', label: 'Apollo.io', envKeys: ['APOLLO_API_KEY'] },
  { id: 'verifalia', label: 'Verifalia', envKeys: ['VERIFALIA_USERNAME'] },
  { id: 'twilio', label: 'Twilio', envKeys: ['TWILIO_ACCOUNT_SID'] },
  { id: 'nrel', label: 'NREL PVWatts / Rates', envKeys: ['NREL_API_KEY', 'NLR_API_KEY'] },
  { id: 'stripe', label: 'Stripe', envKeys: ['STRIPE_SECRET_KEY'] }
];

function isKeyValid(key) {
  return key && String(key).trim() !== '' && !String(key).toLowerCase().includes('your_');
}

/** Local calendar date (matches MySQL CURDATE()) — avoid UTC ISO midnight skew */
function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getProviderConfigStatus() {
  return PROVIDERS.map((p) => {
    const configured = p.envKeys.some((k) => isKeyValid(process.env[k]));
    return { id: p.id, label: p.label, configured };
  });
}

export async function logApiCall(provider, ok, durationMs = 0) {
  try {
    const day = todayLocal();
    const successInc = ok ? 1 : 0;
    const errorInc = ok ? 0 : 1;
    const ms = Math.max(0, Number(durationMs) || 0);

    await db.query(
      `INSERT INTO api_usage_daily (provider, usage_date, success_count, error_count, total_ms, call_count)
       VALUES (?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         success_count = success_count + VALUES(success_count),
         error_count = error_count + VALUES(error_count),
         total_ms = total_ms + VALUES(total_ms),
         call_count = call_count + 1`,
      [provider, day, successInc, errorInc, ms]
    );
  } catch (err) {
    // Never break product flows on logging failure
    console.error('[apiUsage] log failed:', err.message);
  }
}

/**
 * fetch() wrapper that records success/error + latency for the admin APIs tab.
 * @param {string} provider - one of PROVIDERS[].id
 */
export async function trackedFetch(provider, url, options) {
  const started = Date.now();
  try {
    const res = await fetch(url, options);
    await logApiCall(provider, res.ok, Date.now() - started);
    return res;
  } catch (err) {
    await logApiCall(provider, false, Date.now() - started);
    throw err;
  }
}

/**
 * Wrap any async provider call (SDK, etc.) for usage logging.
 */
export async function trackApiCall(provider, fn) {
  const started = Date.now();
  try {
    const result = await fn();
    await logApiCall(provider, true, Date.now() - started);
    return result;
  } catch (err) {
    await logApiCall(provider, false, Date.now() - started);
    throw err;
  }
}

export async function getUsageSummary(days = 7) {
  const [rows] = await db.query(
    `SELECT provider,
            SUM(success_count) AS success_count,
            SUM(error_count) AS error_count,
            SUM(call_count) AS call_count,
            SUM(total_ms) AS total_ms
     FROM api_usage_daily
     WHERE usage_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY provider`,
    [days]
  );

  const byProvider = Object.fromEntries(
    rows.map((r) => [
      r.provider,
      {
        success: Number(r.success_count) || 0,
        errors: Number(r.error_count) || 0,
        calls: Number(r.call_count) || 0,
        avgMs: r.call_count > 0 ? Math.round(Number(r.total_ms) / Number(r.call_count)) : 0
      }
    ])
  );

  return getProviderConfigStatus().map((p) => ({
    ...p,
    ...(byProvider[p.id] || { success: 0, errors: 0, calls: 0, avgMs: 0 })
  }));
}

export { PROVIDERS };
