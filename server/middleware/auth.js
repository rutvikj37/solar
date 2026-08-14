import jwt from 'jsonwebtoken';
import db from '../db.js';

const WEAK_DEFAULTS = new Set([
  'solar_velocity_secret_jwt_2026',
  'secret',
  'changeme',
  'jwt_secret',
]);

function resolveJwtSecret() {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret || secret.length < 32 || WEAK_DEFAULTS.has(secret)) {
    console.error(
      '[Auth] JWT_SECRET must be set to a strong random value (≥32 characters). Refusing to start with a missing/weak secret.'
    );
    process.exit(1);
  }
  return secret;
}

const JWT_SECRET = resolveJwtSecret();

export const ADMIN_ROLES = ['admin', 'platform_admin', 'super_admin'];

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

/**
 * Reload live role + account_status from DB. Rejects suspended/missing users.
 * Use after authenticateToken on privileged routes (and anywhere role must be fresh).
 */
export async function attachUserSession(req, res, next) {
  try {
    const [users] = await db.query(
      'SELECT id, email, name, role, account_status FROM users WHERE id = ?',
      [req.user.id]
    );
    if (users.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    const row = users[0];
    const status = String(row.account_status || 'active').toLowerCase();
    if (status && status !== 'active') {
      return res.status(403).json({ error: 'Account is not active' });
    }
    req.user.role = row.role;
    req.user.account_status = row.account_status;
    req.user.email = row.email;
    req.user.name = row.name;
    next();
  } catch (error) {
    console.error('[Auth] attachUserSession failed:', error.message || error);
    res.status(500).json({ error: 'Failed to verify session' });
  }
}

/** @deprecated Use attachUserSession */
export const attachRole = attachUserSession;

export function requireAdmin(req, res, next) {
  if (!req.user || !isAdminRole(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/** authenticateToken → live DB role/status → requireAdmin */
export const adminAuth = [authenticateToken, attachUserSession, requireAdmin];

export { JWT_SECRET };
