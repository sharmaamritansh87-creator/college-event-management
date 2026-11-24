// utils/asyncHandler.js  -  lets us write "async" route handlers without
// try/catch everywhere. Any error is passed to the error handler in server.js.
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
