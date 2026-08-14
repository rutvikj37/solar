import PDFDocument from 'pdfkit';

const PAGE = { width: 595.28, height: 841.89 };
const M = 40;

const C = {
  deep: '#0B1220',
  ink: '#0F172A',
  text: '#1E293B',
  muted: '#64748B',
  rule: '#E2E8F0',
  surface: '#F8FAFC',
  card: '#FFFFFF',
  accent: '#2563EB',
  glow: '#0EA5E9',
  white: '#FFFFFF',
  soft: '#EFF6FF',
  green: '#059669'
};

function fmt(v, fallback = '—') {
  if (v === null || v === undefined || v === '') return fallback;
  const s = String(v).trim();
  if (!s || s === 'N/A' || s === 'Not Available' || s === 'undefined' || s === 'null') return fallback;
  return s;
}

function money(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return '—';
  return `$${v.toLocaleString('en-US')}`;
}

function parseJson(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function leadSharePdfFilename(lead) {
  const id = lead?.id || 'lead';
  const slug = String(lead?.address || 'property')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return `SolarX-Lead-${id}-${slug || 'sheet'}.pdf`;
}

export function buildLeadShareWhatsAppText(lead) {
  const solar = parseJson(lead.solar_json);
  const owner = fmt(lead.owner_name, 'Homeowner');
  const address = fmt(lead.address);
  const score = lead.lead_score || parseJson(lead.property_json)?.aiLeadScore?.overall || '—';
  const savings = fmt(solar.twentyFiveYearSavings, money(lead.estimated_savings));
  const size = fmt(solar.recommendedSize);
  const phone = fmt(lead.phone);
  const email = fmt(lead.email);

  return [
    `*SolarX.live — Lead Sheet*`,
    ``,
    `*${owner}*`,
    address,
    ``,
    `Lead score: ${score}/100`,
    `25-yr savings: ${savings}`,
    `System size: ${size}`,
    phone !== '—' ? `Phone: ${phone}` : null,
    email !== '—' ? `Email: ${email}` : null,
    ``,
    `Lead sheet PDF attached / downloaded from SolarX.live.`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Branded one-page SolarX.live lead detail PDF for sharing.
 */
export function renderLeadSharePdf(lead) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      bufferPages: true,
      info: {
        Title: `Lead Sheet — ${fmt(lead.address, 'Property')}`,
        Author: 'SolarX.live',
        Subject: 'Solar lead details',
        Creator: 'SolarX.live',
      },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      drawLeadSheet(doc, lead);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function drawBrand(doc, x, y) {
  doc.roundedRect(x, y, 22, 22, 5).fill(C.accent);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.white);
  doc.text('SX', x, y + 6, { width: 22, align: 'center', lineBreak: false });

  const brandX = x + 30;
  doc.font('Helvetica-Bold').fontSize(14);
  const solarW = doc.widthOfString('SolarX');
  doc.fillColor(C.white).text('SolarX', brandX, y + 4, { lineBreak: false });
  doc.fillColor(C.glow).text('.live', brandX + solarW, y + 4, { lineBreak: false });
}

function sectionTitle(doc, title, y, x = M) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.accent);
  doc.text(String(title).toUpperCase(), x, y, {
    width: PAGE.width - x - M,
    characterSpacing: 1.2,
    lineBreak: false,
  });
  return y + 16;
}

function kvRow(doc, label, value, y, colX = M, colW = PAGE.width - M * 2) {
  const gap = 4;
  const labelW = Math.min(108, Math.floor(colW * 0.42));
  const valueW = Math.max(40, colW - labelW - 4);
  const text = fmt(value);

  doc.font('Helvetica').fontSize(9);
  const labelH = doc.heightOfString(String(label), { width: labelW });
  doc.font('Helvetica-Bold').fontSize(9);
  const valueH = doc.heightOfString(text, { width: valueW });
  const rowH = Math.max(11, labelH, valueH);

  doc.font('Helvetica').fontSize(9).fillColor(C.muted);
  doc.text(String(label), colX, y, { width: labelW });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.ink);
  doc.text(text, colX + labelW, y, { width: valueW });

  return y + rowH + gap;
}

