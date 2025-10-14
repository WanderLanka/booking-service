require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3009,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/wanderlanka',
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-key',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),
};

module.exports = config;
