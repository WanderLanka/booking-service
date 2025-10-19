const mongoose = require('mongoose');
const logger = require('../utils/logger');
const config = require('./index');

function sanitizeMongoUri(uri) {
  try {
    return uri.replace(/(mongodb(\+srv)?:\/\/)([^:]+):([^@]+)@/i, '$1****:****@');
  } catch {
    return uri;
  }
}

async function connectDB() {
  const uri = config.mongoUri;
  const dbName = config.dbName;
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    autoIndex: true,
    maxPoolSize: 10,
    dbName,
  });
  logger.info(`MongoDB connected (booking-service) uri=${sanitizeMongoUri(uri)} db=${dbName}`);
}

module.exports = { connectDB };
