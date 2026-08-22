import db from '../../db.js';
import { adjustWallet } from './wallet.js';
import { DISPUTE_CLAIM_TYPES, TERMINAL_NO_RELIST } from './constants.js';

export async function fileDispute({ leadId, installerUserId, claimType, details }) {
  if (!DISPUTE_CLAIM_TYPES.includes(claimType)) {
    throw new Error('Invalid claim type');
  }

  const [leads] = await db.query(`SELECT * FROM marketplace_leads WHERE id = ?`, [leadId]);
  const lead = leads[0];
  if (!lead) throw new Error('Lead not found');
  if (Number(lead.winner_user_id) !== Number(installerUserId)) {
    throw new Error('Only the winning installer can dispute this lead');
  }
  if (TERMINAL_NO_RELIST.has(lead.status) && lead.status === 'invalid_refunded') {
    throw new Error('Lead already refunded');
  }
  if (!lead.unlocked_at && lead.status !== 'lead_unlocked' && !['contacted', 'interested', 'appointment', 'proposal', 'won', 'lost'].includes(lead.status)) {
    throw new Error('Lead not unlocked yet');
  }

  const [existing] = await db.query(
    `SELECT id FROM marketplace_disputes
     WHERE lead_id = ? AND installer_user_id = ? AND status = 'pending'`,
    [leadId, installerUserId],
  );
  if (existing.length) throw new Error('A pending dispute already exists for this lead');

  const [result] = await db.query(
    `INSERT INTO marketplace_disputes
      (lead_id, installer_user_id, claim_type, details, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [leadId, installerUserId, claimType, details || null],
  );
  return result.insertId;
}

export async function reviewDispute({ disputeId, adminId, decision, reviewNote, refundAmount }) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT d.*, l.winning_amount, l.status AS lead_status, l.lead_code
       FROM marketplace_disputes d
       JOIN marketplace_leads l ON l.id = d.lead_id
       WHERE d.id = ?
       FOR UPDATE`,
      [disputeId],
    );
    const dispute = rows[0];
    if (!dispute) throw new Error('Dispute not found');
    if (dispute.status !== 'pending') throw new Error('Dispute already reviewed');

    if (decision === 'denied') {
      await conn.query(
        `UPDATE marketplace_disputes SET
           status = 'denied', reviewed_by = ?, review_note = ?, reviewed_at = NOW()
         WHERE id = ?`,
        [adminId, reviewNote || null, disputeId],
      );
      await conn.commit();
      return { status: 'denied' };
    }

    if (decision !== 'approved') throw new Error('Invalid decision');

    const amount =
      refundAmount != null && Number.isFinite(Number(refundAmount))
        ? Number(refundAmount)
        : Number(dispute.winning_amount) || 0;

    if (amount > 0) {
      await adjustWallet({
        userId: dispute.installer_user_id,
        entryType: 'refund',
        amount,
        leadId: dispute.lead_id,
        disputeId,
        adminId,
        note: `Dispute approved for ${dispute.lead_code}`,
        conn,
      });
    }

    await conn.query(
      `UPDATE marketplace_disputes SET
         status = 'approved',
         refund_amount = ?,
         reviewed_by = ?,
         review_note = ?,
         reviewed_at = NOW()
       WHERE id = ?`,
      [amount, adminId, reviewNote || null, disputeId],
    );

    await conn.query(
      `UPDATE marketplace_leads SET status = 'invalid_refunded' WHERE id = ?`,
      [dispute.lead_id],
    );

    await conn.commit();
    return { status: 'approved', refundAmount: amount };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
