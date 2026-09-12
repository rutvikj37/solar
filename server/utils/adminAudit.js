import db from '../db.js';
import { logger } from './logger.js';

/**
 * Persist a platform-admin action for the Admin audit feed.
 * Failures are logged but never thrown (audit must not break the primary action).
 */
export async function writeAdminAudit({
  adminId,
  action,
  targetType = null,
  targetId = null,
  details = null,
  ip = null,
}) {
  try {
    await db.query(
      `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        adminId || null,
        String(action || '').slice(0, 100),
        targetType ? String(targetType).slice(0, 50) : null,
        targetId != null && Number.isFinite(Number(targetId)) ? Number(targetId) : null,
        details != null ? JSON.stringify(details) : null,
        ip ? String(ip).slice(0, 45) : null,
      ],
    );
  } catch (err) {
    logger.warn('admin_audit_log write failed', { action, error: err.message });
  }
}

export function clientIp(req) {
  return (
    req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    null
  );
}
