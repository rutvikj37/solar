import express from 'express';
import db from '../db.js';
import { adminAuth } from '../middleware/auth.js';
import { adjustWallet, getWalletBalance, ensureWallet } from '../services/marketplace/wallet.js';
import { selectWinnerBid, closeBiddingForLead } from '../services/marketplace/bidClose.js';
import { reviewDispute } from '../services/marketplace/disputes.js';
import { unlockOpportunity, maskOpportunity } from '../services/marketplace/mask.js';
import { clearMarketplaceDemos } from '../services/marketplace/seedDemo.js';
import { ensureInstallerProfile } from '../services/marketplace/eligibility.js';
import { qualifyMarketplaceLead, verifyMarketplaceLeadContact, approveMarketplaceLead } from '../services/marketplace/qualifyLead.js';
import {
  ensureLeadBiddingTimes,
  ensureLeadsBiddingTimes,
  getMarketplaceSettings,
} from '../services/marketplace/bidWindow.js';

const router = express.Router();

router.get('/leads', ...adminAuth, async (req, res) => {
  try {
    const status = req.query.status;
    let sql = `SELECT * FROM marketplace_leads`;
    const params = [];
    if (status) {
      sql += ` WHERE status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY created_at DESC LIMIT 300`;
    const [rows] = await db.query(sql, params);
    await ensureLeadsBiddingTimes(rows);
    const settings = await getMarketplaceSettings();
    return res.json({
      leads: rows.map((r) => ({
        ...unlockOpportunity(r, settings),
        // Admin sees full PII
        status: r.status,
        minBid: Number(r.min_bid),
        biddingOpensAt: r.bidding_opens_at,
        biddingClosesAt: r.bidding_closes_at,
        winnerUserId: r.winner_user_id,
        winningAmount: r.winning_amount != null ? Number(r.winning_amount) : null,
        expansionStage: r.expansion_stage,
        maskedPreview: maskOpportunity(r, { settings }),
      })),
    });
  } catch (err) {
    console.error('[MarketplaceAdmin] leads failed:', err);
    return res.status(500).json({ error: 'Failed to load leads' });
  }
});

router.get('/leads/:id', ...adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM marketplace_leads WHERE id = ?`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const settings = await getMarketplaceSettings();
    await ensureLeadBiddingTimes(rows[0], settings);
    const [bids] = await db.query(
      `SELECT b.*, u.name AS installer_name, u.email AS installer_email, u.company_name
       FROM marketplace_bids b
       LEFT JOIN users u ON u.id = b.installer_user_id
       WHERE b.lead_id = ?
       ORDER BY b.amount DESC, b.created_at ASC`,
      [req.params.id],
    );
    return res.json({
      lead: unlockOpportunity(rows[0], settings),
      raw: rows[0],
      bids: bids.map((b) => ({
        id: b.id,
        installerUserId: b.installer_user_id,
        installerName: b.installer_name,
        installerEmail: b.installer_email,
        companyName: b.company_name,
        amount: Number(b.amount),
        status: b.status,
        createdAt: b.created_at,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load lead' });
  }
});

router.post('/leads/:id/close-bidding', ...adminAuth, async (req, res) => {
  try {
    const result = await closeBiddingForLead(Number(req.params.id));
    return res.json({ ok: true, result });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Failed to close bidding' });
  }
});

router.post('/leads/:id/select-winner', ...adminAuth, async (req, res) => {
  try {
    const bidId = Number(req.body?.bidId);
    if (!bidId) return res.status(400).json({ error: 'bidId required' });
    const result = await selectWinnerBid(Number(req.params.id), bidId);
    return res.json({ ok: true, result });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Failed to select winner' });
  }
});

router.patch('/leads/:id/status', ...adminAuth, async (req, res) => {
  try {
    const { status, winnerUserId, winningAmount } = req.body || {};
    if (!status) return res.status(400).json({ error: 'Status is required' });
    await db.query(
      `UPDATE marketplace_leads
       SET status = ?,
           winner_user_id = COALESCE(?, winner_user_id),
           winning_amount = COALESCE(?, winning_amount)
       WHERE id = ?`,
      [status, winnerUserId || null, winningAmount != null ? Number(winningAmount) : null, req.params.id],
    );
    const [rows] = await db.query(`SELECT * FROM marketplace_leads WHERE id = ?`, [req.params.id]);
    const settings = await getMarketplaceSettings();
    return res.json({ ok: true, lead: unlockOpportunity(rows[0], settings) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update status' });
  }
});

router.get('/disputes', ...adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT d.*, l.lead_code, l.homeowner_name, l.address, l.winning_amount,
              u.name AS installer_name, u.email AS installer_email
       FROM marketplace_disputes d
       JOIN marketplace_leads l ON l.id = d.lead_id
       LEFT JOIN users u ON u.id = d.installer_user_id
       ORDER BY FIELD(d.status,'pending','approved','denied'), d.created_at DESC
       LIMIT 200`,
    );
    return res.json({ disputes: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load disputes' });
  }
});

