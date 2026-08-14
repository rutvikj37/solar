import test from 'node:test';
import assert from 'node:assert/strict';
import {
  streetAddressKey,
  isSameStreetProperty,
  assertAddressMatchesSearch,
  looksLikeStreetAddress,
} from '../services/coordinateService.js';

test('looksLikeStreetAddress detects street queries', () => {
  assert.equal(looksLikeStreetAddress('4 Chamberlin Ct, Lawrence Twp, NJ 08648'), true);
  assert.equal(looksLikeStreetAddress('08648'), false);
  assert.equal(looksLikeStreetAddress('Lawrence Township'), false);
});

test('streetAddressKey normalizes court/lane suffixes', () => {
  assert.deepEqual(streetAddressKey('4 Chamberlin Ct, Lawrence Twp, NJ 08648'), {
    number: '4',
    street: 'chamberlin ct',
  });
  assert.deepEqual(streetAddressKey('4 Chamberlin Court, Trenton, NJ 08648, USA'), {
    number: '4',
    street: 'chamberlin ct',
  });
  assert.deepEqual(streetAddressKey('2 Fountayne Ln, Lawrence Township, NJ 08648'), {
    number: '2',
    street: 'fountayne ln',
  });
});

test('Chamberlin regression: neighbor Fountayne must not match', () => {
  const searched = '4 Chamberlin Ct, Lawrence Twp, NJ 08648';
  const wrong = '2 Fountayne Ln, Lawrence Township, NJ 08648';
  const right = '4 Chamberlin Ct, Lawrence Township, NJ 08648';

  assert.equal(isSameStreetProperty(searched, wrong), false);
  assert.equal(isSameStreetProperty(searched, right), true);

  const bad = assertAddressMatchesSearch(searched, wrong);
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'street_mismatch');

  const good = assertAddressMatchesSearch(searched, right);
  assert.equal(good.ok, true);
});

test('same number different street rejected', () => {
  assert.equal(
    isSameStreetProperty('10 Main St, Austin, TX', '10 Oak Ave, Austin, TX'),
    false
  );
});

test('different number same street rejected', () => {
  assert.equal(
    isSameStreetProperty('4 Chamberlin Ct', '48 Chamberlin Ct, Lawrence Township, NJ'),
    false
  );
});
