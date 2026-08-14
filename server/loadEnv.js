import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn('[env] Could not load .env file');
} else {
  const count = Object.keys(result.parsed || {}).length;
  console.log(`[env] Loaded ${count} keys`);
}
