/**
 * Lead scoring per Space2Roof model (lead scoring.docx):
 * 1) Homeowner Lead Score 0–100
 * 2) Solar Potential Score 0–100 (installer side)
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /\d{7,}/;

export const LEAD_SCORE_TIERS = [
  { min: 90, label: 'Hot', key: 'hot' },
  { min: 75, label: 'Strong', key: 'strong' },
  { min: 55, label: 'Moderate', key: 'moderate' },
  { min: 0, label: 'Early-stage', key: 'early' },
];

/** Bid starting price: leadScore × multiplier (doc example: 90 × 2 = $180). */
export const BID_START_MULTIPLIER = 2;

export function clampScore(n, min = 0, max = 100) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.round(v)));
}

export function leadScoreTier(score) {
  const n = clampScore(score);
  return LEAD_SCORE_TIERS.find((t) => n >= t.min) || LEAD_SCORE_TIERS[LEAD_SCORE_TIERS.length - 1];
}

function isEmailFormatValid(email) {
  return EMAIL_RE.test(String(email || '').trim());
}

function isPhoneFormatValid(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 10 && PHONE_RE.test(digits);
}

function isEmailDeliverable(classification) {
  const lower = String(classification || '').toLowerCase();
  return lower.includes('deliverable') && !lower.includes('undeliverable');
}

function isPhoneVerified(lineType) {
  const type = String(lineType || '').toUpperCase();
  if (!type || type === 'NOT AVAILABLE') return false;
  if (type.includes('INVALID')) return false;
  if (/(VOIP|TOLL.?FREE|PREMIUM|SHARED)/i.test(type) && !/MOBILE|LANDLINE|FIXED/i.test(type)) {
    return false;
  }
  return true;
}

/**
 * A. Purchase Intent — max 20
 */
export function scorePurchaseIntent(timeline) {
  const t = String(timeline || '').toLowerCase();
  if (!t.trim()) return { points: 0, label: 'Not selected' };
  if (
    /asap|as soon as possible|this month|immediately|ready now|0\s*[-–]\s*3|within 3|1\s*[-–]\s*3|next 3/.test(
      t,
    )
  ) {
    return { points: 20, label: '0–3 months' };
  }
  if (/3\s*[-–]\s*6|this year/.test(t) && !/6\s*[-–]\s*12/.test(t)) {
    return { points: 14, label: '3–6 months' };
  }
  if (/6\s*[-–]\s*12|next year/.test(t)) {
    return { points: 7, label: '6–12 months' };
  }
  if (/just research|just explor|exploring|not sure/.test(t)) {
    return { points: 3, label: 'Just researching' };
  }
  return { points: 3, label: 'Just researching' };
}

/**
 * B. Home Ownership + roof — max 15
 * Owns 10 | Renter w/ permission 7 | Renter 0 | + roof selected 5
 */
export function scoreOwnership(homeownerStatus, projectDetails = '', ownershipHint = null) {
  const status = String(homeownerStatus || '').toLowerCase();
  const details = String(projectDetails || '').toLowerCase();
  const hint = String(ownershipHint || '').toLowerCase();
  const combined = `${status} ${details} ${hint}`;

  let ownershipPoints = 0;
  let ownershipLabel = 'Unknown';

  if (/own|homeowner|yes,\s*i own/.test(combined) && !/rent/.test(combined)) {
    ownershipPoints = 10;
    ownershipLabel = 'Owns home';
  } else if (/permission|owner permission|with permission|property manager/.test(combined)) {
    ownershipPoints = 7;
    ownershipLabel = 'Renter with owner permission';
  } else if (/rent|renter/.test(combined)) {
    ownershipPoints = 0;
    ownershipLabel = 'Renter / no permission';
  } else if (/homeowner|own/.test(status)) {
    ownershipPoints = 10;
    ownershipLabel = 'Owns home';
  }

  const roofMatch = String(projectDetails || '').match(/Roof:\s*([^.]+)/i);
  const roofSelected = Boolean(roofMatch && roofMatch[1] && !/not sure/i.test(roofMatch[1]));
  const roofPoints = roofSelected ? 5 : 0;

  return {
    points: ownershipPoints + roofPoints,
    ownershipPoints,
    roofPoints,
    ownershipLabel,
    roofSelected,
    roofType: roofMatch ? roofMatch[1].trim() : null,
  };
}

/**
 * C. Electricity bill — max 15 (lead score)
 */
