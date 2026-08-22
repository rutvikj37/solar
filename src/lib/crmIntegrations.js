import { API_BASE } from '../config.js';

export const CRM_PROVIDER_META = {
  hubspot: {
    label: 'HubSpot',
    shortLabel: 'HubSpot',
    description: 'Creates a contact in your HubSpot CRM.',
    icon: 'hub',
    btnClass: 'bg-orange-500/15 hover:bg-orange-500/25 border-orange-500/40 text-orange-200',
    dotClass: 'bg-orange-400',
  },
  salesforce: {
    label: 'Salesforce',
    shortLabel: 'Salesforce',
    description: 'Creates a lead in your Salesforce org.',
    icon: 'cloud',
    btnClass: 'bg-sky-500/15 hover:bg-sky-500/25 border-sky-500/40 text-sky-200',
    dotClass: 'bg-sky-400',
  },
};

function authHeaders() {
  const token = localStorage.getItem('solar_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchCrmIntegrations() {
  const res = await fetch(`${API_BASE}/api/crm/integrations`, { headers: authHeaders() });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to load CRM integrations');
  return json;
}

export function getProviderStatus(integrations, provider) {
  return integrations?.providers?.find((p) => p.provider === provider) || { connected: false, provider };
}

export function getConnectedProviders(integrations) {
  return ['hubspot', 'salesforce'].filter((p) => getProviderStatus(integrations, p).connected);
}

export async function connectCrmProvider(provider, returnTo = null) {
  const params = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
  const res = await fetch(`${API_BASE}/api/crm/integrations/connect/${provider}${params}`, {
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Connect failed');
  window.location.href = json.authorizeUrl;
}

export async function pushLeadToCrm(leadId, provider) {
  const res = await fetch(`${API_BASE}/api/crm/integrations/push/${leadId}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'CRM push failed');
  return json;
}

export async function pushBulkLeadsToCrm(leadIds, provider) {
  const res = await fetch(`${API_BASE}/api/crm/integrations/push-bulk`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, leadIds }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'CRM bulk push failed');
  return json;
}

export async function disconnectCrmProvider(provider) {
  const res = await fetch(`${API_BASE}/api/crm/integrations/${provider}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Disconnect failed');
  return json;
}

export function crmToastFromSearchParams(searchParams, setSearchParams) {
  const crm = searchParams.get('crm');
  const err = searchParams.get('crm_error');
  let message = '';
  if (crm?.endsWith('_connected')) {
    const key = crm.replace('_connected', '');
    message = `${CRM_PROVIDER_META[key]?.label || key} connected — you can push leads now.`;
    searchParams.delete('crm');
    setSearchParams(searchParams, { replace: true });
  } else if (err) {
    message = `Connection failed: ${err}`;
    searchParams.delete('crm_error');
    setSearchParams(searchParams, { replace: true });
  }
  return message;
}
