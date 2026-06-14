const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const logger = require('./src/utils/logger');
const { connectDB, disconnectDB } = require('./src/config/database');
const initializeRoles = require('./src/utils/initRoles');
const socketService = require('./src/services/socketService');

// Create uploads directory if it doesn't exist
const uploadDirs = ['uploads', 'uploads/photos', 'uploads/documents', 'uploads/temp'];
uploadDirs.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logger.info(`Created directory: ${dirPath}`);
  }
});

const PORT = process.env.PORT || 5000;
let server;
let shuttingDown = false;

const getDatabaseFailureHint = (error) => {
  if (
    error.name === 'MongooseServerSelectionError' &&
    process.env.MONGODB_URI?.startsWith('mongodb+srv://')
  ) {
    return 'Atlas nodes are unreachable. Check Atlas Network Access/IP allowlisting, cluster status, and firewall access to port 27017.';
  }

  return 'Check MONGODB_URI and confirm that MongoDB is running and reachable.';
};

const startServer = async () => {
  try {
    await connectDB();
    await initializeRoles();

    // Import after connecting so the session store can reuse the active MongoDB client.
    const app = require('./src/app');
    server = app.listen(PORT, () => {
      // Initialize Socket.io
      socketService.init(server);

      logger.info([
        'Attendance Management System API',
        `Server: http://localhost:${PORT}`,
        `Environment: ${process.env.NODE_ENV || 'development'}`,
        'MongoDB: Connected',
        `API Documentation: http://localhost:${PORT}/api/docs`,
        `Health Check: http://localhost:${PORT}/health`
      ].join('\n'));
    });
  } catch (error) {
    logger.error('Backend startup aborted because MongoDB connection failed.', {
      error: error.message,
      hint: getDatabaseFailureHint(error)
    });
    process.exit(1);
  }
};

const shutdown = async (reason, exitCode = 0) => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  logger.info(`${reason}. Shutting down...`);

  try {
    if (server) {
      await new Promise(resolve => server.close(resolve));
      logger.info('HTTP server closed.');
    }

    if (mongoose.connection.readyState !== 0) {
      await disconnectDB();
    }
  } catch (error) {
    logger.error('Error during shutdown:', {
      error: error.message,
      stack: error.stack
    });
    exitCode = 1;
  } finally {
    process.exit(exitCode);
  }
};

process.on('unhandledRejection', (err, promise) => {
  logger.error(`Unhandled Rejection: ${err.message}`, {
    stack: err.stack,
    promise
  });
  shutdown('Unhandled rejection', 1);
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, {
    stack: err.stack
  });
  shutdown('Uncaught exception', 1);
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();

module.exports = { startServer, shutdown };