export function scoreElectricityBillLead(monthlyBill) {
  if (monthlyBill == null || monthlyBill === '') {
    return { points: 0, label: 'Not provided', bill: null };
  }
  const bill = Number(monthlyBill);
  if (!Number.isFinite(bill) || bill < 0) {
    return { points: 0, label: 'Not provided', bill: null };
  }
  if (bill >= 200) return { points: 15, label: '$200+', bill };
  if (bill >= 150) return { points: 13, label: '$150–199', bill };
  if (bill >= 100) return { points: 10, label: '$100–149', bill };
  if (bill >= 50) return { points: 6, label: '$50–99', bill };
  return { points: 3, label: '<$50', bill };
}

/**
 * D. Personal information — max 50
 * Valid email 15 / unvalidated 5 | Valid phone 15 / unvalidated 5
 * Name 5 | Address 10 | Residential or Commercial 5
 */
export function scorePersonalInfo({
  name,
  email,
  phone,
  address,
  propertyType,
  emailStatus,
  phoneType,
} = {}) {
  const emailProvided = Boolean(String(email || '').trim());
  const phoneProvided = Boolean(String(phone || '').replace(/\D/g, '').length >= 7);
  const emailFormatOk = isEmailFormatValid(email);
  const phoneFormatOk = isPhoneFormatValid(phone);
  const emailVerified = emailProvided && isEmailDeliverable(emailStatus);
  const phoneVerified = phoneProvided && isPhoneVerified(phoneType);

  let emailPoints = 0;
  if (emailVerified) emailPoints = 15;
  else if (emailFormatOk || emailProvided) emailPoints = 5;

  let phonePoints = 0;
  if (phoneVerified) phonePoints = 15;
  else if (phoneFormatOk || phoneProvided) phonePoints = 5;

  const namePoints = String(name || '').trim().length >= 2 ? 5 : 0;
  const addr = String(address || '').trim();
  const addressPoints = addr.length >= 8 && /\d/.test(addr) ? 10 : addr.length >= 5 ? 5 : 0;

  const type = String(propertyType || '').toLowerCase();
  const propertyTypePoints =
    /residential|commercial|business|homeowner|renter/.test(type) ||
    type === 'residential' ||
    type === 'commercial'
      ? 5
      : 0;

  const points =
    emailPoints + phonePoints + namePoints + addressPoints + propertyTypePoints;

  return {
    points: Math.min(50, points),
    emailPoints,
    phonePoints,
    namePoints,
    addressPoints,
    propertyTypePoints,
    emailVerified,
    phoneVerified,
    emailFormatOk,
    phoneFormatOk,
    emailValid: emailFormatOk,
    phoneValid: phoneFormatOk,
    contactValid: emailFormatOk && phoneFormatOk,
  };
}

/**
 * Homeowner Lead Score — 100 points
 */
export function computeLeadScore(input = {}) {
  const intent = scorePurchaseIntent(input.installationTimeline);
  const ownership = scoreOwnership(
    input.homeownerStatus,
    input.projectDetails,
    input.ownership,
  );
  const bill = scoreElectricityBillLead(input.monthlyBill);
  const personal = scorePersonalInfo(input);

  const overall = clampScore(
    intent.points + ownership.points + bill.points + personal.points,
  );
  const tier = leadScoreTier(overall);

  return {
    overall,
    tier: tier.label,
    tierKey: tier.key,
    sections: {
      purchaseIntent: { max: 20, ...intent },
      ownershipRoof: { max: 15, ...ownership },
      electricityBill: { max: 15, ...bill },
      personalInfo: { max: 50, ...personal },
    },
  };
}

/**
 * Solar Potential — Electricity usage max 20
 */
export function scoreElectricityUsageSolar(monthlyBill) {
  if (monthlyBill == null || monthlyBill === '') {
    return { points: 0, label: 'Not provided' };
  }
  const bill = Number(monthlyBill);
  if (!Number.isFinite(bill) || bill <= 0) return { points: 0, label: 'Not provided' };
  if (bill >= 200) return { points: 20, label: '$200+' };
  if (bill >= 150) return { points: 15, label: '$150–199' };
  if (bill >= 100) return { points: 10, label: '$100–149' };
  if (bill >= 50) return { points: 7, label: '$50–99' };
  return { points: 3, label: '<$50' };
}

/**
 * Usable roof area — max 20
 */
