import fetch from 'node-fetch';
import { COOP_ALLOW_POPUPS } from '../middleware/coopHeaders.js';

function resolveFirebaseAuthHost() {
  const explicit = String(process.env.FIREBASE_AUTH_PROXY_HOST || '').trim();
  if (explicit) return explicit.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const projectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
  return projectId ? `${projectId}.firebaseapp.com` : '';
}

/**
 * Proxy /__/auth/* to Firebase hosting so authDomain can be your custom domain
 * (e.g. spacetoroof.com) while OAuth handler stays on Firebase infrastructure.
 *
 * Enable with FIREBASE_AUTH_PROXY=1 and set FIREBASE_AUTH_DOMAIN to your site host.
 */
export function mountFirebaseAuthProxy(app) {
  const enabled = String(process.env.FIREBASE_AUTH_PROXY || '').trim() === '1';
  const host = resolveFirebaseAuthHost();
  if (!enabled || !host) return false;

  app.use('/__/auth', async (req, res) => {
    const target = `https://${host}${req.originalUrl}`;
    try {
      const upstream = await fetch(target, {
        method: req.method,
        headers: {
          Accept: req.headers.accept || '*/*',
          'Accept-Language': req.headers['accept-language'] || 'en',
          'User-Agent': req.headers['user-agent'] || 'SpaceToRoof-Auth-Proxy',
        },
        redirect: 'manual',
      });

      res.status(upstream.status);
      upstream.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (lower === 'transfer-encoding' || lower === 'connection') return;
        res.setHeader(key, value);
      });
      res.setHeader('Cross-Origin-Opener-Policy', COOP_ALLOW_POPUPS);

      const body = await upstream.buffer();
      res.send(body);
    } catch (err) {
      console.error('[Firebase Auth Proxy] upstream failed:', err.message || err);
      res.status(502).json({ error: 'Firebase auth proxy unavailable' });
    }
  });

  console.log(`[Firebase] Auth handler proxy enabled → https://${host}/__/auth/*`);
  return true;
}
