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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /\d{7,}/;

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function scoreContact(email, phone) {
  let score = 0;
  const emailOk = EMAIL_RE.test(String(email || '').trim());
  const phoneDigits = String(phone || '').replace(/\D/g, '');
  const phoneOk = phoneDigits.length >= 10 && PHONE_RE.test(phoneDigits);
  if (emailOk) score += 50;
  if (phoneOk) score += 50;
  return {
    score,
    emailValid: emailOk,
    phoneValid: phoneOk,
    valid: emailOk && phoneOk,
  };
}

function scoreProperty(address, zip) {
  const addr = String(address || '').trim();
  const z = extractZip(addr, zip);
  let score = 0;
  if (addr.length >= 8) score += 40;
  if (/\d/.test(addr)) score += 20;
  if (z) score += 40;
  return { score: clamp(score), zip: z, valid: Boolean(z) && addr.length >= 5 };
}

function scorePropertyType(homeownerStatus, projectDetails = '') {
  const text = `${homeownerStatus || ''} ${projectDetails || ''}`.toLowerCase();
  if (/commercial|business|warehouse|office/.test(text)) {
    return { type: 'commercial', score: 55 };
  }
  return { type: 'residential', score: 85 };
}

function scoreExistingSolar(projectDetails = '') {
  const text = String(projectDetails || '').toLowerCase();
  if (/already have solar|existing solar|has solar|panels already|currently have solar/.test(text)) {
    return { likely: true, score: 15 };
  }
  if (/no solar|never had|interested in getting|want solar/.test(text)) {
    return { likely: false, score: 90 };
  }
  return { likely: false, score: 70 };
}

function scoreSolarPotential(monthlyBill, propertyType) {
  const bill = Number(monthlyBill) || 0;
  let score = 40;
  if (bill >= 300) score = 95;
  else if (bill >= 200) score = 85;
  else if (bill >= 150) score = 75;
  else if (bill >= 100) score = 65;
  else if (bill > 0) score = 50;
  if (propertyType === 'commercial') score = Math.min(100, score + 5);
  const label =
    score >= 85 ? 'High' : score >= 65 ? 'Moderate' : score >= 45 ? 'Fair' : 'Low';
  // Rough system size estimate from bill
  const estimatedSolarKw = bill > 0 ? Math.round((bill / 120) * 10) / 10 : null;
  const estimatedRoofSqft = estimatedSolarKw ? Math.round(estimatedSolarKw * 80) : null;
  return { score, label, estimatedSolarKw, estimatedRoofSqft };
}

function scoreBuyingIntent(timeline, projectDetails = '') {
  const t = String(timeline || '').toLowerCase();
  const d = String(projectDetails || '').toLowerCase();
  let score = 40;
  if (/asap|as soon as possible|immediately|this month|0-1|ready now/.test(t)) score = 95;
  else if (/1-3|1–3|within 3|soon|next 3/.test(t)) score = 80;
  else if (/3-6|3–6|this year|6 months/.test(t)) score = 65;
  else if (/6-12|6–12|next year|just research|exploring|not sure/.test(t)) score = 45;
  else if (t) score = 50;
  if (/quote|ready to buy|financing|install/.test(d)) score = Math.min(100, score + 10);
  return { score };
}

/**
 * Validate + score inquiry. Opens bidding only when listInMarketplace is true (admin approve).
 */
