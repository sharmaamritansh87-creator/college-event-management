// routes/news.js  -  club announcements
const express = require('express');
const pool = require('../config/db');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');
const { clean } = require('../utils/validators');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/news  -> everyone can read, newest first
router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT n.news_id, n.title, n.content, n.club_name, n.posted_on, n.posted_by,
            u.name AS posted_by_name
       FROM club_news n JOIN users u ON u.user_id = n.posted_by
      ORDER BY n.posted_on DESC, n.news_id DESC`
  );
  res.json(rows);
}));

// POST /api/news  (organizer or admin)
router.post('/', requireRole('organizer', 'admin'), asyncHandler(async (req, res) => {
  const title = clean(req.body.title);
  const content = clean(req.body.content);
  if (title.length < 3 || title.length > 150) throw new HttpError(400, 'Title must be 3 to 150 characters.');
  if (content.length < 5) throw new HttpError(400, 'Please write the announcement text.');

  const clubName = req.user.role === 'organizer'
    ? (req.user.club_name || 'Student Council')
    : (clean(req.body.club_name) || 'Student Council');

  await pool.query(
    'INSERT INTO club_news (title, content, club_name, posted_by) VALUES (?, ?, ?, ?)',
    [title, content, clubName, req.user.user_id]
  );
  res.status(201).json({ message: 'Announcement posted.' });
}));

// DELETE /api/news/:id  (author or admin)
router.delete('/:id', requireRole('organizer', 'admin'), asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT posted_by FROM club_news WHERE news_id = ?', [req.params.id]);
  if (rows.length === 0) throw new HttpError(404, 'Announcement not found.');
  if (req.user.role === 'organizer' && rows[0].posted_by !== req.user.user_id) {
    throw new HttpError(403, 'You can only delete your own announcements.');
  }
  await pool.query('DELETE FROM club_news WHERE news_id = ?', [req.params.id]);
  res.json({ message: 'Announcement deleted.' });
}));

module.exports = router;
