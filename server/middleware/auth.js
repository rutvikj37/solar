import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'solar_velocity_secret_jwt_2026';

export const ADMIN_ROLES = ['admin', 'platform_admin', 'super_admin'];

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

export function requireAdmin(req, res, next) {
  if (!req.user || !isAdminRole(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export { JWT_SECRET };
