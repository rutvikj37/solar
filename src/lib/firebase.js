import { initializeApp, getApps } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
import { API_BASE } from '../config.js';

let configMeta = { signInMethod: 'popup', authDomain: '' };

function normalizeHost(host) {
  return String(host || '').replace(/^www\./, '').toLowerCase();
}

function resolveSignInMethod(authDomain) {
  if (typeof window === 'undefined') return 'popup';
  const domain = normalizeHost(authDomain);
  const host = normalizeHost(window.location.hostname);
  return domain && host && domain === host ? 'redirect' : 'popup';
}

function configFromEnv() {
  const cfg = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  if (cfg.apiKey && cfg.projectId && cfg.appId) {
    configMeta = {
      signInMethod: resolveSignInMethod(cfg.authDomain),
      authDomain: cfg.authDomain || '',
    };
    return cfg;
  }
  return null;
}

let resolvedConfig = configFromEnv();
let app = resolvedConfig
  ? getApps().length
    ? getApps()[0]
    : initializeApp(resolvedConfig)
  : null;
let auth = app ? getAuth(app) : null;
let initPromise = null;

export function isFirebaseConfigured() {
  return Boolean(resolvedConfig);
}

export function getFirebaseConfigMeta() {
  return configMeta;
}

async function fetchConfigFromServer() {
  const res = await fetch(`${API_BASE}/api/auth/firebase-config`, { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok || !data.configured) {
    throw new Error(
      'Social login is not configured. Add VITE_FIREBASE_* values to .env and restart Vite.',
    );
  }
  configMeta = {
    signInMethod: data.signInMethod || 'popup',
    authDomain: data.authDomain || '',
  };
  return {
    apiKey: data.apiKey,
    authDomain: data.authDomain,
    projectId: data.projectId,
    storageBucket: data.storageBucket,
    messagingSenderId: data.messagingSenderId,
    appId: data.appId,
  };
}

/** Initialize Firebase Auth from VITE_* env or /api/auth/firebase-config. */
export async function ensureFirebaseAuth() {
  if (auth) return auth;
  if (!initPromise) {
    initPromise = (async () => {
      if (!resolvedConfig) {
        resolvedConfig = await fetchConfigFromServer();
      }
      app = getApps().length ? getApps()[0] : initializeApp(resolvedConfig);
      auth = getAuth(app);
      // Avoid IndexedDB "Database is closing/hidden" when auth popup backgrounds this tab (firebase <12.18).
      await setPersistence(auth, browserLocalPersistence);
      return auth;
    })().catch((err) => {
      // Allow a later click to retry (e.g. API was briefly unreachable).
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

export { auth };
export default app;
