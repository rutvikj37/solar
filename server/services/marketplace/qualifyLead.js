import db from '../../db.js';
import { parseAddressParts } from '../ai-calling/leadGeo.js';
import {
  billRangeFromAmount,
  extractZip,
  generateLeadCode,
} from './constants.js';
import { computeBiddingWindow } from './bidWindow.js';
import { enrichHomeownerInquiry } from './enrichHomeownerInquiry.js';
import { notifyHomeownerListed } from './notifications.js';
import {
  validateEmailWithVerifalia,
  lookupPhoneWithTwilio,
} from '../contactEnrichmentService.js';
import { buildScorePackage, computeStartingBid } from './leadScoring.js';

/**
 * Validate + score inquiry. Opens bidding only when listInMarketplace is true (admin approve).
 * Scores follow lead scoring.docx:
 * - opportunity_score = Homeowner Lead Score (0–100)
 * - solar_potential_score = Solar Potential Score (0–100)
 */
export async function qualifyMarketplaceLead(leadId, options = {}) {
  const { listInMarketplace = true } = options;
  const [rows] = await db.query(`SELECT * FROM marketplace_leads WHERE id = ?`, [leadId]);
  const lead = rows[0];
  if (!lead) throw new Error('Marketplace lead not found');
  if (!['new', 'ai_qualified', 'pending_admin'].includes(lead.status)) {
    return lead;
  }

  const enrichment = safeJson(lead.enrichment_json) || {};
  const scored = buildScorePackage(
    {
      name: lead.homeowner_name,
      email: lead.email,
      phone: lead.phone,
      address: lead.address,
      monthlyBill: lead.monthly_bill,
      homeownerStatus: lead.homeowner_status,
      installationTimeline: lead.installation_timeline,
      projectDetails: lead.project_details,
      propertyType: lead.property_type,
      emailStatus: lead.email_status,
      phoneType: lead.phone_type,
      estimatedRoofSqft: lead.estimated_roof_sqft,
    },
    enrichment,
  );

  const [settingsRows] = await db.query(
    `SELECT default_bid_window_hours, default_min_bid FROM marketplace_settings WHERE id = 1`,
  );
  const settings = settingsRows[0] || {};
  const { opens, closes } = computeBiddingWindow(settings);
  const minBid = computeStartingBid(scored.leadScore, settings);

  const billRange = lead.bill_range || billRangeFromAmount(lead.monthly_bill);
  const zip = extractZip(lead.address, lead.zip) || lead.zip;
  const addressParts = parseAddressParts(lead.address);
  const leadState = lead.state || addressParts.state || null;

  // Gate listing on contact + property validity (existing solar remains bidable at lower solar score)
  const canList = scored.contactValid && scored.propertyValid;

  const sharedFields = [
    zip,
    leadState,
    scored.propertyType,
    scored.leadScore,
    scored.solarPotentialScore,
    JSON.stringify(scored.breakdown),
    billRange,
    scored.existingSolarLikely ? 1 : 0,
    scored.solarPotentialLabel,
    scored.estimatedRoofSqft,
    scored.estimatedSolarKw,
  ];

  // Homeowner submit: score only, wait for admin approval
  if (!listInMarketplace) {
    await db.query(
      `UPDATE marketplace_leads SET
         status = 'pending_admin',
         zip = COALESCE(?, zip),
         state = COALESCE(?, state),
         property_type = ?,
         opportunity_score = ?,
         solar_potential_score = ?,
         score_breakdown = ?,
         bill_range = ?,
         existing_solar_likely = ?,
         solar_potential_label = ?,
         estimated_roof_sqft = ?,
         estimated_solar_kw = ?,
         enrichment_json = ?
       WHERE id = ?`,
      [
        ...sharedFields,
        JSON.stringify({
          ...enrichment,
          scoredAt: new Date().toISOString(),
          listed: false,
          awaitingAdmin: true,
          canList,
          leadScoreTier: scored.leadScoreTier,
        }),
        leadId,
      ],
    );
    const [updated] = await db.query(`SELECT * FROM marketplace_leads WHERE id = ?`, [leadId]);
    return updated[0];
  }

  if (!canList) {
    await db.query(
      `UPDATE marketplace_leads SET
         status = 'ai_qualified',
         zip = COALESCE(?, zip),
         state = COALESCE(?, state),
         property_type = ?,
         opportunity_score = ?,
         solar_potential_score = ?,
         score_breakdown = ?,
         bill_range = ?,
         existing_solar_likely = ?,
         solar_potential_label = ?,
         estimated_roof_sqft = ?,
         estimated_solar_kw = ?,
         enrichment_json = ?
       WHERE id = ?`,
      [
        ...sharedFields,
        JSON.stringify({
          ...enrichment,
          qualifiedAt: new Date().toISOString(),
          listed: false,
          reason: 'failed_gates',
          leadScoreTier: scored.leadScoreTier,
        }),
        leadId,
      ],
    );
    const [updated] = await db.query(`SELECT * FROM marketplace_leads WHERE id = ?`, [leadId]);
    return updated[0];
  }

  await db.query(
    `UPDATE marketplace_leads SET
       status = 'bidding',
       zip = COALESCE(?, zip),
       state = COALESCE(?, state),
       property_type = ?,
       opportunity_score = ?,
       solar_potential_score = ?,
       score_breakdown = ?,
       bill_range = ?,
       existing_solar_likely = ?,
       solar_potential_label = ?,
       estimated_roof_sqft = ?,
       estimated_solar_kw = ?,
       bidding_opens_at = ?,
       bidding_closes_at = ?,
       min_bid = ?,
       expansion_stage = 0,
       expansion_radius_miles = 25,
       enrichment_json = ?
     WHERE id = ?`,
    [
      ...sharedFields,
      opens,
      closes,
      minBid,
      JSON.stringify({
        ...enrichment,
        qualifiedAt: new Date().toISOString(),
        listed: true,
        stages: ['ai_qualified', 'marketplace', 'bidding'],
        leadScoreTier: scored.leadScoreTier,
        startingBid: minBid,
      }),
      leadId,
    ],
  );

  const [updated] = await db.query(`SELECT * FROM marketplace_leads WHERE id = ?`, [leadId]);
  return updated[0];
}

function safeJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Public homeowner-facing payload — no verification or marketplace status details.
 */
export function formatInquiryResponse(lead) {
  if (!lead) return null;

  const enrichment = safeJson(lead.enrichment_json) || {};
  const breakdown = safeJson(lead.score_breakdown) || {};
  const validationChecks = Array.isArray(breakdown.validationChecks)
    ? breakdown.validationChecks
    : rebuildValidationChecks(breakdown);
  const listedInMarketplace =
    lead.status === 'bidding' || lead.status === 'no_bid_expanding';

  return {
    ok: true,
    leadCode: lead.lead_code,
    status: lead.status,
    message:
      'Thank you! Your inquiry was received and is under review. A qualified installer will reach out once your request is approved.',
    propertyType: lead.property_type || 'residential',
    solarPotentialLabel: lead.solar_potential_label || breakdown.solarPotentialLabel || null,
    billRange: lead.bill_range || null,
    estimatedSolarKw:
      lead.estimated_solar_kw != null ? Number(lead.estimated_solar_kw) : null,
    estimatedRoofSqft:
      lead.estimated_roof_sqft != null ? Number(lead.estimated_roof_sqft) : null,
    // Lead Score (homeowner) — primary opportunity score
    opportunityScore: Number(lead.opportunity_score) || 0,
    leadScore: Number(lead.opportunity_score) || 0,
    leadScoreTier: breakdown.leadScoreTier || enrichment.leadScoreTier || null,
    // Solar Potential Score (installer)
    solarPotentialScore:
      lead.solar_potential_score != null
        ? Number(lead.solar_potential_score)
        : Number(breakdown.solarPotentialScore) || 0,
    scoreBreakdown: breakdown,
    validationChecks,
    listedInMarketplace,
    enrichmentSource: enrichment.googleSolarHit ? 'google_solar' : 'estimated',
    dataSources: enrichment.dataSources || null,
    satelliteImageUrl: lead.lead_code
      ? `/api/marketplace/report-image/${encodeURIComponent(lead.lead_code)}`
      : null,
    solarReport: enrichment.googleSolarHit
      ? {
          panelCount: enrichment.panelCount,
          systemKw: enrichment.systemKw,
          annualProductionKwh: enrichment.annualProductionKwh,
          coveragePct: enrichment.coveragePct,
          orientation: enrichment.orientation,
          pitch: enrichment.pitch,
          shading: enrichment.shading,
          usableRoofSqft: enrichment.usableRoofSqft,
          imageryDate: enrichment.imageryDate,
          imageryQuality: enrichment.imageryQuality,
          ratePerKwh: enrichment.ratePerKwh,
          year1Savings: enrichment.year1Savings,
          year5Savings: enrichment.year5Savings,
          year10Savings: enrichment.year10Savings,
          year25Savings: enrichment.year25Savings,
          estSolarPayment: enrichment.estSolarPayment,
          co2Tons25: enrichment.co2Tons25,
          treesEquiv: enrichment.treesEquiv,
          milesOffset: enrichment.milesOffset,
          productionSource: enrichment.productionSource,
        }
      : null,
    propertyLat: lead.latitude != null ? Number(lead.latitude) : enrichment.lat,
    propertyLng: lead.longitude != null ? Number(lead.longitude) : enrichment.lng,
  };
}

