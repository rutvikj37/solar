import PDFDocument from 'pdfkit';
import { BRAND_MONOGRAM, BRAND_NAME } from '../config/brand.js';
import {
  buildSolarReportEstimates,
  roofTypeFromProjectDetails,
} from './solarReportEstimates.js';

const PAGE = { width: 595.28, height: 841.89 };
const M = 44;

const C = {
  deep: '#060B17',
  ink: '#0F172A',
  text: '#1E293B',
  muted: '#64748B',
  rule: '#E2E8F0',
  surface: '#F8FAFC',
  accent: '#06B6D4',
  glow: '#34D399',
  white: '#FFFFFF',
  soft: '#ECFEFF',
  amber: '#F59E0B',
};

function fmt(v, fallback = '—') {
  if (v === null || v === undefined || v === '') return fallback;
  const s = String(v).trim();
  if (!s) return fallback;
  return s;
}

function money(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `$${Math.round(v).toLocaleString('en-US')}`;
}

export function homeownerReportPdfFilename(leadCode, address = '') {
  const slug = String(address || 'property')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  return `${BRAND_NAME}-Report-${leadCode || 'estimate'}-${slug || 'property'}.pdf`;
}

export function buildReportDataFromLead(lead, formatted) {
  const solarReport = formatted?.solarReport || null;
  const enrichmentSource = formatted?.enrichmentSource || 'estimated';

  return {
    address: lead.address,
    monthlyBill: lead.monthly_bill,
    leadCode: lead.lead_code,
    opportunityScore: lead.opportunity_score,
    listedInMarketplace: formatted?.listedInMarketplace,
    validationChecks: formatted?.validationChecks || [],
    qualificationMessage: formatted?.message,
    roofType: roofTypeFromProjectDetails(lead.project_details),
    timeline: lead.installation_timeline,
    billRange: lead.bill_range,
    estimatedSolarKw: lead.estimated_solar_kw ?? solarReport?.systemKw ?? null,
    estimatedRoofSqft: lead.estimated_roof_sqft ?? solarReport?.usableRoofSqft ?? null,
    solarReport,
    enrichmentSource,
    googleSolarHit: enrichmentSource === 'google_solar',
    dataSources: formatted?.dataSources || null,
  };
}

function drawBrand(doc, x, y) {
  doc.roundedRect(x, y, 22, 22, 5).fill(C.accent);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.white);
  doc.text(BRAND_MONOGRAM, x, y + 6, { width: 22, align: 'center', lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(13).fillColor(C.white);
  doc.text(BRAND_NAME, x + 30, y + 5, { lineBreak: false });
}

function sectionTitle(doc, title, y) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.accent);
  doc.text(String(title).toUpperCase(), M, y, {
    width: PAGE.width - M * 2,
    characterSpacing: 1,
    lineBreak: false,
  });
  return y + 18;
}

