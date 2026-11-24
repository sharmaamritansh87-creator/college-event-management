// routes/events.js  -  list / create / edit / delete events, participants list
const express = require('express');
const pool = require('../config/db');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');
const { clean, parseDateTime } = require('../utils/validators');
const { EVENT_COLUMNS } = require('../utils/eventQueries');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate); // every route below needs a logged-in user

const CATEGORIES = ['Cultural', 'Technical', 'Workshop', 'Sports', 'General'];
const MODES = ['On campus', 'Online', 'Hybrid'];

// ---------------------------------------------------------------------
// GET /api/events
// What students (and everyone) browse: published events, plus the
// logged-in user's own registration info for each event.
// ---------------------------------------------------------------------
router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT ${EVENT_COLUMNS},
            mr.registration_id AS my_registration_id,
            mr.status          AS my_status,
            mr.video_url       AS my_video_url,
            mr.video_note      AS my_video_note,
            ma.status          AS my_attendance,
            mf.rating          AS my_feedback_rating
       FROM events e
       LEFT JOIN registrations mr ON mr.event_id = e.event_id AND mr.user_id = ?
       LEFT JOIN attendance   ma ON ma.registration_id = mr.registration_id
       LEFT JOIN feedback     mf ON mf.registration_id = mr.registration_id
      WHERE e.status = 'Published'
         OR (e.status = 'Cancelled' AND mr.status = 'Registered')
      ORDER BY (e.event_datetime < NOW()) ASC,
               ABS(TIMESTAMPDIFF(SECOND, NOW(), e.event_datetime)) ASC`,
    [req.user.user_id]
  );
  res.json(rows);
}));

// ---------------------------------------------------------------------
// GET /api/events/manage
// Organizer -> only their own events (any status). Admin -> all events.
// ---------------------------------------------------------------------
router.get('/manage', requireRole('organizer', 'admin'), asyncHandler(async (req, res) => {
  const params = [];
  let where = '';
  if (req.user.role === 'organizer') {
    where = 'WHERE e.created_by = ?';
    params.push(req.user.user_id);
  }
  const [rows] = await pool.query(
    `SELECT ${EVENT_COLUMNS}, u.name AS created_by_name
       FROM events e JOIN users u ON u.user_id = e.created_by
       ${where}
      ORDER BY e.event_datetime DESC`,
    params
  );
  res.json(rows);
}));

// Helper: loads an event and checks that this user may manage it.
async function getManagedEvent(req, eventId) {
  const [rows] = await pool.query('SELECT * FROM events WHERE event_id = ?', [eventId]);
  if (rows.length === 0) throw new HttpError(404, 'Event not found.');
  const event = rows[0];
  if (req.user.role === 'organizer' && event.created_by !== req.user.user_id) {
    throw new HttpError(403, 'You can only manage events created by you.');
  }
  return event;
}

// Helper: validates the event form. Returns the cleaned data or throws.
function validateEventBody(body, existing) {
  const title = clean(body.title);
  const description = clean(body.description);
  const venue = clean(body.venue);
  const category = clean(body.category);
  const mode = clean(body.mode) || 'On campus';
  const capacity = Number(body.capacity);
  const when = parseDateTime(body.event_datetime);
  const deadline = parseDateTime(body.registration_deadline);

  if (title.length < 3 || title.length > 150) throw new HttpError(400, 'Title must be 3 to 150 characters.');
  if (description.length < 10) throw new HttpError(400, 'Please write a description of at least 10 characters.');
  if (!CATEGORIES.includes(category)) throw new HttpError(400, 'Please choose a valid category.');
  if (!MODES.includes(mode)) throw new HttpError(400, 'Please choose a valid mode.');
  if (venue.length < 2) throw new HttpError(400, 'Please enter the venue.');
  if (!when) throw new HttpError(400, 'Please enter a valid event date and time.');
  if (!deadline) throw new HttpError(400, 'Please enter a valid registration deadline.');
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) {
    throw new HttpError(400, 'Capacity must be a whole number between 1 and 10000.');
  }

  // A new event (or a changed date) must be in the future
  const dateChanged = !existing || existing.event_datetime !== when.sql;
  if (dateChanged && when.date <= new Date()) {
    throw new HttpError(400, 'The event date must be in the future.');
  }
  if (deadline.date > when.date) {
    throw new HttpError(400, 'The registration deadline must be on or before the event date.');
  }

  return { title, description, venue, category, mode, capacity, when: when.sql, deadline: deadline.sql };
}

// ---------------------------------------------------------------------
// POST /api/events   (organizer or admin)
// Organizer events start as "Pending" until an admin approves them.
// ---------------------------------------------------------------------
router.post('/', requireRole('organizer', 'admin'), asyncHandler(async (req, res) => {
  const d = validateEventBody(req.body, null);

  let clubName, status;
  if (req.user.role === 'organizer') {
    clubName = req.user.club_name || 'Student Council';
    status = 'Pending';
  } else {
    clubName = clean(req.body.club_name) || 'Student Council';
    status = 'Published';
  }

  const [result] = await pool.query(
    `INSERT INTO events
       (title, description, category, mode, club_name, venue,
        event_datetime, registration_deadline, capacity, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.title, d.description, d.category, d.mode, clubName, d.venue,
     d.when, d.deadline, d.capacity, status, req.user.user_id]
  );
  res.status(201).json({
    event_id: result.insertId,
    status,
    message: status === 'Pending'
      ? 'Event created and sent to the admin for approval.'
      : 'Event created and published.'
  });
}));

