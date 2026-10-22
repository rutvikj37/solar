import { BRAND_COMPANY_DEFAULT } from '../config/brand.js';
import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import db from '../db.js';
import { authenticateToken, isAdminRole, requireAdmin } from '../middleware/auth.js';
import {
  OWNERSHIP_TYPES,
  assumptionsSnapshot,
  buildProposalEconomics,
  listIncentives,
  normalizeOwnership,
  normalizeSegment,
  normalizeStateCode,
} from '../services/solarEconomics.js';
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

const publicRecalcLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
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

function parseAssumptionsJson(proposal) {
  try {
    return proposal?.assumptions_json ? JSON.parse(proposal.assumptions_json) : {};
  } catch {
    return {};
  }
}

function proposalInputs(p) {
  return {
    grossCost: p.gross_cost,
    systemSizeKw: p.system_size_kw,
    financingType: p.financing_type,
    segment: p.property_segment,
    state: p.state_code,
    loanTermYears: p.loan_term_years,
    loanInterestRate: p.loan_interest_rate,
    downPayment: p.down_payment,
    stateRebate: p.state_rebate,
    batteryType: p.battery_type,
    batteryCount: p.battery_count,
    batteryCost: p.battery_cost,
    utilityEscalation: p.utility_escalation,
  };
}

async function loadLeadGeo(leadId) {
  const [rows] = await db.query(
    'SELECT id, address, latitude, longitude, solar_json FROM leads WHERE id = ? LIMIT 1',
    [leadId],
  );
  return rows[0] || {};
}

// GET /api/proposals/incentives (Auth) — incentive data table used by the savings maths
router.get('/incentives', authenticateToken, asyncHandler(async (req, res) => {
  const includeDisabled = isAdminRole(req.user.role) && req.query.all === '1';
  res.json({ incentives: await listIncentives({ includeDisabled }) });
}));

// PUT /api/proposals/incentives/:code (Admin) — update or create an incentive row
router.put('/incentives/:code', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 64);
  if (!code) return res.status(400).json({ error: 'Invalid code' });
  const b = req.body || {};
  const kind = ['percent', 'fixed', 'per_watt'].includes(b.kind) ? b.kind : 'percent';
  const segment = ['residential', 'commercial', 'any'].includes(b.segment) ? b.segment : 'residential';
  const ownership = String(b.ownership || 'cash,loan')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => OWNERSHIP_TYPES.includes(s))
    .join(',');
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(String(b.asOf || '')) ? b.asOf : new Date().toISOString().slice(0, 10);
  const expiresOn = /^\d{4}-\d{2}-\d{2}$/.test(String(b.expiresOn || '')) ? b.expiresOn : null;
  const amount = Number(b.amount);
  if (!Number.isFinite(amount) || amount < 0 || (kind === 'percent' && amount > 1)) {
    return res.status(400).json({ error: 'amount must be >= 0 (percent as a fraction, e.g. 0.3)' });
  }
  if (!ownership) return res.status(400).json({ error: 'ownership must include cash, loan, lease or ppa' });
  await db.query(
    `INSERT INTO solar_incentives
       (code, jurisdiction, label, segment, ownership, kind, amount, cap_amount, enabled, as_of, expires_on, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE jurisdiction = VALUES(jurisdiction), label = VALUES(label), segment = VALUES(segment),
       ownership = VALUES(ownership), kind = VALUES(kind), amount = VALUES(amount), cap_amount = VALUES(cap_amount),
       enabled = VALUES(enabled), as_of = VALUES(as_of), expires_on = VALUES(expires_on), notes = VALUES(notes)`,
    [
      code,
      normalizeStateCode(b.jurisdiction) || 'US',
      String(b.label || code).slice(0, 255),
      segment,
      ownership,
      kind,
      amount,
      b.cap != null && b.cap !== '' && Number.isFinite(Number(b.cap)) ? Number(b.cap) : null,
      b.enabled === false || b.enabled === 0 ? 0 : 1,
      asOf,
      expiresOn,
      b.notes != null ? String(b.notes).slice(0, 2000) : null,
    ],
  );
  res.json({ ok: true, incentives: await listIncentives({ includeDisabled: true }) });
}));

