const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RevokedPermission = require('../models/RevokedPermission');
const Role = require('../models/Role');
const SystemActionLog = require('../models/SystemActionLog');
const logger = require('../utils/logger');

const parseCookies = (cookieHeader = '') => cookieHeader.split(';').reduce((cookies, cookieSegment) => {
  const [name, ...value] = cookieSegment.split('=');
  if (!name) return cookies;
  cookies[name.trim()] = decodeURIComponent(value.join('=').trim());
  return cookies;
}, {});

const getCookie = (req, name) => {
  if (req.headers?.cookie) {
    const cookies = parseCookies(req.headers.cookie);
    return cookies[name];
  }
  return undefined;
};

// Main authentication middleware
exports.authMiddleware = async (req, res, next) => {
  try {
    let token;
    
    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Fallback to cookie-based access token when available
    if (!token) {
      token = getCookie(req, 'accessToken');
    }
    
    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please login.'
      });
    }
    
    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expired. Please refresh your token.',
          code: 'TOKEN_EXPIRED'
        });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Invalid token. Please login again.',
          code: 'INVALID_TOKEN'
        });
      }
      throw error;
    }
    
    // Check token type
    if (decoded.type && decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token type'
      });
    }
    
    // Get user from database
    const user = await User.findById(decoded.userId)
      .select('-password_hash -refresh_token_hash -two_factor_secret');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found or account deactivated'
      });
    }
    
    // Check if user is active
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error: 'Account is not active. Please contact HR.'
      });
    }
    
    // Check if account is locked
    if (user.isAccountLocked && user.isAccountLocked()) {
      return res.status(403).json({
        success: false,
        error: 'Account is temporarily locked. Please try again later.'
      });
    }
    
    // Check if login capability is revoked
    const loginRevoked = await RevokedPermission.isCapabilityRevoked(user._id, 'login');
    if (loginRevoked) {
      return res.status(403).json({
        success: false,
        error: 'Login access has been revoked. Contact administrator.'
      });
    }
    
    // Attach user to request
    req.user = user;
    req.userId = user._id;
    
    // Update last active timestamp (optional, can be done periodically)
    if (Math.random() < 0.1) { // Only update ~10% of requests to reduce DB load
      user.last_login = new Date();
      user.save().catch(err => logger.error('Failed to update last_login:', err));
    }
    
    next();
    
  } catch (error) {
    logger.error('Auth middleware error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Authentication error. Please try again.'
    });
  }
};

// Optional authentication (doesn't fail if no token)
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      token = getCookie(req, 'accessToken');
    }
    
    if (!token) {
      req.user = null;
      return next();
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId)
      .select('-password_hash -refresh_token_hash');
    
    req.user = user || null;
    
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

// Role-based authorization
exports.authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions. Access denied.'
      });
    }
    
    next();
  };
};

// Permission check middleware
exports.checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }
      
      // Super Admin has all permissions
      if (user.role === 'SUPER_ADMIN') {
        return next();
      }
      
      // Check if permission is revoked
      const isRevoked = await RevokedPermission.isCapabilityRevoked(user._id, permission);
      
      if (isRevoked) {
        // Log attempted access
        await SystemActionLog.create({
          actor_user_id: user._id,
          actor_role: user.role,
          action_type: 'PERMISSION_CHANGE',
          reason: `Attempted to use revoked permission: ${permission}`,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          is_super_admin_action: false
        }).catch(err => logger.error('Failed to log revoked permission attempt:', err));
        
        return res.status(403).json({
          success: false,
          error: 'This permission has been revoked. Contact administrator.'
        });
      }
      
      // Role-based permission mapping for system roles
      const systemRolePermissions = {
        'HR': [
          'override_attendance',
          'upload_employees',
          'lock_payroll',
          'define_policies',
          'view_all_data',
          'handle_escalations',
          'approve_requests',
          'edit_punch_times',
          'view_reports',
          'manage_users',
          'manage_shifts',
          'manage_geofence'
        ],
        'MANAGER': [
          'view_team_data',
          'approve_requests',
          'view_reports',
          'handle_escalations'
        ],
        'EMPLOYEE': [
          'view_self_data',
          'submit_requests'
        ]
      };
      
      let userPermissions = systemRolePermissions[user.role] || [];

      // If no system permissions match, check custom roles in DB
      if (userPermissions.length === 0 && user.role !== 'SUPER_ADMIN') {
        const customRole = await Role.findOne({ name: user.role });
        if (customRole) {
          userPermissions = customRole.permissions || [];
        }
      }
      
      if (!userPermissions.includes(permission)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient role permissions'
        });
      }
      
      next();
      
    } catch (error) {
      logger.error('Permission check error:', error);
      next(error);
    }
  };
};

