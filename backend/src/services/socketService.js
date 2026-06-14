const socketIo = require('socket.io');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');

class SocketService {
  constructor() {
    this.io = null;
  }

  init(server) {
    this.io = socketIo(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.io.use((socket, next) => {
      try {
        let token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        if (!token && socket.handshake.headers.cookie) {
          const cookies = cookie.parse(socket.handshake.headers.cookie);
          token = cookies.token;
        }

        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
        next();
      } catch (err) {
        next(new Error('Authentication error: Invalid token'));
      }
    });

    this.io.on('connection', (socket) => {
      logger.info(`Socket connected: ${socket.id} (User: ${socket.user.id})`);

      // Join personal room for user-specific events
      socket.join(`user_${socket.user.id}`);

      // Join role-based room
      if (socket.user.role) {
        socket.join(`role_${socket.user.role}`);
      }

      socket.on('disconnect', () => {
        logger.info(`Socket disconnected: ${socket.id}`);
      });
    });

    logger.info('Socket.io initialized successfully');
  }

  // Emit to all connected clients
  emitToAll(event, data) {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  // Emit to specific user
  emitToUser(userId, event, data) {
    if (this.io) {
      this.io.to(`user_${userId}`).emit(event, data);
    }
  }

  // Emit to specific role (e.g. SUPER_ADMIN, HR)
  emitToRole(role, event, data) {
    if (this.io) {
      this.io.to(`role_${role}`).emit(event, data);
    }
  }
}

module.exports = new SocketService();
