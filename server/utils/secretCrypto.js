import crypto from 'crypto';

const ALGO = 'aes-256-gcm';

function getKey() {
  const raw = process.env.AI_CALLING_ENCRYPTION_KEY || process.env.JWT_SECRET || 'default_dev_key_change_in_prod!!';
  return crypto.createHash('sha256').update(String(raw)).digest();
}

export function encryptSecret(plaintext) {
  if (!plaintext) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptSecret(ciphertext) {
  if (!ciphertext) return null;
  const parts = String(ciphertext).split(':');
  if (parts.length !== 3) return null;
  const iv = Buffer.from(parts[0], 'base64');
  const tag = Buffer.from(parts[1], 'base64');
  const data = Buffer.from(parts[2], 'base64');
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
