/**
 * Writes VITE_FIREBASE_* keys into the project root .env from Firebase Admin credentials.
 * Run: node server/scripts/syncFirebaseEnv.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import '../loadEnv.js';
import { loadFirebaseWebConfig } from '../services/firebaseWebConfig.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');

const cfg = await loadFirebaseWebConfig();
if (!cfg) {
  console.error(
    'Could not load Firebase web config. Check FIREBASE_* in server/.env and register a Web app in Firebase Console.',
  );
  process.exit(1);
}

const lines = [
  `VITE_FIREBASE_API_KEY=${cfg.apiKey}`,
  `VITE_FIREBASE_AUTH_DOMAIN=${cfg.authDomain}`,
  `VITE_FIREBASE_PROJECT_ID=${cfg.projectId}`,
  `VITE_FIREBASE_STORAGE_BUCKET=${cfg.storageBucket}`,
  `VITE_FIREBASE_MESSAGING_SENDER_ID=${cfg.messagingSenderId}`,
  `VITE_FIREBASE_APP_ID=${cfg.appId}`,
];

let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
for (const line of lines) {
  const key = line.split('=')[0];
  const re = new RegExp(`^${key}=.*$`, 'm');
  content = re.test(content)
    ? content.replace(re, line)
    : `${content.replace(/\s*$/, '')}\n${line}\n`;
}

if (!content.includes('# Firebase Web SDK')) {
  content = content.replace(
    /(\nVITE_FIREBASE_API_KEY=)/,
    '\n# Firebase Web SDK (Google social login)\n$1',
  );
}

fs.writeFileSync(envPath, content);
console.log(`Updated ${envPath} with VITE_FIREBASE_* keys. Restart Vite to apply.`);
