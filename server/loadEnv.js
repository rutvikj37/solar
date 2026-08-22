import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

/** Express always reads `server/.env` (not the repo-root Vite `.env`). */
const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '.env');
const result = dotenv.config({ path: envPath, override: true });

if (result.error) {
  console.warn('[env] Could not load server/.env file');
} else {
  const count = Object.keys(result.parsed || {}).length;
  console.log(`[env] Loaded ${count} keys from ${envPath}`);
}
