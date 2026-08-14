import { API_BASE } from '../config.js';
import { authHeaders, getToken } from './auth.js';

/** Download leads CSV using Authorization header (never put JWT in the query string). */
export async function downloadLeadsCsv() {
  const token = getToken();
  if (!token) {
    throw new Error('Not signed in');
  }

  const response = await fetch(`${API_BASE}/api/leads/export-csv`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error('Export failed');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `solar_leads_export_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
