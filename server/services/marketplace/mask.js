/**
 * Masked marketplace opportunity shape — never expose homeowner PII.
 */

import { applyResolvedBiddingTimes } from './bidWindow.js';
import { isEarlyMarketplaceWindow } from './constants.js';

export function maskOpportunity(row, { ownBid = null, allActiveAmounts = [], settings = {}, earlyAccessViewer = false } = {}) {
  if (!row) return null;

  applyResolvedBiddingTimes(row, settings);
  const strength = computeBidStrength(ownBid?.amount, allActiveAmounts);
  const earlyAccess = isEarlyMarketplaceWindow(row);

  return {
    id: row.id,
    leadCode: row.lead_code,
    status: row.status,
    zip: row.zip || null,
    city: row.city || null,
    state: row.state || null,
    locationLabel: [row.city, row.state, row.zip].filter(Boolean).join(', ') || row.zip || 'Location masked',
    propertyType: row.property_type || 'residential',
    estimatedRoofSqft: row.estimated_roof_sqft != null ? Number(row.estimated_roof_sqft) : null,
    estimatedSolarKw: row.estimated_solar_kw != null ? Number(row.estimated_solar_kw) : null,
    solarPotentialLabel: row.solar_potential_label || null,
    electricityBillRange: row.bill_range || null,
    installationTimeline: row.installation_timeline || null,
    opportunityScore: Number(row.opportunity_score) || 0,
    leadScore: Number(row.opportunity_score) || 0,
    solarPotentialScore:
      row.solar_potential_score != null
        ? Number(row.solar_potential_score)
        : Number(safeJson(row.score_breakdown)?.solarPotentialScore) || 0,
    leadScoreTier: safeJson(row.score_breakdown)?.leadScoreTier || null,
    scoreBreakdown: safeJson(row.score_breakdown),
    biddingOpensAt: row.bidding_opens_at,
    biddingClosesAt: row.bidding_closes_at,
    minBid: Number(row.min_bid) || 0,
    expansionStage: Number(row.expansion_stage) || 0,
    createdAt: row.created_at,
    earlyAccess,
    earlyAccessExclusive: earlyAccess && earlyAccessViewer,
    ownBid: ownBid
      ? {
          id: ownBid.id,
          amount: Number(ownBid.amount),
          status: ownBid.status,
          strength,
          createdAt: ownBid.created_at,
        }
      : null,
    bidStrength: strength,
  };
}

export function unlockOpportunity(row, settings = {}) {
  if (!row) return null;
  applyResolvedBiddingTimes(row, settings);
  return {
    id: row.id,
    leadCode: row.lead_code,
    status: row.status,
    homeownerName: row.homeowner_name,
    phone: row.phone,
    email: row.email,
    emailStatus: row.email_status,
    phoneType: row.phone_type,
    address: row.address,
    zip: row.zip,
    city: row.city,
    state: row.state,
    propertyType: row.property_type,
    monthlyBill: row.monthly_bill != null ? Number(row.monthly_bill) : null,
    billRange: row.bill_range,
    homeownerStatus: row.homeowner_status,
    installationTimeline: row.installation_timeline,
    projectDetails: row.project_details,
    estimatedRoofSqft: row.estimated_roof_sqft != null ? Number(row.estimated_roof_sqft) : null,
    estimatedSolarKw: row.estimated_solar_kw != null ? Number(row.estimated_solar_kw) : null,
    solarPotentialLabel: row.solar_potential_label,
    opportunityScore: Number(row.opportunity_score) || 0,
    leadScore: Number(row.opportunity_score) || 0,
    solarPotentialScore:
      row.solar_potential_score != null
        ? Number(row.solar_potential_score)
        : Number(safeJson(row.score_breakdown)?.solarPotentialScore) || 0,
    leadScoreTier: safeJson(row.score_breakdown)?.leadScoreTier || null,
    scoreBreakdown: safeJson(row.score_breakdown),
    enrichment: safeJson(row.enrichment_json),
    minBid: row.min_bid != null ? Number(row.min_bid) : null,
    biddingOpensAt: row.bidding_opens_at,
    biddingClosesAt: row.bidding_closes_at,
    winningAmount: row.winning_amount != null ? Number(row.winning_amount) : null,
    winnerUserId: row.winner_user_id,
    unlockedAt: row.unlocked_at,
    paymentDueAt: row.payment_due_at || null,
    crmLeadId: row.crm_lead_id,
    expansionStage: row.expansion_stage,
    createdAt: row.created_at,
  };
}

export function computeBidStrength(ownAmount, allAmounts = []) {
  if (ownAmount == null || !Number.isFinite(Number(ownAmount))) return null;
  const amounts = (allAmounts || []).map(Number).filter((n) => Number.isFinite(n));
  if (amounts.length === 0) return 'Leading';
  const max = Math.max(...amounts);
  const own = Number(ownAmount);
  if (own >= max) return 'Leading';
  if (own >= max * 0.85) return 'Competitive';
  return 'Behind';
}

function safeJson(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