function kpiRow(doc, items, y) {
  const contentW = PAGE.width - M * 2;
  const gap = 8;
  const cardW = (contentW - gap * (items.length - 1)) / items.length;
  items.forEach((item, i) => {
    const x = M + i * (cardW + gap);
    doc.roundedRect(x, y, cardW, 52, 8).fill(C.surface);
    doc.roundedRect(x, y, cardW, 52, 8).stroke(C.rule);
    doc.font('Helvetica').fontSize(7).fillColor(C.muted);
    doc.text(item.label, x + 8, y + 10, { width: cardW - 16, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(C.ink);
    doc.text(item.value, x + 8, y + 26, { width: cardW - 16, lineBreak: false });
  });
  return y + 64;
}

function drawFooter(doc, leadCode) {
  const footerY = PAGE.height - 42;
  doc.rect(0, footerY - 6, PAGE.width, 48).fill(C.deep);
  doc.font('Helvetica').fontSize(7).fillColor('#94A3B8');
  doc.text(
    'Illustrative estimate only — not an installer quote or binding savings guarantee.',
    M,
    footerY + 2,
    { width: PAGE.width - M * 2, lineBreak: false },
  );
  doc.text(`Lead ID ${leadCode}  ·  Generated ${new Date().toLocaleDateString('en-US')}`, M, footerY + 14, {
    lineBreak: false,
  });
}

function drawReport(doc, data) {
  const estimates = buildSolarReportEstimates(data);
  const contentW = PAGE.width - M * 2;
  const leadCode = fmt(data.leadCode, 'Pending');
  const address = fmt(data.address, 'Your property');
  const listed = Boolean(data.listedInMarketplace);

  // Header
  doc.rect(0, 0, PAGE.width, 108).fill(C.deep);
  drawBrand(doc, M, 24);
  doc.font('Helvetica').fontSize(8).fillColor('#94A3B8');
  doc.text('PERSONALIZED SOLAR SNAPSHOT', M, 52, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(16).fillColor(C.white);
  doc.text(address, M, 66, { width: contentW, lineBreak: false });

  let y = 124;
  y = sectionTitle(doc, 'Estimated system snapshot', y);
  y = kpiRow(doc, [
    { label: 'PANELS', value: String(estimates.panelCount) },
    { label: 'SYSTEM SIZE', value: `${estimates.systemKw} kW` },
    { label: 'COVERAGE', value: `${estimates.coveragePct}%` },
    { label: 'ANNUAL OUTPUT', value: `${estimates.annualProduction.toLocaleString()} kWh` },
  ], y);

  y = sectionTitle(doc, 'Cumulative savings vs grid (estimate)', y);
  y = kpiRow(
    doc,
    [
      { label: 'YEAR 1', value: money(estimates.year1Savings) },
      { label: 'YEAR 5', value: money(estimates.year5Savings) },
      { label: 'YEAR 10', value: money(estimates.year10Savings) },
      { label: 'YEAR 25', value: money(estimates.year25Savings) },
    ],
    y,
  );

  doc.font('Helvetica').fontSize(8).fillColor(C.muted);
  doc.text(
    `Based on $${estimates.bill}/mo bill · ~$${estimates.ratePerKwh.toFixed(2)}/kWh · ${estimates.systemKw} kW system`,
    M,
    y,
    { width: contentW },
  );
  y += 22;

  if (estimates.googleSolarHit && (estimates.orientation || estimates.pitch || estimates.shading)) {
    doc.font('Helvetica').fontSize(8).fillColor(C.text);
    const roofBits = [
      estimates.orientation ? `Orientation: ${estimates.orientation}` : null,
      estimates.pitch ? `Pitch: ${estimates.pitch}` : null,
      estimates.shading ? `Shading: ${estimates.shading}` : null,
      estimates.imageryDate ? `Imagery: ${estimates.imageryDate}` : null,
    ].filter(Boolean);
    doc.text(roofBits.join('   ·   '), M, y, { width: contentW });
    y += 18;
  }

  // Status box
  const statusColor = listed ? C.glow : C.amber;
  const statusTitle = listed ? 'Qualified for installer marketplace' : 'Report saved — under review';
  doc.roundedRect(M, y, contentW, 44, 8).fill(listed ? '#ECFDF5' : '#FFFBEB');
  doc.roundedRect(M, y, contentW, 44, 8).stroke(listed ? '#A7F3D0' : '#FDE68A');
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.ink);
  doc.text(statusTitle, M + 12, y + 10, { width: contentW - 24, lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor(C.muted);
  doc.text(fmt(data.qualificationMessage, ''), M + 12, y + 24, { width: contentW - 24 });
  y += 58;

  y = sectionTitle(doc, 'Cost of waiting & monthly comparison', y);
  doc.font('Helvetica').fontSize(8).fillColor(C.text);
  doc.text(`Bill today: $${estimates.bill}/mo`, M, y, { continued: true });
  doc.text(`   ·   In ~10 yrs: $${estimates.bill2036}/mo est.`, { continued: true });
  doc.text(`   ·   In ~25 yrs: $${estimates.bill2051}/mo est.`);
  y += 16;
  doc.text(
    `Est. after solar: ~$${estimates.estSolarPayment}/mo   ·   Est. monthly savings: ~$${Math.max(0, estimates.bill - estimates.estSolarPayment)}/mo`,
    M,
    y,
    { width: contentW },
  );
  y += 28;

  y = sectionTitle(doc, 'Environmental impact (estimate)', y);
  y = kpiRow(
    doc,
    [
      { label: 'TREES/YR', value: String(estimates.treesEquiv) },
      { label: 'MILES OFFSET', value: estimates.milesOffset.toLocaleString() },
      { label: 'CO₂ / 25 YRS', value: `${estimates.co2Tons25}t` },
      { label: 'KWH / 25 YRS', value: `${Math.round((estimates.annualProduction * 25) / 1000)}k` },
    ],
    y,
  );

  doc.font('Helvetica').fontSize(7).fillColor(C.muted);
  doc.text(
    'Actual system size, pricing, savings, and performance vary by roof, equipment, installer bids, and utility policies. Consult a licensed solar professional before making financial decisions.',
    M,
    PAGE.height - 72,
    { width: contentW },
  );

  drawFooter(doc, leadCode);
}

export function renderHomeownerReportPdf(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      bufferPages: true,
      info: {
        Title: `Solar Report — ${fmt(data.leadCode)}`,
        Author: BRAND_NAME,
        Subject: 'Homeowner solar estimate',
        Creator: BRAND_NAME,
      },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      drawReport(doc, data);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
