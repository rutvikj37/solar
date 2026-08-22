import db from '../../db.js';
import { SQL_DEMO_LEAD_BIND, SQL_MATCH_DEMO_LEADS } from './demoLead.js';

/**
 * Demo seeding is disabled — marketplace uses real homeowner inquiries only.
 */
export async function seedMarketplaceDemos() {
  return {
    skipped: true,
    message: 'Demo seeding is disabled. Submit leads via the homeowner form.',
  };
}

/**
 * Auto-seed on installer visit — disabled.
 */
export async function ensureOpenMarketplaceDemos() {
  return { skipped: true, reason: 'disabled' };
}

/**
 * Remove all marketplace demo/seed records from the database.
 */
export async function clearMarketplaceDemos() {
  const conn = await db.getConnection();
  const summary = {
    deletedLeads: 0,
    deletedBids: 0,
    deletedDisputes: 0,
    deletedCrmLeads: 0,
    deletedLedgerRows: 0,
  };

  try {
    await conn.beginTransaction();

    const [demoLeads] = await conn.query(
      `SELECT id, crm_lead_id FROM marketplace_leads WHERE ${SQL_MATCH_DEMO_LEADS}`,
      SQL_DEMO_LEAD_BIND,
    );

    const leadIds = demoLeads.map((row) => row.id);
    const crmIds = demoLeads.map((row) => row.crm_lead_id).filter((id) => id != null);

    if (leadIds.length) {
      const [bidResult] = await conn.query(
        `DELETE FROM marketplace_bids WHERE lead_id IN (?)`,
        [leadIds],
      );
      summary.deletedBids = bidResult.affectedRows || 0;

      const [disputeResult] = await conn.query(
        `DELETE FROM marketplace_disputes WHERE lead_id IN (?)`,
        [leadIds],
      );
      summary.deletedDisputes = disputeResult.affectedRows || 0;

      const [ledgerResult] = await conn.query(
        `DELETE FROM marketplace_wallet_ledger WHERE lead_id IN (?)`,
        [leadIds],
      );
      summary.deletedLedgerRows = ledgerResult.affectedRows || 0;

      const [leadResult] = await conn.query(
        `DELETE FROM marketplace_leads WHERE id IN (?)`,
        [leadIds],
      );
      summary.deletedLeads = leadResult.affectedRows || 0;
    }

    if (crmIds.length) {
      const [crmResult] = await conn.query(`DELETE FROM leads WHERE id IN (?)`, [crmIds]);
      summary.deletedCrmLeads = crmResult.affectedRows || 0;
    }

    await conn.query(
      `DELETE FROM marketplace_wallet_ledger WHERE note LIKE '%Marketplace demo%'`,
    );

    await conn.commit();
    summary.message = `Removed ${summary.deletedLeads} demo marketplace lead(s).`;
    return summary;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

