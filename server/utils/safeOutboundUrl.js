import dns from 'dns/promises';
import net from 'net';

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal']);

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const norm = ip.toLowerCase();
    if (norm === '::1') return true;
    if (norm.startsWith('fc') || norm.startsWith('fd')) return true;
    if (norm.startsWith('fe80')) return true;
    return false;
  }
  return false;
}

function reject(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/** Validate user-supplied outbound webhook URLs (HTTPS only, no private networks). */
export async function assertSafeOutboundUrl(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl || '').trim());
  } catch {
    throw reject('Invalid webhook URL');
  }
  if (url.protocol !== 'https:') {
    throw reject('Webhook URL must use HTTPS');
  }
  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local')) {
    throw reject('Webhook URL host is not allowed');
  }
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw reject('Webhook URL may not target private networks');
    }
    return url;
  }
  const addresses = await dns.lookup(hostname, { all: true });
  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw reject('Webhook URL resolves to a private network address');
    }
  }
  return url;
}
