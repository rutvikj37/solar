import test from 'node:test';
import assert from 'node:assert/strict';
import { formatInquiryResponse } from '../services/marketplace/qualifyLead.js';

test('formatInquiryResponse includes score breakdown and validation checks', () => {
  const response = formatInquiryResponse({
    lead_code: 'SX-ABC',
    status: 'bidding',
    opportunity_score: 92,
    property_type: 'residential',
    solar_potential_label: 'High',
    bill_range: '$200–$300',
    installation_timeline: 'ASAP',
    score_breakdown: JSON.stringify({
      contactValidity: 100,
      propertyValidity: 80,
      residentialCommercial: 85,
      existingSolar: 90,
      solarPotential: 95,
      buyingIntent: 80,
      contactValid: true,
      propertyValid: true,
      existingSolarLikely: false,
      propertyType: 'residential',
    }),
    enrichment_json: JSON.stringify({ googleSolarHit: false }),
  });

  assert.equal(response.opportunityScore, 92);
  assert.equal(response.listedInMarketplace, true);
  assert.ok(Array.isArray(response.validationChecks));
  assert.equal(response.validationChecks.length, 6);
  assert.equal(response.scoreBreakdown.solarPotential, 95);
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
