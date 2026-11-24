// scripts/setup-db.js  -  run with:  npm run setup
// 1) creates the tables            (database/schema.sql)
// 2) inserts the demo data         (database/seed.sql) with hashed passwords
// Works on a local MySQL and on a cloud MySQL (set DB_SSL=true for cloud).
// WARNING: it DROPS and recreates the project's tables.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const DB_NAME = process.env.DB_NAME || 'campus_events';

async function main() {
  if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) throw new Error('DB_NAME may only contain letters, numbers and underscores.');

  let schemaSql = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'schema.sql'), 'utf8');
  let seedSql = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'seed.sql'), 'utf8');

  // The SQL files hard-code "campus_events". Remove their CREATE DATABASE / USE lines;
  // this script uses the DB_NAME from .env instead (cloud hosts give you a fixed database name).
  const stripDbLines = (sql) => sql.replace(/CREATE DATABASE[^;]*;/g, '').replace(/^USE [^;]*;/gm, '');
  schemaSql = stripDbLines(schemaSql);
  seedSql = stripDbLines(seedSql);

  // All demo accounts use the password "demo123"
  const hash = await bcrypt.hash('demo123', 10);
  seedSql = seedSql.split('{{DEMO_PASSWORD_HASH}}').join(hash);

  const useSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true';
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    ssl: useSsl ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
    multipleStatements: true
  });

  // Try to create the database (works locally; cloud users may not be allowed -> that is fine)
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } catch (err) {
    console.log('(Skipping CREATE DATABASE: ' + err.message + ')');
  }
  await conn.query(`USE \`${DB_NAME}\``);

  console.log(`Creating tables in database "${DB_NAME}"...`);
  await conn.query(schemaSql);
  console.log('Inserting demo data...');
  await conn.query(seedSql);
  await conn.end();

  console.log('\nDone! Demo logins (password for all: demo123):');
  console.log('  Admin      admin@college.edu');
  console.log('  Club Head  clubhead@college.edu   (Music Club)');
  console.log('  Club Head  codingclub@college.edu (Coding Club)');
  console.log('  Student    student@college.edu    (Rahul Verma)');
  console.log('\nNow start the app with:  npm start\n');
}

main().catch((err) => {
  console.error('\nSetup failed:', err.message);
  console.error('Check your database settings in backend/.env and make sure the database server is reachable.\n');
  process.exit(1);
});