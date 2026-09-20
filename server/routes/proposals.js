import { BRAND_COMPANY_DEFAULT } from '../config/brand.js';
import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { maskLeadContactForPublic } from '../utils/leadAccess.js';
import { requirePlanFeature } from '../services/planEntitlements.js';

const router = express.Router();

const publicProposalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

const publicSignLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many signature attempts' },
});

const publicEventLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many tracking requests' },
});

const TRACKABLE_EVENTS = new Set([
  'opened',
  'viewed',
  'financing_viewed',
  'equipment_viewed',
  'downloaded',
  'accepted',
]);

function randomSlug() {
  return `prop_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
}

function buildEngagement(proposal, eventCounts = {}) {
  const viewCount = Number(proposal.view_count || 0);
  return {
    status: proposal.status,
    viewCount,
    downloadCount: Number(proposal.download_count || 0),
    sentAt: proposal.sent_at || proposal.created_at || null,
    firstViewedAt: proposal.first_viewed_at || null,
    lastViewedAt: proposal.viewed_at || null,
    financingViewedAt: proposal.financing_viewed_at || null,
    equipmentViewedAt: proposal.equipment_viewed_at || null,
    downloadedAt: proposal.downloaded_at || null,
    signedAt: proposal.signed_at || null,
    events: {
      opened: Number(eventCounts.opened || 0),
      viewed: Number(eventCounts.viewed || viewCount || 0),
      financing_viewed: Number(eventCounts.financing_viewed || 0),
      equipment_viewed: Number(eventCounts.equipment_viewed || 0),
      downloaded: Number(eventCounts.downloaded || proposal.download_count || 0),
      accepted: Number(eventCounts.accepted || (proposal.status === 'signed' ? 1 : 0)),
    },
    summary:
      viewCount > 0
        ? `Viewed ${viewCount} time${viewCount === 1 ? '' : 's'}`
        : proposal.status === 'sent'
          ? 'Sent — waiting for open'
          : proposal.status === 'signed'
            ? 'Accepted / signed'
            : 'Not viewed yet',
  };
}

async function loadEventCounts(proposalId) {
  const [rows] = await db.query(
    `SELECT event_type, COUNT(*) AS cnt
     FROM proposal_events
     WHERE proposal_id = ?
     GROUP BY event_type`,
    [proposalId],
  );
  return Object.fromEntries(rows.map((r) => [r.event_type, Number(r.cnt)]));
}

async function recordProposalEvent(proposal, eventType, { sessionId = null, meta = null } = {}) {
  if (!TRACKABLE_EVENTS.has(eventType)) {
    return { ok: false, error: 'Invalid event type' };
  }

  const sid = sessionId ? String(sessionId).slice(0, 64) : null;

  // Deduplicate once-per-session for section views / opened
  if (sid && ['opened', 'financing_viewed', 'equipment_viewed'].includes(eventType)) {
    const [dup] = await db.query(
      `SELECT id FROM proposal_events
       WHERE proposal_id = ? AND event_type = ? AND session_id = ?
       LIMIT 1`,
      [proposal.id, eventType, sid],
    );
    if (dup.length) {
      const [fresh] = await db.query('SELECT * FROM proposals WHERE id = ? LIMIT 1', [proposal.id]);
      return { ok: true, deduped: true, proposal: fresh[0] };
    }
  }

  await db.query(
    `INSERT INTO proposal_events (proposal_id, lead_id, user_id, event_type, session_id, meta)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      proposal.id,
      proposal.lead_id,
      proposal.user_id,
      eventType,
      sid,
      meta ? JSON.stringify(meta) : null,
    ],
  );

  if (eventType === 'opened' || eventType === 'viewed') {
    await db.query(
      `UPDATE proposals SET
         view_count = view_count + 1,
         viewed_at = NOW(),
         first_viewed_at = COALESCE(first_viewed_at, NOW()),
         status = IF(status = 'sent', 'viewed', status)
       WHERE id = ?`,
      [proposal.id],
    );
    if (eventType === 'opened') {
      await db.query(
        `INSERT INTO lead_activities (lead_id, user_id, type, content)
         VALUES (?, ?, 'proposal_opened', ?)`,
        [
          proposal.lead_id,
          proposal.user_id,
          'Homeowner opened the proposal link.',
        ],
      );
    }
  } else if (eventType === 'financing_viewed') {
    await db.query(
      `UPDATE proposals SET financing_viewed_at = COALESCE(financing_viewed_at, NOW()) WHERE id = ?`,
      [proposal.id],
    );
  } else if (eventType === 'equipment_viewed') {
    await db.query(
      `UPDATE proposals SET equipment_viewed_at = COALESCE(equipment_viewed_at, NOW()) WHERE id = ?`,
      [proposal.id],
    );
  } else if (eventType === 'downloaded') {
    await db.query(
      `UPDATE proposals SET
         download_count = download_count + 1,
         downloaded_at = NOW()
       WHERE id = ?`,
      [proposal.id],
    );
  } else if (eventType === 'accepted') {
    // Sign endpoint owns signed status; this is for analytics alias only
  }

  const [fresh] = await db.query('SELECT * FROM proposals WHERE id = ? LIMIT 1', [proposal.id]);
  return { ok: true, proposal: fresh[0] };
}

