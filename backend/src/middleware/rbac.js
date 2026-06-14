const User = require('../models/User');
const RevokedPermission = require('../models/RevokedPermission');
const SystemActionLog = require('../models/SystemActionLog');
const logger = require('../utils/logger');
const socketService = require('../services/socketService');
const cacheService = require('../services/cacheService');
const { ROLES, ROLE_LEVELS, PERMISSIONS, hasPermission, canManageRole } = require('../config/roles');

// Role hierarchy levels
const ROLE_HIERARCHY = {
  'SUPER_ADMIN': 100,
  'HR': 80,
  'MANAGER': 50,
  'EMPLOYEE': 10
};

// Permission matrix
const PERMISSION_MATRIX = {
  'SUPER_ADMIN': {
    canViewAllData: true,
    canEditAnyAttendance: true,
    canManageUsers: true,
    canRevokeAccess: true,
    canViewSuperAdminLogs: true,
    canLockPayroll: true,
    canDefinePolicies: true,
    canOverrideAnything: true,
    canManageSystem: true
  },
  'HR': {
    canViewAllData: true,
    canEditAttendance: true,
    canManageUsers: true,
    canLockPayroll: true,
    canDefinePolicies: true,
    canApproveRequests: true,
    canHandleEscalations: true,
    canViewReports: true,
    canManageShifts: true,
    canManageGeoFence: true
  },
  'MANAGER': {
    canViewTeamData: true,
    canApproveTeamRequests: true,
    canViewTeamAttendance: true,
    canViewTeamReports: true
  },
  'EMPLOYEE': {
    canViewSelfData: true,
    canSubmitRequests: true,
    canViewSelfAttendance: true
  }
};

// Check if user can access resource
exports.canAccessResource = (resourceType, action) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const targetUserId = req.params.userId || req.params.id || req.body.user_id;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }
      
      // Super Admin can access everything
      if (user.role === 'SUPER_ADMIN') {
        return next();
      }
      
      // Check revoked permissions first
      const capabilityMap = {
        'edit_attendance': 'override_attendance',
        'view_all_data': 'view_all_data',
        'manage_users': 'upload_employees',
        'lock_payroll': 'lock_payroll',
        'approve_requests': 'approve_requests'
      };
      
      const capability = capabilityMap[action];
      
      if (capability) {
        const isRevoked = await RevokedPermission.isCapabilityRevoked(user._id, capability);
        if (isRevoked) {
          return res.status(403).json({
            success: false,
            error: `Your ${capability} access has been revoked`
          });
        }
      }
      
      // HR can access everything except Super Admin data
      if (user.role === 'HR') {
        if (targetUserId) {
          const targetUser = await User.findById(targetUserId);
          if (targetUser && targetUser.role === 'SUPER_ADMIN') {
            return res.status(403).json({
              success: false,
              error: 'Cannot access Super Admin data'
            });
          }
        }
        return next();
      }
      
      // Manager can only access their team
      if (user.role === 'MANAGER') {
        if (targetUserId) {
          const targetUser = await User.findById(targetUserId);
          if (!targetUser) {
            return res.status(404).json({
              success: false,
              error: 'User not found'
            });
          }
          
          // Check if target user is in manager's team
          if (targetUser.manager_id?.toString() !== user._id.toString() && 
              targetUser._id.toString() !== user._id.toString()) {
            return res.status(403).json({
              success: false,
              error: 'Can only access team members data'
            });
          }
        }
        return next();
      }
      
      // Employee can only access their own data
      if (user.role === 'EMPLOYEE') {
        if (targetUserId && targetUserId !== user._id.toString()) {
          return res.status(403).json({
            success: false,
            error: 'Can only access own data'
          });
        }
        return next();
      }
      
      res.status(403).json({
        success: false,
        error: 'Access denied'
      });
      
    } catch (error) {
      logger.error('RBAC resource access error:', error);
      next(error);
    }
  };
};

// Check role level
exports.hasRoleLevel = (minimumLevel) => {
  return (req, res, next) => {
    const userLevel = ROLE_HIERARCHY[req.user?.role] || 0;
    
    if (userLevel >= minimumLevel) {
      next();
    } else {
      res.status(403).json({
        success: false,
        error: 'Insufficient role level'
      });
    }
  };
};

// Check if user can view logs
exports.canViewLogs = async (req, res, next) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }
    
    // Store filter for later use
    req.logFilter = {};
    
    if (user.role === 'SUPER_ADMIN') {
      // Super Admin sees everything
      req.logFilter = {};
    } else if (user.role === 'HR') {
      // HR cannot see Super Admin actions
      req.logFilter = { is_super_admin_action: { $ne: true } };
    } else if (user.role === 'MANAGER') {
      // Manager can only see team logs
      const teamMembers = await User.findTeamMembers(user._id);
      const teamIds = teamMembers.map(m => m._id);
      req.logFilter = {
        $or: [
          { actor_user_id: { $in: teamIds } },
          { target_user_id: { $in: teamIds } }
        ]
      };
    } else {
      // Employee can only see their own logs
      req.logFilter = {
        $or: [
          { actor_user_id: user._id },
          { target_user_id: user._id }
        ]
      };
    }
    
    next();
  } catch (error) {
    logger.error('Log visibility error:', error);
    next(error);
  }
};

