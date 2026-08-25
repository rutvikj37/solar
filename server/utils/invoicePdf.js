import PDFDocument from 'pdfkit';
import {
  BRAND_DISPLAY,
  BRAND_DOMAIN,
  BRAND_MONOGRAM,
  BRAND_NAME,
  BRAND_TAGLINE,
} from '../config/brand.js';

/** A4 points */
const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 50;

/**
 * Stripe / Cursor-style invoice: white page, black type, sparse rules.
 * Brand accent only on the wordmark (brand).
 */
const C = {
  ink: '#0A0A0A',
  text: '#171717',
  secondary: '#525252',
  muted: '#737373',
  rule: '#E5E5E5',
  ruleStrong: '#D4D4D4',
  surface: '#FAFAFA',
  paid: '#16A34A',
  due: '#DC2626',
  accent: '#2563EB',
  glow: '#0EA5E9',
  white: '#FFFFFF'
};

export function formatInvoiceNumber(id) {
  return `INV-${String(id).padStart(4, '0')}`;
}

export function invoicePdfFilename(id) {
  return `Invoice-${formatInvoiceNumber(id)}.pdf`;
}

export function formatBillingReason(reason) {
  const map = {
    initial: 'Lead plan purchase',
    renewal: 'Lead plan renewal',
    admin_plan_grant: 'Plan purchase',
    admin_plan_change: 'Plan change',
    admin_plan_restrict: 'Plan restriction',
    admin_plan_unrestrict: 'Restriction lifted',
    admin_credit_adjustment: 'Lead credit adjustment',
    marketplace_wallet: 'Bid wallet top-up',
  };
  return map[reason] || String(reason || 'Lead plan purchase').replace(/_/g, ' ');
}