export function scoreUsableRoofArea({ usableRoofSqft, panelCount, estimatedRoofSqft } = {}) {
  const sqft = Number(usableRoofSqft ?? estimatedRoofSqft) || 0;
  const panels = Number(panelCount) || 0;

  let band = 'Unable to determine';
  let points = 0;

  if (sqft > 0 || panels > 0) {
    if (sqft >= 1800 || panels >= 36) {
      band = 'Very High';
      points = 20;
    } else if (sqft >= 1200 || panels >= 24) {
      band = 'High';
      points = 16;
    } else if (sqft >= 800 || panels >= 16) {
      band = 'Medium';
      points = 11;
    } else if (sqft >= 400 || panels >= 8) {
      band = 'Low';
      points = 6;
    } else {
      band = 'Very Low';
      points = 2;
    }
  }

  return {
    points,
    label: band,
    usableRoofSqft: sqft || null,
    panelCount: panels || null,
  };
}

/**
 * Sun exposure — max 15
 */
export function scoreSunExposure({
  maxSunshineHours,
  annualProductionKwh,
  systemKw,
  nrelCapacityFactor,
  coveragePct,
} = {}) {
  let hours = Number(maxSunshineHours) || 0;
  if (!hours && systemKw > 0 && annualProductionKwh > 0) {
    hours = annualProductionKwh / systemKw / 0.85;
  }

  const cf = Number(nrelCapacityFactor);
  if (!hours && Number.isFinite(cf) && cf > 0) {
    // Rough CF → annual sunshine hours proxy
    hours = cf * 8760 * 0.85;
  }

  if (hours >= 1800) return { points: 15, label: 'Excellent', hours };
  if (hours >= 1600) return { points: 13, label: 'Very Good', hours };
  if (hours >= 1400) return { points: 10, label: 'Good', hours };
  if (hours >= 1200) return { points: 6, label: 'Moderate', hours };
  if (hours > 0) return { points: 2, label: 'Poor', hours };

  const cov = Number(coveragePct);
  if (Number.isFinite(cov) && cov > 0) {
    if (cov >= 85) return { points: 15, label: 'Excellent', hours: null };
    if (cov >= 70) return { points: 13, label: 'Very Good', hours: null };
    if (cov >= 55) return { points: 10, label: 'Good', hours: null };
    if (cov >= 40) return { points: 6, label: 'Moderate', hours: null };
    return { points: 2, label: 'Poor', hours: null };
  }

  return { points: 0, label: 'Unable to determine', hours: null };
}

/**
 * Shading — max 10
 */
