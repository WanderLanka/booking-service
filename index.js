require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const logger = require('./src/utils/logger');
const cors = require('cors');

const config = require('./src/config');
const { connectDB } = require('./src/config/database');
const tourGuideRoutes = require('./src/tourguide/routes');

const app = express();

// Core middleware
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json());
app.use(morgan('combined', { stream: logger.stream }));

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'booking-service', timestamp: new Date().toISOString() });
});

// Namespaced routes
app.use('/tourguide', tourGuideRoutes);

// Not found handler
app.use((req, res) => {
  logger.warn('Route not found', { method: req.method, path: req.path });
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err?.stack || String(err) });
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// Start
connectDB().then(() => {
  app.listen(config.port, () => {
    logger.info(`🚀 Booking service listening on port ${config.port}`);
  });
});