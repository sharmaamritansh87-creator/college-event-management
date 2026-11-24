// routes/auth.js  -  sign up, log in, "who am I"
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');
const { isEmail, clean } = require('../utils/validators');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function makeToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h'
  });
}

// What we send back to the browser (never the password hash!)
function publicUser(u) {
  return {
    id: u.user_id,
    name: u.name,
    email: u.email,
    role: u.role,
    department: u.department,
    student_id: u.student_id,
    club_name: u.club_name
  };
}

// POST /api/auth/register  -> students sign themselves up
router.post('/register', asyncHandler(async (req, res) => {
  const name = clean(req.body.name);
  const email = clean(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const department = clean(req.body.department) || null;
  const studentId = clean(req.body.student_id) || null;

  if (name.length < 2) throw new HttpError(400, 'Please enter your full name.');
  if (!isEmail(email)) throw new HttpError(400, 'Please enter a valid email address.');
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');

  const [existing] = await pool.query('SELECT user_id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) throw new HttpError(409, 'An account with this email already exists.');

  const hash = await bcrypt.hash(password, 10);
  const [result] = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, department, student_id)
     VALUES (?, ?, ?, 'student', ?, ?)`,
    [name, email, hash, department, studentId]
  );

  const [rows] = await pool.query('SELECT * FROM users WHERE user_id = ?', [result.insertId]);
  res.status(201).json({ token: makeToken(result.insertId), user: publicUser(rows[0]) });
}));

// POST /api/auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const email = clean(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password) throw new HttpError(400, 'Please enter your email and password.');

  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  const user = rows[0];
  // Same message for "no such user" and "wrong password" (do not leak which one)
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) throw new HttpError(401, 'Incorrect email or password.');

  res.json({ token: makeToken(user.user_id), user: publicUser(user) });
}));

// GET /api/auth/me  -> current logged-in user
router.get('/me', authenticate, (req, res) => {
  res.json({
    id: req.user.user_id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
    department: req.user.department,
    student_id: req.user.student_id,
    club_name: req.user.club_name
  });
});

module.exports = router;
