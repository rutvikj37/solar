/**
 * Homeowner report estimates — shared logic for web + PDF (illustrative only).
 * Prefers Google Solar enrichment when available.
 */

function isGoogleSolarEnriched(data = {}) {
  const solar = data.solarReport || {};
  return (
    data.googleSolarHit === true ||
    data.enrichmentSource === 'google_solar' ||
    (solar.systemKw != null && solar.annualProductionKwh != null)
  );
}

export function buildSolarReportEstimates(data = {}) {
  const bill = Math.max(50, Number(data.monthlyBill) || 250);
  const annualBill = bill * 12;
  const solar = data.solarReport || {};
  const googleSolarHit = isGoogleSolarEnriched(data);

  let ratePerKwh = 0.16;
  let annualUsageKwh = Math.round((annualBill / ratePerKwh) * 0.95);
  let systemKw;
  let panelCount;
  let sunHours = 1450;
  let annualProduction;
  let coveragePct;
  let year1Savings;
  let year5Savings;
  let year10Savings;
  let year25Savings;
  let estSolarPayment;
  let co2TonsYear;
  let co2Tons25;
  let treesEquiv;
  let milesOffset;

  if (googleSolarHit && solar.systemKw != null) {
    ratePerKwh = Number(solar.ratePerKwh) || 0.16;
    annualUsageKwh = bill > 0 ? Math.round((annualBill / ratePerKwh) * 0.95) : 0;
    systemKw = Number(solar.systemKw);
    panelCount = solar.panelCount ?? Math.max(8, Math.round(systemKw / 0.42));
    annualProduction =
      solar.annualProductionKwh ?? Math.round(systemKw * sunHours * 0.85);
    coveragePct =
      solar.coveragePct ??
      Math.min(
        98,
        Math.max(35, Math.round((annualProduction / Math.max(annualUsageKwh, 1)) * 100)),
      );
    year1Savings = solar.year1Savings ?? Math.round(Math.min(annualBill, annualProduction * ratePerKwh));
    year5Savings = solar.year5Savings ?? Math.round(year1Savings * 4.6);
    year10Savings = solar.year10Savings ?? Math.round(year1Savings * 9.2);
    year25Savings = solar.year25Savings ?? Math.round(annualProduction * ratePerKwh * 25);
    estSolarPayment = solar.estSolarPayment ?? Math.round(Math.max(0, bill - year1Savings / 12));
    co2TonsYear = Math.round(((annualProduction * 0.92) / 1000) * 10) / 10;
    co2Tons25 = solar.co2Tons25 ?? Math.round(co2TonsYear * 23 * 10) / 10;
    treesEquiv = solar.treesEquiv ?? Math.round(co2TonsYear * 16);
    milesOffset = solar.milesOffset ?? Math.round(annualProduction * 0.92 * 2.1);
    if (systemKw > 0 && annualProduction > 0) {
      sunHours = Math.round(annualProduction / systemKw / 0.85);
    }
  } else {
    const systemKwRaw =
      data.estimatedSolarKw != null
        ? Number(data.estimatedSolarKw)
        : Math.round((bill / 120) * 10) / 10;
    systemKw = Math.max(3.5, systemKwRaw);
    panelCount = Math.max(8, Math.round(systemKw / 0.42));
    annualProduction = Math.round(systemKw * sunHours * 0.85);
    coveragePct = Math.min(
      98,
      Math.max(35, Math.round((annualProduction / Math.max(annualUsageKwh, 1)) * 100)),
    );
    year1Savings = Math.round(annualBill * 0.82);
    year5Savings = Math.round(year1Savings * 4.6);
    year10Savings = Math.round(year1Savings * 9.2);
    year25Savings = Math.round(year1Savings * 21);
    estSolarPayment = Math.round(bill * 0.58);
    co2TonsYear = Math.round(((annualProduction * 0.92) / 1000) * 10) / 10;
    co2Tons25 = Math.round(co2TonsYear * 23 * 10) / 10;
    treesEquiv = Math.round(co2TonsYear * 16);
    milesOffset = Math.round(annualProduction * 0.92 * 2.1);
  }

  const bill2036 = Math.round(bill * 1.034 ** 10);
  const bill2051 = Math.round(bill * 1.034 ** 25);

  const opportunityScore =
    data.opportunityScore != null
      ? Number(data.opportunityScore)
      : data.leadScore != null
        ? Number(data.leadScore)
        : Math.min(95, Math.max(52, 60 + Math.floor(bill / 15)));

  const leadScoreTier =
    data.leadScoreTier ||
    (opportunityScore >= 90
      ? 'Hot'
      : opportunityScore >= 75
        ? 'Strong'
        : opportunityScore >= 55
          ? 'Moderate'
          : 'Early-stage');

  const fitLabel =
    opportunityScore >= 90
      ? 'Hot'
      : opportunityScore >= 75
        ? 'Strong'
        : opportunityScore >= 55
          ? 'Moderate'
          : 'Early-stage';

  return {
    bill,
    annualBill,
    ratePerKwh,
    annualUsageKwh,
    systemKw: Number(systemKw).toFixed(1),
    panelCount,
    sunHours,
    annualProduction,
    coveragePct,
    kwhPerPanel: Math.round(annualProduction / Math.max(panelCount, 1)),
    year1Savings,
    year5Savings,
    year10Savings,
    year25Savings,
    bill2036,
    bill2051,
    estSolarPayment,
    co2TonsYear,
    co2Tons25,
    treesEquiv,
    milesOffset,
    opportunityScore,
    leadScore: opportunityScore,
    leadScoreTier,
    solarPotentialScore:
      data.solarPotentialScore != null ? Number(data.solarPotentialScore) : null,
    fitLabel,
    googleSolarHit,
    productionSource: solar.productionSource || (googleSolarHit ? 'Google Solar API' : 'estimated'),
    orientation: solar.orientation || null,
    pitch: solar.pitch || null,
    shading: solar.shading || null,
    imageryDate: solar.imageryDate || null,
    imageryQuality: solar.imageryQuality || null,
  };
}

