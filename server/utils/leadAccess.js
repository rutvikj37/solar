import db from '../db.js';
import { isAdminRole } from '../middleware/auth.js';

const LEAD_ACCESS_WHERE = `
  l.id = ? AND (
    l.user_id = ?
    OR tm.owner_user_id = ?
    OR l.user_id IN (
      SELECT id FROM users WHERE email IN (
        SELECT member_email FROM team_members WHERE owner_user_id = ?
      )
    )
  )
`;

/** Resolve a lead only if the user owns it (or team access). Admins may load any lead by id. */
export async function fetchLeadForUser(leadId, userId, role, selectClause = 'l.*') {
  let [leads] = await db.query(
    `SELECT ${selectClause} FROM leads l
     LEFT JOIN users u ON u.id = l.user_id
     LEFT JOIN team_members tm ON LOWER(tm.member_email) = LOWER(u.email)
     WHERE ${LEAD_ACCESS_WHERE}`,
    [leadId, userId, userId, userId],
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
