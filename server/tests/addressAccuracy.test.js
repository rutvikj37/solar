import test from 'node:test';
import assert from 'node:assert/strict';
import {
  streetAddressKey,
  isSameStreetProperty,
  assertAddressMatchesSearch,
  looksLikeStreetAddress,
  pickAddressSearchPinCoords,
  buildCoordinatePropertyId,
  parseCoordinatePropertyId,
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
  assert.equal(
    isSameStreetProperty('1308 Johnson Cir, Bridgewater, NJ 08807', '2308 Johnson Cir, Bridgewater, NJ 08807'),
    false
  );
});

test('pickAddressSearchPinCoords prefers geocode over neighbor-snapped solar', () => {
  const query = '1308 Johnson Cir, Bridgewater, NJ 08807, USA';
  const geocoded = {
    lat: 40.58647,
    lng: -74.66944,
    source: 'geocode',
    locationType: 'ROOFTOP',
    formattedAddress: '1308 Johnson Cir, Bridgewater, NJ 08807, USA',
    rank: 2,
  };
  // Solar snapped ~45m away to neighbor 2308 (typical same-street spacing).
  const solarCenter = {
    lat: 40.58687,
    lng: -74.66910,
    source: 'google_solar',
    rank: 1,
  };
  const wrongAutocomplete = {
    lat: 40.58687,
    lng: -74.66910,
    source: 'provided',
    rank: 5,
  };

  const picked = pickAddressSearchPinCoords({
    query,
    geocoded,
    solarCenter,
    provided: wrongAutocomplete,
  });

  assert.ok(picked);
  assert.equal(picked.source, 'geocode');
  assert.equal(picked.lat, geocoded.lat);
  assert.equal(picked.lng, geocoded.lng);
  assert.match(picked.formattedAddress, /^1308 /);
});

test('coordinate property ids round-trip embedded address', () => {
  const id = buildCoordinatePropertyId(40.58647, -74.66944, '1308 Johnson Cir, Bridgewater, NJ 08807');
  const parsed = parseCoordinatePropertyId(id);
  assert.ok(parsed);
  assert.equal(parsed.lat, 40.58647);
  assert.equal(parsed.lng, -74.66944);
  assert.equal(parsed.address, '1308 Johnson Cir, Bridgewater, NJ 08807');
});
