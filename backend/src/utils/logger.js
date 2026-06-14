const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format (colored for development)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'attendance-api' },
  transports: [
    // Write all logs to file
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10
    })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Create audit logger (separate file for audit logs)
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'audit.log'),
      maxsize: 10485760,
      maxFiles: 30
    })
  ]
});

// Create access logger for HTTP requests
const accessLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'access.log'),
      maxsize: 10485760,
      maxFiles: 10
    })
  ]
});

// Stream for Morgan (HTTP request logging)
logger.stream = {
  write: (message) => {
    accessLogger.info(message.trim());
  }
};

// Log audit events
logger.audit = (action, data) => {
  auditLogger.info(action, data);
};

// Log security events
logger.security = (event, data) => {
  logger.warn(`[SECURITY] ${event}`, data);
  auditLogger.warn(`[SECURITY] ${event}`, data);
};

// Log performance metrics
logger.performance = (operation, duration, metadata = {}) => {
  logger.info(`[PERFORMANCE] ${operation} took ${duration}ms`, metadata);
};

// Log API requests
logger.request = (req, res, duration) => {
  accessLogger.info('API Request', {
    method: req.method,
    url: req.originalUrl,
    status: res.statusCode,
    duration: `${duration}ms`,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id
  });
};

// Log database queries (only in development)
if (process.env.NODE_ENV === 'development' && process.env.LOG_DB_QUERIES === 'true') {
  const mongoose = require('mongoose');
  mongoose.set('debug', (collectionName, method, query, doc) => {
    logger.debug('MongoDB Query', {
      collection: collectionName,
      method,
      query,
      doc
    });
  });
}

module.exports = logger;