require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { connectDB } = require('./src/config/database');
const logger = require('./src/utils/logger');
const { errorConverter, errorHandler, notFound } = require('./src/middleware/errorHandler');

// Routers
const tourPackageBookingRoutes = require('./src/tourpackage_booking/routes');
const paymentsRoutes = require('./src/payments/routes');
const enhancedBookingRoutes = require('./src/routes/enhancedBookingRoutes');

const app = express();

const PORT = process.env.PORT || 3009;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);

app.use(cors({ origin: CORS_ORIGINS.length ? CORS_ORIGINS : true, credentials: true }));
app.use(express.json());
app.use(morgan('combined', { stream: logger.stream }));

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'booking-service', timestamp: new Date().toISOString() });
});

// Static (if needed later, e.g., invoices)
app.use('/public', express.static(path.join(process.cwd(), 'public')));

// Mount routes
app.use('/tourpackage_booking', tourPackageBookingRoutes);
app.use('/payments', paymentsRoutes);
// Enhanced booking routes - mounted at root to handle API Gateway forwarding
app.use('/', enhancedBookingRoutes);

app.use(notFound);
app.use(errorConverter);
app.use(errorHandler);

connectDB().then(() => {
  app.listen(PORT, () => logger.info(`🚀 Booking service listening on port ${PORT}`));
});
