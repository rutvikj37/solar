/**
 * Plan-wise feature entitlements for Founding Launch packages.
 * Numeric limits come from the packages row; booleans from package id.
 */
import db from '../db.js';
import { isAdminRole } from '../middleware/auth.js';

const ALL_FEATURES = {
  marketplace: true,
  proposals: true,
  appointments: true,
  csvExport: true,
  advancedFilters: true,
  dripAutomations: true,
  territoryLock: true,
  earlyMarketplace: true,
};

const FEATURES_BY_PLAN = {
  Free: {
    marketplace: false,
    proposals: false,
    appointments: false,
    csvExport: false,
    advancedFilters: false,
    dripAutomations: true,
    territoryLock: false,
    earlyMarketplace: false,
  },
  Scout: {
    marketplace: false,
    proposals: false,
    appointments: false,
    csvExport: true,
    advancedFilters: false,
    dripAutomations: true,
    territoryLock: false,
    earlyMarketplace: false,
  },
  Pioneer: {
    marketplace: true,
    proposals: true,
    appointments: false,
    csvExport: true,
    advancedFilters: true,
    dripAutomations: true,
    territoryLock: false,
    earlyMarketplace: false,
  },
  MissionControl: {
    marketplace: true,
    proposals: true,
    appointments: true,
    csvExport: true,
    advancedFilters: true,
    dripAutomations: true,
    territoryLock: true,
    earlyMarketplace: true,
  },
  Admin: { ...ALL_FEATURES },
};

const DEFAULT_LIMITS = {
  leadLimit: 0,
  emailLimit: 0,
  whatsappLimit: 0,
  crmUserLimit: 1,
  emailAutomationLimit: 1,
  territoryLockDays: 0,
};

function featuresForPackageId(packageId) {
  const id = String(packageId || 'Free');
  if (FEATURES_BY_PLAN[id]) return { ...FEATURES_BY_PLAN[id] };
  // Unknown paid / admin-created plan: Pioneer-level access
  return { ...FEATURES_BY_PLAN.Pioneer };
}

/**
 * Resolve active package row for a user (subscription preferred, else user_packages).
 */
export async function resolveUserPackage(userId, userRole = null) {
  if (userRole && isAdminRole(userRole)) {
    return {
      unlimited: true,
      packageId: 'Admin',
      packageName: 'Admin',
      leadLimit: Number.MAX_SAFE_INTEGER,
      emailLimit: Number.MAX_SAFE_INTEGER,
      whatsappLimit: Number.MAX_SAFE_INTEGER,
      crmUserLimit: Number.MAX_SAFE_INTEGER,
      emailAutomationLimit: Number.MAX_SAFE_INTEGER,
      territoryLockDays: 7,
    };
  }

  const [subs] = await db.query(
    `SELECT s.package_id, s.status, p.name AS package_name,
            p.lead_limit, p.email_limit, p.whatsapp_limit,
            p.crm_user_limit, p.email_automation_limit, p.price
     FROM user_subscriptions s
     LEFT JOIN packages p ON p.id = s.package_id
     WHERE s.user_id = ?
       AND s.status IN ('active', 'trialing', 'past_due')
     LIMIT 1`,
    [userId],
  );

  if (subs.length) {
    const s = subs[0];
    const features = featuresForPackageId(s.package_id);
    return {
      unlimited: false,
      packageId: s.package_id || 'Free',
      packageName: s.package_name || s.package_id || 'Free',
      leadLimit: Number(s.lead_limit) || 0,
      emailLimit: Number(s.email_limit) || 0,
      whatsappLimit: Number(s.whatsapp_limit) || 0,
      crmUserLimit: Number(s.crm_user_limit) || DEFAULT_LIMITS.crmUserLimit,
      emailAutomationLimit:
        Number(s.email_automation_limit) || DEFAULT_LIMITS.emailAutomationLimit,
      territoryLockDays: features.territoryLock ? 7 : 0,
    };
  }

  const [packs] = await db.query(
    `SELECT up.package_id, p.name AS package_name,
            p.lead_limit, p.email_limit, p.whatsapp_limit,
            p.crm_user_limit, p.email_automation_limit
     FROM user_packages up
     LEFT JOIN packages p ON p.id = up.package_id
     WHERE up.user_id = ? AND up.status = 'active'
     ORDER BY up.id DESC
     LIMIT 1`,
    [userId],
  );

  if (packs.length) {
    const p = packs[0];
    const features = featuresForPackageId(p.package_id);
    return {
      unlimited: false,
      packageId: p.package_id || 'Free',
      packageName: p.package_name || p.package_id || 'Free',
      leadLimit: Number(p.lead_limit) || 0,
      emailLimit: Number(p.email_limit) || 0,
      whatsappLimit: Number(p.whatsapp_limit) || 0,
      crmUserLimit: Number(p.crm_user_limit) || DEFAULT_LIMITS.crmUserLimit,
      emailAutomationLimit:
        Number(p.email_automation_limit) || DEFAULT_LIMITS.emailAutomationLimit,
      territoryLockDays: features.territoryLock ? 7 : 0,
    };
  }

  return {
    unlimited: false,
    packageId: 'Free',
    packageName: 'Free',
    ...DEFAULT_LIMITS,
  };
}