function rebuildValidationChecks(breakdown = {}) {
  const sections = breakdown.sections || {};
  const lead = sections.lead || {};
  const solar = sections.solar || {};
  if (!lead.purchaseIntent && breakdown.buyingIntent == null) return [];

  return [
    {
      key: 'purchaseIntent',
      label: 'Purchase intent',
      score: lead.purchaseIntent?.points ?? Math.round((breakdown.buyingIntent || 0) * 0.2),
      max: 20,
      passed: (lead.purchaseIntent?.points ?? 0) >= 7 || (breakdown.buyingIntent || 0) >= 45,
      detail: lead.purchaseIntent?.label,
    },
    {
      key: 'ownershipRoof',
      label: 'Ownership & roof',
      score: lead.ownershipRoof?.points ?? 0,
      max: 15,
      passed: (lead.ownershipRoof?.points ?? 0) > 0,
      detail: lead.ownershipRoof?.ownershipLabel,
    },
    {
      key: 'electricityBill',
      label: 'Electricity bill',
      score: lead.electricityBill?.points ?? 0,
      max: 15,
      passed: (lead.electricityBill?.points ?? 0) > 0,
      detail: lead.electricityBill?.label,
    },
    {
      key: 'personalInfo',
      label: 'Personal information',
      score: lead.personalInfo?.points ?? Math.round((breakdown.contactValidity || 0) * 0.5),
      max: 50,
      passed: breakdown.contactValid !== false,
      detail: 'Name, contact, address, and property type',
    },
    {
      key: 'solarPotential',
      label: 'Solar potential',
      score: breakdown.solarPotentialScore ?? breakdown.solarPotential ?? 0,
      max: 100,
      passed: (breakdown.solarPotentialScore ?? breakdown.solarPotential ?? 0) >= 45,
      detail: breakdown.solarPotentialLabel,
    },
    {
      key: 'existingSolar',
      label: 'Existing solar',
      score: solar.existingSolar?.points ?? 0,
      max: 15,
      passed: !breakdown.existingSolarLikely,
      detail: solar.existingSolar?.label,
    },
  ];
}

