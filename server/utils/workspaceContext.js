import db from '../db.js';

/** All workspace permission keys used by RBAC. */
export const ALL_WORKSPACE_PERMISSIONS = [
  'leads_view',
  'leads_create',
  'leads_edit',
  'leads_export',
  'proposals_create',
  'proposals_edit',
  'outreach_send',
  'analytics_view',
  'team_manage',
  'billing_view',
];

export const DEFAULT_WORKSPACE_ROLES = [
  {
    id: 'manager',
    name: 'Manager',
    description: 'Full pipeline, proposals, team management & analytics access',
    color: 'purple',
    isDefault: true,
    permissions: [
      'leads_view',
      'leads_create',
      'leads_edit',
      'leads_export',
      'proposals_create',
      'proposals_edit',
      'outreach_send',
      'analytics_view',
      'team_manage',
      'billing_view',
    ],
  },
  {
    id: 'sales_rep',
    name: 'Sales Rep',
    description: 'Prospect searching, pipeline management, and proposal generation',
    color: 'blue',
    isDefault: true,
    permissions: [
      'leads_view',
      'leads_create',
      'leads_edit',
      'proposals_create',
      'proposals_edit',
      'outreach_send',
    ],
  },
  {
    id: 'canvasser',
    name: 'Canvasser',
    description: 'Field territory scanning, mobile lead capture, and status logging',
    color: 'amber',
    isDefault: true,
    permissions: ['leads_view', 'leads_create', 'leads_edit'],
  },
  {
    id: 'estimator',
    name: 'Estimator',
    description: 'System design, solar equipment modeling, and proposal pricing',
    color: 'emerald',
    isDefault: true,
    permissions: ['leads_view', 'proposals_create', 'proposals_edit', 'analytics_view'],
  },
];

function parsePermissions(raw) {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function resolveMemberPermissions(ownerUserId, roleKey, roleId) {
  if (roleId != null && Number.isFinite(Number(roleId))) {
    try {
      const [custom] = await db.query(
        'SELECT permissions FROM workspace_roles WHERE id = ? AND owner_user_id = ? LIMIT 1',
        [Number(roleId), ownerUserId],
      );
      if (custom.length > 0) {
        return parsePermissions(custom[0].permissions);
      }
    } catch (err) {
      if (err?.code !== 'ER_NO_SUCH_TABLE') throw err;
    }
  }

  const def = DEFAULT_WORKSPACE_ROLES.find((r) => r.id === String(roleKey || ''));
  if (def) return [...def.permissions];

  // Legacy free-text roles without a matching default — minimal access
  return ['leads_view'];
}

/**
 * Resolve the workspace credit/lead pool for an actor.
 * Owners pool to themselves; active team members pool to their owner.
 * @returns {{ ownerUserId: number, actorUserId: number, isOwner: boolean, teamRole: string|null, roleId: number|null, permissions: string[] }}
 */
export async function resolveWorkspaceContext(userId) {
  const actorId = Number(userId);
  if (!Number.isFinite(actorId)) {
    throw new Error('Invalid user id for workspace context');
  }

  let memberRows = [];
  try {
    const [rows] = await db.query(
      `SELECT tm.owner_user_id, tm.role, tm.role_id
       FROM users u
       JOIN team_members tm
         ON LOWER(tm.member_email) = LOWER(u.email)
        AND tm.status = 'active'
       WHERE u.id = ?
         AND tm.owner_user_id <> u.id
       ORDER BY tm.id ASC
       LIMIT 1`,
      [actorId],
    );
    memberRows = rows;
  } catch (err) {
    // Legacy DBs may lack team_members.role_id until migrateSchema() runs.
    if (err?.code === 'ER_BAD_FIELD_ERROR' || err?.code === 'ER_NO_SUCH_TABLE') {
      try {
        const [rows] = await db.query(
          `SELECT tm.owner_user_id, tm.role, NULL AS role_id
           FROM users u
           JOIN team_members tm
             ON LOWER(tm.member_email) = LOWER(u.email)
            AND tm.status = 'active'
           WHERE u.id = ?
             AND tm.owner_user_id <> u.id
           ORDER BY tm.id ASC
           LIMIT 1`,
          [actorId],
        );
        memberRows = rows;
      } catch (fallbackErr) {
        if (fallbackErr?.code === 'ER_NO_SUCH_TABLE') {
          memberRows = [];
        } else {
          throw fallbackErr;
        }
      }
    } else {
      throw err;
    }
  }

  if (memberRows.length === 0) {
    return {
      ownerUserId: actorId,
      actorUserId: actorId,
      isOwner: true,
      teamRole: 'owner',
      roleId: null,
      permissions: [...ALL_WORKSPACE_PERMISSIONS],
    };
  }

  const tm = memberRows[0];
  const ownerUserId = Number(tm.owner_user_id);
  const permissions = await resolveMemberPermissions(ownerUserId, tm.role, tm.role_id);

  return {
    ownerUserId,
    actorUserId: actorId,
    isOwner: false,
    teamRole: tm.role || null,
    roleId: tm.role_id != null ? Number(tm.role_id) : null,
    permissions,
  };
}

export function workspaceHasPermission(workspace, permission) {
  if (!workspace) return false;
  if (workspace.isOwner) return true;
  return Array.isArray(workspace.permissions) && workspace.permissions.includes(permission);
}

/** assigned_to for new leads: set when actor is a member, else null (owner-created). */
export function assignedToForActor(workspace) {
  if (!workspace || workspace.isOwner) return null;
  return workspace.actorUserId;
}
