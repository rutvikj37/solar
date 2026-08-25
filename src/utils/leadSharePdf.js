import { BRAND_DISPLAY, BRAND_NAME } from '../config/brand.js';
import { API_BASE } from '../config.js';

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
  return `${BRAND_NAME}-Lead-${id}-${slug || 'sheet'}.pdf`;
}

export function buildLeadShareWhatsAppText(lead) {
  const solar = parseJson(lead.solar_json) || lead.solar || {};
  const prop = parseJson(lead.property_json) || lead.propertyExtra || {};
  const owner = fmt(lead.owner_name, 'Homeowner');
  const address = fmt(lead.address);
  const score = lead.lead_score || prop.aiLeadScore?.overall || '—';
  const savings =
    solar.twentyFiveYearSavings != null && solar.twentyFiveYearSavings !== ''
      ? fmt(solar.twentyFiveYearSavings)
      : money(lead.estimated_savings);
  const size = fmt(solar.recommendedSize);
  const phone = fmt(lead.phone);
  const email = fmt(lead.email);

  return [
    `*${BRAND_DISPLAY} — Lead Sheet*`,
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
    `Lead sheet PDF from ${BRAND_DISPLAY}.`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Fetch branded lead-sheet PDF (JWT in Authorization header).
 */
export async function fetchLeadSharePdf(leadId) {
  const token = localStorage.getItem('solar_token');
  if (!token) throw new Error('Sign in required');

  const res = await fetch(`${API_BASE}/api/leads/${leadId}/share-pdf?download=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Could not generate lead PDF');
  }

  const blob = await res.blob();
  const headerName = res.headers.get('X-PDF-Filename');
  const waEncoded = res.headers.get('X-WhatsApp-Text');
  const waText = waEncoded ? decodeURIComponent(waEncoded) : null;

  return { blob, filename: headerName || `${BRAND_NAME}-Lead-${leadId}.pdf`, waText };
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function openWhatsApp(text) {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Download branded lead PDF.
 */
export async function downloadLeadSharePdf(lead) {
  const { blob, filename } = await fetchLeadSharePdf(lead.id);
  triggerDownload(blob, filename || leadSharePdfFilename(lead));
}

/**
 * Share lead PDF + summary to WhatsApp.
 * Uses Web Share API with file when available (mobile); otherwise downloads PDF and opens WhatsApp with text.
 */
export async function shareLeadToWhatsApp(lead) {
  const { blob, filename, waText } = await fetchLeadSharePdf(lead.id);
  const text = waText || buildLeadShareWhatsAppText(lead);
  const name = filename || leadSharePdfFilename(lead);
  const file = new File([blob], name, { type: 'application/pdf' });

  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `${BRAND_DISPLAY} Lead Sheet`,
        text,
      });
      return { method: 'native' };
    } catch (err) {
      if (err?.name === 'AbortError') return { method: 'cancelled' };
      // fall through
    }
  }

  triggerDownload(blob, name);
  openWhatsApp(text);
  return { method: 'whatsapp-link' };
}
