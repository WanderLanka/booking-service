const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const isProd = process.env.NODE_ENV === 'production';

const logFormat = format.printf(({ level, message, timestamp, stack, ...meta }) => {
  const base = `${timestamp} [${level}] ${message}`;
  const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  const errorStack = stack ? `\n${stack}` : '';
  return base + extra + errorStack;
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  format: format.combine(
    format.errors({ stack: true }),
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    format.splat(),
    format.json(),
    logFormat
  ),
  transports: [
    new DailyRotateFile({
      dirname: logsDir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '14d',
      level: 'info'
    }),
    new DailyRotateFile({
      dirname: logsDir,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '30d',
      level: 'error'
    })
  ]
});

// Console transport in non-production for easier local debugging
if (!isProd) {
  logger.add(new transports.Console({
    level: process.env.CONSOLE_LOG_LEVEL || 'debug',
    format: format.combine(
      format.colorize(),
      format.timestamp({ format: 'HH:mm:ss' }),
      logFormat
    )
  }));
}

// Stream interface for morgan
logger.stream = {
  write: (message) => {
    // Use info to ensure file transports (level >= info) capture access logs
    logger.info(message.trim());
  }
};

module.exports = logger;