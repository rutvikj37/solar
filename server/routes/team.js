import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { assertCrmSeatAvailable, getUserEntitlements } from '../services/planEntitlements.js';
import { issueTeamInvitationEmail } from '../services/authEmailService.js';
import { signUserToken } from './auth.js';
import { resolveFrontendBaseUrl } from '../utils/frontendUrl.js';

const router = express.Router();

const DEFAULT_WORKSPACE_ROLES = [
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
    permissions: [
      'leads_view',
      'leads_create',
      'leads_edit',
    ],
  },
  {
    id: 'estimator',
    name: 'Estimator',
    description: 'System design, solar equipment modeling, and proposal pricing',
    color: 'emerald',
    isDefault: true,
    permissions: [
      'leads_view',
      'proposals_create',
      'proposals_edit',
      'analytics_view',
    ],
  },
];

// ==========================================
// 1. WORKSPACE ROLES MANAGEMENT
// ==========================================

// List standard and custom roles for workspace
router.get('/roles', authenticateToken, asyncHandler(async (req, res) => {
  const [customRoles] = await db.query(
    'SELECT id, name, description, color, permissions, created_at, updated_at FROM workspace_roles WHERE owner_user_id = ? ORDER BY id ASC',
    [req.user.id]
  );
  const formattedCustom = customRoles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description || '',
    color: r.color || 'blue',
    isDefault: false,
    permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions || '[]') : (r.permissions || []),
    created_at: r.created_at,
  }));

  res.json({
    defaultRoles: DEFAULT_WORKSPACE_ROLES,
    customRoles: formattedCustom,
    allRoles: [...DEFAULT_WORKSPACE_ROLES, ...formattedCustom],
  });
}));

// Create a custom workspace role
router.post('/roles', authenticateToken, asyncHandler(async (req, res) => {
  const { name, description = '', color = 'blue', permissions = [] } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Role name is required' });
  }

  const roleNameClean = name.trim().slice(0, 64);
  const validColors = ['blue', 'emerald', 'amber', 'purple', 'rose', 'cyan', 'indigo'];
  const safeColor = validColors.includes(color) ? color : 'blue';
  const permsJson = JSON.stringify(Array.isArray(permissions) ? permissions : []);

  const [result] = await db.query(
    'INSERT INTO workspace_roles (owner_user_id, name, description, color, permissions) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, roleNameClean, description.trim().slice(0, 255), safeColor, permsJson]
  );

  res.status(201).json({
    id: result.insertId,
    name: roleNameClean,
    description: description.trim(),
    color: safeColor,
    permissions: Array.isArray(permissions) ? permissions : [],
    isDefault: false,
    message: 'Custom workspace role created successfully',
  });
}));

// Update a custom workspace role
router.put('/roles/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description = '', color = 'blue', permissions = [] } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Role name is required' });
  }

  const roleNameClean = name.trim().slice(0, 64);
  const permsJson = JSON.stringify(Array.isArray(permissions) ? permissions : []);

  const [result] = await db.query(
    'UPDATE workspace_roles SET name = ?, description = ?, color = ?, permissions = ? WHERE id = ? AND owner_user_id = ?',
    [roleNameClean, description.trim().slice(0, 255), color, permsJson, id, req.user.id]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({ error: 'Role not found or unauthorized' });
  }

  res.json({
    id: Number(id),
    name: roleNameClean,
    description,
    color,
    permissions: Array.isArray(permissions) ? permissions : [],
    message: 'Role updated successfully',
  });
}));

// Delete a custom workspace role
router.delete('/roles/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [result] = await db.query(
    'DELETE FROM workspace_roles WHERE id = ? AND owner_user_id = ?',
    [id, req.user.id]
  );
  if (result.affectedRows === 0) {
    return res.status(404).json({ error: 'Role not found or unauthorized' });
  }
  res.json({ success: true, message: 'Custom workspace role removed' });
}));

// ==========================================
// 2. TEAM MEMBERS & INVITATION SYSTEM
// ==========================================

// List team members for logged-in master account
router.get('/members', authenticateToken, asyncHandler(async (req, res) => {
  const [members] = await db.query(
    `SELECT tm.id, tm.member_email, tm.role, tm.role_id, tm.status, tm.invite_token, tm.invite_expires, tm.created_at,
            u.name, u.account_status,
            wr.name as custom_role_name, wr.color as custom_role_color
     FROM team_members tm
     LEFT JOIN users u ON LOWER(u.email) = LOWER(tm.member_email)
     LEFT JOIN workspace_roles wr ON wr.id = tm.role_id
     WHERE tm.owner_user_id = ?
     ORDER BY tm.created_at DESC`,
    [req.user.id]
  );
  const entitlements = await getUserEntitlements(req.user.id, req.user.role);
  const frontendBaseUrl = resolveFrontendBaseUrl();

  const enrichedMembers = members.map((m) => ({
    ...m,
    inviteLink: m.invite_token ? `${frontendBaseUrl}/accept-invite?token=${encodeURIComponent(m.invite_token)}` : null,
  }));

  res.json({
    members: enrichedMembers,
    entitlements: {
      crmUserLimit: entitlements.limits.crmUserLimit,
      crmSeats: entitlements.usage.crmSeats,
      packageId: entitlements.packageId,
    },
  });
}));

