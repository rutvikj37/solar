import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { assertCrmSeatAvailable, getUserEntitlements } from '../services/planEntitlements.js';

const router = express.Router();

// List team members for logged-in master account
router.get('/members', authenticateToken, asyncHandler(async (req, res) => {
  const [members] = await db.query(
    `SELECT tm.id, tm.member_email, tm.role, tm.status, tm.created_at, u.name, u.account_status
     FROM team_members tm
     LEFT JOIN users u ON LOWER(u.email) = LOWER(tm.member_email)
     WHERE tm.owner_user_id = ?
     ORDER BY tm.created_at DESC`,
    [req.user.id]
  );
  const entitlements = await getUserEntitlements(req.user.id, req.user.role);
  res.json({
    members,
    entitlements: {
      crmUserLimit: entitlements.limits.crmUserLimit,
      crmSeats: entitlements.usage.crmSeats,
      packageId: entitlements.packageId,
    },
  });
}));

// Invite team member
router.post('/invite', authenticateToken, asyncHandler(async (req, res) => {
  const { memberEmail, role = 'sales_rep' } = req.body;
  if (!memberEmail) return res.status(400).json({ error: 'memberEmail is required' });
  if (!['manager', 'canvasser', 'sales_rep'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    await assertCrmSeatAvailable(req.user.id, req.user.role);
  } catch (err) {
    return res.status(err.status || 403).json(err.payload || { error: err.message });
  }

  const emailClean = memberEmail.trim().toLowerCase();
  const [existing] = await db.query(
    'SELECT id FROM team_members WHERE owner_user_id = ? AND LOWER(member_email) = ?',
    [req.user.id, emailClean]
  );
  if (existing.length > 0) {
    return res.status(400).json({ error: 'Team member already invited' });
  }

  const [result] = await db.query(
    'INSERT INTO team_members (owner_user_id, member_email, role, status) VALUES (?, ?, ?, "active")',
    [req.user.id, emailClean, role]
  );

  res.status(201).json({
    id: result.insertId,
    memberEmail: emailClean,
    role,
    status: 'active',
    message: 'Team member added to workspace!'
  });
}));

// Delete/Revoke team member
router.delete('/members/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  await db.query('DELETE FROM team_members WHERE id = ? AND owner_user_id = ?', [id, req.user.id]);
  res.json({ success: true, message: 'Team member seat revoked' });
}));

// Territory Conversion Analytics (Cost Per Qualified Lead CPL & Closing Rate per ZIP Code)
router.get('/territory-analytics', authenticateToken, asyncHandler(async (req, res) => {
  const [leads] = await db.query(
    'SELECT id, address, status, lead_score, property_value, estimated_savings, created_at FROM leads WHERE user_id = ?',
    [req.user.id]
  );

  const territoryMap = {};

  for (const lead of leads) {
    // Extract ZIP code from address string (e.g. "123 Main St, Beverly Hills, CA 90210")
    const match = (lead.address || '').match(/\b\d{5}(?:-\d{4})?\b/);
    const zip = match ? match[0] : 'Other Territory';

    if (!territoryMap[zip]) {
      territoryMap[zip] = {
        zip,
        totalScanned: 0,
        qualifiedCount: 0,
        closedWonCount: 0,
        totalEstSavings: 0,
        totalValue: 0
      };
    }

    territoryMap[zip].totalScanned += 1;
    if ((lead.lead_score || 0) >= 70) territoryMap[zip].qualifiedCount += 1;
    if (lead.status === 'won' || lead.status === 'closed') territoryMap[zip].closedWonCount += 1;
    territoryMap[zip].totalEstSavings += Number(lead.estimated_savings || 0);
    territoryMap[zip].totalValue += Number(lead.property_value || 0);
  }

  const territories = Object.values(territoryMap).map((t) => {
    const closingRatePct = t.totalScanned > 0 ? Number(((t.closedWonCount / t.totalScanned) * 100).toFixed(1)) : 0;
    const cplUsd = t.qualifiedCount > 0 ? Number(((t.totalScanned * 0.50) / t.qualifiedCount).toFixed(2)) : 0.50;
    return {
      ...t,
      closingRatePct,
      cplUsd
    };
  });

  territories.sort((a, b) => b.closingRatePct - a.closingRatePct);

  const totalScannedAll = leads.length;
  const totalWonAll = leads.filter((l) => l.status === 'won' || l.status === 'closed').length;
  const overallClosingRate = totalScannedAll > 0 ? ((totalWonAll / totalScannedAll) * 100).toFixed(1) : 0;
  const avgCpl = territories.length > 0 ? (territories.reduce((acc, x) => acc + x.cplUsd, 0) / territories.length).toFixed(2) : '0.50';

  res.json({
    summary: {
      totalTerritories: territories.length,
      totalScannedLeads: totalScannedAll,
      totalClosedWon: totalWonAll,
      overallClosingRate: Number(overallClosingRate),
      avgCplUsd: Number(avgCpl)
    },
    territories
  });
}));

export default router;
