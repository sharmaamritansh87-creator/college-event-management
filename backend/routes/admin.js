// routes/admin.js  -  dashboard statistics, user management, reports
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');
const { isEmail, clean } = require('../utils/validators');
const { EVENT_COLUMNS } = require('../utils/eventQueries');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

const ROLES = ['student', 'organizer', 'admin'];

// GET /api/admin/stats  -> numbers for the dashboard
router.get('/stats', asyncHandler(async (req, res) => {
  const [[totals]] = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'student')   AS students,
      (SELECT COUNT(*) FROM users WHERE role = 'organizer') AS organizers,
      (SELECT COUNT(*) FROM events)                          AS total_events,
      (SELECT COUNT(*) FROM events WHERE status = 'Published' AND event_datetime >= NOW()) AS upcoming_events,
      (SELECT COUNT(*) FROM events WHERE status = 'Published' AND event_datetime <  NOW()) AS completed_events,
      (SELECT COUNT(*) FROM events WHERE status = 'Pending')  AS pending_events,
      (SELECT COUNT(*) FROM registrations WHERE status = 'Registered') AS total_registrations,
      (SELECT COUNT(*) FROM attendance a JOIN registrations r ON r.registration_id = a.registration_id
         WHERE r.status = 'Registered' AND a.status = 'Present') AS total_present,
      (SELECT ROUND(AVG(rating), 1) FROM feedback) AS avg_rating
  `);

  const [byCategory] = await pool.query(
    `SELECT category, COUNT(*) AS total FROM events WHERE status = 'Published' GROUP BY category ORDER BY total DESC`
  );

  const [topEvents] = await pool.query(
    `SELECT e.event_id, e.title, e.club_name, COUNT(r.registration_id) AS registrations
       FROM events e
       JOIN registrations r ON r.event_id = e.event_id AND r.status = 'Registered'
      GROUP BY e.event_id, e.title, e.club_name
      ORDER BY registrations DESC, e.title
      LIMIT 5`
  );

  res.json({ totals, byCategory, topEvents });
}));

// GET /api/admin/report  -> one row per event, used for the CSV download
router.get('/report', asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT ${EVENT_COLUMNS}, u.name AS created_by_name
       FROM events e JOIN users u ON u.user_id = e.created_by
      ORDER BY e.event_datetime DESC`
  );
  res.json(rows);
}));

// GET /api/admin/users
router.get('/users', asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.user_id, u.name, u.email, u.role, u.department, u.student_id, u.club_name, u.created_at,
            (SELECT COUNT(*) FROM registrations r WHERE r.user_id = u.user_id AND r.status = 'Registered') AS registrations
       FROM users u
      ORDER BY FIELD(u.role, 'admin', 'organizer', 'student'), u.name`
  );
  res.json(rows);
}));

// POST /api/admin/users  -> create any kind of user (e.g. a new organizer)
router.post('/users', asyncHandler(async (req, res) => {
  const name = clean(req.body.name);
  const email = clean(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const role = clean(req.body.role);
  const clubName = clean(req.body.club_name) || null;
  const department = clean(req.body.department) || null;

  if (name.length < 2) throw new HttpError(400, 'Please enter the name.');
  if (!isEmail(email)) throw new HttpError(400, 'Please enter a valid email address.');
  if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');
  if (!ROLES.includes(role)) throw new HttpError(400, 'Please choose a valid role.');
  if (role === 'organizer' && !clubName) throw new HttpError(400, 'An organizer needs a club name.');

  const [existing] = await pool.query('SELECT user_id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) throw new HttpError(409, 'A user with this email already exists.');

  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role, department, club_name)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, email, hash, role, department, role === 'organizer' ? clubName : null]
  );
  res.status(201).json({ message: 'User created.' });
}));

// PUT /api/admin/users/:id/role   body: { role, club_name }
router.put('/users/:id/role', asyncHandler(async (req, res) => {
  const role = clean(req.body.role);
  const clubName = clean(req.body.club_name) || null;
  if (!ROLES.includes(role)) throw new HttpError(400, 'Please choose a valid role.');
  if (Number(req.params.id) === req.user.user_id) throw new HttpError(400, 'You cannot change your own role.');
  if (role === 'organizer' && !clubName) throw new HttpError(400, 'An organizer needs a club name.');

  const [result] = await pool.query(
    'UPDATE users SET role = ?, club_name = ? WHERE user_id = ?',
    [role, role === 'organizer' ? clubName : null, req.params.id]
  );
  if (result.affectedRows === 0) throw new HttpError(404, 'User not found.');
  res.json({ message: 'Role updated.' });
}));

// DELETE /api/admin/users/:id
router.delete('/users/:id', asyncHandler(async (req, res) => {
  if (Number(req.params.id) === req.user.user_id) throw new HttpError(400, 'You cannot delete your own account.');
  const [result] = await pool.query('DELETE FROM users WHERE user_id = ?', [req.params.id]);
  if (result.affectedRows === 0) throw new HttpError(404, 'User not found.');
  res.json({ message: 'User deleted.' });
}));

module.exports = router;
