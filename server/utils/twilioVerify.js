import crypto from 'crypto';

function isTwilioAuthConfigured() {
  const token = process.env.TWILIO_AUTH_TOKEN || '';
  return token && !token.toLowerCase().includes('your_');
}

/** Validate X-Twilio-Signature (HMAC-SHA1) when auth token is configured. */
export function verifyTwilioSignature(req) {
  if (!isTwilioAuthConfigured()) {
    return process.env.NODE_ENV !== 'production';
  }
  const signature = req.headers['x-twilio-signature'];
  if (!signature) return false;

  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const url = `${proto}://${host}${req.originalUrl}`;

  const params = req.body && typeof req.body === 'object' ? req.body : {};
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + String(params[key] ?? '');
  }

  const expected = crypto
    .createHmac('sha1', process.env.TWILIO_AUTH_TOKEN)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function requireTwilioSignature(req, res) {
  if (!verifyTwilioSignature(req)) {
    res.status(403).type('text/plain').send('Forbidden');
    return false;
  }
  return true;
}
