import db from '../../db.js';
import { parseAddressParts } from '../ai-calling/leadGeo.js';

function digitsZip(zip) {
  return String(zip || '').replace(/\D/g, '');
}

function zipPrefix(zip, n = 3) {
  return digitsZip(zip).slice(0, n);
}

/**
 * Stage 0 metro match: exact ZIP, 3-digit ZIP prefix (e.g. 85001 ↔ 85007),
 * same state, or state-wide row with no ZIP. Nearby radius_miles also
 * qualifies same-state / prefix matches for nearby metro ZIPs.
 */
function resolveLeadLocation(lead) {
  const parsed = parseAddressParts(lead?.address || '');
  return {
    zip: lead?.zip || parsed.zip,
    state: lead?.state || parsed.state,
    city: lead?.city || null,
  };
}

export function areaMatchesLead(area, lead) {
  if (!area || !lead) return false;

  const resolved = resolveLeadLocation(lead);
  const leadZip = digitsZip(resolved.zip);
  const leadState = String(resolved.state || '').trim().toUpperCase();
  const leadCity = String(resolved.city || '').trim().toLowerCase();
  const stage = Number(lead.expansion_stage) || 0;
  const expansionRadius = Number(lead.expansion_radius_miles) || 25;

  const areaZip = digitsZip(area.zip);
  const areaState = String(area.state || '').trim().toUpperCase();
  const radius = Number(area.radius_miles) || 0;

  if (leadZip && areaZip && leadZip === areaZip) return true;

  if (!areaZip && leadState && areaState && leadState === areaState) return true;

  const sameState = Boolean(leadState && areaState && leadState === areaState);
  const prefixMatch =
    leadZip.length >= 3 && areaZip.length >= 3 && zipPrefix(leadZip) === zipPrefix(areaZip);

  // Stage 0: metro / nearby / same-state (installer chips use city ZIPs that
  // often differ from listing ZIPs, e.g. Phoenix 85001 vs lead 85007).
  if (stage === 0) {
    if (prefixMatch) return true;
    if (sameState) return true;
    if (radius > 0 && (prefixMatch || sameState)) return true;
    if (leadCity && sameState) return true;
    return false;
  }

  if (stage >= 1) {
    if (sameState) return true;
    if (radius > 0 && radius >= expansionRadius) return true;
    if (stage >= 2 && prefixMatch) return true;
  }

  if (stage >= 3 && (areaZip || areaState)) return true;

  return false;
}

/**
 * Returns true if installer may see/bid on this lead based on service areas.
 * - rejected / suspended profiles are always blocked
 * - when requireVerified=true, only verification_status=verified may see leads
 * - no service-area rows → not eligible (installer must pick territory first)
 * - with service-area rows → lead ZIP/state must match
 */
export async function isInstallerEligible(userId, lead, { requireVerified = true } = {}) {
  if (!userId || !lead) return false;

  const [profiles] = await db.query(
    `SELECT verification_status FROM installer_profiles WHERE user_id = ?`,
    [userId],
  );
  const status = profiles[0]?.verification_status || 'pending';
  if (status === 'rejected' || status === 'suspended') return false;
  if (requireVerified && status !== 'verified') return false;

  const [areas] = await db.query(
    `SELECT zip, state, radius_miles FROM installer_service_areas WHERE user_id = ?`,
    [userId],
  );
  if (!areas.length) return false;

  for (const area of areas) {
    if (areaMatchesLead(area, lead)) return true;
  }

  return false;
}

export async function listEligibleLeadIdsForInstaller(userId, leads) {
  const out = [];
  for (const lead of leads) {
    if (await isInstallerEligible(userId, lead)) out.push(lead.id);
  }
  return out;
}

export async function ensureInstallerProfile(userId, companyName = null) {
  await db.query(
    `INSERT INTO installer_profiles (user_id, company_name, verification_status)
     VALUES (?, ?, 'pending')
     ON DUPLICATE KEY UPDATE
       company_name = COALESCE(VALUES(company_name), company_name)`,
    [userId, companyName],
  );
}
