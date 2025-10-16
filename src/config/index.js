require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3009,
  // Prefer service-specific connection for booking service
  mongoUri: process.env.BOOKING_MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/wanderlanka_booking',
  dbName: process.env.BOOKING_DB_NAME || undefined,
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-key',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),
};

module.exports = config;
