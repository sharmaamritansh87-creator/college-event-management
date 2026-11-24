// middleware/auth.js  -  login check (authenticate) and role check (requireRole)
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const HttpError = require('../utils/httpError');
const asyncHandler = require('../utils/asyncHandler');

// 1) authenticate: reads the "Authorization: Bearer <token>" header,
//    verifies the token, then loads the user from the database.
//    Loading the user every time means a changed role or a deleted
//    account takes effect immediately.
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Please log in first.');

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw new HttpError(401, 'Your session has expired. Please log in again.');
  }

  const [rows] = await pool.query(
    'SELECT user_id, name, email, role, department, student_id, club_name FROM users WHERE user_id = ?',
    [payload.id]
  );
  if (rows.length === 0) throw new HttpError(401, 'This account no longer exists.');

  req.user = rows[0];
  next();
});

// 2) requireRole('admin', 'organizer') -> only those roles may continue
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, 'You do not have permission to do this.'));
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
