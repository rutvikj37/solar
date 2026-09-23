import db from '../db.js';
import { isAdminRole } from '../middleware/auth.js';
import { resolveWorkspaceContext } from './workspaceContext.js';

/**
 * Lead is visible if it belongs to the workspace owner pool, the actor personally
 * (legacy), or is assigned to the actor.
 */
export async function fetchLeadForUser(leadId, userId, role, selectClause = 'l.*') {
  const ws = await resolveWorkspaceContext(userId);
  let [leads] = await db.query(
    `SELECT ${selectClause} FROM leads l
     WHERE l.id = ? AND (
       l.user_id = ?
       OR l.user_id = ?
       OR l.assigned_to = ?
     )`,
    [leadId, ws.ownerUserId, userId, userId],
  );
  if (leads.length === 0 && isAdminRole(role)) {
    const adminCols =
      selectClause === 'l.*' ? '*' : selectClause.replace(/\bl\./g, '');
    [leads] = await db.query(`SELECT ${adminCols} FROM leads WHERE id = ?`, [leadId]);
  }
  return leads[0] || null;
}

/** @deprecated Use fetchLeadForUser — kept for call-site compatibility */
export async function assertLeadOwnership(leadId, userId, role = 'solar_company', selectClause = 'l.*') {
  return fetchLeadForUser(leadId, userId, role, selectClause);
}

/** SQL fragment helpers for workspace-scoped lead lists. */
export function workspaceLeadOwnerId(workspace) {
  return workspace?.ownerUserId;
}

export function maskLeadContactForPublic(lead) {
  if (!lead) return null;
  const phone = lead.phone ? `***-***-${String(lead.phone).replace(/\D/g, '').slice(-4)}` : null;
  let email = lead.email;
  if (email && email.includes('@')) {
    const [user, domain] = email.split('@');
    email = `${user[0] || ''}***@${domain}`;
  }
  return { ...lead, phone, email };
}
