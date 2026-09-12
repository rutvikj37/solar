import express from 'express';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { authenticateToken, attachUserSession } from '../middleware/auth.js';
import { createInquiry, formatInquiryResponse } from '../services/marketplace/qualifyLead.js';
import { maskOpportunity, unlockOpportunity, computeBidStrength } from '../services/marketplace/mask.js';
import { getWalletBalance, getLedger, ensureWallet } from '../services/marketplace/wallet.js';
import { isInstallerEligible, ensureInstallerProfile } from '../services/marketplace/eligibility.js';
import { closeBiddingForLead } from '../services/marketplace/bidClose.js';
import { fileDispute } from '../services/marketplace/disputes.js';
import {
  MARKETPLACE_WALLET_PACKS,
  createMarketplaceWalletCheckout,
  confirmRazorpayWalletPayment,
  confirmStripeWalletPayment,
  getMarketplaceWalletPaymentInfo,
} from '../services/marketplace/walletTopup.js';
import {
  ACTIVE_PIPELINE,
  BIDDING_OPEN_STATUSES,
  CLOSED_PIPELINE,
  OUTCOME_TRANSITIONS,
  DISPUTE_CLAIM_TYPES,
  MIN_WALLET_BALANCE_TO_BID,
} from '../services/marketplace/constants.js';
import {
  buildReportDataFromLead,
  homeownerReportPdfFilename,
  renderHomeownerReportPdf,
} from '../utils/homeownerReportPdf.js';
import {
  buildHomeownerReportPayload,
} from '../services/marketplace/enrichHomeownerInquiry.js';
import {
  fetchGoogleSatelliteImage,
  buildGoogleSatelliteStaticUrl,
} from '../services/propertyService.js';
import {
  SQL_DEMO_LEAD_BIND,
  SQL_EXCLUDE_DEMO_LEADS,
  isDemoMarketplaceLead,
  sqlExcludeDemoLeadsForAlias,
} from '../services/marketplace/demoLead.js';
import { geocodeAddressCoordinates } from '../services/coordinateService.js';
import {
  ensureLeadBiddingTimes,
  ensureLeadsBiddingTimes,
  getMarketplaceSettings,
  applyResolvedBiddingTimes,
} from '../services/marketplace/bidWindow.js';
import {
  verifyHomeownerEmail,
  sendHomeownerPhoneOtp,
  confirmHomeownerPhoneOtp,
} from '../services/marketplace/contactVerify.js';

const router = express.Router();

const inquiryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many inquiries submitted. Please try again later.' },
});

const contactVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification attempts. Please try again later.' },
});

const phoneOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 4,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many SMS verification requests. Please try again later.' },
});

const reportImageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many report image requests. Please try again later.' },
});

const reportJsonLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many report requests. Please try again later.' },
});

const reportPdfLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many report downloads. Please try again later.' },
});

const auth = [authenticateToken];

function marketplaceRequireVerified() {
  const raw = String(process.env.MARKETPLACE_REQUIRE_VERIFIED || '').trim().toLowerCase();
  if (raw === 'false' || raw === '0') return false;
  if (raw === 'true' || raw === '1') return true;
  // Production default: only verified installers see/bid on opportunities.
  return process.env.NODE_ENV === 'production';
}

function requireInstaller(req, res, next) {
  const role = req.user?.role;
  if (role === 'solar_company' || role === 'installer' || ['admin', 'platform_admin', 'super_admin'].includes(role)) {
    return next();
  }
  return res.status(403).json({ error: 'Installer access required' });
}

/** Public: Verifalia email deliverability check */
router.post('/verify-email', contactVerifyLimiter, async (req, res) => {
  try {
    const result = await verifyHomeownerEmail(req.body?.email);
    if (!result.ok) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error('[Marketplace] verify-email failed:', err);
    return res.status(500).json({ ok: false, error: 'Email verification failed. Please try again.' });
  }
});

/** Public: Twilio SMS OTP send (after Lookup) */
router.post('/verify-phone/send', phoneOtpLimiter, async (req, res) => {
  try {
    const result = await sendHomeownerPhoneOtp(req.body?.phone);
    if (!result.ok) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error('[Marketplace] verify-phone/send failed:', err);
    return res.status(500).json({ ok: false, error: 'Could not send verification SMS. Please try again.' });
  }
});

