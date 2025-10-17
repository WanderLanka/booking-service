module.exports = {
  // Booking DB (service-specific first, then generic, then default)
  mongoUri: process.env.BOOKING_MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017',
  dbName: process.env.BOOKING_DB_NAME || 'wanderlanka_booking',
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean),
};
