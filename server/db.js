import './loadEnv.js';
import mysql from 'mysql2/promise';

const isProd = process.env.NODE_ENV === 'production';

const dbPassword = process.env.DB_PASSWORD;
if (isProd && (!dbPassword || dbPassword === 'admin123')) {
  console.error('[DB] Refusing to start: set a strong DB_PASSWORD in production (do not use defaults).');
  process.exit(1);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || (isProd ? undefined : 'admin'),
  password: dbPassword || (isProd ? undefined : 'admin123'),
  database: process.env.DB_NAME || 'techx_solar',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool;
