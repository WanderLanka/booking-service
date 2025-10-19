const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const level = process.env.LOG_LEVEL || 'info';

const logger = createLogger({
  level,
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({
      level,
      format: format.combine(format.colorize(), format.simple()),
    }),
    new DailyRotateFile({
      filename: path.join(logDir, 'booking-service-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level,
    }),
  ],
});

logger.stream = {
  write: (message) => logger.info(message.trim()),
};

module.exports = logger;