export async function qualifyMarketplaceLead(leadId, options = {}) {
  const { listInMarketplace = true } = options;
  const [rows] = await db.query(`SELECT * FROM marketplace_leads WHERE id = ?`, [leadId]);
  const lead = rows[0];
  if (!lead) throw new Error('Marketplace lead not found');
  if (!['new', 'ai_qualified', 'pending_admin'].includes(lead.status)) {
    return lead;
  }

  const contact = scoreContact(lead.email, lead.phone);
  const property = scoreProperty(lead.address, lead.zip);
  const propType = scorePropertyType(lead.homeowner_status, lead.project_details);
  const existing = scoreExistingSolar(lead.project_details);
  const solar = scoreSolarPotential(lead.monthly_bill, propType.type);
  const intent = scoreBuyingIntent(lead.installation_timeline, lead.project_details);

  const enrichment = safeJson(lead.enrichment_json) || {};
  if (enrichment.googleSolarHit) {
    if (enrichment.systemKw != null) {
      solar.estimatedSolarKw = enrichment.systemKw;
      solar.estimatedRoofSqft = enrichment.usableRoofSqft ?? solar.estimatedRoofSqft;
      if (enrichment.coveragePct >= 70) solar.label = 'High';
      else if (enrichment.coveragePct >= 50) solar.label = 'Moderate';
    }
    if (enrichment.existingSolarLikely) {
      existing.likely = true;
      existing.score = 15;
    } else if (enrichment.existingSolarStatus) {
      existing.likely = false;
      existing.score = Math.max(existing.score, 85);
    }
  }

  const overall = clamp(
    contact.score * 0.2 +
      property.score * 0.2 +
      propType.score * 0.1 +
      existing.score * 0.15 +
      solar.score * 0.2 +
      intent.score * 0.15,
  );

  const breakdown = {
    contactValidity: contact.score,
    propertyValidity: property.score,
    residentialCommercial: propType.score,
    existingSolar: existing.score,
    solarPotential: solar.score,
    buyingIntent: intent.score,
    propertyType: propType.type,
    contactValid: contact.valid,
    propertyValid: property.valid,
    existingSolarLikely: existing.likely,
  };

  const [settingsRows] = await db.query(
    `SELECT default_bid_window_hours, default_min_bid FROM marketplace_settings WHERE id = 1`,
  );
  const settings = settingsRows[0] || {};
  const { opens, closes, minBid } = computeBiddingWindow(settings);

  const billRange = lead.bill_range || billRangeFromAmount(lead.monthly_bill);
  const zip = property.zip || lead.zip;
  const addressParts = parseAddressParts(lead.address);
  const leadState = lead.state || addressParts.state || null;

  // Hard fail contact/property → ai_qualified without bidding
  const canList = contact.valid && property.valid && !existing.likely;

  const sharedFields = [
    zip,
    leadState,
    propType.type,
    overall,
    JSON.stringify(breakdown),
    billRange,
    existing.likely ? 1 : 0,
    solar.label,
    solar.estimatedRoofSqft,
    solar.estimatedSolarKw,
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
         score_breakdown = ?,
         bill_range = ?,
         existing_solar_likely = ?,
         solar_potential_label = ?,
         estimated_roof_sqft = ?,
         estimated_solar_kw = ?,
         enrichment_json = ?
       WHERE id = ?`,
      [
        zip,
        leadState,
        propType.type,
        overall,
        JSON.stringify(breakdown),
        billRange,
        existing.likely ? 1 : 0,
        solar.label,
        solar.estimatedRoofSqft,
        solar.estimatedSolarKw,
        JSON.stringify({
          ...enrichment,
          qualifiedAt: new Date().toISOString(),
          listed: false,
          reason: 'failed_gates',
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
      zip,
      leadState,
      propType.type,
      overall,
      JSON.stringify(breakdown),
      billRange,
      0,
      solar.label,
      solar.estimatedRoofSqft,
      solar.estimatedSolarKw,
      opens,
      closes,
      minBid,
      JSON.stringify({
        ...enrichment,
        qualifiedAt: new Date().toISOString(),
        listed: true,
        stages: ['ai_qualified', 'marketplace', 'bidding'],
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

  return {
    ok: true,
    leadCode: lead.lead_code,
    message:
      'Thank you! Your inquiry was received and is under review. A qualified installer will reach out once your request is approved.',
    propertyType: lead.property_type || 'residential',
    solarPotentialLabel: lead.solar_potential_label || null,
    billRange: lead.bill_range || null,
    estimatedSolarKw:
      lead.estimated_solar_kw != null ? Number(lead.estimated_solar_kw) : null,
    estimatedRoofSqft:
      lead.estimated_roof_sqft != null ? Number(lead.estimated_roof_sqft) : null,
    opportunityScore: Number(lead.opportunity_score) || 0,
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
    err.existingLeadCode = dupes[0].lead_code;
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
