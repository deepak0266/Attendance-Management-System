const mongoose = require('mongoose');
const logger = require('../utils/logger');

// MongoDB connection options
const mongooseOptions = {
  maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10,
  minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4, // Use IPv4, skip trying IPv6
  retryWrites: true,
  retryReads: true,
  w: 'majority',
  readPreference: 'primaryPreferred',
  maxIdleTimeMS: 10000,
  heartbeatFrequencyMS: 10000
};

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/attendance_system';

    const conn = await mongoose.connect(mongoURI, mongooseOptions);
    
    logger.info(`MongoDB Connected: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', {
        error: err.message,
        stack: err.stack,
        code: err.code
      });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected successfully');
    });

    mongoose.connection.on('reconnectFailed', () => {
      logger.error('MongoDB reconnection failed. Manual intervention required.');
    });

    // Monitor connection pool
    setInterval(() => {
      const poolSize = mongoose.connection.client.s.options.maxPoolSize;
      const activeConnections = mongoose.connections.length;
      
      logger.debug('Connection pool status', {
        poolSize,
        activeConnections,
        readyState: mongoose.connection.readyState
      });
    }, 60000); // Every minute

    // Create indexes after connection
    await createIndexes();

    return conn;
  } catch (error) {
    logger.error('MongoDB connection failed:', {
      error: error.message,
      stack: error.stack,
      code: error.code
    });
    throw error;
  }
};

// Create database indexes
const createIndexes = async () => {
  try {
    logger.info('Creating database indexes...');
    
    const User = require('../models/User');
    const AttendanceLog = require('../models/AttendanceLog');
    const SystemActionLog = require('../models/SystemActionLog');
    const RevokedPermission = require('../models/RevokedPermission');
    const Shift = require('../models/Shift');
    const Policy = require('../models/Policy');
    const GeoFence = require('../models/GeoFence');
    const RegularizationRequest = require('../models/RegularizationRequest');
    const BreakLog = require('../models/BreakLog');
    const PayrollLock = require('../models/PayrollLock');

    // Create indexes for each model
    await User.createIndexes();
    await AttendanceLog.createIndexes();
    await SystemActionLog.createIndexes();
    await RevokedPermission.createIndexes();
    await Shift.createIndexes();
    await Policy.createIndexes();
    await GeoFence.createIndexes();
    await RegularizationRequest.createIndexes();
    await BreakLog.createIndexes();
    await PayrollLock.createIndexes();

    logger.info('All database indexes created successfully');
  } catch (error) {
    logger.error('Error creating database indexes:', error);
    throw error;
  }
};

// Get database status
const getDatabaseStatus = () => {
  const state = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  return {
    state: states[state] || 'unknown',
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name,
    models: Object.keys(mongoose.models).length,
    poolSize: mongoose.connection.client?.s?.options?.maxPoolSize || 0
  };
};

// Health check
const healthCheck = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return {
        healthy: false,
        error: 'Database not connected'
      };
    }

    // Perform a quick query to verify database is responsive
    await mongoose.connection.db.admin().ping();
    
    return {
      healthy: true,
      ...getDatabaseStatus()
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message
    };
  }
};

// Disconnect from database
const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting from MongoDB:', error);
    throw error;
  }
};

module.exports = {
  connectDB,
  disconnectDB,
  getDatabaseStatus,
  healthCheck,
  createIndexes
};