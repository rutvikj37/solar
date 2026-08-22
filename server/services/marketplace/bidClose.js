import db from '../../db.js';
import { adjustWallet } from './wallet.js';
import { BIDDING_OPEN_STATUSES } from './constants.js';
import { computeBiddingWindow, ensureLeadsBiddingTimes } from './bidWindow.js';
import { notifyInstallerWonBid } from './notifications.js';

const MAX_WINNER_RETRIES = 5;

async function getSettings(conn = db) {
  const [rows] = await conn.query(`SELECT * FROM marketplace_settings WHERE id = 1`);
  return rows[0] || {};
}

function parseExpansionRadii(json) {
  if (Array.isArray(json)) return json.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (typeof json === 'string') {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed)) return parsed.map(Number).filter((n) => Number.isFinite(n) && n > 0);
    } catch {
      /* ignore */
    }
  }
  return [25, 50, 100];
}

function resolveExpansionRadius(settings, stage) {
  const radii = parseExpansionRadii(settings.expansion_radius_miles_json);
  const idx = Math.max(0, stage - 1);
  return radii[idx] ?? radii[radii.length - 1] ?? 25;
}

function computeReducedMinBid(currentMinBid, settings, stage) {
  const base = Number(currentMinBid) || Number(settings.default_min_bid) || 25;
  const lowFloor = Number(settings.low_price_min_bid) || 10;
  const reductionPct = Number(settings.min_bid_reduction_pct) || 20;
  if (stage < 2) return Math.max(lowFloor, base);
  const reduced = base * Math.pow(1 - reductionPct / 100, stage - 1);
  return Math.max(lowFloor, Math.round(reduced * 100) / 100);
}

/**
 * Close a single lead's bidding window: pick winner or expand / lower price.
 */