router.post('/disputes/:id/review', ...adminAuth, async (req, res) => {
  try {
    const { decision, reviewNote, refundAmount } = req.body || {};
    const result = await reviewDispute({
      disputeId: Number(req.params.id),
      adminId: req.user.id,
      decision,
      reviewNote,
      refundAmount,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Review failed' });
  }
});

router.get('/installers', ...adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.name, u.email, u.company_name, u.role, u.account_status,
              p.verification_status, p.notes AS profile_notes,
              w.balance AS wallet_balance,
              (SELECT COUNT(*) FROM installer_service_areas a WHERE a.user_id = u.id) AS area_count
       FROM users u
       LEFT JOIN installer_profiles p ON p.user_id = u.id
       LEFT JOIN marketplace_wallets w ON w.user_id = u.id
       WHERE u.role IN ('solar_company','installer','super_admin','admin') OR p.user_id IS NOT NULL
       ORDER BY u.id DESC
       LIMIT 300`,
    );

    const [areas] = await db.query(`SELECT * FROM installer_service_areas ORDER BY id DESC`);
    const areasByUser = {};
    for (const a of areas) {
      if (!areasByUser[a.user_id]) areasByUser[a.user_id] = [];
      areasByUser[a.user_id].push(a);
    }

    const installers = rows.map((r) => ({
      ...r,
      areas: areasByUser[r.id] || [],
    }));

    return res.json({ installers });
  } catch (err) {
    console.error('[MarketplaceAdmin] installers failed:', err);
    return res.status(500).json({ error: 'Failed to load installers' });
  }
});

router.patch('/installers/:userId/verification', ...adminAuth, async (req, res) => {
  try {
    const status = req.body?.verificationStatus;
    if (!['pending', 'verified', 'rejected', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid verification status' });
    }
    await ensureInstallerProfile(Number(req.params.userId));
    await db.query(
      `UPDATE installer_profiles SET verification_status = ?, notes = COALESCE(?, notes) WHERE user_id = ?`,
      [status, req.body?.notes || null, req.params.userId],
    );
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update verification' });
  }
});

router.get('/installers/:userId/service-areas', ...adminAuth, async (req, res) => {
  try {
    const [areas] = await db.query(
      `SELECT * FROM installer_service_areas WHERE user_id = ? ORDER BY id DESC`,
      [req.params.userId],
    );
    return res.json({ areas });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load areas' });
  }
});

router.post('/installers/:userId/service-areas', ...adminAuth, async (req, res) => {
  try {
    await ensureInstallerProfile(Number(req.params.userId));
    const { zip, state, radiusMiles } = req.body || {};
    if (!zip && !state) return res.status(400).json({ error: 'ZIP or state required' });
    const [result] = await db.query(
      `INSERT INTO installer_service_areas (user_id, zip, state, radius_miles) VALUES (?, ?, ?, ?)`,
      [
        req.params.userId,
        zip || null,
        state || null,
        radiusMiles != null ? Number(radiusMiles) : null,
      ],
    );
    return res.status(201).json({ ok: true, id: result.insertId });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to add area' });
  }
});

router.delete('/installers/:userId/service-areas/:areaId', ...adminAuth, async (req, res) => {
  try {
    await db.query(`DELETE FROM installer_service_areas WHERE id = ? AND user_id = ?`, [
      req.params.areaId,
      req.params.userId,
    ]);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete area' });
  }
});

router.get('/wallets', ...adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT w.user_id, w.balance, w.updated_at, u.name, u.email, u.company_name
       FROM marketplace_wallets w
       JOIN users u ON u.id = w.user_id
       ORDER BY w.balance DESC
       LIMIT 300`,
    );
    const [ledger] = await db.query(
      `SELECT l.*, u.name AS user_name, u.email AS user_email
       FROM marketplace_wallet_ledger l
       LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.id DESC
       LIMIT 100`,
    );
    return res.json({ wallets: rows, recentLedger: ledger });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load wallets' });
  }
});

router.post('/wallets/:userId/adjust', ...adminAuth, async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const amount = Number(req.body?.amount);
    const mode = req.body?.mode || 'add';
    if (!Number.isFinite(amount) || amount === 0) {
      return res.status(400).json({ error: 'Valid amount required' });
    }
    await ensureWallet(userId);
    let delta = amount;
    if (mode === 'set') {
      const current = await getWalletBalance(userId);
      delta = amount - current;
    } else if (mode === 'subtract') {
      delta = -Math.abs(amount);
    } else {
      delta = Math.abs(amount);
    }
    if (delta === 0) {
      return res.json({ ok: true, balance: await getWalletBalance(userId) });
    }
    const result = await adjustWallet({
      userId,
      entryType: delta > 0 ? 'top_up' : 'admin_adjust',
      amount: delta,
      adminId: req.user.id,
      note: req.body?.note || `Admin ${mode}`,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Wallet adjust failed' });
  }
});