// Utility: Calculate ROI parameters server-side
function calculateSolarROI(params) {
  const grossCost = Number(params.grossCost || 25500);
  const batteryCost = Number(params.batteryCost || (params.batteryType === 'tesla_powerwall' ? 11500 * Number(params.batteryCount || 1) : params.batteryType === 'enphase_iq' ? 6500 * Number(params.batteryCount || 1) : 0));
  const totalGross = grossCost + batteryCost;
  
  const itc30 = params.includeItc30 ? totalGross * 0.30 : 0;
  const stateRebate = Number(params.stateRebate || 0);
  const netCost = Math.max(0, totalGross - itc30 - stateRebate);

  const systemSizeKw = Number(params.systemSizeKw || 8.5);
  const annualProdKwh = systemSizeKw * 1400; // Average solar yield kWh/yr
  const baseElecRate = 0.22; // $0.22/kWh
  const escalation = Number(params.utilityEscalation || 4.5) / 100;
  
  let cumulative25yrUtilityWithoutSolar = 0;
  let currentRate = baseElecRate;
  for (let yr = 1; yr <= 25; yr++) {
    cumulative25yrUtilityWithoutSolar += annualProdKwh * currentRate;
    currentRate *= (1 + escalation);
  }

  const est25yrSavings = Math.round(cumulative25yrUtilityWithoutSolar - netCost);
  const year1Savings = annualProdKwh * baseElecRate;
  const paybackYears = Number((netCost / Math.max(1, year1Savings)).toFixed(1));

  let monthlyPayment = 0;
  if (params.financingType === 'loan') {
    const ratePerMonth = (Number(params.loanInterestRate || 5.99) / 100) / 12;
    const numMonths = Number(params.loanTermYears || 20) * 12;
    const principal = Math.max(0, netCost - Number(params.downPayment || 0));
    if (ratePerMonth > 0 && numMonths > 0) {
      monthlyPayment = Math.round((principal * ratePerMonth * Math.pow(1 + ratePerMonth, numMonths)) / (Math.pow(1 + ratePerMonth, numMonths) - 1));
    }
  } else if (params.financingType === 'lease') {
    monthlyPayment = Math.round(netCost / (20 * 12) * 0.85);
  }

  return {
    grossCost: totalGross,
    itc30: Math.round(itc30),
    stateRebate,
    netCost: Math.round(netCost),
    est25yrSavings,
    paybackYears,
    monthlyPayment,
    year1Savings: Math.round(year1Savings)
  };
}