function formatUsd(cents) {
  const n = Number(cents || 0) / 100;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateLong(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function addMonths(d, months) {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  date.setMonth(date.getMonth() + months);
  return date;
}

function isPaid(status) {
  return String(status || '').toLowerCase() === 'paid';
}

function isCreditAdjustment(invoice) {
  return String(invoice.billing_reason || '') === 'admin_credit_adjustment';
}

function lineItem(invoice) {
  const pkg = invoice.package_name || invoice.package_id || BRAND_DISPLAY;
  const credits = Number(invoice.credits || 0);
  const reason = String(invoice.billing_reason || 'initial');
  const issued = invoice.created_at ? new Date(invoice.created_at) : new Date();
  const periodEnd = addMonths(issued, 1);

  if (reason === 'marketplace_wallet') {
    const pack = String(invoice.package_id || '');
    const match = pack.match(/^mkt_(\d+)$/);
    const title = match ? `$${match[1]} Bid Wallet top-up` : 'Bid Wallet top-up';
    const detail =
      credits > 0
        ? `$${credits.toLocaleString('en-US')} marketplace bid balance (USD) · not used for map lead unlocks`
        : 'Marketplace bid wallet (USD)';
    return {
      title,
      detail,
      qty: 1,
      unitCents: Number(invoice.amount_cents || 0),
      amountCents: Number(invoice.amount_cents || 0),
    };
  }

  if (reason === 'admin_credit_adjustment') {
    const delta = credits >= 0 ? `+${credits.toLocaleString('en-US')}` : credits.toLocaleString('en-US');
    const desc = invoice.description && String(invoice.description).trim();
    return {
      title: 'Lead credit adjustment',
      detail: desc || `${delta} lead credits`,
      qty: 1,
      unitCents: Number(invoice.amount_cents || 0),
      amountCents: Number(invoice.amount_cents || 0)
    };
  }

  const period =
    periodEnd && !Number.isNaN(issued.getTime())
      ? `${formatDateLong(issued)} – ${formatDateLong(periodEnd)}`
      : null;

  const creditLine =
    credits > 0 ? `${credits.toLocaleString('en-US')} lead credits / month` : null;

  const detailParts = [creditLine, period].filter(Boolean);

  let title = pkg;
  if (reason === 'renewal') title = `${pkg} (renewal)`;
  if (reason === 'admin_plan_change') title = pkg;

  return {
    title,
    detail: detailParts.join('  ·  ') || formatBillingReason(reason),
    qty: 1,
    unitCents: Number(invoice.amount_cents || 0),
    amountCents: Number(invoice.amount_cents || 0)
  };
}

function memoText(invoice) {
  const reason = String(invoice.billing_reason || '');
  const amount = Number(invoice.amount_cents || 0);
  if (reason === 'admin_plan_grant' && amount === 0) {
    return `This invoice was issued complimentary by ${BRAND_DISPLAY}.`;
  }
  if (reason === 'admin_plan_grant' || reason === 'admin_plan_change') {
    const how =
      invoice.description && /paid offline/i.test(invoice.description)
        ? `Paid offline. Recorded by ${BRAND_DISPLAY}.`
        : invoice.admin_name
          ? `Issued by ${invoice.admin_name} on behalf of ${BRAND_DISPLAY}.`
          : `Issued by ${BRAND_DISPLAY}.`;
    return how;
  }
  if (reason === 'admin_credit_adjustment') {
    return invoice.admin_name
      ? `Credit balance updated by ${invoice.admin_name}.`
      : `Credit balance updated by ${BRAND_DISPLAY}.`;
  }
  if (reason === 'renewal') {
    return `Thank you for your business. This invoice is for your ${BRAND_DISPLAY} subscription.`;
  }
  if (reason === 'marketplace_wallet') {
    return 'Thank you for your business. This payment adds USD to your marketplace bid wallet for installer bidding.';
  }
  return 'Thank you for your business.';
}

export function renderInvoicePdf(invoice, billTo = {}) {
  return new Promise((resolve, reject) => {
    // margin: 0 — default 50pt bottom margin was pushing the footer onto extra blank pages
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      bufferPages: true,
      autoFirstPage: true,
      info: {
        Title: `Invoice ${formatInvoiceNumber(invoice.id)}`,
        Author: BRAND_DISPLAY,
        Subject: 'Invoice',
        Creator: BRAND_DISPLAY
      }
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      drawStripeStyleInvoice(doc, invoice, billTo);
      keepOnlyFirstPage(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/** Drop any accidental extra pages so the invoice is always 1 page. */
function keepOnlyFirstPage(doc) {
  if (Array.isArray(doc._pageBuffer) && doc._pageBuffer.length > 1) {
    doc._pageBuffer.length = 1;
    doc.page = doc._pageBuffer[0];
  }
  const pages = doc._root?.data?.Pages?.data;
  if (pages?.Kids && pages.Kids.length > 1) {
    pages.Kids.length = 1;
    pages.Count = 1;
  }
}

function drawMetaRow(doc, label, value, x, y, labelW = 92) {
  doc.font('Helvetica').fontSize(9).fillColor(C.muted);
  doc.text(label, x, y, { width: labelW, lineBreak: false });
  doc.font('Helvetica').fontSize(9).fillColor(C.ink);
  doc.text(String(value), x + labelW, y, { width: 160, lineBreak: false });
}

function drawStripeStyleInvoice(doc, invoice, billTo) {
  const invNo = formatInvoiceNumber(invoice.id);
  const issued = invoice.created_at || new Date();
  const due = invoice.created_at || new Date();
  const paid = isPaid(invoice.status);
  const amountCents = Number(invoice.amount_cents || 0);
  const item = lineItem(invoice);
  const contentW = PAGE.width - MARGIN * 2;
  const rightX = PAGE.width - MARGIN - 252;

  let y = 42;

  /* Wordmark — left */
  doc.roundedRect(MARGIN, y, 22, 22, 5).fill(C.accent);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.white);
  doc.text(BRAND_MONOGRAM, MARGIN, y + 6, { width: 22, align: 'center', lineBreak: false });

  doc.font('Helvetica-Bold').fontSize(14);
  const brandX = MARGIN + 30;
  const brandW = doc.widthOfString(BRAND_NAME);
  doc.fillColor(C.ink).text(BRAND_NAME, brandX, y + 4, { lineBreak: false });
  doc.fillColor(C.glow).text('.com', brandX + brandW, y + 4, { lineBreak: false });

  /* Title — right, Stripe/Cursor style */
  doc.font('Helvetica').fontSize(28).fillColor(C.ink);
  doc.text('Invoice', MARGIN, y - 2, { width: contentW, align: 'right', lineBreak: false });

  y += 36;
  if (paid) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.paid);
    doc.text('Paid', MARGIN, y, { width: contentW, align: 'right', lineBreak: false });
    y += 16;
  } else {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.due);
    doc.text(String(invoice.status || 'Open').replace(/^./, (c) => c.toUpperCase()), MARGIN, y, {
      width: contentW,
      align: 'right',
      lineBreak: false
    });
    y += 16;
  }

  drawMetaRow(doc, 'Invoice number', invNo, rightX, y);
  y += 16;
  drawMetaRow(doc, 'Date of issue', formatDateLong(issued), rightX, y);
  y += 16;
  drawMetaRow(doc, paid ? 'Date paid' : 'Date due', formatDateLong(due), rightX, y);

  /* From / Bill to */
  let leftY = 42 + 40;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(C.ink);
  doc.text(BRAND_DISPLAY, MARGIN, leftY);
  leftY += 14;
  doc.font('Helvetica').fontSize(9).fillColor(C.secondary);
  doc.text(BRAND_DOMAIN, MARGIN, leftY);
  leftY += 12;
  doc.text(BRAND_TAGLINE, MARGIN, leftY);
  leftY += 12;
  doc.text('Lead generation for solar installers', MARGIN, leftY);

  y = Math.max(y + 28, leftY + 28);

  doc.font('Helvetica').fontSize(8).fillColor(C.muted);
  doc.text('Bill to', MARGIN, y);
  y += 12;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(C.ink);
  doc.text(billTo.name || billTo.email || 'Customer', MARGIN, y);
  y += 14;
  doc.font('Helvetica').fontSize(9).fillColor(C.secondary);
  if (billTo.email) {
    doc.text(billTo.email, MARGIN, y);
    y += 12;
  }
  if (billTo.company_name) {
    doc.text(String(billTo.company_name), MARGIN, y);
    y += 12;
  }

  y += 22;

  /* Line items header — Stripe table */
  const col = {
    desc: { x: MARGIN, w: 278 },
    qty: { x: MARGIN + 278, w: 50 },
    unit: { x: MARGIN + 328, w: 90 },
    amt: { x: MARGIN + 418, w: contentW - 418 }
  };

  doc
    .moveTo(MARGIN, y)
    .lineTo(PAGE.width - MARGIN, y)
    .strokeColor(C.ruleStrong)
    .lineWidth(0.8)
    .stroke();
  y += 10;

  doc.font('Helvetica').fontSize(8).fillColor(C.muted);
  doc.text('Description', col.desc.x, y, { width: col.desc.w, lineBreak: false });
  doc.text('Qty', col.qty.x, y, { width: col.qty.w, align: 'right', lineBreak: false });
  doc.text('Unit price', col.unit.x, y, { width: col.unit.w, align: 'right', lineBreak: false });
  doc.text('Amount', col.amt.x, y, { width: col.amt.w, align: 'right', lineBreak: false });

  y += 14;
  doc
    .moveTo(MARGIN, y)
    .lineTo(PAGE.width - MARGIN, y)
    .strokeColor(C.rule)
    .lineWidth(0.6)
    .stroke();
  y += 12;

  doc.font('Helvetica').fontSize(10).fillColor(C.ink);
  doc.text(item.title, col.desc.x, y, { width: col.desc.w, height: 28, ellipsis: true });
  const titleH = Math.min(28, doc.heightOfString(item.title, { width: col.desc.w }));
  doc.font('Helvetica').fontSize(10).fillColor(C.ink);
  doc.text(String(item.qty), col.qty.x, y, { width: col.qty.w, align: 'right', lineBreak: false });
  doc.text(formatUsd(item.unitCents), col.unit.x, y, { width: col.unit.w, align: 'right', lineBreak: false });
  doc.text(formatUsd(item.amountCents), col.amt.x, y, { width: col.amt.w, align: 'right', lineBreak: false });

  if (item.detail) {
    y += Math.max(titleH, 12) + 4;
    doc.font('Helvetica').fontSize(8).fillColor(C.muted);
    doc.text(item.detail, col.desc.x, y, { width: col.desc.w, height: 24, ellipsis: true });
    y += Math.min(24, doc.heightOfString(item.detail, { width: col.desc.w })) + 8;
  } else {
    y += Math.max(titleH, 12) + 12;
  }

  y += 4;
  doc
    .moveTo(MARGIN, y)
    .lineTo(PAGE.width - MARGIN, y)
    .strokeColor(C.rule)
    .lineWidth(0.6)
    .stroke();

  /* Totals — right stack like Stripe */
  y += 16;
  const totalsX = PAGE.width - MARGIN - 250;
  const totalsLabelW = 120;
  const totalsValW = 130;

  const rows = [
    ['Subtotal', formatUsd(amountCents), false],
    ['Total', formatUsd(amountCents), true]
  ];
  if (paid) {
    rows.push(['Amount paid', formatUsd(amountCents), true, C.paid]);
  } else {
    rows.push(['Amount due', formatUsd(amountCents), true, C.due]);
  }

  rows.forEach(([label, value, bold, color]) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(C.secondary);
    doc.text(label, totalsX, y, { width: totalsLabelW, lineBreak: false });
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(color || C.ink);
    doc.text(value, totalsX + totalsLabelW, y, { width: totalsValW, align: 'right', lineBreak: false });
    y += 18;
  });

  y += 10;
  doc
    .moveTo(totalsX, y)
    .lineTo(PAGE.width - MARGIN, y)
    .strokeColor(C.rule)
    .lineWidth(0.6)
    .stroke();
  y += 16;

  doc.font('Helvetica').fontSize(9).fillColor(C.secondary);
  const methodLabel = invoice.method
    ? String(invoice.method).replace(/_/g, ' ')
    : isCreditAdjustment(invoice)
      ? 'account adjustment'
      : 'card';
  doc.text(
    paid
      ? `Payment ${formatUsd(amountCents)} paid · ${methodLabel}`
      : `Payment due · ${methodLabel}`,
    MARGIN,
    y,
    { width: contentW, height: 16, ellipsis: true }
  );

  y += 28;
  doc.font('Helvetica').fontSize(9).fillColor(C.text);
  doc.text(memoText(invoice), MARGIN, y, { width: contentW * 0.72, height: 36, ellipsis: true });

  /* Footer — stay above page bottom so PDFKit does not insert blank pages */
  const footerY = PAGE.height - 40;
  doc
    .moveTo(MARGIN, footerY)
    .lineTo(PAGE.width - MARGIN, footerY)
    .strokeColor(C.rule)
    .lineWidth(0.6)
    .stroke();
  doc.font('Helvetica').fontSize(8).fillColor(C.muted);
  doc.text(`${BRAND_DISPLAY}  ·  ${BRAND_DOMAIN}`, MARGIN, footerY + 10, {
    width: 280,
    lineBreak: false
  });
  doc.text('Page 1 of 1', PAGE.width - MARGIN - 80, footerY + 10, {
    width: 80,
    align: 'right',
    lineBreak: false
  });
}
