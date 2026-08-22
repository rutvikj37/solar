import crypto from 'crypto';

function mediaSigningSecret() {
  return process.env.TWILIO_AUTH_TOKEN || process.env.JWT_SECRET || '';
}

export function signMediaFileAccess(fileName, ttlMs = 3600000) {
  const secret = mediaSigningSecret();
  if (!secret) return null;
  const exp = Date.now() + ttlMs;
  const sig = crypto.createHmac('sha256', secret).update(`${fileName}:${exp}`).digest('hex');
  return { exp, sig };
}

export function buildSignedMediaFileUrl(publicBase, fileName) {
  const signed = signMediaFileAccess(fileName);
  if (!signed) {
    return `${publicBase}/api/ai-calling/tts-audio/file/${encodeURIComponent(fileName)}`;
  }
  return `${publicBase}/api/ai-calling/tts-audio/file/${encodeURIComponent(fileName)}?exp=${signed.exp}&sig=${signed.sig}`;
}

export function verifyMediaFileAccess(fileName, exp, sig) {
  const secret = mediaSigningSecret();
  if (!secret || !exp || !sig) return false;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Date.now()) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${fileName}:${expNum}`).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}
