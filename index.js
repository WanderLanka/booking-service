require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const logger = require('./src/utils/logger');
const cors = require('cors');

const config = require('./src/config');
const { connectDB } = require('./src/config/database');
const tourGuideRoutes = require('./src/tourguide/routes');
const { errorConverter, errorHandler, notFound } = require('./src/middleware/errorHandler');

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

// Not found and error handlers
app.use(notFound);
app.use(errorConverter);
app.use(errorHandler);

// Start
connectDB().then(() => {
  app.listen(config.port, () => {
    logger.info(`🚀 Booking service listening on port ${config.port}`);
  });
});