/** Public: confirm Twilio SMS OTP */
router.post('/verify-phone/confirm', contactVerifyLimiter, async (req, res) => {
  try {
    const result = confirmHomeownerPhoneOtp(req.body?.phone, req.body?.code);
    if (!result.ok) {
      return res.status(400).json(result);
    }
    return res.json(result);
  } catch (err) {
    console.error('[Marketplace] verify-phone/confirm failed:', err);
    return res.status(500).json({ ok: false, error: 'Could not confirm verification code.' });
  }
});

/** Public homeowner inquiry */
router.post('/inquiries', inquiryLimiter, async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      address,
      zip,
      monthlyBill,
      homeownerStatus,
      installationTimeline,
      projectDetails,
      propertyLat,
      propertyLng,
    } = req.body || {};

    if (!name?.trim() || !phone?.trim() || !email?.trim() || !address?.trim()) {
      return res.status(400).json({ error: 'Name, phone, email, and property address are required' });
    }

    // Phone OTP verification removed — admin verifies contact before marketplace listing.
    const lead = await createInquiry({
      name,
      phone,
      email,
      address,
      zip,
      monthlyBill,
      homeownerStatus,
      installationTimeline,
      projectDetails,
      propertyLat,
      propertyLng,
    });

    return res.status(201).json(formatInquiryResponse(lead));
  } catch (err) {
    if (err.code === 'DUPLICATE_INQUIRY') {
      return res.status(409).json({
        error: err.message,
        code: err.code,
        existingLeadCode: err.existingLeadCode,
        existingStatus: err.existingStatus,
      });
    }
    console.error('[Marketplace] inquiry failed:', err);
    return res.status(500).json({ error: 'Failed to submit inquiry' });
  }
});

/** Public homeowner report JSON by lead code */
router.get('/report/:leadCode', reportJsonLimiter, async (req, res) => {
  try {
    const leadCode = String(req.params.leadCode || '').trim();
    if (!leadCode) {
      return res.status(400).json({ error: 'Report ID required' });
    }

    const [rows] = await db.query(
      `SELECT * FROM marketplace_leads WHERE lead_code = ? LIMIT 1`,
      [leadCode],
    );
    const lead = rows[0];
    if (!lead) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const formatted = formatInquiryResponse(lead);
    const report = {
      ...buildHomeownerReportPayload(lead),
      ...formatted,
      qualificationMessage: formatted.message,
    };

    return res.json(report);
  } catch (err) {
    console.error('[Marketplace] report fetch failed:', err);
    return res.status(500).json({ error: 'Failed to load report' });
  }
});

/** Public satellite rooftop image for homeowner report */
router.get('/report-image/:leadCode', reportImageLimiter, async (req, res) => {
  try {
    const leadCode = String(req.params.leadCode || '').trim();
    if (!leadCode) {
      return res.status(400).json({ error: 'Report ID required' });
    }

    const [rows] = await db.query(
      `SELECT latitude, longitude, enrichment_json FROM marketplace_leads WHERE lead_code = ? LIMIT 1`,
      [leadCode],
    );
    const lead = rows[0];
    if (!lead) {
      return res.status(404).json({ error: 'Report not found' });
    }

    let lat = Number(lead.latitude);
    let lng = Number(lead.longitude);
    if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && lead.enrichment_json) {
      try {
        const enrichment =
          typeof lead.enrichment_json === 'object'
            ? lead.enrichment_json
            : JSON.parse(lead.enrichment_json);
        lat = Number(enrichment.lat);
        lng = Number(enrichment.lng);
      } catch {
        /* ignore */
      }
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(404).json({ error: 'No coordinates for satellite imagery' });
    }

    const imageOpts = { zoom: '20', size: '800x400', scale: '2', marker: true };
    const fallbackUrl = buildGoogleSatelliteStaticUrl(lat, lng, imageOpts);
    const image = await fetchGoogleSatelliteImage(lat, lng, imageOpts);

    if (image.error) {
      if (fallbackUrl) {
        return res.redirect(fallbackUrl);
      }
      return res.status(503).json({ error: 'Satellite imagery temporarily unavailable' });
    }

    res.setHeader('Content-Type', image.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
    return res.send(image.buffer);
  } catch (err) {
    console.error('[Marketplace] report image failed:', err);
    return res.status(500).json({ error: 'Failed to load satellite image' });
  }
});

