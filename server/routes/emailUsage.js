import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getEmailQuota } from '../services/email/emailQuota.js';
import { getPlatformEmailProvider } from '../services/outreachDelivery.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

router.get(
  '/usage',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const quota = await getEmailQuota(req.user.id, req.user.role);
    res.json({
      unlimited: !!quota.unlimited,
      packageId: quota.packageId,
      packageName: quota.packageName,
      limit: quota.unlimited ? null : quota.limit,
      used: quota.used,
      remaining: quota.unlimited ? null : quota.remaining,
      periodKey: quota.periodKey,
      periodEnd: quota.periodEnd,
      provider: getPlatformEmailProvider() || 'none',
    });
  }),
);

export default router;
