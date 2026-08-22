import { API_BASE } from '../config.js';

function authHeaders() {
  const token = localStorage.getItem('solar_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const EMAIL_PROVIDER_META = {
  gmail: {
    label: 'Gmail',
    description: 'Send from your Gmail inbox.',
    icon: 'mail',
    btnClass: 'bg-red-500/15 hover:bg-red-500/25 border-red-500/40 text-red-200',
  },
  outlook: {
    label: 'Outlook',
    description: 'Send from Microsoft 365 / Outlook.',
    icon: 'mail',
    btnClass: 'bg-blue-500/15 hover:bg-blue-500/25 border-blue-500/40 text-blue-200',
  },
  smtp: {
    label: 'Custom SMTP',
    description: 'Use your company mail server.',
    icon: 'dns',
    btnClass: 'bg-primary/15 hover:bg-primary/25 border-primary/40 text-primary',
  },
};

export async function fetchEmailIntegration() {
  const res = await fetch(`${API_BASE}/api/email/integrations`, { headers: authHeaders() });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to load email integration');
  return json;
}

export async function connectEmailProvider(provider, returnTo = null) {
  const params = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
  const res = await fetch(`${API_BASE}/api/email/integrations/connect/${provider}${params}`, {
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Connect failed');
  window.location.href = json.authorizeUrl;
}

export async function saveSmtpSettings(settings) {
  const res = await fetch(`${API_BASE}/api/email/integrations/smtp`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to save SMTP');
  return json;
}

export async function sendTestEmail() {
  const res = await fetch(`${API_BASE}/api/email/integrations/test`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Test email failed');
  return json;
}

export async function disconnectEmail() {
  const res = await fetch(`${API_BASE}/api/email/integrations`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Disconnect failed');
  return json;
}

export function emailToastFromSearchParams(searchParams, setSearchParams) {
  const email = searchParams.get('email');
  const err = searchParams.get('email_error');
  let message = '';
  if (email?.endsWith('_connected')) {
    const key = email.replace('_connected', '');
    message = `${EMAIL_PROVIDER_META[key]?.label || key} connected — you can send emails from your address.`;
    searchParams.delete('email');
    setSearchParams(searchParams, { replace: true });
  } else if (err) {
    message = `Email connection failed: ${err}`;
    searchParams.delete('email_error');
    setSearchParams(searchParams, { replace: true });
  }
  return message;
}
