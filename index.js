require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const logger = require('./src/utils/logger');
const config = require('./src/config');
const { connectDB } = require('./src/config/database');
const { errorConverter, errorHandler, notFound } = require('./src/middleware/errorHandler');

// Middleware
const authMiddleware = require('./src/middleware/auth');

// Routes
const healthRoutes = require('./src/routes/healthRoutes');
const tourGuideRoutes = require('./src/tourguide/routes');
const bookingRoutes = require('./src/routes/bookingRoutes');
const tourPackageBookingRoutes = require('./src/tourpackage_booking/routes');
const paymentsRoutes = require('./src/payments/routes');

const app = express();

// --- Configuration ---
const PORT = process.env.PORT || config.port || 3009;
const CORS_ORIGINS = (
  process.env.CORS_ORIGINS ||
  (Array.isArray(config.corsOrigins) ? config.corsOrigins.join(',') : config.corsOrigins) ||
  ''
)
  .split(',')
  .filter(Boolean);

// --- Core Middleware ---
app.use(cors({ origin: CORS_ORIGINS.length ? CORS_ORIGINS : true, credentials: true }));
app.use(express.json());
app.use(morgan('combined', { stream: logger.stream }));

// --- Health Check ---
app.use('/', healthRoutes);
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'booking-service', timestamp: new Date().toISOString() });
});

// --- Static Files ---
app.use('/public', express.static(path.join(process.cwd(), 'public')));

// --- Routes ---
// Public or unprotected routes
app.use('/tourguide', tourGuideRoutes);
app.use('/tourpackage_booking', tourPackageBookingRoutes);
app.use('/payments', paymentsRoutes);

// Protected routes (require authentication)
app.use('/', authMiddleware, bookingRoutes);

// --- Error Handling ---
app.use(notFound);
app.use(errorConverter);
app.use(errorHandler);

// --- Start Server ---
connectDB().then(() => {
  app.listen(PORT, () => {
    logger.info(`🚀 Booking service listening on port ${PORT}`);
  });
});
