import './loadEnv.js';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'admin123',
  database: process.env.DB_NAME || 'techx_solar',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool;