// POST /api/proposals/preview (Auth) — run the savings maths without saving
router.post('/preview', authenticateToken, requirePlanFeature('proposals'), asyncHandler(async (req, res) => {
  const { leadId } = req.body || {};
  if (!leadId) return res.status(400).json({ error: 'leadId is required' });
  const [leadRows] = await db.query('SELECT id FROM leads WHERE id = ? AND user_id = ?', [leadId, req.user.id]);
  if (!leadRows.length) return res.status(404).json({ error: 'Lead not found' });
  const roi = await buildProposalEconomics({ lead: await loadLeadGeo(leadId), inputs: req.body });
  res.json({ roi });
}));

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
      utilityEscalation,
      segment,
      state,
    } = req.body;

    if (!leadId) return res.status(400).json({ error: 'leadId is required' });

    // Ensure lead belongs to user
    const [leadRows] = await db.query('SELECT id, owner_name, address FROM leads WHERE id = ? AND user_id = ?', [leadId, userId]);
    if (leadRows.length === 0) return res.status(404).json({ error: 'Lead not found' });

    const ownership = normalizeOwnership(financingType);
    const propertySegment = normalizeSegment(segment);
    const roi = await buildProposalEconomics({
      lead: await loadLeadGeo(leadId),
      inputs: {
        grossCost,
        systemSizeKw,
        financingType: ownership,
        segment: propertySegment,
        state,
        loanTermYears,
        loanInterestRate,
        downPayment,
        stateRebate,
        batteryType,
        batteryCount,
        batteryCost,
        utilityEscalation,
      },
    });
    const assumptionsJson = JSON.stringify({ ...assumptionsSnapshot(roi), assumptions: roi.assumptions, incentives: roi.incentives });
    const solarGrossCost = grossCost != null && grossCost !== '' ? Number(grossCost) : 25500;

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
           property_segment = ?,
           state_code = ?,
           utility_rate = ?,
           annual_production_kwh = ?,
           incentives_total = ?,
           assumptions_json = ?,
           sent_at = COALESCE(sent_at, NOW()),
           updated_at = NOW()
         WHERE id = ?`,
        [
          companyName || BRAND_COMPANY_DEFAULT,
          systemSizeKw || 8.50,
          panelCount || 20,
          solarGrossCost,
          ownership,
          loanTermYears || 20,
          loanInterestRate || 5.99,
          downPayment || 0.00,
          0,
          stateRebate || 0,
          batteryType || 'none',
          batteryCount || 0,
          batteryCost || 0.00,
          roi.assumptions.escalationPct,
          roi.est25yrSavings,
          roi.paybackYears ?? 0,
          propertySegment,
          roi.assumptions.state,
          roi.utilityRate,
          roi.annualProductionKwh,
          roi.incentivesTotal,
          assumptionsJson,
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
           est_25yr_savings, payback_years, property_segment, state_code, utility_rate,
           annual_production_kwh, incentives_total, assumptions_json, status, sent_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', NOW())`,
        [
          slug,
          leadId,
          userId,
          companyName || BRAND_COMPANY_DEFAULT,
          systemSizeKw || 8.50,
          panelCount || 20,
          solarGrossCost,
          ownership,
          loanTermYears || 20,
          loanInterestRate || 5.99,
          downPayment || 0.00,
          0,
          stateRebate || 0,
          batteryType || 'none',
          batteryCount || 0,
          batteryCost || 0.00,
          roi.assumptions.escalationPct,
          roi.est25yrSavings,
          roi.paybackYears ?? 0,
          propertySegment,
          roi.assumptions.state,
          roi.utilityRate,
          roi.annualProductionKwh,
          roi.incentivesTotal,
          assumptionsJson,
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
      proposal: { ...saved[0], roi },
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

    const [leadRows] = await db.query('SELECT id, owner_name, address, latitude, longitude, phone, email, lead_score, image_url, solar_json, property_json FROM leads WHERE id = ? LIMIT 1', [proposal.lead_id]);
    const lead = leadRows.length > 0 ? leadRows[0] : null;

    let solar = {};
    let propertyExtra = {};
    if (lead?.solar_json) {
      try { solar = JSON.parse(lead.solar_json); } catch {}
    }
    if (lead?.property_json) {
      try { propertyExtra = JSON.parse(lead.property_json); } catch {}
    }

    const roi = await buildProposalEconomics({
      lead: lead || {},
      inputs: proposalInputs(proposal),
      cached: parseAssumptionsJson(proposal),
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
router.post('/public/:slug/recalculate', publicRecalcLimiter, async (req, res) => {
  try {
    const { slug } = req.params;
    const [rows] = await db.query('SELECT * FROM proposals WHERE slug = ? LIMIT 1', [slug]);
    if (rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });

    const p = rows[0];
    const body = req.body || {};
    const base = proposalInputs(p);
    // Homeowner may explore financing / battery options; pricing, location and incentives stay as quoted.
    const inputs = {
      ...base,
      financingType: body.financingType ? normalizeOwnership(body.financingType) : base.financingType,
      loanTermYears: Number(body.loanTermYears) > 0 ? Math.min(30, Number(body.loanTermYears)) : base.loanTermYears,
      loanInterestRate:
        Number(body.loanInterestRate) > 0 ? Math.min(30, Number(body.loanInterestRate)) : base.loanInterestRate,
      downPayment: body.downPayment !== undefined ? Math.max(0, Number(body.downPayment) || 0) : base.downPayment,
      batteryType: body.batteryType || base.batteryType,
      batteryCount: body.batteryCount !== undefined ? Math.max(0, Math.min(4, Number(body.batteryCount) || 0)) : base.batteryCount,
    };
    if (body.batteryType !== undefined || body.batteryCount !== undefined) inputs.batteryCost = null;

    const [leadRows] = await db.query('SELECT id, address, latitude, longitude, solar_json FROM leads WHERE id = ? LIMIT 1', [p.lead_id]);
    const roi = await buildProposalEconomics({
      lead: leadRows[0] || {},
      inputs,
      cached: parseAssumptionsJson(p),
    });
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
    const [signResult] = await db.query(
      `UPDATE proposals SET
         signed_name = ?,
         signed_email = ?,
         signed_signature_data = ?,
         signed_at = NOW(),
         status = 'signed'
       WHERE id = ? AND (status IS NULL OR status <> 'signed')`,
      [signedName, signedEmail || '', signatureData, proposal.id]
    );
    if (!signResult?.affectedRows) {
      return res.status(409).json({ error: 'Proposal has already been signed.' });
    }

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
