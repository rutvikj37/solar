import { API_BASE } from '../config.js';

export function solarReportPdfFilename(leadCode, address = '') {
  const slug = String(address || 'property')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
  return `SpaceToRoof-Report-${leadCode || 'estimate'}-${slug || 'property'}.pdf`;
}

function reportAccessQuery(leadCode, reportAccess, { download = true } = {}) {
  const params = new URLSearchParams();
  if (download) params.set('download', '1');
  if (reportAccess?.exp && reportAccess?.sig) {
    params.set('exp', String(reportAccess.exp));
    params.set('sig', String(reportAccess.sig));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Download homeowner solar report PDF by lead code (requires signed reportAccess).
 */
export async function downloadSolarReportPdf(
  leadCode,
  { address = '', download = true, reportAccess = null } = {},
) {
  if (!leadCode) throw new Error('Report ID missing');
  if (!reportAccess?.exp || !reportAccess?.sig) {
    throw new Error('Report access expired. Please open your report link from email or submit a new inquiry.');
  }

  const qs = reportAccessQuery(leadCode, reportAccess, { download });
  const res = await fetch(
    `${API_BASE}/api/marketplace/report-pdf/${encodeURIComponent(leadCode)}${qs}`,
  );

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
