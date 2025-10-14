const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/wanderlanka';
    await mongoose.connect(mongoUri);

    logger.info('✅ MongoDB connected');
  } catch (error) {
    logger.error('❌ MongoDB connection error', { message: error.message });
    process.exit(1);
  }
};

module.exports = { connectDB };
