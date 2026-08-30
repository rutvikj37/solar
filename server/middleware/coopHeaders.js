/** COOP value required for Firebase Google signInWithPopup (window.closed polling). */
export const COOP_ALLOW_POPUPS = 'same-origin-allow-popups';

/** Apply on every HTML/SPA response; safe on API responses too. */
export function coopHeadersMiddleware(_req, res, next) {
  res.setHeader('Cross-Origin-Opener-Policy', COOP_ALLOW_POPUPS);
  next();
}
