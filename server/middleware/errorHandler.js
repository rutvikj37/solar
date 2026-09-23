const SAFE_CLIENT_CODES = new Set([
  'PROPERTY_DATA_UNAVAILABLE',
  'PROPERTY_DATA_NOT_FOUND',
  'MOCK_PROPERTY_BLOCKED',
  'EMAIL_NOT_CONFIGURED',
  'TERRITORY_LOCKED',
]);

export function errorHandler(err, req, res, _next) {
  console.error('[API Error Handler]:', err.stack || err.message || err);

  const statusCode = err.statusCode || err.status || 500;
  const isDev = process.env.NODE_ENV === 'development';

  // CORS denial is handled by cors() with cb(null, false) — no Error throw
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  const hasSafeCode = err.code && SAFE_CLIENT_CODES.has(err.code);
  if (statusCode >= 500 && !isDev && !hasSafeCode) {
    return res.status(statusCode).json({ error: 'Internal Server Error' });
  }

  const message = err.message || 'Internal Server Error';
  res.status(statusCode).json({
    error: message,
    ...(err.code ? { code: err.code } : {}),
    ...(err.mockBlocked ? { mockBlocked: true } : {}),
    ...(isDev ? { stack: err.stack } : {}),
  });
}