// POST /api/proposals (Auth) - Create or update proposal configuration for a lead
router.post('/', authenticateToken, requirePlanFeature('proposals'), asyncHandler(async (req, res) => {
  const userId = req.user.id;
    const {
      leadId,
      companyName,
      systemSizeKw,
      panelCount,
      grossCost,
      financingType,
      loanTermYears,
      loanInterestRate,
      downPayment,
      includeItc30,
      stateRebate,
      batteryType,
      batteryCount,
      batteryCost,
      utilityEscalation
    } = req.body;

    if (!leadId) return res.status(400).json({ error: 'leadId is required' });

    // Ensure lead belongs to user
    const [leadRows] = await db.query('SELECT id, owner_name, address FROM leads WHERE id = ? AND user_id = ?', [leadId, userId]);
    if (leadRows.length === 0) return res.status(404).json({ error: 'Lead not found' });

    const roi = calculateSolarROI({
      grossCost,
      systemSizeKw,
      financingType,
      loanTermYears,
      loanInterestRate,
      downPayment,
      includeItc30,
      stateRebate,
      batteryType,
      batteryCount,
      batteryCost,
      utilityEscalation
    });

    // Check if proposal exists for lead
    const [existing] = await db.query('SELECT * FROM proposals WHERE lead_id = ? AND user_id = ? LIMIT 1', [leadId, userId]);
    let slug;

    if (existing.length > 0) {
      slug = existing[0].slug;
      await db.query(
        `UPDATE proposals SET
           company_name = ?,
           system_size_kw = ?,
           panel_count = ?,
           gross_cost = ?,
           financing_type = ?,
           loan_term_years = ?,
           loan_interest_rate = ?,
           down_payment = ?,
           include_itc_30 = ?,
           state_rebate = ?,
           battery_type = ?,
           battery_count = ?,
           battery_cost = ?,
           utility_escalation = ?,
           est_25yr_savings = ?,
           payback_years = ?,
           sent_at = COALESCE(sent_at, NOW()),
           updated_at = NOW()
         WHERE id = ?`,
        [
          companyName || BRAND_COMPANY_DEFAULT,
          systemSizeKw || 8.50,
          panelCount || 20,
          roi.grossCost,
          financingType || 'cash',
          loanTermYears || 20,
          loanInterestRate || 5.99,
          downPayment || 0.00,
          includeItc30 !== undefined ? (includeItc30 ? 1 : 0) : 1,
          stateRebate || 1000.00,
          batteryType || 'none',
          batteryCount || 0,
          batteryCost || 0.00,
          utilityEscalation || 4.50,
          roi.est25yrSavings,
          roi.paybackYears,
          existing[0].id
        ]
      );
    } else {
      slug = randomSlug();
      await db.query(
        `INSERT INTO proposals (
           slug, lead_id, user_id, company_name, system_size_kw, panel_count, gross_cost,
           financing_type, loan_term_years, loan_interest_rate, down_payment, include_itc_30,
           state_rebate, battery_type, battery_count, battery_cost, utility_escalation,
           est_25yr_savings, payback_years, status, sent_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', NOW())`,
        [
          slug,
          leadId,
          userId,
          companyName || BRAND_COMPANY_DEFAULT,
          systemSizeKw || 8.50,
          panelCount || 20,
          roi.grossCost,
          financingType || 'cash',
          loanTermYears || 20,
          loanInterestRate || 5.99,
          downPayment || 0.00,
          includeItc30 !== undefined ? (includeItc30 ? 1 : 0) : 1,
          stateRebate || 1000.00,
          batteryType || 'none',
          batteryCount || 0,
          batteryCost || 0.00,
          utilityEscalation || 4.50,
          roi.est25yrSavings,
          roi.paybackYears
        ]
      );

      await db.query(
        `INSERT INTO lead_activities (lead_id, user_id, type, content)
         VALUES (?, ?, 'proposal_sent', ?)`,
        [leadId, userId, 'Proposal created and share link ready.'],
      );

      // Move lead into proposal stage if still early in pipeline
      await db.query(
        `UPDATE leads SET status = 'proposal', updated_at = NOW()
         WHERE id = ? AND user_id = ?
           AND status IN ('new', 'contacted', 'qualified', 'appointment', 'in_progress')`,
        [leadId, userId],
      );
    }

    const [saved] = await db.query('SELECT * FROM proposals WHERE slug = ? LIMIT 1', [slug]);
    const engagement = buildEngagement(saved[0], await loadEventCounts(saved[0].id));
    return res.json({
      success: true,
      proposal: saved[0],
      slug,
      shareableUrl: `/proposal/${slug}`,
      engagement,
    });
}));