// Super Admin action logging
exports.logSuperAdminAction = async (req, res, next) => {
  try {
    const originalJson = res.json;
    
    res.json = function(data) {
      // Only log mutations (POST, PUT, PATCH, DELETE), ignore GET requests
      if (req.user?.role === 'SUPER_ADMIN' && res.statusCode < 400 && req.method !== 'GET') {
        // Log successful Super Admin actions
        SystemActionLog.create({
          actor_user_id: req.user._id,
          actor_role: 'SUPER_ADMIN',
          action_type: 'SUPER_ADMIN_ACTION',
          target_entity_type: req.baseUrl,
          new_value: req.method === 'GET' ? null : data,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          session_id: req.session?.id,
          is_super_admin_action: true
        }).then(log => {
          // Emit real-time event to Super Admins
          socketService.emitToRole('SUPER_ADMIN', 'new_super_admin_log', log);
          // Clear dashboard caches if relevant
          if (req.method !== 'GET') {
            cacheService.clear('dashboard_stats_*');
          }
        }).catch(err => logger.error('Failed to log Super Admin action:', err));
      }
      
      originalJson.call(this, data);
    };
    
    next();
  } catch (error) {
    logger.error('Super Admin logging error:', error);
    next();
  }
};

// Check if user can manage target user
exports.canManageUser = async (req, res, next) => {
  try {
    const actor = req.user;
    const targetUserId = req.params.userId || req.params.id || req.body.user_id;
    
    if (!targetUserId) {
      return next();
    }
    
    const targetUser = await User.findById(targetUserId);
    
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Super Admin can manage everyone
    if (actor.role === 'SUPER_ADMIN') {
      return next();
    }
    
    // HR can manage everyone except Super Admin
    if (actor.role === 'HR' && targetUser.role !== 'SUPER_ADMIN') {
      return next();
    }
    
    // Manager can manage their team members
    if (actor.role === 'MANAGER' && 
        targetUser.role === 'EMPLOYEE' && 
        targetUser.manager_id?.toString() === actor._id.toString()) {
      return next();
    }
    
    // Self management
    if (actor._id.toString() === targetUser._id.toString()) {
      return next();
    }
    
    return res.status(403).json({
      success: false,
      error: 'Cannot manage this user'
    });
    
  } catch (error) {
    logger.error('User management check error:', error);
    next(error);
  }
};

// Check specific permission
exports.requirePermission = (permission) => {
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
      
      // Check if permission exists in matrix
      const userPermissions = PERMISSION_MATRIX[user.role] || {};
      
      if (!userPermissions[permission]) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }
      
      next();
    } catch (error) {
      logger.error('Permission check error:', error);
      next(error);
    }
  };
};

// Check if user can approve requests
exports.canApproveRequest = async (req, res, next) => {
  try {
    const user = req.user;
    const requestId = req.params.id;
    
    const RegularizationRequest = require('../models/RegularizationRequest');
    const request = await RegularizationRequest.findById(requestId);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }
    
    // Super Admin can approve any request
    if (user.role === 'SUPER_ADMIN') {
      return next();
    }
    
    // HR can approve escalated requests
    if (user.role === 'HR' && ['PENDING_HR', 'ESCALATED'].includes(request.status)) {
      return next();
    }
    
    // Manager can approve their team's pending requests
    if (user.role === 'MANAGER' && 
        request.manager_id?.toString() === user._id.toString() && 
        request.status === 'PENDING_MANAGER') {
      return next();
    }
    
    return res.status(403).json({
      success: false,
      error: 'Cannot approve this request'
    });
    
  } catch (error) {
    logger.error('Approval permission check error:', error);
    next(error);
  }
};

// Get accessible departments for user
exports.getAccessibleDepartments = async (user) => {
  if (user.role === 'SUPER_ADMIN' || user.role === 'HR') {
    return null; // All departments
  }
  
  if (user.role === 'MANAGER') {
    const teamMembers = await User.findTeamMembers(user._id);
    const departments = [...new Set(teamMembers.map(m => m.department))];
    return departments;
  }
  
  return [user.department];
};

// Check if user can access department data
exports.canAccessDepartment = async (req, res, next) => {
  try {
    const user = req.user;
    const department = req.params.department || req.query.department;
    
    if (!department) {
      return next();
    }
    
    if (['SUPER_ADMIN', 'HR'].includes(user.role)) {
      return next();
    }
    
    if (user.role === 'MANAGER') {
      const accessibleDepts = await exports.getAccessibleDepartments(user);
      if (accessibleDepts.includes(department)) {
        return next();
      }
    }
    
    if (user.department === department) {
      return next();
    }
    
    return res.status(403).json({
      success: false,
      error: 'Cannot access this department data'
    });
    
  } catch (error) {
    logger.error('Department access check error:', error);
    next(error);
  }
};