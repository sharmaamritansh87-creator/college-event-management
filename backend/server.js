// server.js  -  starts the web server.
// It does two jobs:
//   1) serves the API       ->  http://localhost:3000/api/...
//   2) serves the website   ->  http://localhost:3000/   (files from ../frontend)
require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const HttpError = require('./utils/httpError');

if (!process.env.JWT_SECRET) {
  console.error('\n[ERROR] JWT_SECRET is missing.');
  console.error('Copy backend/.env.example to backend/.env and fill in your values, then run again.\n');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

// ----- API routes -----
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/registrations', require('./routes/registrations'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/news', require('./routes/news'));
app.use('/api/admin', require('./routes/admin'));

// Unknown /api/... URL
app.use('/api', (req, res) => res.status(404).json({ message: 'API route not found.' }));

// ----- Frontend (HTML / CSS / JS) -----
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ----- Error handler (must be last) -----
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON sent to the server.' });
  console.error(err);
  res.status(500).json({ message: 'Something went wrong on the server. Please try again.' });
});

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, async () => {
  console.log(`\nCampus Event Management System is running  ->  http://localhost:${PORT}\n`);
  try {
    await pool.query('SELECT 1');
    console.log('Database connected.');
  } catch (err) {
    console.error('Could not connect to MySQL:', err.message);
    console.error('Check DB_HOST / DB_USER / DB_PASSWORD in backend/.env and make sure MySQL is running.');
    console.error('Then run "npm run setup" once to create the tables and demo data.\n');
  }
});