// GET /api/proposals/lead/:leadId (Auth) - Fetch proposal for a lead
router.get('/lead/:leadId', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { leadId } = req.params;
  const [rows] = await db.query('SELECT * FROM proposals WHERE lead_id = ? AND user_id = ? LIMIT 1', [leadId, userId]);
  if (rows.length === 0) return res.json({ proposal: null, engagement: null, events: [] });
  const proposal = rows[0];
  const eventCounts = await loadEventCounts(proposal.id);
  const [events] = await db.query(
    `SELECT id, event_type, session_id, meta, created_at
     FROM proposal_events
     WHERE proposal_id = ?
     ORDER BY created_at DESC
     LIMIT 50`,
    [proposal.id],
  );
  return res.json({
    proposal,
    shareableUrl: `/proposal/${proposal.slug}`,
    engagement: buildEngagement(proposal, eventCounts),
    events,
  });
}));

// GET /api/proposals/lead/:leadId/events (Auth)
router.get('/lead/:leadId/events', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { leadId } = req.params;
  const [rows] = await db.query('SELECT * FROM proposals WHERE lead_id = ? AND user_id = ? LIMIT 1', [leadId, userId]);
  if (rows.length === 0) return res.json({ events: [], engagement: null });
  const proposal = rows[0];
  const [events] = await db.query(
    `SELECT id, event_type, session_id, meta, created_at
     FROM proposal_events
     WHERE proposal_id = ?
     ORDER BY created_at DESC
     LIMIT 100`,
    [proposal.id],
  );
  res.json({
    events,
    engagement: buildEngagement(proposal, await loadEventCounts(proposal.id)),
  });
}));

// GET /api/proposals/public/:slug (Public) - Fetch proposal (no auto view bump; client posts events)
router.get('/public/:slug', publicProposalLimiter, async (req, res) => {
  try {
    const { slug } = req.params;
    const [rows] = await db.query('SELECT * FROM proposals WHERE slug = ? LIMIT 1', [slug]);
    if (rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });

    const proposal = rows[0];

    const [leadRows] = await db.query('SELECT id, owner_name, address, phone, email, lead_score, image_url, solar_json, property_json FROM leads WHERE id = ? LIMIT 1', [proposal.lead_id]);
    const lead = leadRows.length > 0 ? leadRows[0] : null;

    let solar = {};
    let propertyExtra = {};
    if (lead?.solar_json) {
      try { solar = JSON.parse(lead.solar_json); } catch {}
    }
    if (lead?.property_json) {
      try { propertyExtra = JSON.parse(lead.property_json); } catch {}
    }

    const roi = calculateSolarROI({
      grossCost: proposal.gross_cost,
      systemSizeKw: proposal.system_size_kw,
      financingType: proposal.financing_type,
      loanTermYears: proposal.loan_term_years,
      loanInterestRate: proposal.loan_interest_rate,
      downPayment: proposal.down_payment,
      includeItc30: Boolean(proposal.include_itc_30),
      stateRebate: proposal.state_rebate,
      batteryType: proposal.battery_type,
      batteryCount: proposal.battery_count,
      batteryCost: proposal.battery_cost,
      utilityEscalation: proposal.utility_escalation
    });

    res.json({
      proposal: { ...proposal, roi },
      lead: lead ? maskLeadContactForPublic({ ...lead, solar, propertyExtra }) : null
    });
  } catch (err) {
    console.error('Public proposal fetch error:', err);
    res.status(500).json({ error: 'Failed to load proposal' });
  }
});

// POST /api/proposals/public/:slug/events — engagement tracking
router.post('/public/:slug/events', publicEventLimiter, async (req, res) => {
  try {
    const { slug } = req.params;
    const eventType = String(req.body?.type || '').trim();
    const sessionId = req.body?.sessionId || null;
    const meta = req.body?.meta || null;

    if (!TRACKABLE_EVENTS.has(eventType)) {
      return res.status(400).json({ error: 'Invalid event type' });
    }

    const [rows] = await db.query('SELECT * FROM proposals WHERE slug = ? LIMIT 1', [slug]);
    if (rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });

    const result = await recordProposalEvent(rows[0], eventType, { sessionId, meta });
    if (!result.ok) return res.status(400).json({ error: result.error });

    res.json({
      success: true,
      deduped: Boolean(result.deduped),
      engagement: buildEngagement(result.proposal, await loadEventCounts(result.proposal.id)),
    });
  } catch (err) {
    console.error('Proposal event error:', err);
    res.status(500).json({ error: 'Failed to record event' });
  }
});

