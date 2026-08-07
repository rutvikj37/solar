import express from 'express';
import crypto from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

function randomSlug() {
  return `prop_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
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
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
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
           updated_at = NOW()
         WHERE id = ?`,
        [
          companyName || 'SollarX Energy Solutions',
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
           est_25yr_savings, payback_years, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent')`,
        [
          slug,
          leadId,
          userId,
          companyName || 'SollarX Energy Solutions',
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
    }

    const [saved] = await db.query('SELECT * FROM proposals WHERE slug = ? LIMIT 1', [slug]);
    return res.json({
      success: true,
      proposal: saved[0],
      slug,
      shareableUrl: `/proposal/${slug}`
    });
}));

// GET /api/proposals/lead/:leadId (Auth) - Fetch proposal for a lead
router.get('/lead/:leadId', authenticateToken, asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { leadId } = req.params;
  const [rows] = await db.query('SELECT * FROM proposals WHERE lead_id = ? AND user_id = ? LIMIT 1', [leadId, userId]);
  if (rows.length === 0) return res.json({ proposal: null });
  return res.json({ proposal: rows[0], shareableUrl: `/proposal/${rows[0].slug}` });
}));

// GET /api/proposals/public/:slug (Public) - Fetch proposal details for public homeowner page
router.get('/public/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const [rows] = await db.query('SELECT * FROM proposals WHERE slug = ? LIMIT 1', [slug]);
    if (rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });

    const proposal = rows[0];

    // Increment view count
    await db.query('UPDATE proposals SET view_count = view_count + 1, viewed_at = NOW(), status = IF(status = "sent", "viewed", status) WHERE id = ?', [proposal.id]);

    // Fetch associated lead info
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
      lead: lead ? { ...lead, solar, propertyExtra } : null
    });
  } catch (err) {
    console.error('Public proposal fetch error:', err);
    res.status(500).json({ error: 'Failed to load proposal' });
  }
});

// POST /api/proposals/public/:slug/recalculate (Public) - Recalculate ROI in real-time
router.post('/public/:slug/recalculate', async (req, res) => {
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
router.post('/public/:slug/sign', async (req, res) => {
  try {
    const { slug } = req.params;
    const { signedName, signedEmail, signatureData } = req.body;

    if (!signedName || !signatureData) {
      return res.status(400).json({ error: 'Signed full name and signature drawing are required.' });
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
