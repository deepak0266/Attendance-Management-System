const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const fs = require('fs');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimiter');
const { authMiddleware, csrfProtection } = require('./middleware/auth');

// Import routes
const authRoutes = require('./routes/authRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const reportRoutes = require('./routes/reportRoutes');
const approvalRoutes = require('./routes/approvalRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const roleRoutes = require('./routes/roleRoutes');

// Import logger
const logger = require('./utils/logger');

// Initialize express app
const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Determine runtime flags
const isProd = process.env.NODE_ENV === 'production';
const allowedOrigins = [
  ...(process.env.CORS_ORIGIN || '').split(','),
  process.env.FRONTEND_URL || '',
  ...(!isProd ? ['http://localhost:3000'] : [])
].map(origin => origin.trim()).filter(Boolean);
const isAllowedOrigin = (origin) => {
  if (!origin || allowedOrigins.includes(origin)) {
    return true;
  }

  if (!isProd) {
    return true; // Allow all origins in development (for ngrok/localtunnel/local network)
  }

  return false;
};
const mongoClientPromise = mongoose.connection.readyState === 1
  ? Promise.resolve(mongoose.connection.getClient())
  : new Promise((resolve, reject) => {
      mongoose.connection.once('connected', () => resolve(mongoose.connection.getClient()));
      mongoose.connection.once('error', reject);
    });

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", ...(isProd ? [] : ["'unsafe-inline'", "'unsafe-eval'"])],
      styleSrc: ["'self'", ...(isProd ? [] : ["'unsafe-inline'"])],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", ...allowedOrigins],
      frameAncestors: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      const error = new Error(`CORS policy violation: origin not allowed (${origin})`);
      error.statusCode = 403;
      callback(error);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['Content-Type', 'Authorization']
}));

// Compression middleware
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON' });
      throw new Error('Invalid JSON');
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn(`Attempted NoSQL injection - Key: ${key}`, { 
      ip: req.ip, 
      path: req.path 
    });
  }
}));

// Prevent parameter pollution
app.use(hpp({
  whitelist: [
    'date',
    'startDate',
    'endDate',
    'status',
    'department',
    'role',
    'shift_id'
  ]
}));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    clientPromise: mongoClientPromise,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60, // 1 day
    autoRemove: 'native',
    crypto: {
      secret: process.env.SESSION_SECRET || 'your-secret-key-change-this'
    }
  }),
  cookie: {
    secure: isProd,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    sameSite: isProd ? 'none' : 'lax',
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: '/api'
  },
  name: 'attendance.sid'
}));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl}`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  });
  
  next();
});

// Rate limiting
app.use('/api/', rateLimiter);

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: new Date().toISOString(),
    responseTime: process.hrtime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  };
  
  try {
    res.status(200).json(healthcheck);
  } catch (error) {
    healthcheck.message = error.message;
    res.status(503).json(healthcheck);
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', authMiddleware, csrfProtection, attendanceRoutes);
app.use('/api/users', authMiddleware, csrfProtection, userRoutes);
app.use('/api/admin', authMiddleware, csrfProtection, adminRoutes);
app.use('/api/reports', authMiddleware, csrfProtection, reportRoutes);
app.use('/api/approvals', authMiddleware, csrfProtection, approvalRoutes);
app.use('/api/notifications', authMiddleware, csrfProtection, notificationRoutes);
app.use('/api/roles', authMiddleware, csrfProtection, roleRoutes);

// API Documentation route (optional)
app.get('/api/docs', (req, res) => {
  res.json({
    name: 'Attendance Management System API',
    version: '1.0.0',
    description: 'Production-grade attendance management system',
    endpoints: {
      auth: '/api/auth',
      attendance: '/api/attendance',
      users: '/api/users',
      admin: '/api/admin',
      reports: '/api/reports',
      approvals: '/api/approvals',
      notifications: '/api/notifications',
      roles: '/api/roles'
    },
    documentation: 'Contact admin for detailed API documentation'
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    error: 'API endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Serve static frontend files in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  
  if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
  }
}

// Global error handling middleware
app.use(errorHandler);

// Handle 404 for non-API routes
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl 
  });
});

module.exports = app;