/** Public homeowner report PDF download by lead code */
router.get('/report-pdf/:leadCode', reportPdfLimiter, async (req, res) => {
  try {
    const leadCode = String(req.params.leadCode || '').trim();
    if (!leadCode) {
      return res.status(400).json({ error: 'Report ID required' });
    }

    const [rows] = await db.query(
      `SELECT * FROM marketplace_leads WHERE lead_code = ? LIMIT 1`,
      [leadCode],
    );
    const lead = rows[0];
    if (!lead) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const formatted = formatInquiryResponse(lead);
    const reportData = buildReportDataFromLead(lead, formatted);
    const buffer = await renderHomeownerReportPdf(reportData);
    const filename = homeownerReportPdfFilename(lead.lead_code, lead.address);
    const download = req.query.download === '1' || req.query.download === 'true';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader(
      'Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
    );
    res.setHeader('X-PDF-Filename', filename);
    res.setHeader('Access-Control-Expose-Headers', 'X-PDF-Filename, Content-Disposition');
    return res.send(buffer);
  } catch (err) {
    console.error('[Marketplace] report PDF failed:', err);
    return res.status(500).json({ error: 'Failed to generate report PDF' });
  }
});

/** Available masked opportunities for installer */
router.get('/opportunities', ...auth, requireInstaller, async (req, res) => {
  try {
    const userId = req.user.id;
    await ensureInstallerProfile(userId, req.user.name);

    const [leads] = await db.query(
      `SELECT * FROM marketplace_leads
       WHERE status IN ('bidding', 'no_bid_expanding')
       ${SQL_EXCLUDE_DEMO_LEADS}
       ORDER BY created_at DESC
       LIMIT 200`,
      SQL_DEMO_LEAD_BIND,
    );

    await ensureLeadsBiddingTimes(leads);
    const settings = await getMarketplaceSettings();
    const requireVerified = marketplaceRequireVerified();

    const [profiles] = await db.query(
      `SELECT verification_status FROM installer_profiles WHERE user_id = ?`,
      [userId],
    );
    const verificationStatus = profiles[0]?.verification_status || 'pending';
    const accountBlocked =
      verificationStatus === 'rejected' || verificationStatus === 'suspended';
    const [areaRows] = await db.query(
      `SELECT COUNT(*) AS c FROM installer_service_areas WHERE user_id = ?`,
      [userId],
    );
    const serviceAreaCount = Number(areaRows[0]?.c || 0);

    if (serviceAreaCount === 0) {
      await ensureWallet(userId);
      const walletBalance = await getWalletBalance(userId);
      return res.json({
        opportunities: [],
        walletBalance,
        minBalanceToBid: MIN_WALLET_BALANCE_TO_BID,
        canBid: walletBalance >= MIN_WALLET_BALANCE_TO_BID,
        filter: {
          openLeadCount: leads.length,
          visibleCount: 0,
          requireVerified,
          verificationStatus,
          serviceAreaCount: 0,
          hiddenByNoServiceArea: leads.length,
          hiddenByVerification: 0,
          hiddenByCoverage: 0,
          hiddenByAccountStatus: accountBlocked ? leads.length : 0,
        },
      });
    }

    const eligible = [];
    let hiddenByVerification = 0;
    let hiddenByCoverage = 0;
    let hiddenByAccountStatus = 0;
    for (const lead of leads) {
      if (await isInstallerEligible(userId, lead, { requireVerified })) {
        eligible.push(lead);
        continue;
      }
      if (accountBlocked) {
        hiddenByAccountStatus += 1;
      } else if (requireVerified && verificationStatus !== 'verified') {
        hiddenByVerification += 1;
      } else if (serviceAreaCount > 0) {
        hiddenByCoverage += 1;
      } else {
        // Fallback: treat unknown blocks as account/verification related when status isn't verified
        if (verificationStatus !== 'verified') hiddenByVerification += 1;
        else hiddenByCoverage += 1;
      }
    }

    const leadIds = eligible.map((l) => l.id);
    let bidsByLead = {};
    let amountsByLead = {};
    if (leadIds.length) {
      const [bids] = await db.query(
        `SELECT * FROM marketplace_bids WHERE lead_id IN (?) AND status IN ('active','outbid','won','lost')`,
        [leadIds],
      );
      for (const b of bids) {
        if (!amountsByLead[b.lead_id]) amountsByLead[b.lead_id] = [];
        if (b.status === 'active') amountsByLead[b.lead_id].push(Number(b.amount));
        if (Number(b.installer_user_id) === Number(userId)) {
          bidsByLead[b.lead_id] = b;
        }
      }
    }

    const items = eligible.map((lead) =>
      maskOpportunity(lead, {
        ownBid: bidsByLead[lead.id] || null,
        allActiveAmounts: amountsByLead[lead.id] || [],
        settings,
      }),
    );

    await ensureWallet(userId);
    const walletBalance = await getWalletBalance(userId);

    return res.json({
      opportunities: items,
      walletBalance,
      minBalanceToBid: MIN_WALLET_BALANCE_TO_BID,
      canBid: walletBalance >= MIN_WALLET_BALANCE_TO_BID,
      filter: {
        openLeadCount: leads.length,
        visibleCount: items.length,
        requireVerified,
        verificationStatus,
        serviceAreaCount,
        hiddenByVerification,
        hiddenByCoverage,
        hiddenByAccountStatus,
      },
    });
  } catch (err) {
    console.error('[Marketplace] opportunities failed:', err);
    return res.status(500).json({ error: 'Failed to load opportunities' });
  }
});

