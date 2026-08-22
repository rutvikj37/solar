const isProd = process.env.NODE_ENV === 'production';

/** Return a safe error string for API clients (hide internals on 5xx in production). */
export function clientErrorMessage(err, fallback = 'Request failed') {
  const status = Number(err?.status || err?.statusCode || 500);
  const message = String(err?.message || '').trim();
  if (!message) return fallback;
  if (status >= 500 && isProd) return fallback;
  return message;
}
