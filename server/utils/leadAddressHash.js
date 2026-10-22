import crypto from 'crypto';
import { normalizeAddress } from '../services/rentcastCache.js';

/** SHA-1 of the normalized address; null when the address is empty. Used for UNIQUE(user_id, address_hash). */
export function leadAddressHash(address) {
  const norm = normalizeAddress(address);
  if (!norm) return null;
  return crypto.createHash('sha1').update(norm).digest('hex');
}
