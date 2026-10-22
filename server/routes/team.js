import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { authenticateToken, optionalAuthenticateToken, isAdminRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { assertCrmSeatAvailable, getUserEntitlements } from '../services/planEntitlements.js';
import { issueTeamInvitationEmail } from '../services/authEmailService.js';
import { signUserToken } from './auth.js';
import { resolveFrontendBaseUrl } from '../utils/frontendUrl.js';
import { requireWorkspacePermission } from '../middleware/workspacePermissions.js';
import {
  DEFAULT_WORKSPACE_ROLES,
  resolveWorkspaceContext,
  workspaceHasPermission,
} from '../utils/workspaceContext.js';

const router = express.Router();

// ==========================================
// 1. WORKSPACE ROLES MANAGEMENT
// ==========================================

// List standard and custom roles for workspace
router.get('/roles', authenticateToken, asyncHandler(async (req, res) => {
  const workspace = await resolveWorkspaceContext(req.user.id);
  const ownerUserId = workspace.ownerUserId;
  let customRoles = [];
  try {
    const [rows] = await db.query(
      'SELECT id, name, description, color, permissions, created_at, updated_at FROM workspace_roles WHERE owner_user_id = ? ORDER BY id ASC',
      [ownerUserId]
    );
    customRoles = rows;
  } catch (err) {
    if (err?.code !== 'ER_NO_SUCH_TABLE') throw err;
    customRoles = [];
  }
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
router.post('/roles', authenticateToken, requireWorkspacePermission('team_manage'), asyncHandler(async (req, res) => {
  const { name, description = '', color = 'blue', permissions = [] } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Role name is required' });
  }

  const roleNameClean = name.trim().slice(0, 64);
  const validColors = ['blue', 'emerald', 'amber', 'purple', 'rose', 'cyan', 'indigo'];
  const safeColor = validColors.includes(color) ? color : 'blue';
  const permsJson = JSON.stringify(Array.isArray(permissions) ? permissions : []);

  const ownerUserId = (req.workspace || await resolveWorkspaceContext(req.user.id)).ownerUserId;
  const [result] = await db.query(
    'INSERT INTO workspace_roles (owner_user_id, name, description, color, permissions) VALUES (?, ?, ?, ?, ?)',
    [ownerUserId, roleNameClean, description.trim().slice(0, 255), safeColor, permsJson]
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
router.put('/roles/:id', authenticateToken, requireWorkspacePermission('team_manage'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description = '', color = 'blue', permissions = [] } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Role name is required' });
  }

  const roleNameClean = name.trim().slice(0, 64);
  const permsJson = JSON.stringify(Array.isArray(permissions) ? permissions : []);

  const [result] = await db.query(
    'UPDATE workspace_roles SET name = ?, description = ?, color = ?, permissions = ? WHERE id = ? AND owner_user_id = ?',
    [roleNameClean, description.trim().slice(0, 255), color, permsJson, id, (req.workspace || await resolveWorkspaceContext(req.user.id)).ownerUserId]
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
router.delete('/roles/:id', authenticateToken, requireWorkspacePermission('team_manage'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [result] = await db.query(
    'DELETE FROM workspace_roles WHERE id = ? AND owner_user_id = ?',
    [id, (req.workspace || await resolveWorkspaceContext(req.user.id)).ownerUserId]
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
  const workspace = await resolveWorkspaceContext(req.user.id);
  const ownerUserId = workspace.ownerUserId;
  let members;
  try {
    const [rows] = await db.query(
      `SELECT tm.id, tm.member_email, tm.role, tm.role_id, tm.status, tm.invite_expires, tm.created_at,
              u.name, u.account_status,
              wr.name as custom_role_name, wr.color as custom_role_color
       FROM team_members tm
       LEFT JOIN users u ON LOWER(u.email) = LOWER(tm.member_email)
       LEFT JOIN workspace_roles wr ON wr.id = tm.role_id
       WHERE tm.owner_user_id = ?
       ORDER BY tm.created_at DESC`,
      [ownerUserId]
    );
    members = rows;
  } catch (err) {
    // Pre-migration schema: role_id / invite_* / workspace_roles may be missing.
    if (err?.code !== 'ER_BAD_FIELD_ERROR' && err?.code !== 'ER_NO_SUCH_TABLE') throw err;
    const [rows] = await db.query(
      `SELECT tm.id, tm.member_email, tm.role, tm.status, tm.created_at,
              u.name, u.account_status
       FROM team_members tm
       LEFT JOIN users u ON LOWER(u.email) = LOWER(tm.member_email)
       WHERE tm.owner_user_id = ?
       ORDER BY tm.created_at DESC`,
      [ownerUserId]
    );
    members = rows.map((m) => ({
      ...m,
      role_id: null,
      invite_expires: null,
      custom_role_name: null,
      custom_role_color: null,
    }));
  }
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

// Invite team member via Resend email
router.post('/invite', authenticateToken, requireWorkspacePermission('team_manage'), asyncHandler(async (req, res) => {
  const { memberEmail, role = 'sales_rep', roleId = null } = req.body;
  if (!memberEmail) return res.status(400).json({ error: 'memberEmail is required' });

  const wsInvite = req.workspace || await resolveWorkspaceContext(req.user.id);
  const ownerUserId = wsInvite.ownerUserId;
  try {
    await assertCrmSeatAvailable(ownerUserId, req.user.role);
  } catch (err) {
    return res.status(err.status || 403).json(err.payload || { error: err.message });
  }

  const emailClean = memberEmail.trim().toLowerCase();
  if (!emailClean.includes('@') || !emailClean.includes('.')) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  const [inviteeRows] = await db.query('SELECT id, role FROM users WHERE LOWER(email) = ? LIMIT 1', [emailClean]);
  const invitee = inviteeRows[0];
  if (invitee && isAdminRole(invitee.role)) {
    return res.status(400).json({ error: 'Platform administrator accounts cannot be invited to a workspace.' });
  }
  if (invitee && Number(invitee.id) === Number(ownerUserId)) {
    return res.status(400).json({ error: 'The workspace owner cannot be invited as a member.' });
  }

  let finalRoleName = role;
  let customRoleId = null;

  if (roleId) {
    const [cr] = await db.query(
      'SELECT id, name FROM workspace_roles WHERE id = ? AND owner_user_id = ?',
      [roleId, ownerUserId]
    );
    if (cr.length > 0) {
      customRoleId = cr[0].id;
      finalRoleName = cr[0].name;
    }
  }

  // Check if member is already in workspace
  const [existing] = await db.query(
    'SELECT id, status FROM team_members WHERE owner_user_id = ? AND LOWER(member_email) = ?',
    [ownerUserId, emailClean]
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
      [ownerUserId, emailClean, finalRoleName, customRoleId, token, expiresAt]
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

  res.status(201).json({
    id: memberId,
    memberEmail: emailClean,
    role: finalRoleName,
    roleId: customRoleId,
    status: 'pending',
    emailSent: !sendWarning,
    emailWarning: sendWarning || null,
    message: sendWarning
      ? 'Invite created, but the email could not be sent. Check email settings and use "Resend" to try again.'
      : 'Invitation sent via Resend! The team member can now accept and set their password.',
  });
}));

// Resend invitation email
router.post('/invite/resend', authenticateToken, requireWorkspacePermission('team_manage'), asyncHandler(async (req, res) => {
  const { memberId } = req.body;
  if (!memberId) return res.status(400).json({ error: 'memberId is required' });

  const ownerUserId = (req.workspace || await resolveWorkspaceContext(req.user.id)).ownerUserId;
  const [rows] = await db.query(
    'SELECT id, member_email, role, status FROM team_members WHERE id = ? AND owner_user_id = ?',
    [memberId, ownerUserId]
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

  res.json({
    success: true,
    emailSent: !sendWarning,
    message: sendWarning
      ? 'Invite refreshed, but email delivery failed. Check email settings and try again.'
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

// Accept invitation. New users set a password here; existing users must be signed in as the invited email.
router.post('/invite/accept', optionalAuthenticateToken, asyncHandler(async (req, res) => {
  const { token, name, password } = req.body;
  if (!token) return res.status(400).json({ error: 'Token is required' });

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
  const fullName = (name || '').trim() || tm.member_email.split('@')[0];

  const [existing] = await db.query('SELECT id, email, name, role FROM users WHERE LOWER(email) = ?', [emailClean]);

  if (existing.length > 0) {
    const existingUser = existing[0];
    if (isAdminRole(existingUser.role)) {
      return res.status(403).json({ error: 'Platform administrator accounts cannot join a workspace.' });
    }
    if (!req.user) {
      return res.status(401).json({
        error: `An account already exists for ${tm.member_email}. Sign in with that account to accept this invitation.`,
        code: 'LOGIN_REQUIRED',
        email: tm.member_email,
      });
    }
    if (String(req.user.email || '').toLowerCase().trim() !== emailClean || Number(req.user.id) !== Number(existingUser.id)) {
      return res.status(403).json({
        error: `This invitation is for ${tm.member_email}. Sign in with that account to accept it.`,
        code: 'INVITE_EMAIL_MISMATCH',
      });
    }

    const [upd] = await db.query(
      'UPDATE team_members SET status = "active", invite_token = NULL, invite_expires = NULL WHERE id = ? AND invite_token = ?',
      [tm.id, token]
    );
    if (upd.affectedRows === 0) {
      return res.status(400).json({ error: 'This invitation has already been used.' });
    }

    return res.json({
      success: true,
      user: {
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
        role: existingUser.role,
        companyName: tm.company_name,
        teamRole: tm.role,
      },
      message: `Welcome to ${tm.company_name || 'the workspace'}!`,
      redirect: '/dashboard',
    });
  }

  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  // Claim the invite before creating the account so a token cannot create two users.
  const [claim] = await db.query(
    'UPDATE team_members SET status = "active", invite_token = NULL, invite_expires = NULL WHERE id = ? AND invite_token = ?',
    [tm.id, token]
  );
  if (claim.affectedRows === 0) {
    return res.status(400).json({ error: 'This invitation has already been used.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  let userRecord;
  try {
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

    // Invitees share the owner's credit pool — do not grant a working Free/10 package.
    await db.query(
      'INSERT INTO user_packages (user_id, package_id, remaining_leads, purchased_leads, status) VALUES (?, "Free", 0, 0, "active")',
      [userRecord.id]
    );
  } catch (err) {
    await db.query(
      'UPDATE team_members SET status = "pending", invite_token = ?, invite_expires = ? WHERE id = ?',
      [token, tm.invite_expires, tm.id]
    ).catch(() => null);
    throw err;
  }

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
router.delete('/members/:id', authenticateToken, requireWorkspacePermission('team_manage'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ownerUserId = (req.workspace || await resolveWorkspaceContext(req.user.id)).ownerUserId;
  await db.query('DELETE FROM team_members WHERE id = ? AND owner_user_id = ?', [id, ownerUserId]);
  res.json({ success: true, message: 'Team member seat revoked' });
}));

// Territory Conversion Analytics (Cost Per Qualified Lead CPL & Closing Rate per ZIP Code)
router.get('/territory-analytics', authenticateToken, asyncHandler(async (req, res) => {
  const workspace = await resolveWorkspaceContext(req.user.id);
  const ownerUserId = workspace.ownerUserId;

  const [leads] = await db.query(
    'SELECT id, address, status, lead_score, property_value, estimated_savings, created_at FROM leads WHERE user_id = ?',
    [ownerUserId]
  );

  let unlockCostUsd = null;
  try {
    const [pkgRows] = await db.query(
      `SELECT p.price, p.lead_limit
       FROM user_packages up
       JOIN packages p ON p.id = up.package_id
       WHERE up.user_id = ? AND up.status = 'active'
       ORDER BY up.id DESC LIMIT 1`,
      [ownerUserId],
    );
    const price = Number(pkgRows[0]?.price);
    const leadLimit = Number(pkgRows[0]?.lead_limit);
    if (Number.isFinite(price) && price > 0 && Number.isFinite(leadLimit) && leadLimit > 0) {
      unlockCostUsd = price / leadLimit;
    }
  } catch {
    unlockCostUsd = null;
  }

  const territoryMap = {};

  for (const lead of leads) {
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
    const cplUsd =
      unlockCostUsd != null && t.qualifiedCount > 0
        ? Number(((t.totalScanned * unlockCostUsd) / t.qualifiedCount).toFixed(2))
        : null;
    return {
      ...t,
      closingRatePct,
      cplUsd,
    };
  });

  territories.sort((a, b) => b.closingRatePct - a.closingRatePct);

  const totalScannedAll = leads.length;
  const totalWonAll = leads.filter((l) => l.status === 'won' || l.status === 'closed').length;
  const overallClosingRate = totalScannedAll > 0 ? ((totalWonAll / totalScannedAll) * 100).toFixed(1) : 0;
  const cplValues = territories.map((x) => x.cplUsd).filter((v) => v != null && Number.isFinite(v));
  const avgCplUsd = cplValues.length > 0
    ? Number((cplValues.reduce((acc, x) => acc + x, 0) / cplValues.length).toFixed(2))
    : null;

  res.json({
    summary: {
      totalTerritories: territories.length,
      totalScannedLeads: totalScannedAll,
      totalClosedWon: totalWonAll,
      overallClosingRate: Number(overallClosingRate),
      avgCplUsd,
      unlockCostUsd,
    },
    territories,
  });
}));

/** Current actor workspace context (permissions for UI). */
router.get('/workspace', authenticateToken, asyncHandler(async (req, res) => {
  const workspace = await resolveWorkspaceContext(req.user.id);
  res.json({
    ownerUserId: workspace.ownerUserId,
    actorUserId: workspace.actorUserId,
    isOwner: workspace.isOwner,
    teamRole: workspace.teamRole,
    roleId: workspace.roleId,
    permissions: workspace.permissions,
    canManageTeam: workspaceHasPermission(workspace, 'team_manage'),
    canExportLeads: workspaceHasPermission(workspace, 'leads_export'),
    canViewBilling: workspaceHasPermission(workspace, 'billing_view'),
  });
}));

export default router;
