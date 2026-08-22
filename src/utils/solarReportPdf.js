import { API_BASE } from '../config.js';

export function solarReportPdfFilename(leadCode, address = '') {
  const slug = String(address || 'property')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  return `SolarXAI-Report-${leadCode || 'estimate'}-${slug || 'property'}.pdf`;
}

/**
 * Download homeowner solar report PDF by lead code (public endpoint).
 */
export async function downloadSolarReportPdf(leadCode, { address = '', download = true } = {}) {
  if (!leadCode) throw new Error('Report ID missing');

  const qs = download ? '?download=1' : '';
  const res = await fetch(`${API_BASE}/api/marketplace/report-pdf/${encodeURIComponent(leadCode)}${qs}`);

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Could not generate report PDF');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const filename =
    res.headers.get('X-PDF-Filename') || solarReportPdfFilename(leadCode, address);

  if (download) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