export function mapValidationToFitRows(validationChecks = [], estimates) {
  const byKey = Object.fromEntries(validationChecks.map((c) => [c.key, c]));

  const rows = [
    {
      label: 'Purchase intent',
      score: byKey.purchaseIntent?.score ?? byKey.buyingIntent?.score ?? 0,
      max: byKey.purchaseIntent?.max ?? 20,
      detail: byKey.purchaseIntent?.detail || 'How soon they want solar.',
    },
    {
      label: 'Ownership & roof',
      score: byKey.ownershipRoof?.score ?? 0,
      max: byKey.ownershipRoof?.max ?? 15,
      detail: byKey.ownershipRoof?.detail || 'Home ownership and roof type.',
    },
    {
      label: 'Electricity bill',
      score: byKey.electricityBill?.score ?? Math.min(15, Math.round(estimates.bill / 20)),
      max: byKey.electricityBill?.max ?? 15,
      detail: `$${estimates.bill}/mo · Higher usage improves solar economics.`,
    },
    {
      label: 'Personal information',
      score: byKey.personalInfo?.score ?? byKey.contactValidity?.score ?? 0,
      max: byKey.personalInfo?.max ?? 50,
      detail: byKey.personalInfo?.detail || 'Name, contact, address, and property type.',
    },
  ];

  const hasNewKeys = Boolean(
    byKey.purchaseIntent || byKey.ownershipRoof || byKey.personalInfo || byKey.electricityBill,
  );
  if (!hasNewKeys && validationChecks.length) {
    const legacy = [
      {
        label: 'Monthly electricity bill',
        score: byKey.solarPotential?.score ?? estimates.opportunityScore * 0.15,
        max: 15,
        detail: `$${estimates.bill}/mo · Higher usage improves solar economics.`,
      },
      {
        label: 'Solar coverage potential',
        score: Math.round((estimates.coveragePct / 100) * 15),
        max: 15,
        detail: `${estimates.coveragePct}% of estimated demand · Based on system size vs usage.`,
      },
      {
        label: 'Roof & property check',
        score: byKey.propertyValidity?.score ? Math.round(byKey.propertyValidity.score * 0.1) : 8,
        max: 10,
        detail: byKey.propertyValidity?.detail || 'Address and property details validated.',
      },
      {
        label: 'Contact & intent',
        score: Math.round(
          ((byKey.contactValidity?.score || 70) + (byKey.buyingIntent?.score || 60)) / 13,
        ),
        max: 10,
        detail: byKey.buyingIntent?.detail || 'Timeline and contact details reviewed.',
      },
      {
        label: 'Existing solar check',
        score: byKey.existingSolar?.passed ? 10 : 2,
        max: 10,
        detail: byKey.existingSolar?.detail || 'No existing system flagged.',
      },
      {
        label: 'Property type fit',
        score: byKey.residentialCommercial?.score
          ? Math.round(byKey.residentialCommercial.score * 0.05)
          : 5,
        max: 5,
        detail: byKey.residentialCommercial?.detail || 'Residential property profile.',
      },
    ];
    return {
      rows: legacy,
      earned: legacy.reduce((sum, r) => sum + Math.min(r.max, r.score), 0),
      maxTotal: legacy.reduce((sum, r) => sum + r.max, 0),
    };
  }

  const earned = rows.reduce((sum, r) => sum + Math.min(r.max, Number(r.score) || 0), 0);
  const maxTotal = rows.reduce((sum, r) => sum + r.max, 0);

  return { rows, earned, maxTotal };
}

export function roofTypeFromProjectDetails(projectDetails = '') {
  const match = String(projectDetails || '').match(/Roof:\s*([^\.]+)/i);
  return match ? match[1].trim() : 'Roof assessed';
}