// Helper for deep hierarchy
const isSubordinate = async (targetUserId, managerId) => {
  if (!targetUserId || !managerId) return false;
  if (targetUserId.toString() === managerId.toString()) return true;
  
  const visited = new Set();
  let currentTarget = await User.findById(targetUserId);
  
  while (currentTarget && currentTarget.manager_id) {
    if (visited.has(currentTarget._id.toString())) break; // prevent infinite loops
    visited.add(currentTarget._id.toString());
    
    if (currentTarget.manager_id.toString() === managerId.toString()) return true;
    currentTarget = await User.findById(currentTarget.manager_id);
  }
  return false;
};

// Check resource ownership or management rights
exports.checkResourceAccess = (resourceType) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const resourceId = req.params.id || req.params.userId || req.body.user_id;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }
      
      // Super Admin has access to everything
      if (user.role === 'SUPER_ADMIN') {
        return next();
      }
      
      // Self access
      if (resourceId && resourceId === user._id.toString()) {
        return next();
      }
      
      // Deep Hierarchy access for anyone with 'view_team_data' permission
      // This includes Custom Roles like Director, VP, and built-in MANAGER
      if (resourceId) {
        // First check if they have the system 'view_all_data' (like HR)
        let hasGlobalAccess = false;
        if (user.role === 'HR') hasGlobalAccess = true;
        
        if (!hasGlobalAccess) {
           const customRole = await Role.findOne({ name: user.role });
           if (customRole && customRole.permissions.includes('view_all_data')) {
             hasGlobalAccess = true;
           }
        }

        if (hasGlobalAccess) {
          const targetUser = await User.findById(resourceId);
          if (targetUser && targetUser.role !== 'SUPER_ADMIN') {
            return next();
          }
        } else {
          // Check if they have team access
          let hasTeamAccess = user.role === 'MANAGER';
          if (!hasTeamAccess) {
            const customRole = await Role.findOne({ name: user.role });
            if (customRole && customRole.permissions.includes('view_team_data')) {
              hasTeamAccess = true;
            }
          }

          if (hasTeamAccess) {
            const isSub = await isSubordinate(resourceId, user._id);
            if (isSub) return next();
          }
        }
      } else {
        // If no resourceId provided, just allow HR or global data viewers
        if (user.role === 'HR') return next();
        const customRole = await Role.findOne({ name: user.role });
        if (customRole && customRole.permissions.includes('view_all_data')) return next();
      }
      
      return res.status(403).json({
        success: false,
        error: 'Access denied to this resource'
      });
      
    } catch (error) {
      logger.error('Resource access check error:', error);
      next(error);
    }
  };
};

// Validate session
exports.validateSession = async (req, res, next) => {
  try {
    const sessionId = req.headers['x-session-id'];
    
    if (!sessionId) {
      return next(); // Optional, can be required
    }
    
    // Check if session is valid
    // This would integrate with a session store (Redis/MongoDB)
    
    next();
  } catch (error) {
    logger.error('Session validation error:', error);
    next(error);
  }
};

// CSRF protection
exports.csrfProtection = (req, res, next) => {
  // Skip for GET requests
  if (req.method === 'GET') {
    return next();
  }
  
  const csrfToken = req.headers['x-csrf-token'];
  const sessionToken = req.session?.csrfToken;
  
  if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
    return res.status(403).json({
      success: false,
      error: 'Invalid CSRF token'
    });
  }
  
  next();
};

// Rate limit by user
exports.userRateLimit = (maxRequests, windowMs) => {
  const requests = new Map();
  
  return (req, res, next) => {
    if (!req.user) {
      return next();
    }
    
    const userId = req.user._id.toString();
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!requests.has(userId)) {
      requests.set(userId, []);
    }
    
    const userRequests = requests.get(userId);
    const validRequests = userRequests.filter(time => time > windowStart);
    
    if (validRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.'
      });
    }
    
    validRequests.push(now);
    requests.set(userId, validRequests);
    
    next();
  };
};

// Clean up expired rate limit entries periodically
setInterval(() => {
  // This would be implemented with Redis in production
}, 60000);