export async function closeBiddingForLead(leadId, { retryDepth = 0 } = {}) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [leads] = await conn.query(
      `SELECT * FROM marketplace_leads WHERE id = ? FOR UPDATE`,
      [leadId],
    );
    const lead = leads[0];
    if (!lead || !BIDDING_OPEN_STATUSES.has(lead.status)) {
      await conn.rollback();
      return { action: 'skipped' };
    }

    const [bids] = await conn.query(
      `SELECT * FROM marketplace_bids
       WHERE lead_id = ? AND status = 'active'
       ORDER BY amount DESC, created_at ASC
       FOR UPDATE`,
      [leadId],
    );

    if (bids.length === 0) {
      const settings = await getSettings(conn);
      const result = await reopenNoBidLead(conn, lead, settings);
      await conn.commit();
      return result;
    }

    const winner = bids[0];
    const amount = Number(winner.amount);

    try {
      await adjustWallet({
        userId: winner.installer_user_id,
        entryType: 'win_debit',
        amount: -amount,
        leadId,
        note: `Won marketplace lead ${lead.lead_code}`,
        conn,
      });
    } catch (err) {
      if (err.code === 'INSUFFICIENT_FUNDS') {
        await conn.query(
          `UPDATE marketplace_bids SET status = 'lost' WHERE id = ?`,
          [winner.id],
        );
        await conn.commit();
        if (retryDepth >= MAX_WINNER_RETRIES) {
          return {
            action: 'needs_admin_review',
            leadId,
            error: 'Max winner retries exceeded — top bidders had insufficient wallet balance',
          };
        }
        return closeBiddingForLead(leadId, { retryDepth: retryDepth + 1 });
      }
      throw err;
    }

    await conn.query(
      `UPDATE marketplace_bids SET status = 'won' WHERE id = ?`,
      [winner.id],
    );
    await conn.query(
      `UPDATE marketplace_bids SET status = 'lost'
       WHERE lead_id = ? AND id != ? AND status = 'active'`,
      [leadId, winner.id],
    );

    let crmLeadId = null;
    let crmError = null;
    try {
      crmLeadId = await createCrmLeadForWinner(conn, lead, winner.installer_user_id);
    } catch (err) {
      crmError = err.message;
      console.error('[Marketplace] CRM lead copy failed:', err.message);
      await conn.query(
        `UPDATE marketplace_leads SET enrichment_json = JSON_SET(
           COALESCE(enrichment_json, '{}'),
           '$.crmCopyFailed', true,
           '$.crmCopyError', ?
         ) WHERE id = ?`,
        [err.message, leadId],
      );
    }

    await conn.query(
      `UPDATE marketplace_leads SET
         status = 'lead_unlocked',
         winning_bid_id = ?,
         winner_user_id = ?,
         winning_amount = ?,
         unlocked_at = NOW(),
         crm_lead_id = ?,
         expansion_stage = 0,
         expansion_radius_miles = 25
       WHERE id = ?`,
      [winner.id, winner.installer_user_id, amount, crmLeadId, leadId],
    );

    await conn.commit();

    notifyInstallerWonBid({
      installerUserId: winner.installer_user_id,
      lead: { ...lead, lead_code: lead.lead_code, winning_amount: amount },
    }).catch(() => {});

    return {
      action: 'winner',
      leadId,
      winnerUserId: winner.installer_user_id,
      amount,
      crmLeadId,
      crmError,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * No bids when the window closes — expand radius / lower min bid or mark closed_unsold.
 */
async function reopenNoBidLead(conn, lead, settings) {
  const maxStages = Number(settings.max_expansion_stages) || 3;
  const currentStage = Number(lead.expansion_stage) || 0;
  const nextStage = currentStage + 1;

  if (nextStage > maxStages) {
    await conn.query(
      `UPDATE marketplace_leads SET
         status = 'closed_unsold',
         bidding_closes_at = NOW()
       WHERE id = ?`,
      [lead.id],
    );
    return { action: 'closed_unsold', leadId: lead.id, expansionStage: currentStage };
  }

  const radius = resolveExpansionRadius(settings, nextStage);
  const newMinBid = computeReducedMinBid(lead.min_bid, settings, nextStage);
  const { opens, closes, windowHours } = computeBiddingWindow(settings);

  await conn.query(
    `UPDATE marketplace_leads SET
       status = 'no_bid_expanding',
       min_bid = ?,
       expansion_stage = ?,
       expansion_radius_miles = ?,
       bidding_opens_at = ?,
       bidding_closes_at = ?
     WHERE id = ?`,
    [newMinBid, nextStage, radius, opens, closes, lead.id],
  );

  return {
    action: 'expanded',
    leadId: lead.id,
    expansionStage: nextStage,
    expansionRadiusMiles: radius,
    minBid: newMinBid,
    windowHours,
  };
}

async function createCrmLeadForWinner(conn, lead, userId) {
  const [result] = await conn.query(
    `INSERT INTO leads
      (user_id, address, owner_name, phone, email, lead_score, status, notes, solar_json, property_json)
     VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)`,
    [
      userId,
      lead.address,
      lead.homeowner_name,
      lead.phone,
      lead.email,
      lead.opportunity_score || 0,
      `Marketplace win ${lead.lead_code}`,
      lead.enrichment_json || null,
      JSON.stringify({
        source: 'marketplace',
        marketplaceLeadId: lead.id,
        leadCode: lead.lead_code,
        propertyType: lead.property_type,
        monthlyBill: lead.monthly_bill,
        homeownerStatus: lead.homeowner_status,
        installationTimeline: lead.installation_timeline,
        projectDetails: lead.project_details,
      }),
    ],
  );
  return result.insertId;
}

export async function processExpiredBiddingWindows() {
  const [missing] = await db.query(
    `SELECT * FROM marketplace_leads
     WHERE status IN ('bidding', 'no_bid_expanding')
       AND bidding_closes_at IS NULL
     LIMIT 50`,
  );
  if (missing.length) {
    await ensureLeadsBiddingTimes(missing);
  }

  const [rows] = await db.query(
    `SELECT id FROM marketplace_leads
     WHERE status IN ('bidding', 'no_bid_expanding')
       AND bidding_closes_at IS NOT NULL
       AND bidding_closes_at <= NOW()
     ORDER BY bidding_closes_at ASC
     LIMIT 50`,
  );
  const results = [];
  for (const row of rows) {
    try {
      results.push(await closeBiddingForLead(row.id));
    } catch (err) {
      console.error(`[Marketplace] closeBidding ${row.id} failed:`, err.message);
      results.push({ action: 'error', leadId: row.id, error: err.message });
    }
  }
  return results;
}

/**
 * Admin/manual: force select a specific bid as winner.
 */
export async function selectWinnerBid(leadId, bidId) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [leads] = await conn.query(
      `SELECT * FROM marketplace_leads WHERE id = ? FOR UPDATE`,
      [leadId],
    );
    const lead = leads[0];
    if (!lead) throw new Error('Lead not found');
    if (lead.winner_user_id) throw new Error('Lead already has a winner');
    const selectable = new Set(['bidding', 'no_bid_expanding', 'marketplace', 'winner_selected']);
    if (!selectable.has(lead.status)) {
      throw new Error('Lead is not open for winner selection');
    }

    const [bids] = await conn.query(
      `SELECT * FROM marketplace_bids WHERE id = ? AND lead_id = ? FOR UPDATE`,
      [bidId, leadId],
    );
    const bid = bids[0];
    if (!bid) throw new Error('Bid not found');

    const amount = Number(bid.amount);
    await adjustWallet({
      userId: bid.installer_user_id,
      entryType: 'win_debit',
      amount: -amount,
      leadId,
      note: `Admin-selected win ${lead.lead_code}`,
      conn,
    });

    await conn.query(`UPDATE marketplace_bids SET status = 'won' WHERE id = ?`, [bid.id]);
    await conn.query(
      `UPDATE marketplace_bids SET status = 'lost'
       WHERE lead_id = ? AND id != ? AND status IN ('active','outbid')`,
      [leadId, bid.id],
    );

    let crmLeadId = null;
    let crmError = null;
    try {
      crmLeadId = await createCrmLeadForWinner(conn, lead, bid.installer_user_id);
    } catch (err) {
      crmError = err.message;
      console.error('[Marketplace] CRM lead copy failed:', err.message);
    }

    await conn.query(
      `UPDATE marketplace_leads SET
         status = 'lead_unlocked',
         winning_bid_id = ?,
         winner_user_id = ?,
         winning_amount = ?,
         unlocked_at = NOW(),
         crm_lead_id = ?,
         expansion_stage = 0,
         expansion_radius_miles = 25
       WHERE id = ?`,
      [bid.id, bid.installer_user_id, amount, crmLeadId, leadId],
    );

    await conn.commit();
    return { leadId, winnerUserId: bid.installer_user_id, amount, crmLeadId, crmError };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export { parseExpansionRadii, resolveExpansionRadius, computeReducedMinBid };