function drawLeadSheet(doc, lead) {
  const solar = parseJson(lead.solar_json);
  const prop = parseJson(lead.property_json);
  const score = Number(lead.lead_score || prop.aiLeadScore?.overall || 0) || 0;
  const owner = fmt(lead.owner_name, 'Homeowner');
  const address = fmt(lead.address);
  const contentW = PAGE.width - M * 2;

  // Hero header
  doc.rect(0, 0, PAGE.width, 118).fill(C.deep);
  drawBrand(doc, M, 28);

  doc.font('Helvetica').fontSize(9).fillColor('#94A3B8');
  doc.text('LEAD INTELLIGENCE SHEET', M, 58, { lineBreak: false });

  doc.font('Helvetica-Bold').fontSize(18).fillColor(C.white);
  doc.text(owner, M, 74, { width: contentW - 110, lineBreak: false });

  // Score badge
  const badgeX = PAGE.width - M - 78;
  doc.roundedRect(badgeX, 34, 78, 54, 10).fill('#132038');
  doc.font('Helvetica').fontSize(8).fillColor('#94A3B8');
  doc.text('SCORE', badgeX, 42, { width: 78, align: 'center', lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(20).fillColor(C.glow);
  doc.text(String(score), badgeX, 56, { width: 78, align: 'center', lineBreak: false });

  let y = 136;

  // Address block
  doc.roundedRect(M, y, contentW, 52, 10).fill(C.soft);
  doc.font('Helvetica').fontSize(8).fillColor(C.accent);
  doc.text('PROPERTY', M + 14, y + 12, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.ink);
  doc.text(address, M + 14, y + 26, { width: contentW - 28, lineBreak: false });
  y += 68;

  // KPI cards
  const kpis = [
    { label: '25-YR SAVINGS', value: fmt(solar.twentyFiveYearSavings, money(lead.estimated_savings)) },
    { label: 'SYSTEM SIZE', value: fmt(solar.recommendedSize) },
    { label: 'ANNUAL PROD.', value: fmt(solar.annualProduction) },
    { label: 'STATUS', value: fmt(lead.status, 'new').toUpperCase() },
  ];
  const gap = 10;
  const cardW = (contentW - gap * 3) / 4;
  kpis.forEach((k, i) => {
    const x = M + i * (cardW + gap);
    doc.roundedRect(x, y, cardW, 54, 8).fill(C.surface);
    doc.roundedRect(x, y, cardW, 54, 8).stroke(C.rule);
    doc.font('Helvetica').fontSize(7).fillColor(C.muted);
    doc.text(k.label, x + 8, y + 12, { width: cardW - 16, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.ink);
    doc.text(k.value, x + 8, y + 28, { width: cardW - 16, lineBreak: false });
  });
  y += 70;

  // Two columns: Contact | Solar
  const colW = (contentW - 16) / 2;
  const leftX = M;
  const rightX = M + colW + 16;
  const colTop = y;

  y = sectionTitle(doc, 'Contact', colTop, leftX);
  y = kvRow(doc, 'Phone', lead.phone, y, leftX, colW);
  y = kvRow(doc, 'Email', lead.email, y, leftX, colW);
  y = kvRow(doc, 'Owner occupied', lead.owner_occupied === 1 ? 'Yes' : lead.owner_occupied === 0 ? 'No' : prop.ownerOccupied, y, leftX, colW);
  y = kvRow(doc, 'Mailing address', lead.mailing_address || prop.mailingAddress, y, leftX, colW);
  const leftBottom = y;

  let ry = sectionTitle(doc, 'Solar potential', colTop, rightX);
  ry = kvRow(doc, 'Roof area', solar.totalRoofArea || (lead.roof_size ? `${Number(lead.roof_size).toLocaleString('en-US')} sq ft` : null), ry, rightX, colW);
  ry = kvRow(doc, 'Usable roof', solar.usableRoofArea, ry, rightX, colW);
  ry = kvRow(doc, 'Orientation', solar.orientation, ry, rightX, colW);
  ry = kvRow(doc, 'Pitch', solar.pitch, ry, rightX, colW);
  ry = kvRow(doc, 'Existing solar', solar.existingSolar, ry, rightX, colW);
  ry = kvRow(doc, 'Panels (est.)', solar.estimatedPanels || solar.panelCount, ry, rightX, colW);

  y = Math.max(leftBottom, ry) + 18;
  doc.moveTo(M, y).lineTo(PAGE.width - M, y).strokeColor(C.rule).lineWidth(1).stroke();
  y += 16;

  y = sectionTitle(doc, 'Property registry', y);
  const registry = [
    ['Parcel', lead.parcel_id || prop.parcelNumber],
    ['Property type', prop.propertyType],
    ['Year built', prop.yearBuilt],
    ['Living area', prop.livingArea],
    ['Lot size', prop.lotSize],
    ['Stories', prop.stories],
    ['Property value', money(lead.property_value) !== '—' ? money(lead.property_value) : prop.propertyValue],
    ['Tax assessed', prop.taxAssessedValue],
    ['Last sale', prop.lastSaleDate],
    ['Last sale price', prop.lastSalePrice],
  ];

  const mid = Math.ceil(registry.length / 2);
  let ly = y;
  let rry = y;
  registry.slice(0, mid).forEach(([label, value]) => {
    ly = kvRow(doc, label, value, ly, leftX, colW);
  });
  registry.slice(mid).forEach(([label, value]) => {
    rry = kvRow(doc, label, value, rry, rightX, colW);
  });
  y = Math.max(ly, rry) + 16;

  if (lead.notes && String(lead.notes).trim()) {
    y = sectionTitle(doc, 'Notes', y);
    const notesText = String(lead.notes).trim().slice(0, 320);
    const notesInnerW = contentW - 24;
    doc.font('Helvetica').fontSize(9);
    const notesH = Math.max(28, doc.heightOfString(notesText, { width: notesInnerW }));
    const notesBoxH = notesH + 24;
    doc.roundedRect(M, y, contentW, notesBoxH, 8).fill(C.surface);
    doc.font('Helvetica').fontSize(9).fillColor(C.text);
    doc.text(notesText, M + 12, y + 12, { width: notesInnerW });
    y += notesBoxH + 14;
  }

  // AI summary if present
  const summary = prop.aiLeadScore?.summary || prop.aiLeadScore?.label;
  if (summary) {
    y = sectionTitle(doc, 'AI assessment', y);
    const summaryText = String(summary).slice(0, 420);
    doc.font('Helvetica').fontSize(9).fillColor(C.text);
    const summaryH = doc.heightOfString(summaryText, { width: contentW });
    doc.text(summaryText, M, y, { width: contentW });
    y += summaryH + 16;
  }

  // Footer
  const footerY = PAGE.height - 48;
  doc.rect(0, footerY - 8, PAGE.width, 56).fill(C.deep);
  doc.font('Helvetica').fontSize(8).fillColor('#94A3B8');
  doc.text('Confidential — for authorized SolarX.live users only', M, footerY + 4, { lineBreak: false });
  doc.text(`Generated ${new Date().toLocaleString('en-US')}  ·  solarx.live`, M, footerY + 18, {
    width: contentW,
    align: 'left',
    lineBreak: false,
  });
  doc.font('Helvetica-Bold').fontSize(8).fillColor(C.glow);
  doc.text(`Lead #${lead.id}`, M, footerY + 4, { width: contentW, align: 'right', lineBreak: false });
}
