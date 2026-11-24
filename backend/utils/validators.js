// utils/validators.js  -  small helper functions used for form validation.
// (Validation happens on the SERVER too, never trust the browser alone.)

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmail(value) {
  return typeof value === 'string' && EMAIL_REGEX.test(value.trim());
}

// Trims a value and returns '' for anything that is not a string.
function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Accepts "2026-07-10T17:00", "2026-07-10 17:00" or "2026-07-10 17:00:00".
// Returns { date: JSDate, sql: 'YYYY-MM-DD HH:MM:SS' } or null if invalid.
function parseDateTime(value) {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s = '00'] = m;
  const date = new Date(+y, +mo - 1, +d, +h, +mi, +s);
  // Reject impossible dates such as 2026-02-31
  if (isNaN(date) || date.getMonth() !== +mo - 1 || date.getDate() !== +d) return null;
  return { date, sql: `${y}-${mo}-${d} ${h}:${mi}:${s}` };
}

module.exports = { isEmail, clean, parseDateTime };
