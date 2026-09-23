import { resolveWorkspaceContext, workspaceHasPermission } from '../utils/workspaceContext.js';

/**
 * Enforce a workspace RBAC permission after authenticateToken.
 * Attaches `req.workspace` for downstream handlers.
 *
 * @param {'team_manage'|'leads_export'|'billing_view'|string} permission
 */
export function requireWorkspacePermission(permission) {
  return async (req, res, next) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const workspace = req.workspace || (await resolveWorkspaceContext(req.user.id));
      req.workspace = workspace;
      if (!workspaceHasPermission(workspace, permission)) {
        return res.status(403).json({
          error: `Missing workspace permission: ${permission}`,
          code: 'WORKSPACE_PERMISSION_DENIED',
          permission,
        });
      }
      return next();
    } catch (err) {
      console.error('requireWorkspacePermission error:', err);
      return res.status(500).json({ error: 'Failed to verify workspace permissions' });
    }
  };
}

/** Attach req.workspace without enforcing a permission. */
export async function attachWorkspace(req, res, next) {
  try {
    if (req.user?.id && !req.workspace) {
      req.workspace = await resolveWorkspaceContext(req.user.id);
    }
    return next();
  } catch (err) {
    console.error('attachWorkspace error:', err);
    return res.status(500).json({ error: 'Failed to resolve workspace' });
  }
}
