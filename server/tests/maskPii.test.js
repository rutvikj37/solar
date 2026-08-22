import test from 'node:test';
import assert from 'node:assert/strict';
import { maskOpportunity } from '../services/marketplace/mask.js';

test('maskOpportunity never exposes homeowner PII fields', () => {
  const masked = maskOpportunity({
    id: 1,
    lead_code: 'SX-TEST',
    status: 'bidding',
    zip: '85001',
    city: 'Phoenix',
    state: 'AZ',
    homeowner_name: 'Jane Doe',
    phone: '5551234567',
    email: 'jane@example.com',
    address: '123 Main St',
    property_type: 'residential',
    opportunity_score: 88,
    min_bid: 25,
    expansion_stage: 0,
    created_at: new Date().toISOString(),
  });

  const json = JSON.stringify(masked);
  assert.equal(masked.homeownerName, undefined);
  assert.equal(masked.phone, undefined);
  assert.equal(masked.email, undefined);
  assert.equal(masked.address, undefined);
  assert.ok(!json.includes('jane@example.com'));
  assert.ok(!json.includes('5551234567'));
  assert.ok(!json.includes('Jane Doe'));
  assert.equal(masked.opportunityScore, 88);
});

test('maskOpportunity includes score breakdown when present', () => {
  const masked = maskOpportunity({
    id: 2,
    lead_code: 'SX-TEST2',
    status: 'bidding',
    score_breakdown: JSON.stringify({ contactValidity: 100, solarPotential: 85 }),
    opportunity_score: 90,
    min_bid: 25,
    created_at: new Date().toISOString(),
  });
  assert.equal(masked.scoreBreakdown.contactValidity, 100);
});