router.get('/opportunities/:id', ...auth, requireInstaller, async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await db.query(`SELECT * FROM marketplace_leads WHERE id = ?`, [req.params.id]);
    const lead = rows[0];
    if (!lead) return res.status(404).json({ error: 'Opportunity not found' });
    if (isDemoMarketplaceLead(lead)) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    const settings = await getMarketplaceSettings();
    if (BIDDING_OPEN_STATUSES.has(lead.status)) {
      await ensureLeadBiddingTimes(lead, settings);
    } else {
      applyResolvedBiddingTimes(lead, settings);
    }

    if (BIDDING_OPEN_STATUSES.has(lead.status)) {
      if (!(await isInstallerEligible(userId, lead, { requireVerified: marketplaceRequireVerified() }))) {
        return res.status(403).json({ error: 'Not eligible for this opportunity' });
      }
      const [bids] = await db.query(
        `SELECT * FROM marketplace_bids WHERE lead_id = ? AND status = 'active'`,
        [lead.id],
      );
      const own = bids.find((b) => Number(b.installer_user_id) === Number(userId));
      return res.json({
        opportunity: maskOpportunity(lead, {
          ownBid: own || null,
          allActiveAmounts: bids.map((b) => Number(b.amount)),
          settings,
        }),
      });
    }

    // Winner may see unlocked detail
    if (Number(lead.winner_user_id) === Number(userId)) {
      return res.json({ opportunity: unlockOpportunity(lead, settings) });
    }

    return res.status(403).json({ error: 'Opportunity not available' });
  } catch (err) {
    console.error('[Marketplace] opportunity detail failed:', err);
    return res.status(500).json({ error: 'Failed to load opportunity' });
  }
});

