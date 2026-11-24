// utils/httpError.js  -  an Error that carries an HTTP status code.
// Usage:  throw new HttpError(400, 'Event is full');
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
module.exports = HttpError;
