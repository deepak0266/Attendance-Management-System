const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');
const logger = require('../utils/logger');
const { RATE_LIMITS } = require('../config/constants');

// Create Redis client if Redis URL is provided
let redisClient = null;
if (process.env.REDIS_URL) {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL
  });
  
  redisClient.connect().catch(err => {
    logger.error('Redis connection error:', err);
  });
}

// Create rate limiter store
const createStore = () => {
  if (redisClient) {
    return new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
      prefix: 'rl:'
    });
  }
  return undefined; // Use memory store
};

// General API rate limiter
exports.rateLimiter = rateLimit({
  windowMs: RATE_LIMITS.AUTHENTICATED.windowMs,
  max: (req) => {
    // Different limits based on user role
    if (req.user?.role === 'SUPER_ADMIN') {
      return RATE_LIMITS.ADMIN.max;
    }
    return RATE_LIMITS.AUTHENTICATED.max;
  },
  message: {
    success: false,
    error: 'Too many requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user?.id || req.ip;
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userId: req.user?.id
    });
    
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
    });
  }
});

// Login rate limiter (more restrictive)
exports.loginRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.LOGIN.windowMs,
  max: RATE_LIMITS.LOGIN.max,
  message: {
    success: false,
    error: 'Too many login attempts. Please try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore(),
  keyGenerator: (req) => {
    return `login:${req.body.email || req.ip}`;
  },
  skipSuccessfulRequests: true
});

// Attendance punch rate limiter
exports.punchRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.ATTENDANCE.windowMs,
  max: RATE_LIMITS.ATTENDANCE.max,
  message: {
    success: false,
    error: 'Too many punch attempts. Please wait before trying again.'
  },
  standardHeaders: true,
  store: createStore(),
  keyGenerator: (req) => {
    return `punch:${req.user?.id || req.ip}`;
  }
});

// Admin operations rate limiter
exports.adminRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.ADMIN.windowMs,
  max: RATE_LIMITS.ADMIN.max,
  message: {
    success: false,
    error: 'Too many admin operations. Please slow down.'
  },
  standardHeaders: true,
  store: createStore(),
  keyGenerator: (req) => {
    return `admin:${req.user?.id || req.ip}`;
  }
});

// Public API rate limiter
exports.publicRateLimiter = rateLimit({
  windowMs: RATE_LIMITS.PUBLIC.windowMs,
  max: RATE_LIMITS.PUBLIC.max,
  message: {
    success: false,
    error: 'Too many requests from this IP.'
  },
  standardHeaders: true,
  store: createStore()
});

// Dynamic rate limiter factory
exports.createRateLimiter = (options) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000,
    max: options.max || 100,
    message: options.message || { success: false, error: 'Rate limit exceeded' },
    keyGenerator: options.keyGenerator,
    store: createStore(),
    ...options
  });
};

// Burst protection for specific endpoints
exports.burstProtection = (maxBurst, windowSec = 1) => {
  const bursts = new Map();
  
  return (req, res, next) => {
    const key = req.user?.id || req.ip;
    const now = Date.now();
    const windowMs = windowSec * 1000;
    
    if (!bursts.has(key)) {
      bursts.set(key, []);
    }
    
    const requests = bursts.get(key);
    const validRequests = requests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxBurst) {
      logger.warn('Burst protection triggered', { key, count: validRequests.length });
      
      return res.status(429).json({
        success: false,
        error: 'Request rate too high. Please slow down.'
      });
    }
    
    validRequests.push(now);
    bursts.set(key, validRequests);
    
    next();
  };
};

// Clean up memory store periodically
setInterval(() => {
  // Memory cleanup would be handled by Redis TTL in production
}, 60000);