export async function createInquiry(payload) {
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
  } = payload;

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedAddress = String(address).trim().toLowerCase();

  const [dupes] = await db.query(
    `SELECT id, lead_code, status, created_at FROM marketplace_leads
     WHERE LOWER(email) = ?
       AND LOWER(TRIM(address)) = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     ORDER BY created_at DESC
     LIMIT 1`,
    [normalizedEmail, normalizedAddress],
  );
  if (dupes[0]) {
    const err = new Error('A similar inquiry was already submitted recently.');
    err.code = 'DUPLICATE_INQUIRY';
    // Intentionally omit lead_code — public report URLs must not leak to unauthenticated clients.
    err.existingStatus = dupes[0].status;
    throw err;
  }

  const leadCode = generateLeadCode();
  const bill = monthlyBill != null && monthlyBill !== '' ? Number(monthlyBill) : null;
  const billRange = billRangeFromAmount(bill);
  const resolvedZip = extractZip(address, zip);

  const [result] = await db.query(
    `INSERT INTO marketplace_leads
      (lead_code, status, homeowner_name, phone, email, address, zip,
       monthly_bill, bill_range, homeowner_status, installation_timeline, project_details)
     VALUES (?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      leadCode,
      String(name).trim(),
      String(phone).trim(),
      String(email).trim().toLowerCase(),
      String(address).trim(),
      resolvedZip,
      Number.isFinite(bill) ? bill : null,
      billRange,
      homeownerStatus ? String(homeownerStatus).trim() : null,
      installationTimeline ? String(installationTimeline).trim() : null,
      projectDetails ? String(projectDetails).trim() : null,
    ],
  );

  const leadId = result.insertId;

  let enrichment = null;
  try {
    const enrichPromise = enrichHomeownerInquiry({
      address: String(address).trim(),
      monthlyBill: bill,
      propertyLat,
      propertyLng,
    });
    // Cap enrichment so nginx/proxy does not return HTML 504 (shows as "Network error" in UI).
    enrichment = await Promise.race([
      enrichPromise,
      new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            enriched: false,
            timedOut: true,
            dataSources: { solar: 'timeout', production: 'estimated' },
          });
        }, 18000);
      }),
    ]);
  } catch (err) {
    console.error('[Marketplace] homeowner enrichment failed:', err);
    enrichment = { enriched: false, dataSources: { solar: 'unavailable', production: 'estimated' } };
  }

  if (enrichment) {
    await db.query(
      `UPDATE marketplace_leads SET
         latitude = ?,
         longitude = ?,
         estimated_solar_kw = COALESCE(?, estimated_solar_kw),
         estimated_roof_sqft = COALESCE(?, estimated_roof_sqft),
         existing_solar_likely = CASE WHEN ? THEN 1 ELSE existing_solar_likely END,
         enrichment_json = ?
       WHERE id = ?`,
      [
        enrichment.lat ?? null,
        enrichment.lng ?? null,
        enrichment.systemKw ?? null,
        enrichment.usableRoofSqft ?? null,
        enrichment.existingSolarLikely ? 1 : 0,
        JSON.stringify(enrichment),
        leadId,
      ],
    );
  }

  // Score for admin review — do not open marketplace until admin approves.
  return qualifyMarketplaceLead(leadId, { listInMarketplace: false });
}

function isEmailDeliverable(classification) {
  const lower = String(classification || '').toLowerCase();
  return lower.includes('deliverable') && !lower.includes('undeliverable');
}

function isPhoneReal(lineType) {
  const type = String(lineType || '').toUpperCase();
  if (!type || type === 'NOT AVAILABLE') return false;
  if (type.includes('INVALID')) return false;
  if (/(VOIP|TOLL.?FREE|PREMIUM|SHARED)/i.test(type) && !/MOBILE|LANDLINE|FIXED/i.test(type)) {
    return false;
  }
  return true;
}

/**
 * Admin-only: Verifalia email + Twilio phone lookup (no OTP sent to homeowner).
 */
export async function verifyMarketplaceLeadContact(leadId) {
  const [rows] = await db.query(`SELECT * FROM marketplace_leads WHERE id = ?`, [leadId]);
  const lead = rows[0];
  if (!lead) throw new Error('Marketplace lead not found');

  const emailStatus = await validateEmailWithVerifalia(String(lead.email || '').trim());
  const phoneType = await lookupPhoneWithTwilio(String(lead.phone || '').trim());

  const enrichment = safeJson(lead.enrichment_json) || {};
  const contactCheck = {
    checkedAt: new Date().toISOString(),
    emailStatus,
    phoneType,
    emailDeliverable: isEmailDeliverable(emailStatus),
    phoneReal: isPhoneReal(phoneType),
  };

  await db.query(
    `UPDATE marketplace_leads SET
       email_status = ?,
       phone_type = ?,
       enrichment_json = ?
     WHERE id = ?`,
    [
      emailStatus,
      phoneType,
      JSON.stringify({ ...enrichment, adminContactCheck: contactCheck }),
      leadId,
    ],
  );

  const [updated] = await db.query(`SELECT * FROM marketplace_leads WHERE id = ?`, [leadId]);
  return { lead: updated[0], contactCheck };
}

/**
 * Admin approves lead → verify contact, then list in marketplace (open bidding).
 */
export async function approveMarketplaceLead(leadId) {
  const { contactCheck } = await verifyMarketplaceLeadContact(leadId);

  const qualified = await qualifyMarketplaceLead(leadId, { listInMarketplace: true });
  if (qualified.status === 'bidding' || qualified.status === 'no_bid_expanding') {
    notifyHomeownerListed({ lead: qualified }).catch(() => {});
  }

  return { lead: qualified, contactCheck };
}