// POST /api/proposals/public/:slug/recalculate (Public) - Recalculate ROI in real-time
router.post('/public/:slug/recalculate', publicProposalLimiter, async (req, res) => {
  try {
    const { slug } = req.params;
    const [rows] = await db.query('SELECT * FROM proposals WHERE slug = ? LIMIT 1', [slug]);
    if (rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });

    const p = rows[0];
    const params = {
      grossCost: req.body.grossCost !== undefined ? req.body.grossCost : p.gross_cost,
      systemSizeKw: req.body.systemSizeKw !== undefined ? req.body.systemSizeKw : p.system_size_kw,
      financingType: req.body.financingType || p.financing_type,
      loanTermYears: req.body.loanTermYears || p.loan_term_years,
      loanInterestRate: req.body.loanInterestRate || p.loan_interest_rate,
      downPayment: req.body.downPayment !== undefined ? req.body.downPayment : p.down_payment,
      includeItc30: req.body.includeItc30 !== undefined ? req.body.includeItc30 : Boolean(p.include_itc_30),
      stateRebate: req.body.stateRebate !== undefined ? req.body.stateRebate : p.state_rebate,
      batteryType: req.body.batteryType || p.battery_type,
      batteryCount: req.body.batteryCount !== undefined ? req.body.batteryCount : p.battery_count,
      batteryCost: req.body.batteryCost !== undefined ? req.body.batteryCost : p.battery_cost,
      utilityEscalation: req.body.utilityEscalation !== undefined ? req.body.utilityEscalation : p.utility_escalation
    };

    const roi = calculateSolarROI(params);
    res.json({ success: true, roi });
  } catch (err) {
    res.status(500).json({ error: 'Recalculation error' });
  }
});

// POST /api/proposals/public/:slug/sign (Public) - E-Signature Submission
router.post('/public/:slug/sign', publicSignLimiter, async (req, res) => {
  try {
    const { slug } = req.params;
    const { signedName, signedEmail, signatureData } = req.body;

    if (!signedName || !signatureData) {
      return res.status(400).json({ error: 'Signed full name and signature drawing are required.' });
    }
    if (String(signedName).length > 200) {
      return res.status(400).json({ error: 'Signed name is too long.' });
    }
    if (String(signatureData).length > 500_000) {
      return res.status(400).json({ error: 'Signature data is too large.' });
    }

    const [rows] = await db.query('SELECT * FROM proposals WHERE slug = ? LIMIT 1', [slug]);
    if (rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });

    const proposal = rows[0];

    if (proposal.status === 'signed') {
      return res.status(400).json({ error: 'Proposal has already been signed.' });
    }

    // Record digital signature
    await db.query(
      `UPDATE proposals SET
         signed_name = ?,
         signed_email = ?,
         signed_signature_data = ?,
         signed_at = NOW(),
         status = 'signed'
       WHERE id = ?`,
      [signedName, signedEmail || '', signatureData, proposal.id]
    );

    await db.query(
      `INSERT INTO proposal_events (proposal_id, lead_id, user_id, event_type, meta)
       VALUES (?, ?, ?, 'accepted', ?)`,
      [
        proposal.id,
        proposal.lead_id,
        proposal.user_id,
        JSON.stringify({ signedName, signedEmail: signedEmail || null }),
      ],
    );

    // Update lead status to 'won' or 'proposal'
    await db.query('UPDATE leads SET status = "won", updated_at = NOW() WHERE id = ?', [proposal.lead_id]);

    // Insert lead activity log
    await db.query(
      `INSERT INTO lead_activities (lead_id, user_id, type, content)
       VALUES (?, ?, 'proposal_signed', ?)`,
      [proposal.lead_id, proposal.user_id, `Proposal signed electronically by ${signedName} (${signedEmail || 'N/A'}). Status updated to Closed Won.`]
    );

    res.json({
      success: true,
      message: 'Proposal signed and accepted successfully! Your installer has been notified.'
    });
  } catch (err) {
    console.error('Sign proposal error:', err);
    res.status(500).json({ error: 'Failed to record signature' });
  }
});

export default router;
