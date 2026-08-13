import { API_BASE } from '../config.js';

export function invoiceNumber(id) {
  return `INV-${String(id).padStart(4, '0')}`;
}

export function invoicePdfFilename(id) {
  return `Invoice-${invoiceNumber(id)}.pdf`;
}

/**
 * Fetch invoice PDF with Authorization header (JWT stays out of the URL).
 * View opens a blob tab; download=true triggers a file save.
 */
export async function openInvoicePdf(invoiceId, { download = false } = {}) {
  const token = localStorage.getItem('solar_token');
  if (!token) throw new Error('Sign in required');

  let preview = null;
  if (!download) {
    preview = window.open('about:blank', '_blank');
  }

  const qs = download ? '?download=1' : '';
  const res = await fetch(`${API_BASE}/api/billing/invoices/${invoiceId}/pdf${qs}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    if (preview) preview.close();
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Could not open invoice PDF');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  if (download) {
    const a = document.createElement('a');
    a.href = url;
    a.download = invoicePdfFilename(invoiceId);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  if (preview && !preview.closed) {
    preview.location.href = url;
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