export async function getUserEntitlements(userId, userRole = null) {
  // Members inherit the workspace owner's package features/limits for lead ops.
  let entitlementUserId = userId;
  try {
    const { resolveWorkspaceContext } = await import('../utils/workspaceContext.js');
    const ws = await resolveWorkspaceContext(userId);
    entitlementUserId = ws.ownerUserId;
  } catch {
    /* fall back to actor */
  }
  const pkg = await resolveUserPackage(entitlementUserId, userRole);
  const features = pkg.unlimited
    ? { ...ALL_FEATURES }
    : featuresForPackageId(pkg.packageId);

  let dripCampaigns = 0;
  let crmSeats = 1; // owner counts as 1
  try {
    const [dripRows] = await db.query(
      `SELECT COUNT(*) AS cnt FROM drip_campaigns WHERE user_id = ?`,
      [entitlementUserId],
    );
    dripCampaigns = Number(dripRows[0]?.cnt) || 0;
  } catch {
    /* table may not exist yet */
  }
  try {
    const [seatRows] = await db.query(
      `SELECT COUNT(*) AS cnt FROM team_members WHERE owner_user_id = ? AND status = 'active'`,
      [entitlementUserId],
    );
    crmSeats = 1 + (Number(seatRows[0]?.cnt) || 0);
  } catch {
    /* ignore */
  }

  return {
    packageId: pkg.packageId,
    packageName: pkg.packageName,
    unlimited: !!pkg.unlimited,
    features,
    limits: {
      leadLimit: pkg.leadLimit,
      emailLimit: pkg.emailLimit,
      whatsappLimit: pkg.whatsappLimit,
      crmUserLimit: pkg.crmUserLimit,
      emailAutomationLimit: pkg.emailAutomationLimit,
      territoryLockDays: pkg.territoryLockDays,
    },
    usage: {
      dripCampaigns,
      crmSeats,
    },
    ownerUserId: entitlementUserId,
  };
}

export function featureDeniedPayload(feature, entitlements) {
  const upgradeHints = {
    marketplace: 'Upgrade to Pioneer or Mission Control for Marketplace access.',
    proposals: 'Upgrade to Pioneer or Mission Control to use the Proposal maker.',
    appointments: 'Upgrade to Mission Control to use the Appointment setter.',
    csvExport: 'Upgrade to Scout or higher to export leads as CSV.',
    advancedFilters: 'Upgrade to Pioneer or Mission Control for advanced map filters.',
    territoryLock: 'Upgrade to Mission Control for territory intelligence lock.',
    earlyMarketplace: 'Upgrade to Mission Control for early marketplace access.',
    dripAutomations: 'You have reached your email automation limit for this plan.',
    crmSeats: 'You have reached your CRM user seat limit for this plan.',
  };
  return {
    error: upgradeHints[feature] || 'Plan upgrade required for this feature.',
    code: 'PLAN_FEATURE_REQUIRED',
    feature,
    packageId: entitlements?.packageId || null,
    packageName: entitlements?.packageName || null,
    upgradePath: '/billing#plans',
  };
}

/** Express middleware — call after authenticateToken. */
export function requirePlanFeature(featureKey) {
  return async (req, res, next) => {
    try {
      const entitlements = await getUserEntitlements(req.user.id, req.user.role);
      req.entitlements = entitlements;
      if (entitlements.unlimited || entitlements.features[featureKey]) {
        return next();
      }
      return res.status(403).json(featureDeniedPayload(featureKey, entitlements));
    } catch (err) {
      console.error('requirePlanFeature error:', err);
      return res.status(500).json({ error: 'Failed to verify plan entitlements' });
    }
  };
}

export async function assertCrmSeatAvailable(userId, userRole) {
  const ents = await getUserEntitlements(userId, userRole);
  if (ents.unlimited) return ents;
  if (ents.usage.crmSeats >= ents.limits.crmUserLimit) {
    const err = new Error(featureDeniedPayload('crmSeats', ents).error);
    err.status = 403;
    err.payload = featureDeniedPayload('crmSeats', ents);
    throw err;
  }
  return ents;
}

export async function assertDripCampaignAvailable(userId, userRole) {
  const ents = await getUserEntitlements(userId, userRole);
  if (ents.unlimited) return ents;
  if (!ents.features.dripAutomations) {
    const err = new Error(featureDeniedPayload('dripAutomations', ents).error);
    err.status = 403;
    err.payload = featureDeniedPayload('dripAutomations', ents);
    throw err;
  }
  if (ents.usage.dripCampaigns >= ents.limits.emailAutomationLimit) {
    const err = new Error(featureDeniedPayload('dripAutomations', ents).error);
    err.status = 403;
    err.payload = {
      ...featureDeniedPayload('dripAutomations', ents),
      limit: ents.limits.emailAutomationLimit,
      used: ents.usage.dripCampaigns,
    };
    throw err;
  }
  return ents;
}

/**
 * Check ZIP territory lock. Returns { locked, lockedBySelf, lockedUntil, ownerUserId }.
 */
export async function getTerritoryLock(zip) {
  const zipClean = String(zip || '').trim().slice(0, 20);
  if (!zipClean) return { locked: false };
  try {
    const [rows] = await db.query(
      `SELECT zip, user_id, locked_until FROM territory_locks
       WHERE zip = ? AND locked_until > NOW()
       LIMIT 1`,
      [zipClean],
    );
    if (!rows.length) return { locked: false };
    return {
      locked: true,
      ownerUserId: rows[0].user_id,
      lockedUntil: rows[0].locked_until,
    };
  } catch {
    return { locked: false };
  }
}

export async function claimTerritoryLock(userId, zip, days = 7) {
  const zipClean = String(zip || '').trim().slice(0, 20);
  const d = Math.max(1, Number(days) || 7);
  if (!zipClean || !userId) return;
  try {
    await db.query(
      `INSERT INTO territory_locks (zip, user_id, locked_until)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))
       ON DUPLICATE KEY UPDATE
         user_id = VALUES(user_id),
         locked_until = VALUES(locked_until)`,
      [zipClean, userId, d],
    );
  } catch (err) {
    console.warn('claimTerritoryLock failed:', err.message);
  }
}