router.get('/metrics', ...adminAuth, async (req, res) => {
  try {
    const [[counts]] = await db.query(
      `SELECT
         COUNT(*) AS total_leads,
         SUM(status IN ('bidding','no_bid_expanding')) AS active_bidding,
         SUM(winner_user_id IS NOT NULL) AS won_count,
         SUM(status = 'closed_unsold') AS unsold,
         SUM(status = 'invalid_refunded') AS refunded,
         SUM(status = 'won') AS converted_won,
         SUM(status = 'lost') AS converted_lost,
         AVG(opportunity_score) AS avg_score,
         AVG(winning_amount) AS avg_winning_bid
       FROM marketplace_leads`,
    );
    const [[bidStats]] = await db.query(
      `SELECT COUNT(*) AS total_bids, AVG(amount) AS avg_bid FROM marketplace_bids`,
    );
    const [[disputeStats]] = await db.query(
      `SELECT
         SUM(status = 'pending') AS pending_disputes,
         SUM(status = 'approved') AS approved_disputes,
         SUM(status = 'denied') AS denied_disputes
       FROM marketplace_disputes`,
    );
    const [byStatus] = await db.query(
      `SELECT status, COUNT(*) AS cnt FROM marketplace_leads GROUP BY status ORDER BY cnt DESC`,
    );
    return res.json({
      counts,
      bidStats,
      disputeStats,
      byStatus,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load metrics' });
  }
});

router.post('/clear-demo', ...adminAuth, async (req, res) => {
  try {
    const summary = await clearMarketplaceDemos();
    return res.json({ ok: true, summary });
  } catch (err) {
    console.error('[MarketplaceAdmin] clear-demo failed:', err);
    return res.status(500).json({ error: err.message || 'Failed to clear demo data' });
  }
});

router.get('/settings', ...adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM marketplace_settings WHERE id = 1`);
    return res.json({ settings: rows[0] || null });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load settings' });
  }
});

router.post('/leads/:id/verify-contact', ...adminAuth, async (req, res) => {
  try {
    const leadId = Number(req.params.id);
    const result = await verifyMarketplaceLeadContact(leadId);
    const settings = await getMarketplaceSettings();
    return res.json({
      ok: true,
      contactCheck: result.contactCheck,
      lead: unlockOpportunity(result.lead, settings),
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Contact verification failed' });
  }
});

router.post('/leads/:id/approve', ...adminAuth, async (req, res) => {
  try {
    const leadId = Number(req.params.id);
    const [rows] = await db.query(`SELECT id, status FROM marketplace_leads WHERE id = ?`, [leadId]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    if (!['new', 'ai_qualified', 'pending_admin'].includes(rows[0].status)) {
      return res.status(400).json({ error: 'Only pending leads can be approved for marketplace' });
    }
    const result = await approveMarketplaceLead(leadId);
    const settings = await getMarketplaceSettings();
    return res.json({
      ok: true,
      contactCheck: result.contactCheck,
      lead: unlockOpportunity(result.lead, settings),
    });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Approve failed' });
  }
});

router.post('/leads/:id/re-qualify', ...adminAuth, async (req, res) => {
  try {
    const leadId = Number(req.params.id);
    const [rows] = await db.query(`SELECT id, status FROM marketplace_leads WHERE id = ?`, [leadId]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    if (!['new', 'ai_qualified', 'pending_admin'].includes(rows[0].status)) {
      return res.status(400).json({ error: 'Only pending leads can be re-qualified' });
    }
    const lead = await qualifyMarketplaceLead(leadId, { listInMarketplace: true });
    const settings = await getMarketplaceSettings();
    return res.json({ ok: true, lead: unlockOpportunity(lead, settings) });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Re-qualify failed' });
  }
});

router.patch('/settings', ...adminAuth, async (req, res) => {
  try {
    const s = req.body || {};
    await db.query(
      `UPDATE marketplace_settings SET
         default_bid_window_hours = COALESCE(?, default_bid_window_hours),
         default_min_bid = COALESCE(?, default_min_bid),
         max_expansion_stages = COALESCE(?, max_expansion_stages),
         expansion_radius_miles_json = COALESCE(?, expansion_radius_miles_json),
         min_bid_reduction_pct = COALESCE(?, min_bid_reduction_pct),
         low_price_min_bid = COALESCE(?, low_price_min_bid)
       WHERE id = 1`,
      [
        s.defaultBidWindowHours ?? null,
        s.defaultMinBid ?? null,
        s.maxExpansionStages ?? null,
        s.expansionRadiusMilesJson
          ? JSON.stringify(s.expansionRadiusMilesJson)
          : null,
        s.minBidReductionPct ?? null,
        s.lowPriceMinBid ?? null,
      ],
    );
    const [rows] = await db.query(`SELECT * FROM marketplace_settings WHERE id = 1`);
    return res.json({ settings: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
