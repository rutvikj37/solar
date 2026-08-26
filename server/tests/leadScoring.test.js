import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildScorePackage,
  computeLeadScore,
  computeSolarPotentialScore,
  computeStartingBid,
  scorePurchaseIntent,
  leadScoreTier,
} from '../services/marketplace/leadScoring.js';

test('purchase intent maps timeline bands to doc points', () => {
  assert.equal(scorePurchaseIntent('0–3 months').points, 20);
  assert.equal(scorePurchaseIntent('As soon as possible').points, 20);
  assert.equal(scorePurchaseIntent('3–6 months').points, 14);
  assert.equal(scorePurchaseIntent('6–12 months').points, 7);
  assert.equal(scorePurchaseIntent('Just researching').points, 3);
  assert.equal(scorePurchaseIntent('').points, 0);
});

test('lead score tiers match doc thresholds', () => {
  assert.equal(leadScoreTier(95).label, 'Hot');
  assert.equal(leadScoreTier(80).label, 'Strong');
  assert.equal(leadScoreTier(60).label, 'Moderate');
  assert.equal(leadScoreTier(40).label, 'Early-stage');
});

test('homeowner lead score uses doc section caps', () => {
  const scored = computeLeadScore({
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+1 5551234567',
    address: '123 Main St, Austin TX 78701',
    monthlyBill: 220,
    homeownerStatus: 'Homeowner',
    installationTimeline: '0–3 months',
    projectDetails: 'Roof: Asphalt Shingle. Property: Residential.',
    propertyType: 'residential',
  });

  assert.equal(scored.sections.purchaseIntent.points, 20);
  assert.equal(scored.sections.ownershipRoof.points, 15); // 10 own + 5 roof
  assert.equal(scored.sections.electricityBill.points, 15);
  assert.ok(scored.sections.personalInfo.points >= 30);
  assert.ok(scored.overall <= 100);
  assert.ok(scored.overall >= 80);
});

test('starting bid is lead score × 2', () => {
  assert.equal(computeStartingBid(90, { default_min_bid: 25 }), 180);
  assert.equal(computeStartingBid(10, { default_min_bid: 25 }), 25);
});

test('solar potential scores roof, bill, and existing solar', () => {
  const solar = computeSolarPotentialScore({
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+15551234567',
    address: '123 Main St Austin TX 78701',
    monthlyBill: 220,
    addressVerified: true,
    usableRoofSqft: 1420,
    panelCount: 26,
    maxSunshineHours: 1700,
    shading: 'Minimal (12%)',
    existingSolarLikely: false,
    existingSolarStatus: 'none',
  });

  assert.equal(solar.sections.electricityUsage.points, 20);
  assert.equal(solar.sections.usableRoofArea.points, 16);
  assert.equal(solar.sections.existingSolar.points, 15);
  assert.equal(solar.sections.shading.points, 10);
  assert.ok(solar.overall >= 70);
});

test('buildScorePackage returns dual scores and six validation checks', () => {
  const pkg = buildScorePackage(
    {
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '5551234567',
      address: '500 Congress Ave, Austin, TX 78701',
      monthlyBill: 180,
      homeownerStatus: 'Homeowner',
      installationTimeline: '3–6 months',
      projectDetails: 'Roof: Metal. Property: Residential.',
    },
    { googleSolarHit: true, lat: 30.2, lng: -97.7, usableRoofSqft: 1100, panelCount: 20 },
  );

  assert.ok(pkg.leadScore > 0);
  assert.ok(pkg.solarPotentialScore > 0);
  assert.equal(pkg.validationChecks.length, 6);
  assert.equal(pkg.breakdown.model, 'lead_scoring_docx');
});
