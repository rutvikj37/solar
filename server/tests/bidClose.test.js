import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseExpansionRadii,
  resolveExpansionRadius,
  computeReducedMinBid,
} from '../services/marketplace/bidClose.js';

test('parseExpansionRadii parses JSON array string', () => {
  assert.deepEqual(parseExpansionRadii('[25,50,100]'), [25, 50, 100]);
});

test('resolveExpansionRadius uses stage index', () => {
  const settings = { expansion_radius_miles_json: '[25,50,100]' };
  assert.equal(resolveExpansionRadius(settings, 1), 25);
  assert.equal(resolveExpansionRadius(settings, 2), 50);
  assert.equal(resolveExpansionRadius(settings, 3), 100);
});

test('computeReducedMinBid respects low price floor', () => {
  const settings = { default_min_bid: 25, low_price_min_bid: 10, min_bid_reduction_pct: 20 };
  assert.equal(computeReducedMinBid(25, settings, 1), 25);
  assert.equal(computeReducedMinBid(25, settings, 3), 16);
  assert.ok(computeReducedMinBid(12, settings, 4) >= 10);
});
