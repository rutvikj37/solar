import test from 'node:test';
import assert from 'node:assert/strict';
import { areaMatchesLead } from '../services/marketplace/eligibility.js';

test('areaMatchesLead matches state-wide installer row to lead state from address', () => {
  const lead = {
    address: '123 Main St, Phoenix, AZ 85001',
    zip: '85001',
    state: null,
    expansion_stage: 0,
  };
  const area = { zip: '', state: 'AZ', radius_miles: 100 };
  assert.equal(areaMatchesLead(area, lead), true);
});

test('areaMatchesLead matches ZIP prefix within same metro', () => {
  const lead = {
    address: '456 Oak Ave, Tempe, AZ 85281',
    zip: '85281',
    state: 'AZ',
    expansion_stage: 0,
  };
  const area = { zip: '85283', state: 'AZ', radius_miles: 30 };
  assert.equal(areaMatchesLead(area, lead), true);
});

test('areaMatchesLead rejects different states', () => {
  const lead = {
    address: '789 Pine Rd, Los Angeles, CA 90026',
    zip: '90026',
    state: 'CA',
    expansion_stage: 0,
  };
  const area = { zip: '', state: 'AZ', radius_miles: 100 };
  assert.equal(areaMatchesLead(area, lead), false);
});
