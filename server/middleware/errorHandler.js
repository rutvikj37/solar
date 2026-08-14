export function errorHandler(err, req, res, _next) {
  console.error('[API Error Handler]:', err.stack || err.message || err);

  const statusCode = err.statusCode || err.status || 500;
  const isDev = process.env.NODE_ENV === 'development';

  // CORS rejection from cors() package
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (statusCode >= 500 && !isDev) {
    return res.status(statusCode).json({ error: 'Internal Server Error' });
  }

  const message = err.message || 'Internal Server Error';
  res.status(statusCode).json({
    error: message,
    ...(isDev ? { stack: err.stack } : {}),
  });
}
