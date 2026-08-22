import db from '../../db.js';
import { BIDDING_OPEN_STATUSES } from './constants.js';

/** Default marketplace bidding window when admin settings are missing. */
export const DEFAULT_BID_WINDOW_HOURS = 48;

/** Default minimum bid (USD) when admin settings are missing. */
export const DEFAULT_MIN_BID = 25;

let settingsCache = { at: 0, data: null };
const SETTINGS_CACHE_MS = 60_000;

/**
 * Resolve admin-configured bid window settings with safe fallbacks.
 */
export function resolveBidWindowSettings(settings = {}) {
  const windowHours = Number(settings.default_bid_window_hours);
  const minBid = Number(settings.default_min_bid);
  return {
    windowHours:
      Number.isFinite(windowHours) && windowHours > 0
        ? windowHours
        : DEFAULT_BID_WINDOW_HOURS,
    minBid: Number.isFinite(minBid) && minBid > 0 ? minBid : DEFAULT_MIN_BID,
  };
}

/**
 * Compute bidding open/close timestamps from admin settings.
 */
export function computeBiddingWindow(settings = {}, now = new Date()) {
  const { windowHours, minBid } = resolveBidWindowSettings(settings);
  const opens = new Date(now);
  const closes = new Date(now.getTime() + windowHours * 60 * 60 * 1000);
  return { opens, closes, windowHours, minBid };
}

export async function getMarketplaceSettings(conn = db) {
  const now = Date.now();
  if (settingsCache.data && now - settingsCache.at < SETTINGS_CACHE_MS) {
    return settingsCache.data;
  }
  const [rows] = await conn.query(
    `SELECT default_bid_window_hours, default_min_bid FROM marketplace_settings WHERE id = 1`,
  );
  const data = rows[0] || {};
  settingsCache = { at: now, data };
  return data;
}

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

function toMysqlDatetime(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Resolve bidding open/close for a lead row (sync, no DB write).
 * Falls back to bidding_opens_at + window, or created_at + window for open bidding leads.
 */
export function resolveLeadBiddingTimes(row, settings = {}) {
  if (!row || !BIDDING_OPEN_STATUSES.has(row.status)) {
    return {
      opensAt: toDate(row?.bidding_opens_at),
      closesAt: toDate(row?.bidding_closes_at),
    };
  }

  const { windowHours } = resolveBidWindowSettings(settings);
  const opensAt =
    toDate(row.bidding_opens_at) || toDate(row.created_at);
  let closesAt = toDate(row.bidding_closes_at);
  if (!closesAt && opensAt) {
    closesAt = new Date(opensAt.getTime() + windowHours * 60 * 60 * 1000);
  }

  return { opensAt, closesAt };
}

/** Mutate row in place with resolved bidding timestamps. */
export function applyResolvedBiddingTimes(row, settings = {}) {
  if (!row) return row;
  const { opensAt, closesAt } = resolveLeadBiddingTimes(row, settings);
  if (opensAt && !row.bidding_opens_at) {
    row.bidding_opens_at = toMysqlDatetime(opensAt);
  }
  if (closesAt && !row.bidding_closes_at) {
    row.bidding_closes_at = toMysqlDatetime(closesAt);
  }
  return row;
}

/**
 * Backfill missing bidding_opens_at / bidding_closes_at on open bidding leads.
 */
export async function ensureLeadBiddingTimes(lead, settings, conn = db) {
  if (!lead?.id || !BIDDING_OPEN_STATUSES.has(lead.status)) return lead;

  const resolved = resolveLeadBiddingTimes(lead, settings);
  const opensSql = toMysqlDatetime(resolved.opensAt);
  const closesSql = toMysqlDatetime(resolved.closesAt);
  const needsOpens = !lead.bidding_opens_at && opensSql;
  const needsCloses = !lead.bidding_closes_at && closesSql;

  if (!needsOpens && !needsCloses) return lead;

  await conn.query(
    `UPDATE marketplace_leads SET
       bidding_opens_at = COALESCE(bidding_opens_at, ?),
       bidding_closes_at = COALESCE(bidding_closes_at, ?)
     WHERE id = ?`,
    [opensSql, closesSql, lead.id],
  );

  if (needsOpens) lead.bidding_opens_at = opensSql;
  if (needsCloses) lead.bidding_closes_at = closesSql;
  return lead;
}

export async function ensureLeadsBiddingTimes(leads, conn = db) {
  if (!leads?.length) return leads;
  const settings = await getMarketplaceSettings(conn);
  for (const lead of leads) {
    if (BIDDING_OPEN_STATUSES.has(lead.status)) {
      await ensureLeadBiddingTimes(lead, settings, conn);
    } else {
      applyResolvedBiddingTimes(lead, settings);
    }
  }
  return leads;
}
