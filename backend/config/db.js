// config/db.js  -  creates ONE shared MySQL connection pool for the whole app.
const mysql = require('mysql2/promise');
const useSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true';
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'campus_events',
    ssl: useSsl ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  // Return DATETIME columns as plain strings ("2026-07-10 17:00:00")
  // so JavaScript never shifts them between time zones.
  dateStrings: true
});

module.exports = pool;