// Invite team member via Resend email
router.post('/invite', authenticateToken, asyncHandler(async (req, res) => {
  const { memberEmail, role = 'sales_rep', roleId = null } = req.body;
  if (!memberEmail) return res.status(400).json({ error: 'memberEmail is required' });

  try {
    await assertCrmSeatAvailable(req.user.id, req.user.role);
  } catch (err) {
    return res.status(err.status || 403).json(err.payload || { error: err.message });
  }

  const emailClean = memberEmail.trim().toLowerCase();
  if (!emailClean.includes('@') || !emailClean.includes('.')) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  let finalRoleName = role;
  let customRoleId = null;

  if (roleId) {
    const [cr] = await db.query(
      'SELECT id, name FROM workspace_roles WHERE id = ? AND owner_user_id = ?',
      [roleId, req.user.id]
    );
    if (cr.length > 0) {
      customRoleId = cr[0].id;
      finalRoleName = cr[0].name;
    }
  }

  // Check if member is already in workspace
  const [existing] = await db.query(
    'SELECT id, status FROM team_members WHERE owner_user_id = ? AND LOWER(member_email) = ?',
    [req.user.id, emailClean]
  );

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 days

  let memberId;
  if (existing.length > 0) {
    if (existing[0].status === 'active') {
      return res.status(400).json({ error: 'This team member is already active in your workspace.' });
    }
    memberId = existing[0].id;
    await db.query(
      'UPDATE team_members SET role = ?, role_id = ?, invite_token = ?, invite_expires = ?, status = "pending" WHERE id = ?',
      [finalRoleName, customRoleId, token, expiresAt, memberId]
    );
  } else {
    const [result] = await db.query(
      'INSERT INTO team_members (owner_user_id, member_email, role, role_id, status, invite_token, invite_expires) VALUES (?, ?, ?, ?, "pending", ?, ?)',
      [req.user.id, emailClean, finalRoleName, customRoleId, token, expiresAt]
    );
    memberId = result.insertId;
  }

  // Fetch inviter info for transactional email
  const [inviterRows] = await db.query(
    'SELECT name, email, company_name FROM users WHERE id = ?',
    [req.user.id]
  );
  const inviter = inviterRows[0] || {};
  const inviterName = inviter.name || inviter.email?.split('@')[0] || 'Team Admin';
  const companyName = inviter.company_name || 'SpaceToRoof Workspace';

  let sendWarning = null;
  try {
    await issueTeamInvitationEmail({
      email: emailClean,
      name: '',
      inviterName,
      companyName,
      roleName: finalRoleName,
      token,
    });
  } catch (err) {
    sendWarning = err.message;
    console.error('[Resend Invite Send Notice]:', err.message);
  }

  const frontendBaseUrl = resolveFrontendBaseUrl();
  const inviteLink = `${frontendBaseUrl}/accept-invite?token=${encodeURIComponent(token)}`;

  res.status(201).json({
    id: memberId,
    memberEmail: emailClean,
    role: finalRoleName,
    roleId: customRoleId,
    status: 'pending',
    inviteLink,
    emailSent: !sendWarning,
    emailWarning: sendWarning || null,
    message: sendWarning
      ? 'Invite generated. Email could not be sent (copy the invitation link directly).'
      : 'Invitation sent via Resend! The team member can now accept and set their password.',
  });
}));

