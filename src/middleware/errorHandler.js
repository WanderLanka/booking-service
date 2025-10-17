const logger = require('../utils/logger');

function notFound(req, res, next) {
  res.status(404).json({ success: false, error: 'Not found' });
}

function errorConverter(err, req, res, next) {
  next(err);
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.statusCode || 500;
  const payload = {
    success: false,
    error: err.message || 'Internal Server Error',
  };
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    payload.stack = err.stack;
  }
  logger.error(err);
  res.status(status).json(payload);
}

module.exports = { notFound, errorConverter, errorHandler };
