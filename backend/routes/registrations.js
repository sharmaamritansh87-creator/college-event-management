// routes/registrations.js  -  student actions: register, cancel, video link,
// feedback, certificate data
const express = require('express');
const pool = require('../config/db');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');
const { clean } = require('../utils/validators');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('student'));

// Helper: loads a registration and makes sure it belongs to this student.
async function getMyRegistration(req, registrationId) {
  const [rows] = await pool.query(
    `SELECT r.*, e.title, e.club_name, e.event_datetime, e.status AS event_status,
            (e.event_datetime < NOW()) AS is_past
       FROM registrations r JOIN events e ON e.event_id = r.event_id
      WHERE r.registration_id = ? AND r.user_id = ?`,
    [registrationId, req.user.user_id]
  );
  if (rows.length === 0) throw new HttpError(404, 'Registration not found.');
  return rows[0];
}

// ---------------------------------------------------------------------
// POST /api/registrations   body: { event_id }
// Runs inside a TRANSACTION and locks the event row, so two students
// clicking "Register" at the same moment cannot exceed the capacity.
// ---------------------------------------------------------------------
router.post('/', asyncHandler(async (req, res) => {
  const eventId = Number(req.body.event_id);
  if (!Number.isInteger(eventId)) throw new HttpError(400, 'Please choose an event.');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Lock + load the event
    const [events] = await conn.query(
      `SELECT event_id, title, capacity, status,
              (event_datetime < NOW())          AS is_past,
              (registration_deadline < NOW())   AS deadline_passed
         FROM events WHERE event_id = ? FOR UPDATE`,
      [eventId]
    );
    if (events.length === 0) throw new HttpError(404, 'Event not found.');
    const ev = events[0];

    // 2) Business rules
    if (ev.status !== 'Published') throw new HttpError(400, 'This event is not open for registration.');
    if (ev.is_past) throw new HttpError(400, 'This event has already taken place.');
    if (ev.deadline_passed) throw new HttpError(400, 'The registration deadline for this event has passed.');

    // 3) Duplicate check
    const [existing] = await conn.query(
      'SELECT registration_id, status FROM registrations WHERE user_id = ? AND event_id = ?',
      [req.user.user_id, eventId]
    );
    if (existing.length > 0 && existing[0].status === 'Registered') {
      throw new HttpError(409, 'You are already registered for this event.');
    }

    // 4) Capacity check (only active registrations count)
    const [[{ cnt }]] = await conn.query(
      "SELECT COUNT(*) AS cnt FROM registrations WHERE event_id = ? AND status = 'Registered'",
      [eventId]
    );
    if (cnt >= ev.capacity) throw new HttpError(400, 'Sorry, this event is full.');

    // 5) Save: re-activate a cancelled registration, or insert a new one
    let registrationId;
    if (existing.length > 0) {
      registrationId = existing[0].registration_id;
      await conn.query(
        "UPDATE registrations SET status = 'Registered', registered_on = NOW() WHERE registration_id = ?",
        [registrationId]
      );
    } else {
      const [result] = await conn.query(
        'INSERT INTO registrations (user_id, event_id) VALUES (?, ?)',
        [req.user.user_id, eventId]
      );
      registrationId = result.insertId;
    }

    await conn.commit();
    res.status(201).json({ registration_id: registrationId, message: `You are registered for "${ev.title}".` });
  } catch (err) {
    await conn.rollback();
    // The UNIQUE(user_id, event_id) key is the last line of defence
    if (err.code === 'ER_DUP_ENTRY') {
      throw new HttpError(409, 'You are already registered for this event.');
    }
    throw err;
  } finally {
    conn.release();
  }
}));

// ---------------------------------------------------------------------
// POST /api/registrations/:id/cancel
// ---------------------------------------------------------------------
router.post('/:id/cancel', asyncHandler(async (req, res) => {
  const reg = await getMyRegistration(req, req.params.id);
  if (reg.status !== 'Registered') throw new HttpError(400, 'This registration is already cancelled.');
  if (reg.is_past) throw new HttpError(400, 'You cannot cancel after the event has taken place.');

  await pool.query("UPDATE registrations SET status = 'Cancelled' WHERE registration_id = ?", [reg.registration_id]);
  res.json({ message: `Your registration for "${reg.title}" has been cancelled.` });
}));

// ---------------------------------------------------------------------
// PUT /api/registrations/:id/video   body: { video_url, video_note }
// ---------------------------------------------------------------------
router.put('/:id/video', asyncHandler(async (req, res) => {
  const reg = await getMyRegistration(req, req.params.id);
  if (reg.status !== 'Registered') throw new HttpError(400, 'Register for the event first.');

  const url = clean(req.body.video_url);
  const note = clean(req.body.video_note).slice(0, 255) || null;
  if (!/^https?:\/\/\S+$/i.test(url) || url.length > 500) {
    throw new HttpError(400, 'Please enter a valid link starting with http:// or https://');
  }

  await pool.query('UPDATE registrations SET video_url = ?, video_note = ? WHERE registration_id = ?',
    [url, note, reg.registration_id]);
  res.json({ message: 'Video link saved.' });
}));

// ---------------------------------------------------------------------
// POST /api/registrations/:id/feedback   body: { rating, comments, suggestions }
// ---------------------------------------------------------------------
router.post('/:id/feedback', asyncHandler(async (req, res) => {
  const reg = await getMyRegistration(req, req.params.id);
  if (reg.status !== 'Registered') throw new HttpError(400, 'Only registered students can give feedback.');
  if (!reg.is_past) throw new HttpError(400, 'Feedback opens after the event has taken place.');

  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new HttpError(400, 'Please choose a rating from 1 to 5.');
  }
  const comments = clean(req.body.comments).slice(0, 2000) || null;
  const suggestions = clean(req.body.suggestions).slice(0, 2000) || null;

  const [existing] = await pool.query('SELECT feedback_id FROM feedback WHERE registration_id = ?', [reg.registration_id]);
  if (existing.length > 0) throw new HttpError(409, 'You have already submitted feedback for this event.');

  await pool.query(
    'INSERT INTO feedback (registration_id, rating, comments, suggestions) VALUES (?, ?, ?, ?)',
    [reg.registration_id, rating, comments, suggestions]
  );
  res.status(201).json({ message: 'Thank you for your feedback!' });
}));

// ---------------------------------------------------------------------
// GET /api/registrations/:id/certificate  -> data for the certificate page
// Only available when the organizer marked the student "Present".
// ---------------------------------------------------------------------
router.get('/:id/certificate', asyncHandler(async (req, res) => {
  const reg = await getMyRegistration(req, req.params.id);
  const [att] = await pool.query('SELECT status FROM attendance WHERE registration_id = ?', [reg.registration_id]);
  if (reg.status !== 'Registered' || att.length === 0 || att[0].status !== 'Present') {
    throw new HttpError(403, 'A certificate is available only after your attendance is marked Present.');
  }
  res.json({
    student_name: req.user.name,
    student_id: req.user.student_id,
    department: req.user.department,
    event_title: reg.title,
    club_name: reg.club_name,
    event_datetime: reg.event_datetime
  });
}));

module.exports = router;
