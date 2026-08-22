const isProd = process.env.NODE_ENV === 'production';

function format(level, message, meta = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...meta,
  };
  return isProd
    ? JSON.stringify(entry)
    : `[${entry.ts}] ${level.toUpperCase()} ${message}${Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''}`;
}

export const logger = {
  info(message, meta) {
    console.log(format('info', message, meta));
  },
  warn(message, meta) {
    console.warn(format('warn', message, meta));
  },
  error(message, meta) {
    console.error(format('error', message, meta));
  },
};
