// routes/attendance.js  -  organizers / admins mark attendance
const express = require('express');
const pool = require('../config/db');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('organizer', 'admin'));

// Helper: an organizer may only touch events they created.
function assertCanManage(req, createdBy) {
  if (req.user.role === 'organizer' && createdBy !== req.user.user_id) {
    throw new HttpError(403, 'You can only mark attendance for your own events.');
  }
}

// ---------------------------------------------------------------------
// PUT /api/attendance   body: { registration_id, status: 'Present' | 'Absent' }
// ---------------------------------------------------------------------
router.put('/', asyncHandler(async (req, res) => {
  const registrationId = Number(req.body.registration_id);
  const status = req.body.status;
  if (!Number.isInteger(registrationId)) throw new HttpError(400, 'Invalid registration.');
  if (!['Present', 'Absent'].includes(status)) throw new HttpError(400, 'Status must be Present or Absent.');

  const [rows] = await pool.query(
    `SELECT r.registration_id, r.status, e.created_by
       FROM registrations r JOIN events e ON e.event_id = r.event_id
      WHERE r.registration_id = ?`,
    [registrationId]
  );
  if (rows.length === 0) throw new HttpError(404, 'Registration not found.');
  if (rows[0].status !== 'Registered') throw new HttpError(400, 'This registration was cancelled.');
  assertCanManage(req, rows[0].created_by);

  // Insert, or update if attendance was already marked
  await pool.query(
    `INSERT INTO attendance (registration_id, status, marked_by) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE status = ?, marked_by = ?, marked_on = NOW()`,
    [registrationId, status, req.user.user_id, status, req.user.user_id]
  );
  res.json({ message: `Marked ${status}.` });
}));

// ---------------------------------------------------------------------
// POST /api/attendance/mark-all   body: { event_id }  -> everyone Present
// ---------------------------------------------------------------------
router.post('/mark-all', asyncHandler(async (req, res) => {
  const eventId = Number(req.body.event_id);
  if (!Number.isInteger(eventId)) throw new HttpError(400, 'Invalid event.');

  const [events] = await pool.query('SELECT event_id, created_by FROM events WHERE event_id = ?', [eventId]);
  if (events.length === 0) throw new HttpError(404, 'Event not found.');
  assertCanManage(req, events[0].created_by);

  await pool.query(
    `INSERT INTO attendance (registration_id, status, marked_by)
       SELECT registration_id, 'Present', ? FROM registrations
        WHERE event_id = ? AND status = 'Registered'
     ON DUPLICATE KEY UPDATE status = 'Present', marked_by = ?, marked_on = NOW()`,
    [req.user.user_id, eventId, req.user.user_id]
  );
  res.json({ message: 'Everyone marked Present.' });
}));

module.exports = router;