// ---------------------------------------------------------------------
// PUT /api/events/:id   (owner organizer or admin)
// ---------------------------------------------------------------------
router.put('/:id', requireRole('organizer', 'admin'), asyncHandler(async (req, res) => {
  const event = await getManagedEvent(req, req.params.id);
  const d = validateEventBody(req.body, event);

  const [[{ cnt }]] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM registrations WHERE event_id = ? AND status = 'Registered'",
    [event.event_id]
  );
  if (d.capacity < cnt) {
    throw new HttpError(400, `${cnt} students are already registered, so capacity cannot be lower than ${cnt}.`);
  }

  const clubName = req.user.role === 'admin'
    ? (clean(req.body.club_name) || event.club_name)
    : event.club_name;

  await pool.query(
    `UPDATE events SET title = ?, description = ?, category = ?, mode = ?, club_name = ?,
            venue = ?, event_datetime = ?, registration_deadline = ?, capacity = ?
      WHERE event_id = ?`,
    [d.title, d.description, d.category, d.mode, clubName, d.venue,
     d.when, d.deadline, d.capacity, event.event_id]
  );
  res.json({ message: 'Event updated.' });
}));

// ---------------------------------------------------------------------
// PATCH /api/events/:id/status   (admin only)  -> approve / cancel / re-publish
// ---------------------------------------------------------------------
router.patch('/:id/status', requireRole('admin'), asyncHandler(async (req, res) => {
  const status = clean(req.body.status);
  if (!['Pending', 'Published', 'Cancelled'].includes(status)) {
    throw new HttpError(400, 'Invalid status.');
  }
  const [result] = await pool.query('UPDATE events SET status = ? WHERE event_id = ?', [status, req.params.id]);
  if (result.affectedRows === 0) throw new HttpError(404, 'Event not found.');
  res.json({ message: `Event is now ${status}.` });
}));

// ---------------------------------------------------------------------
// DELETE /api/events/:id   (owner organizer or admin)
// Registrations, attendance and feedback are removed by ON DELETE CASCADE.
// ---------------------------------------------------------------------
router.delete('/:id', requireRole('organizer', 'admin'), asyncHandler(async (req, res) => {
  const event = await getManagedEvent(req, req.params.id);
  await pool.query('DELETE FROM events WHERE event_id = ?', [event.event_id]);
  res.json({ message: 'Event deleted.' });
}));

// ---------------------------------------------------------------------
// GET /api/events/:id/participants  (owner organizer or admin)
// ---------------------------------------------------------------------
router.get('/:id/participants', requireRole('organizer', 'admin'), asyncHandler(async (req, res) => {
  const event = await getManagedEvent(req, req.params.id);
  const [rows] = await pool.query(
    `SELECT r.registration_id, r.registered_on, r.video_url, r.video_note,
            u.user_id, u.name, u.email, u.student_id, u.department,
            COALESCE(a.status, 'Pending') AS attendance_status,
            f.rating AS feedback_rating, f.comments AS feedback_comments
       FROM registrations r
       JOIN users u            ON u.user_id = r.user_id
       LEFT JOIN attendance a  ON a.registration_id = r.registration_id
       LEFT JOIN feedback f    ON f.registration_id = r.registration_id
      WHERE r.event_id = ? AND r.status = 'Registered'
      ORDER BY r.registered_on, u.name`,
    [event.event_id]
  );
  res.json(rows);
}));

module.exports = router;
