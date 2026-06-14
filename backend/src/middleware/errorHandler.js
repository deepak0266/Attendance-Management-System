const logger = require('../utils/logger');
const mongoose = require('mongoose');

// Custom error class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Global error handler
exports.errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  
  // Log error
  logger.error('Error occurred:', {
    message: error.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id,
    statusCode: error.statusCode || 500
  });
  
  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = `Invalid ${err.path}: ${err.value}`;
    error = new AppError(message, 400);
  }
  
  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    const value = err.keyValue[field];
    const message = `Duplicate field value: ${field} '${value}' already exists`;
    error = new AppError(message, 400);
  }
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    const message = `Invalid input data: ${errors.join('. ')}`;
    error = new AppError(message, 400);
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token. Please login again.', 401);
  }
  
  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token expired. Please login again.', 401);
  }
  
  // Multer errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      error = new AppError('File too large. Maximum size is 5MB.', 400);
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      error = new AppError(`Unexpected field: ${err.field}`, 400);
    } else {
      error = new AppError('File upload error', 400);
    }
  }
  
  // MongoDB connection errors
  if (err.name === 'MongoNetworkError' || err.name === 'MongoServerSelectionError') {
    error = new AppError('Database connection error. Please try again later.', 503);
  }
  
  // Send response
  const statusCode = error.statusCode || 500;
  const status = error.status || 'error';
  
  const response = {
    success: false,
    error: error.message || 'An unexpected error occurred',
    status
  };
  
  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.details = error;
  }
  
  // Add request ID for tracking
  response.requestId = req.id || req.headers['x-request-id'];
  
  res.status(statusCode).json(response);
};

// Not found handler
exports.notFound = (req, res, next) => {
  const error = new AppError(`Route not found: ${req.originalUrl}`, 404);
  next(error);
};

// Async handler wrapper
exports.asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Mongoose error handler middleware
exports.handleMongooseError = (err, req, res, next) => {
  if (err instanceof mongoose.Error) {
    if (err.name === 'ValidationError') {
      const errors = {};
      
      for (const field in err.errors) {
        errors[field] = err.errors[field].message;
      }
      
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }
    
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: `Invalid ${err.path}: ${err.value}`
      });
    }
  }
  
  next(err);
};

// Process error handlers
exports.handleUncaughtException = () => {
  process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION! Shutting down...', {
      error: err.message,
      stack: err.stack
    });
    
    // Give time for logs to be written
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
};

exports.handleUnhandledRejection = () => {
  process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! Shutting down...', {
      error: err.message,
      stack: err.stack
    });
    
    // Give time for logs to be written
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
};

// Initialize process handlers
exports.initErrorHandlers = () => {
  exports.handleUncaughtException();
  exports.handleUnhandledRejection();
};

// Export AppError class
exports.AppError = AppError;

// Validation error formatter
exports.formatValidationError = (error) => {
  if (error.name === 'ValidationError') {
    const errors = {};
    
    for (const field in error.errors) {
      errors[field] = error.errors[field].message;
    }
    
    return {
      success: false,
      error: 'Validation failed',
      details: errors
    };
  }
  
  return null;
};

// Database error handler
exports.handleDatabaseError = (err, req, res, next) => {
  // Handle MongoDB duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    const value = err.keyValue[field];
    
    return res.status(409).json({
      success: false,
      error: `Duplicate value: ${field} '${value}' already exists`,
      field
    });
  }
  
  next(err);
};

// Rate limit error handler
exports.handleRateLimitError = (err, req, res, next) => {
  if (err.statusCode === 429) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfter: err.retryAfter || 60
    });
  }
  
  next(err);
};

// Maintenance mode middleware
exports.maintenanceMode = (req, res, next) => {
  if (process.env.MAINTENANCE_MODE === 'true') {
    // Allow certain IPs or admin routes
    const allowedIPs = process.env.MAINTENANCE_ALLOWED_IPS?.split(',') || [];
    
    if (allowedIPs.includes(req.ip) || req.user?.role === 'SUPER_ADMIN') {
      return next();
    }
    
    return res.status(503).json({
      success: false,
      error: 'System is under maintenance. Please try again later.',
      estimatedDowntime: process.env.MAINTENANCE_ESTIMATED_DURATION || '1 hour'
    });
  }
  
  next();
};

// Timeout middleware
exports.timeout = (seconds = 30) => {
  return (req, res, next) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(503).json({
          success: false,
          error: 'Request timeout'
        });
      }
    }, seconds * 1000);
    
    res.on('finish', () => clearTimeout(timeout));
    next();
  };
};