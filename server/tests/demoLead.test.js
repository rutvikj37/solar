import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isDemoMarketplaceLead,
  MARKETPLACE_DEMO_TAG,
} from '../services/marketplace/demoLead.js';

test('isDemoMarketplaceLead detects demo email', () => {
  assert.equal(
    isDemoMarketplaceLead({ email: 'maria.santos.demo@example.com' }),
    true,
  );
});

test('isDemoMarketplaceLead detects enrichment tag', () => {
  assert.equal(
    isDemoMarketplaceLead({
      email: 'real@home.com',
      enrichment_json: JSON.stringify({ demo: MARKETPLACE_DEMO_TAG }),
    }),
    true,
  );
});

test('isDemoMarketplaceLead allows real inquiries', () => {
  assert.equal(
    isDemoMarketplaceLead({
      email: 'homeowner@gmail.com',
      enrichment_json: JSON.stringify({ enriched: true, lat: 33.4 }),
      score_breakdown: JSON.stringify({ contactValidity: 100 }),
    }),
    false,
  );
});