/** Place or update bid */
router.post('/opportunities/:id/bids', ...auth, requireInstaller, async (req, res) => {
  const conn = await db.getConnection();
  try {
    const userId = req.user.id;
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Valid bid amount required' });
    }

    const [preview] = await db.query(`SELECT * FROM marketplace_leads WHERE id = ?`, [
      req.params.id,
    ]);
    const leadPreview = preview[0];
    if (!leadPreview || isDemoMarketplaceLead(leadPreview)) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }
    if (!BIDDING_OPEN_STATUSES.has(leadPreview.status)) {
      return res.status(400).json({ error: 'Bidding is not open for this lead' });
    }
    if (!(await isInstallerEligible(userId, leadPreview, { requireVerified: marketplaceRequireVerified() }))) {
      return res.status(403).json({ error: 'Not eligible for this opportunity' });
    }
    if (amount < Number(leadPreview.min_bid)) {
      return res.status(400).json({ error: `Minimum bid is ${leadPreview.min_bid}` });
    }
    const balancePreview = await getWalletBalance(userId);
    if (balancePreview < MIN_WALLET_BALANCE_TO_BID) {
      return res.status(400).json({
        error: `Minimum $${MIN_WALLET_BALANCE_TO_BID} bid wallet balance required to place bids`,
        code: 'min_wallet_balance',
        minBalanceToBid: MIN_WALLET_BALANCE_TO_BID,
      });
    }

    await conn.beginTransaction();
    await ensureWallet(userId, conn);
    const [walletRows] = await conn.query(
      `SELECT balance FROM marketplace_wallets WHERE user_id = ? FOR UPDATE`,
      [userId],
    );
    const balance = Number(walletRows[0]?.balance) || 0;
    if (balance < MIN_WALLET_BALANCE_TO_BID) {
      await conn.rollback();
      return res.status(400).json({
        error: `Minimum $${MIN_WALLET_BALANCE_TO_BID} bid wallet balance required to place bids`,
        code: 'min_wallet_balance',
        minBalanceToBid: MIN_WALLET_BALANCE_TO_BID,
      });
    }

    const [rows] = await conn.query(
      `SELECT * FROM marketplace_leads WHERE id = ? FOR UPDATE`,
      [req.params.id],
    );
    const lead = rows[0];
    if (!lead || !BIDDING_OPEN_STATUSES.has(lead.status)) {
      await conn.rollback();
      return res.status(400).json({ error: 'Bidding is not open for this lead' });
    }
    if (lead.bidding_closes_at && new Date(lead.bidding_closes_at) <= new Date()) {
      await conn.rollback();
      closeBiddingForLead(lead.id).catch(() => {});
      return res.status(400).json({ error: 'Bidding window has closed' });
    }
    if (amount < Number(lead.min_bid)) {
      await conn.rollback();
      return res.status(400).json({ error: `Minimum bid is ${lead.min_bid}` });
    }

    // Interim hold: outstanding active bids + this bid must fit in wallet balance.
    const [outstandingRows] = await conn.query(
      `SELECT COALESCE(SUM(amount), 0) AS outstanding
       FROM marketplace_bids
       WHERE installer_user_id = ?
         AND status = 'active'
         AND lead_id != ?`,
      [userId, lead.id],
    );
    const outstanding = Number(outstandingRows[0]?.outstanding) || 0;
    if (outstanding + amount > balance) {
      await conn.rollback();
      return res.status(400).json({
        error: 'Insufficient marketplace wallet balance for outstanding bids',
        code: 'bid_coverage',
        balance,
        outstandingBids: outstanding,
        required: outstanding + amount,
      });
    }

    const [existing] = await conn.query(
      `SELECT * FROM marketplace_bids WHERE lead_id = ? AND installer_user_id = ? FOR UPDATE`,
      [lead.id, userId],
    );

    let bidId;
    if (existing[0]) {
      await conn.query(
        `UPDATE marketplace_bids SET amount = ?, status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [amount, existing[0].id],
      );
      bidId = existing[0].id;
    } else {
      const [ins] = await conn.query(
        `INSERT INTO marketplace_bids (lead_id, installer_user_id, amount, status)
         VALUES (?, ?, ?, 'active')`,
        [lead.id, userId, amount],
      );
      bidId = ins.insertId;
    }

    await conn.query(
      `UPDATE marketplace_bids SET status = 'outbid'
       WHERE lead_id = ? AND installer_user_id != ? AND status = 'active' AND amount < ?`,
      [lead.id, userId, amount],
    );
    await conn.query(
      `UPDATE marketplace_bids SET status = 'active'
       WHERE lead_id = ? AND installer_user_id != ? AND status = 'outbid' AND amount >= ?`,
      [lead.id, userId, amount],
    );

    const [activeBids] = await conn.query(
      `SELECT amount FROM marketplace_bids WHERE lead_id = ? AND status = 'active'`,
      [lead.id],
    );
    await conn.commit();

    const strength = computeBidStrength(
      amount,
      activeBids.map((b) => Number(b.amount)),
    );

    return res.json({
      ok: true,
      bid: { id: bidId, amount, status: 'active', strength },
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    console.error('[Marketplace] bid failed:', err);
    return res.status(500).json({ error: 'Failed to place bid' });
  } finally {
    conn.release();
  }
});

router.get('/my-bids', ...auth, requireInstaller, async (req, res) => {
  try {
    const userId = req.user.id;
    const [bids] = await db.query(
      `SELECT b.*, l.lead_code, l.status AS lead_status, l.zip, l.city, l.state,
              l.opportunity_score, l.bidding_opens_at, l.bidding_closes_at, l.min_bid, l.bill_range,
              l.property_type, l.installation_timeline, l.created_at AS lead_created_at
       FROM marketplace_bids b
       JOIN marketplace_leads l ON l.id = b.lead_id
       WHERE b.installer_user_id = ?
       ${sqlExcludeDemoLeadsForAlias('l')}
       ORDER BY b.updated_at DESC
       LIMIT 200`,
      [userId, ...SQL_DEMO_LEAD_BIND],
    );

    const settings = await getMarketplaceSettings();
    const leadCache = new Map();
    for (const b of bids) {
      if (!leadCache.has(b.lead_id)) {
        const stub = {
          id: b.lead_id,
          status: b.lead_status,
          bidding_opens_at: b.bidding_opens_at,
          bidding_closes_at: b.bidding_closes_at,
          created_at: b.lead_created_at,
        };
        if (BIDDING_OPEN_STATUSES.has(stub.status)) {
          await ensureLeadBiddingTimes(stub, settings);
          b.bidding_opens_at = stub.bidding_opens_at;
          b.bidding_closes_at = stub.bidding_closes_at;
        } else {
          applyResolvedBiddingTimes(stub, settings);
        }
        leadCache.set(b.lead_id, stub);
      } else {
        const cached = leadCache.get(b.lead_id);
        b.bidding_opens_at = cached.bidding_opens_at;
        b.bidding_closes_at = cached.bidding_closes_at;
      }
    }

    const leadIds = [...new Set(bids.map((b) => b.lead_id))];
    let amountsByLead = {};
    if (leadIds.length) {
      const [active] = await db.query(
        `SELECT lead_id, amount FROM marketplace_bids WHERE lead_id IN (?) AND status = 'active'`,
        [leadIds],
      );
      for (const a of active) {
        if (!amountsByLead[a.lead_id]) amountsByLead[a.lead_id] = [];
        amountsByLead[a.lead_id].push(Number(a.amount));
      }
    }

    const items = bids.map((b) => ({
      id: b.id,
      leadId: b.lead_id,
      leadCode: b.lead_code,
      amount: Number(b.amount),
      status: b.status,
      strength: computeBidStrength(b.amount, amountsByLead[b.lead_id] || []),
      leadStatus: b.lead_status,
      zip: b.zip,
      locationLabel: [b.city, b.state, b.zip].filter(Boolean).join(', '),
      opportunityScore: b.opportunity_score,
      biddingOpensAt: b.bidding_opens_at,
      biddingClosesAt: b.bidding_closes_at,
      minBid: Number(b.min_bid),
      billRange: b.bill_range,
      propertyType: b.property_type,
      installationTimeline: b.installation_timeline,
      createdAt: b.created_at,
      updatedAt: b.updated_at,
    }));

    return res.json({ bids: items });
  } catch (err) {
    console.error('[Marketplace] my-bids failed:', err);
    return res.status(500).json({ error: 'Failed to load bids' });
  }
});

function wonQuery(userId, statusFilterSql, params) {
  return db.query(
    `SELECT * FROM marketplace_leads
     WHERE winner_user_id = ? ${statusFilterSql}
     ${SQL_EXCLUDE_DEMO_LEADS}
     ORDER BY unlocked_at DESC, id DESC
     LIMIT 200`,
    [userId, ...params, ...SQL_DEMO_LEAD_BIND],
  );
}

router.get('/won', ...auth, requireInstaller, async (req, res) => {
  try {
    const settings = await getMarketplaceSettings();
    const [rows] = await wonQuery(
      req.user.id,
      `AND status IN ('lead_unlocked','winner_selected')`,
      [],
    );
    return res.json({ leads: rows.map((r) => unlockOpportunity(r, settings)) });
  } catch (err) {
    console.error('[Marketplace] won failed:', err);
    return res.status(500).json({ error: 'Failed to load won leads' });
  }
});

router.get('/active', ...auth, requireInstaller, async (req, res) => {
  try {
    const settings = await getMarketplaceSettings();
    const statuses = [...ACTIVE_PIPELINE].filter((s) => s !== 'lead_unlocked');
    const [rows] = await wonQuery(
      req.user.id,
      `AND status IN (${statuses.map(() => '?').join(',')})`,
      statuses,
    );
    return res.json({ leads: rows.map((r) => unlockOpportunity(r, settings)) });
  } catch (err) {
    console.error('[Marketplace] active failed:', err);
    return res.status(500).json({ error: 'Failed to load active leads' });
  }
});

router.get('/closed', ...auth, requireInstaller, async (req, res) => {
  try {
    const settings = await getMarketplaceSettings();
    const statuses = [...CLOSED_PIPELINE];
    const [rows] = await wonQuery(
      req.user.id,
      `AND status IN (${statuses.map(() => '?').join(',')})`,
      statuses,
    );
    return res.json({ leads: rows.map((r) => unlockOpportunity(r, settings)) });
  } catch (err) {
    console.error('[Marketplace] closed failed:', err);
    return res.status(500).json({ error: 'Failed to load closed leads' });
  }
});

router.get('/won/:id', ...auth, requireInstaller, async (req, res) => {
  try {
    const settings = await getMarketplaceSettings();
    const [rows] = await db.query(`SELECT * FROM marketplace_leads WHERE id = ?`, [req.params.id]);
    const lead = rows[0];
    if (!lead || Number(lead.winner_user_id) !== Number(req.user.id) || isDemoMarketplaceLead(lead)) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    return res.json({ lead: unlockOpportunity(lead, settings) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load lead' });
  }
});

router.patch('/won/:id/outcome', ...auth, requireInstaller, async (req, res) => {
  try {
    const nextStatus = String(req.body?.status || '').trim();
    const [rows] = await db.query(`SELECT * FROM marketplace_leads WHERE id = ?`, [req.params.id]);
    const lead = rows[0];
    if (!lead || Number(lead.winner_user_id) !== Number(req.user.id) || isDemoMarketplaceLead(lead)) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    const allowed = OUTCOME_TRANSITIONS[lead.status] || [];
    if (!allowed.includes(nextStatus)) {
      return res.status(400).json({
        error: `Cannot transition from ${lead.status} to ${nextStatus}`,
        allowed,
      });
    }
    await db.query(`UPDATE marketplace_leads SET status = ? WHERE id = ?`, [nextStatus, lead.id]);
    if (lead.crm_lead_id) {
      const crmStatus =
        nextStatus === 'interested'
          ? 'qualified'
          : nextStatus === 'contacted'
            ? 'contacted'
            : nextStatus;
      try {
        await db.query(`UPDATE leads SET status = ? WHERE id = ? AND user_id = ?`, [
          crmStatus,
          lead.crm_lead_id,
          req.user.id,
        ]);
      } catch {
        /* ignore CRM sync errors */
      }
    }
    const [updated] = await db.query(`SELECT * FROM marketplace_leads WHERE id = ?`, [lead.id]);
    const settings = await getMarketplaceSettings();
    return res.json({ lead: unlockOpportunity(updated[0], settings) });
  } catch (err) {
    console.error('[Marketplace] outcome failed:', err);
    return res.status(500).json({ error: 'Failed to update outcome' });
  }
});

router.post('/won/:id/disputes', ...auth, requireInstaller, async (req, res) => {
  try {
    const { claimType, details } = req.body || {};
    if (!DISPUTE_CLAIM_TYPES.includes(claimType)) {
      return res.status(400).json({ error: 'Invalid claim type', allowed: DISPUTE_CLAIM_TYPES });
    }
    const id = await fileDispute({
      leadId: Number(req.params.id),
      installerUserId: req.user.id,
      claimType,
      details,
    });
    return res.status(201).json({ ok: true, disputeId: id });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'Failed to file dispute' });
  }
});

router.get('/wallet', ...auth, requireInstaller, async (req, res) => {
  try {
    await ensureWallet(req.user.id);
    const walletBalance = await getWalletBalance(req.user.id);
    const ledger = await getLedger(req.user.id, { limit: 50 });
    return res.json({
      walletBalance,
      balance: walletBalance,
      ledger,
      packs: MARKETPLACE_WALLET_PACKS,
      minBalanceToBid: MIN_WALLET_BALANCE_TO_BID,
      canBid: walletBalance >= MIN_WALLET_BALANCE_TO_BID,
      ...getMarketplaceWalletPaymentInfo(),
    });
  } catch (err) {
    console.error('[Marketplace] wallet failed:', err);
    return res.status(500).json({ error: 'Failed to load wallet' });
  }
});

router.post('/wallet/checkout', ...auth, requireInstaller, async (req, res) => {
  try {
    const result = await createMarketplaceWalletCheckout({
      userId: req.user.id,
      userEmail: req.user.email,
      userName: req.user.name,
      packId: req.body?.packId,
      amount: req.body?.amount,
    });
    return res.json(result);
  } catch (err) {
    const message = err?.message || err?.error?.description || 'Checkout failed';
    const providerFailure =
      err?.authFailed ||
      err?.code === 'payment_provider_auth' ||
      err?.code === 'payment_provider' ||
      err?.provider === 'razorpay' ||
      /razorpay/i.test(message);
    let httpStatus = Number(err?.status || err?.statusCode);
    if (providerFailure) {
      httpStatus = err?.authFailed || err?.code === 'payment_provider_auth' ? 502 : httpStatus;
      if (!httpStatus || httpStatus === 401) httpStatus = 502;
    } else if (!httpStatus || httpStatus < 400 || httpStatus > 599) {
      httpStatus = err?.error ? 400 : 500;
    }
    console.error('[Marketplace] wallet checkout failed:', err?.error || message);
    return res.status(httpStatus).json({
      error: message,
      code: err?.code || (providerFailure ? 'payment_provider' : undefined),
    });
  }
});

router.post('/wallet/confirm-razorpay', ...auth, requireInstaller, async (req, res) => {
  try {
    const result = await confirmRazorpayWalletPayment({
      userId: req.user.id,
      razorpayOrderId: req.body?.razorpay_order_id,
      razorpayPaymentId: req.body?.razorpay_payment_id,
      razorpaySignature: req.body?.razorpay_signature,
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[Marketplace] razorpay confirm failed:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Failed to confirm payment' });
  }
});

router.post('/wallet/confirm-stripe', ...auth, requireInstaller, async (req, res) => {
  try {
    const sessionId = req.body?.sessionId;
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
    const result = await confirmStripeWalletPayment({ userId: req.user.id, sessionId });
    return res.json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message || 'Failed to confirm payment' });
  }
});

router.get('/service-areas', ...auth, requireInstaller, async (req, res) => {
  try {
    await ensureInstallerProfile(req.user.id);
    const [areas] = await db.query(
      `SELECT id, zip, state, radius_miles, center_lat, center_lng, created_at
       FROM installer_service_areas WHERE user_id = ? ORDER BY id DESC`,
      [req.user.id],
    );
    const [profile] = await db.query(
      `SELECT verification_status, company_name FROM installer_profiles WHERE user_id = ?`,
      [req.user.id],
    );
    return res.json({
      profile: profile[0] || null,
      areas,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load service areas' });
  }
});

router.post('/service-areas', ...auth, requireInstaller, async (req, res) => {
  try {
    await ensureInstallerProfile(req.user.id, req.body?.companyName || req.user.name);
    const { zip, state, radiusMiles } = req.body || {};
    if (!zip && !state) {
      return res.status(400).json({ error: 'ZIP or state required' });
    }

    let centerLat = null;
    let centerLng = null;
    const geoQuery = [zip, state].filter(Boolean).join(', ');
    if (geoQuery) {
      try {
        const geocoded = await geocodeAddressCoordinates(geoQuery);
        if (geocoded) {
          centerLat = geocoded.lat;
          centerLng = geocoded.lng;
        }
      } catch {
        /* optional geocode */
      }
    }

    const [result] = await db.query(
      `INSERT INTO installer_service_areas (user_id, zip, state, radius_miles, center_lat, center_lng)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        zip ? String(zip).trim().slice(0, 20) : null,
        state ? String(state).trim().slice(0, 64) : null,
        radiusMiles != null ? Number(radiusMiles) : null,
        centerLat,
        centerLng,
      ],
    );
    return res.status(201).json({ ok: true, id: result.insertId, centerLat, centerLng });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to add service area' });
  }
});

router.delete('/service-areas/:id', ...auth, requireInstaller, async (req, res) => {
  try {
    await db.query(`DELETE FROM installer_service_areas WHERE id = ? AND user_id = ?`, [
      req.params.id,
      req.user.id,
    ]);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete service area' });
  }
});

export default router;
