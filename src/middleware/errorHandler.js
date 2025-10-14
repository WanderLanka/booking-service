const logger = require('../utils/logger');

class ApiError extends Error {
	constructor(statusCode, message, details) {
		super(message);
		this.statusCode = statusCode;
		this.isOperational = true;
		if (details) this.details = details;
		Error.captureStackTrace(this, this.constructor);
	}
}

// Convert various error types (Joi, Mongoose, SyntaxError) into ApiError
const errorConverter = (err, req, res, next) => {
	let error = err;

	// Joi validation error shape
	if (err && err.isJoi) {
		error = new ApiError(400, 'Validation failed', err.details?.map(d => ({ message: d.message, path: d.path })));
	}

	// Mongoose validation
	if (err?.name === 'ValidationError') {
		const details = Object.values(err.errors || {}).map(e => ({ message: e.message, path: e.path }));
		error = new ApiError(400, 'Validation failed', details);
	}

	// Mongoose cast error (e.g., invalid ObjectId)
	if (err?.name === 'CastError') {
		error = new ApiError(400, `Invalid ${err.path}`);
	}

	// Bad JSON body
	if (err instanceof SyntaxError && 'body' in err) {
		error = new ApiError(400, 'Invalid JSON payload');
	}

	if (!(error instanceof ApiError)) {
		const status = err.statusCode || 500;
		const message = err.message || 'Internal server error';
		error = new ApiError(status, message);
	}

	return next(error);
};

const errorHandler = (err, req, res, next) => {
	const statusCode = err.statusCode || 500;
	const message = err.message || 'Internal server error';

	// Log the error with context
	logger.error('Request error', {
		method: req.method,
		path: req.originalUrl,
		statusCode,
		message,
		details: err.details,
		stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
	});

	const payload = {
		success: false,
		message,
		...(err.details ? { errors: err.details } : {}),
	};

	if (process.env.NODE_ENV !== 'production') {
		payload.stack = err.stack;
	}

	res.status(statusCode).json(payload);
};

const notFound = (req, res) => {
	logger.warn('Route not found', { method: req.method, path: req.originalUrl });
	res.status(404).json({ success: false, message: 'Route not found' });
};

module.exports = {
	ApiError,
	errorConverter,
	errorHandler,
	notFound,
};
