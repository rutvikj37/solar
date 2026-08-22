import { GoogleAuth } from 'google-auth-library';
import { isFirebaseAdminConfigured } from '../firebase.js';

let cached = null;
let loadPromise = null;

async function fetchWebConfigFromFirebase() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  const auth = new GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: [
      'https://www.googleapis.com/auth/firebase.readonly',
      'https://www.googleapis.com/auth/cloud-platform',
    ],
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) {
    throw new Error('Could not obtain Google access token for Firebase config');
  }

  const listRes = await fetch(
    `https://firebase.googleapis.com/v1beta1/projects/${projectId}/webApps`,
    { headers: { Authorization: `Bearer ${token.token}` } },
  );
  const list = await listRes.json();
  if (!listRes.ok) {
    throw new Error(list.error?.message || `Firebase webApps list failed (${listRes.status})`);
  }

  const apps = list.apps || [];
  if (!apps.length) {
    throw new Error(
      'No Firebase web app registered. In Firebase Console → Project settings → Your apps, add a Web app.',
    );
  }

  const cfgRes = await fetch(
    `https://firebase.googleapis.com/v1beta1/${apps[0].name}/config`,
    { headers: { Authorization: `Bearer ${token.token}` } },
  );
  const cfg = await cfgRes.json();
  if (!cfgRes.ok) {
    throw new Error(cfg.error?.message || `Firebase web config failed (${cfgRes.status})`);
  }

  return {
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId: cfg.projectId,
    storageBucket: cfg.storageBucket,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId,
  };
}

/** Load and cache the public Firebase web SDK config (safe to expose to browsers). */
export async function loadFirebaseWebConfig() {
  if (cached) return cached;
  if (!isFirebaseAdminConfigured()) return null;

  if (!loadPromise) {
    loadPromise = fetchWebConfigFromFirebase()
      .then((cfg) => {
        cached = cfg;
        return cfg;
      })
      .catch((err) => {
        console.warn('[Firebase] Could not load web SDK config:', err.message);
        return null;
      });
  }

  return loadPromise;
}

export function getFirebaseWebConfig() {
  return cached;
}
