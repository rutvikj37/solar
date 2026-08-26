import test from 'node:test';
import assert from 'node:assert/strict';
import { formatInquiryResponse } from '../services/marketplace/qualifyLead.js';

test('formatInquiryResponse includes dual scores and validation checks', () => {
  const response = formatInquiryResponse({
    lead_code: 'SX-ABC',
    status: 'bidding',
    opportunity_score: 92,
    solar_potential_score: 81,
    property_type: 'residential',
    solar_potential_label: 'High',
    bill_range: '$200–$300',
    installation_timeline: '0–3 months',
    score_breakdown: JSON.stringify({
      version: 2,
      model: 'lead_scoring_docx',
      leadScore: 92,
      leadScoreTier: 'Hot',
      solarPotentialScore: 81,
      solarPotentialLabel: 'High',
      contactValidity: 80,
      propertyValidity: 90,
      residentialCommercial: 85,
      existingSolar: 100,
      solarPotential: 81,
      buyingIntent: 100,
      contactValid: true,
      propertyValid: true,
      existingSolarLikely: false,
      propertyType: 'residential',
      sections: {
        lead: {
          purchaseIntent: { points: 20, label: '0–3 months' },
          ownershipRoof: { points: 15, ownershipLabel: 'Owns home' },
          electricityBill: { points: 15, label: '$200+' },
          personalInfo: { points: 42, contactValid: true },
        },
        solar: {
          existingSolar: { points: 15, label: 'No solar installed' },
        },
      },
      validationChecks: [
        { key: 'purchaseIntent', label: 'Purchase intent', score: 20, max: 20, passed: true },
        { key: 'ownershipRoof', label: 'Ownership & roof', score: 15, max: 15, passed: true },
        { key: 'electricityBill', label: 'Electricity bill', score: 15, max: 15, passed: true },
        { key: 'personalInfo', label: 'Personal information', score: 42, max: 50, passed: true },
        { key: 'solarPotential', label: 'Solar potential', score: 81, max: 100, passed: true },
        { key: 'existingSolar', label: 'Existing solar', score: 15, max: 15, passed: true },
      ],
    }),
    enrichment_json: JSON.stringify({ googleSolarHit: false }),
  });

  assert.equal(response.opportunityScore, 92);
  assert.equal(response.leadScore, 92);
  assert.equal(response.solarPotentialScore, 81);
  assert.equal(response.listedInMarketplace, true);
  assert.ok(Array.isArray(response.validationChecks));
  assert.equal(response.validationChecks.length, 6);
  assert.equal(response.scoreBreakdown.solarPotential, 81);
  assert.equal(response.leadScoreTier, 'Hot');
});

test('formatInquiryResponse marks ai_qualified leads as not listed', () => {
  const response = formatInquiryResponse({
    lead_code: 'SX-FAIL',
    status: 'ai_qualified',
    opportunity_score: 40,
    score_breakdown: JSON.stringify({ contactValid: false }),
  });
  assert.equal(response.listedInMarketplace, false);
});