// Resend invitation email
router.post('/invite/resend', authenticateToken, asyncHandler(async (req, res) => {
  const { memberId } = req.body;
  if (!memberId) return res.status(400).json({ error: 'memberId is required' });

  const [rows] = await db.query(
    'SELECT id, member_email, role, status FROM team_members WHERE id = ? AND owner_user_id = ?',
    [memberId, req.user.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Team member record not found' });
  const tm = rows[0];

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

  await db.query(
    'UPDATE team_members SET invite_token = ?, invite_expires = ? WHERE id = ?',
    [token, expiresAt, tm.id]
  );

  const [inviterRows] = await db.query('SELECT name, email, company_name FROM users WHERE id = ?', [req.user.id]);
  const inviter = inviterRows[0] || {};
  const inviterName = inviter.name || inviter.email?.split('@')[0] || 'Team Admin';
  const companyName = inviter.company_name || 'SpaceToRoof Workspace';

  let sendWarning = null;
  try {
    await issueTeamInvitationEmail({
      email: tm.member_email,
      inviterName,
      companyName,
      roleName: tm.role,
      token,
    });
  } catch (err) {
    sendWarning = err.message;
  }

  const frontendBaseUrl = resolveFrontendBaseUrl();
  const inviteLink = `${frontendBaseUrl}/accept-invite?token=${encodeURIComponent(token)}`;

  res.json({
    success: true,
    inviteLink,
    emailSent: !sendWarning,
    message: sendWarning
      ? 'Invite refreshed. Email delivery failed (copy link directly).'
      : 'Invitation re-sent via Resend!',
  });
}));

// Public: Verify an invitation token
router.get('/invite/verify', asyncHandler(async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ valid: false, error: 'Token is required' });

  const [rows] = await db.query(
    `SELECT tm.id, tm.member_email, tm.role, tm.role_id, tm.status, tm.invite_expires,
            u.name as owner_name, u.company_name, u.email as owner_email
     FROM team_members tm
     JOIN users u ON u.id = tm.owner_user_id
     WHERE tm.invite_token = ?`,
    [token]
  );

  if (rows.length === 0) {
    return res.status(404).json({ valid: false, error: 'Invalid or already consumed invitation link.' });
  }

  const tm = rows[0];
  if (tm.status === 'active') {
    return res.status(400).json({ valid: false, error: 'This invitation has already been accepted. Please log in directly.' });
  }

  if (tm.invite_expires && new Date(tm.invite_expires) < new Date()) {
    return res.status(400).json({ valid: false, error: 'This invitation link has expired. Please ask your administrator to resend it.' });
  }

  const [existingUsers] = await db.query(
    'SELECT id, name, email FROM users WHERE LOWER(email) = ?',
    [tm.member_email.toLowerCase()]
  );

  res.json({
    valid: true,
    email: tm.member_email,
    role: tm.role,
    companyName: tm.company_name || `${tm.owner_name || 'Workspace'}'s Team`,
    inviterName: tm.owner_name || tm.owner_email?.split('@')[0] || 'Team Admin',
    userExists: existingUsers.length > 0,
    existingName: existingUsers[0]?.name || '',
  });
}));

// Public: Accept invitation & set password
router.post('/invite/accept', asyncHandler(async (req, res) => {
  const { token, name, password } = req.body;
  if (!token) return res.status(400).json({ error: 'Token is required' });
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  const [rows] = await db.query(
    `SELECT tm.id, tm.owner_user_id, tm.member_email, tm.role, tm.role_id, tm.status, tm.invite_expires,
            u.company_name, u.name as owner_name
     FROM team_members tm
     JOIN users u ON u.id = tm.owner_user_id
     WHERE tm.invite_token = ?`,
    [token]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Invalid invitation link.' });
  }

  const tm = rows[0];
  if (tm.status === 'active') {
    return res.status(400).json({ error: 'This invitation has already been accepted. Please log in.' });
  }

  if (tm.invite_expires && new Date(tm.invite_expires) < new Date()) {
    return res.status(400).json({ error: 'This invitation link has expired. Please ask for a new invite.' });
  }

  const emailClean = tm.member_email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, 10);
  const fullName = (name || '').trim() || tm.member_email.split('@')[0];

  let userRecord;
  const [existing] = await db.query('SELECT * FROM users WHERE LOWER(email) = ?', [emailClean]);

  if (existing.length > 0) {
    userRecord = existing[0];
    await db.query(
      'UPDATE users SET password_hash = ?, name = COALESCE(NULLIF(?, ""), name), email_verified = 1, account_status = "active" WHERE id = ?',
      [passwordHash, fullName, userRecord.id]
    );
    userRecord.name = fullName || userRecord.name;
    userRecord.role = userRecord.role || 'solar_company';
  } else {
    const [ins] = await db.query(
      `INSERT INTO users (name, email, password_hash, role, company_name, email_verified, account_status)
       VALUES (?, ?, ?, 'solar_company', ?, 1, 'active')`,
      [fullName, emailClean, passwordHash, tm.company_name || 'Solar Team']
    );
    userRecord = {
      id: ins.insertId,
      name: fullName,
      email: emailClean,
      role: 'solar_company',
      company_name: tm.company_name,
    };

    // Assign initial package for app compatibility
    await db.query(
      'INSERT INTO user_packages (user_id, package_id, remaining_leads, purchased_leads, status) VALUES (?, "Free", 10, 10, "active")',
      [userRecord.id]
    );
  }

  // Update team_member status to active and clear invite token
  await db.query(
    'UPDATE team_members SET status = "active", invite_token = NULL, invite_expires = NULL WHERE id = ?',
    [tm.id]
  );

  const jwtToken = signUserToken(userRecord);

  res.json({
    success: true,
    token: jwtToken,
    user: {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      role: userRecord.role,
      companyName: tm.company_name,
      teamRole: tm.role,
    },
    message: `Welcome to ${tm.company_name || 'the workspace'}! Your account is active.`,
    redirect: '/dashboard',
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