export function scoreShading(shadingLabel) {
  const s = String(shadingLabel || '').toLowerCase();
  if (!s || s === 'unknown') return { points: 0, label: 'Unable to determine', detail: shadingLabel || null };
  if (/minimal|none|no shade/.test(s)) return { points: 10, label: 'Minimal', detail: shadingLabel };
  if (/^low\b|low \(/.test(s)) return { points: 8, label: 'Low', detail: shadingLabel };
  if (/moderate/.test(s)) return { points: 5, label: 'Moderate', detail: shadingLabel };
  if (/high|significant/.test(s)) return { points: 2, label: 'High', detail: shadingLabel };
  if (/severe|heavy/.test(s)) return { points: 0, label: 'Severe', detail: shadingLabel };
  return { points: 5, label: 'Moderate', detail: shadingLabel };
}

/**
 * Existing solar — max 15
 */
export function scoreExistingSolar({
  existingSolarLikely,
  existingSolarStatus,
  projectDetails = '',
} = {}) {
  const details = String(projectDetails || '').toLowerCase();
  const status = String(existingSolarStatus || '').toLowerCase();

  if (
    existingSolarLikely === true ||
    /already have solar|existing solar|has solar|panels already|currently have solar/.test(details) ||
    /existing|present|yes/.test(status)
  ) {
    if (/expand|battery|upgrade|replace|addition/.test(`${details} ${status}`)) {
      return { points: 5, label: 'Solar installed — considering expansion', likely: true };
    }
    return { points: 5, label: 'Solar installed — considering expansion', likely: true };
  }

  if (
    existingSolarLikely === false ||
    /no solar|never had|interested in getting|want solar/.test(details) ||
    /none|no solar|absent/.test(status)
  ) {
    return { points: 15, label: 'No solar installed', likely: false };
  }

  // Explicit enrichment said no existing array
  if (existingSolarStatus != null && String(existingSolarStatus).trim() !== '') {
    return { points: 15, label: 'No solar installed', likely: false };
  }

  return { points: 0, label: 'Not provided', likely: false };
}

/**
 * Lead & property data verification — max 20 (installer solar score)
 */
export function scoreDataVerification({
  name,
  email,
  phone,
  address,
  emailStatus,
  phoneType,
  addressVerified = false,
} = {}) {
  const nameProvided = String(name || '').trim().length >= 2;
  const emailProvided = Boolean(String(email || '').trim());
  const phoneDigits = String(phone || '').replace(/\D/g, '');
  const phoneProvided = phoneDigits.length >= 7;
  const addr = String(address || '').trim();
  const addressProvided = addr.length >= 5;

  const emailVerified = emailProvided && isEmailDeliverable(emailStatus);
  const phoneVerified = phoneProvided && isPhoneVerified(phoneType);

  // Name "verified" is soft — treat as verified when contact was verified
  const nameScore = nameProvided ? (emailVerified || phoneVerified ? 3 : 1) : 0;
  const phonePoints = phoneVerified ? 5 : phoneProvided ? 2 : 0;
  const emailPoints = emailVerified ? 5 : emailProvided ? 1 : 0;
  const addressPoints = addressProvided ? (addressVerified ? 7 : 4) : 0;

  return {
    points: Math.min(20, nameScore + phonePoints + emailPoints + addressPoints),
    namePoints: nameScore,
    phonePoints,
    emailPoints,
    addressPoints,
    nameProvided,
    emailVerified,
    phoneVerified,
    addressVerified: Boolean(addressVerified),
    contactValid: isEmailFormatValid(email) && isPhoneFormatValid(phone),
    propertyValid: addressProvided,
  };
}

/**
 * Solar Potential Score — 100 points (installer side)
 */
export function computeSolarPotentialScore(input = {}) {
  const verification = scoreDataVerification(input);
  const roof = scoreUsableRoofArea(input);
  const sun = scoreSunExposure(input);
  const shading = scoreShading(input.shading);
  const usage = scoreElectricityUsageSolar(input.monthlyBill);
  const existing = scoreExistingSolar(input);

  const overall = clampScore(
    verification.points +
      roof.points +
      sun.points +
      shading.points +
      usage.points +
      existing.points,
  );

  let label = 'Low';
  if (overall >= 85) label = 'High';
  else if (overall >= 65) label = 'Moderate';
  else if (overall >= 45) label = 'Fair';

  return {
    overall,
    label,
    sections: {
      dataVerification: { max: 20, ...verification },
      usableRoofArea: { max: 20, ...roof },
      sunExposure: { max: 15, ...sun },
      shading: { max: 10, ...shading },
      electricityUsage: { max: 20, ...usage },
      existingSolar: { max: 15, ...existing },
    },
    existingSolarLikely: existing.likely,
  };
}

/**
 * Starting bid price from lead score (doc: score × 2).
 * Floors at settings.default_min_bid when provided.
 */
export function computeStartingBid(leadScore, settings = {}) {
  const score = clampScore(leadScore);
  const fromScore = score * BID_START_MULTIPLIER;
  const floor = Number(settings.default_min_bid);
  const minFloor = Number.isFinite(floor) && floor > 0 ? floor : 25;
  return Math.max(minFloor, fromScore);
}

/**
 * Build marketplace score_breakdown + validation checks for API/UI.
 */
function resolvePropertyType(leadInput = {}) {
  const propMatch = String(leadInput.projectDetails || '').match(
    /Property:\s*(Residential|Commercial)/i,
  );
  if (propMatch) return propMatch[1].toLowerCase();
  const explicit = String(leadInput.propertyType || '').toLowerCase();
  if (explicit === 'commercial' || explicit === 'residential') return explicit;
  const blob = `${leadInput.homeownerStatus || ''} ${leadInput.projectDetails || ''}`.toLowerCase();
  if (/commercial|business|warehouse|office/.test(blob)) return 'commercial';
  return 'residential';
}

export function buildScorePackage(leadInput, enrichment = {}) {
  const resolvedType = resolvePropertyType(leadInput);

  const addressVerified = Boolean(
    enrichment.googleSolarHit ||
      enrichment.lat != null ||
      (enrichment.coordSource && enrichment.coordSource !== 'none'),
  );

  const leadScore = computeLeadScore({
    ...leadInput,
    propertyType: resolvedType,
  });

  const solarScore = computeSolarPotentialScore({
    ...leadInput,
    propertyType: resolvedType,
    emailStatus: leadInput.emailStatus,
    phoneType: leadInput.phoneType,
    addressVerified,
    usableRoofSqft: enrichment.usableRoofSqft,
    estimatedRoofSqft: enrichment.usableRoofSqft || leadInput.estimatedRoofSqft,
    panelCount: enrichment.panelCount,
    maxSunshineHours: enrichment.maxSunshineHours,
    annualProductionKwh: enrichment.annualProductionKwh,
    systemKw: enrichment.systemKw,
    nrelCapacityFactor: enrichment.nrelCapacityFactor,
    coveragePct: enrichment.coveragePct,
    shading: enrichment.shading,
    existingSolarLikely: enrichment.existingSolarLikely,
    existingSolarStatus: enrichment.existingSolarStatus,
  });

  const estimatedSolarKw =
    enrichment.systemKw ??
    (leadInput.monthlyBill > 0
      ? Math.round((Number(leadInput.monthlyBill) / 120) * 10) / 10
      : null);
  const estimatedRoofSqft =
    enrichment.usableRoofSqft ??
    (estimatedSolarKw ? Math.round(estimatedSolarKw * 80) : null);

  const breakdown = {
    version: 2,
    model: 'lead_scoring_docx',
    leadScore: leadScore.overall,
    leadScoreTier: leadScore.tier,
    solarPotentialScore: solarScore.overall,
    solarPotentialLabel: solarScore.label,
    propertyType: resolvedType,
    contactValid: leadScore.sections.personalInfo.contactValid,
    propertyValid: solarScore.sections.dataVerification.propertyValid,
    existingSolarLikely: solarScore.existingSolarLikely,
    // Legacy keys for older UI
    contactValidity: Math.round((leadScore.sections.personalInfo.points / 50) * 100),
    propertyValidity: Math.round((solarScore.sections.dataVerification.points / 20) * 100),
    residentialCommercial: resolvedType === 'commercial' ? 55 : 85,
    existingSolar: Math.round((solarScore.sections.existingSolar.points / 15) * 100),
    solarPotential: solarScore.overall,
    buyingIntent: Math.round((leadScore.sections.purchaseIntent.points / 20) * 100),
    sections: {
      lead: leadScore.sections,
      solar: solarScore.sections,
    },
    validationChecks: [
      {
        key: 'purchaseIntent',
        label: 'Purchase intent',
        score: leadScore.sections.purchaseIntent.points,
        max: 20,
        passed: leadScore.sections.purchaseIntent.points >= 7,
        detail: leadScore.sections.purchaseIntent.label,
      },
      {
        key: 'ownershipRoof',
        label: 'Ownership & roof',
        score: leadScore.sections.ownershipRoof.points,
        max: 15,
        passed: leadScore.sections.ownershipRoof.ownershipPoints > 0,
        detail: `${leadScore.sections.ownershipRoof.ownershipLabel}${
          leadScore.sections.ownershipRoof.roofSelected ? ' · Roof selected' : ''
        }`,
      },
      {
        key: 'electricityBill',
        label: 'Electricity bill',
        score: leadScore.sections.electricityBill.points,
        max: 15,
        passed: leadScore.sections.electricityBill.points > 0,
        detail: leadScore.sections.electricityBill.label,
      },
      {
        key: 'personalInfo',
        label: 'Personal information',
        score: leadScore.sections.personalInfo.points,
        max: 50,
        passed: leadScore.sections.personalInfo.contactValid,
        detail: 'Name, contact, address, and property type',
      },
      {
        key: 'solarPotential',
        label: 'Solar potential',
        score: solarScore.overall,
        max: 100,
        passed: solarScore.overall >= 45,
        detail: solarScore.label,
      },
      {
        key: 'existingSolar',
        label: 'Existing solar',
        score: solarScore.sections.existingSolar.points,
        max: 15,
        passed: !solarScore.existingSolarLikely,
        detail: solarScore.sections.existingSolar.label,
      },
    ],
  };

  const validationChecks = breakdown.validationChecks;

  return {
    leadScore: leadScore.overall,
    leadScoreTier: leadScore.tier,
    solarPotentialScore: solarScore.overall,
    solarPotentialLabel: solarScore.label,
    propertyType: resolvedType,
    breakdown,
    validationChecks,
    estimatedSolarKw,
    estimatedRoofSqft,
    existingSolarLikely: solarScore.existingSolarLikely,
    contactValid: leadScore.sections.personalInfo.contactValid,
    propertyValid: solarScore.sections.dataVerification.propertyValid,
  };
}
