const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    // Prefer service-specific env vars first, then generic, then safe default
    const mongoUri = process.env.BOOKING_MONGO_URI
      || process.env.MONGO_URI
      || 'mongodb://localhost:27017/wanderlanka_booking';

    const dbName = process.env.BOOKING_DB_NAME; // optional override
    const options = dbName ? { dbName } : {};

    await mongoose.connect(mongoUri, options);

    logger.info(`✅ MongoDB connected (booking-service) uri=${mongoUri}${dbName ? ` db=${dbName}` : ''}`);
  } catch (error) {
    logger.error('❌ MongoDB connection error', { message: error.message });
    process.exit(1);
  }
};

module.exports = { connectDB };
