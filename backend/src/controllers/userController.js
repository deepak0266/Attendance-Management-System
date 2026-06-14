const User = require('../models/User');
const Shift = require('../models/Shift');
const SystemActionLog = require('../models/SystemActionLog');
const RevokedPermission = require('../models/RevokedPermission');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const moment = require('moment');

// @desc    Get all users (with filtering)
// @route   GET /api/users
// @access  Private (HR, Manager, Super Admin)
exports.getUsers = async (req, res, next) => {
  try {
    const { 
      department, 
      role, 
      status, 
      manager_id,
      search,
      page = 1, 
      limit = 20 
    } = req.query;
    
    const query = {};
    const viewer = req.user;
    
    // Apply role-based filtering
    if (viewer.role === 'MANAGER') {
      query.manager_id = viewer.id;
    } else if (viewer.role === 'HR') {
      query.role = { $ne: 'SUPER_ADMIN' };
    }
    
    // Apply filters
    if (department) query.department = department;
    if (role && viewer.role === 'SUPER_ADMIN') query.role = role;
    if (status) query.status = status;
    if (manager_id && viewer.role !== 'MANAGER') query.manager_id = manager_id;
    
    // Search by name, email, or employee ID
    if (search) {
      query.$or = [
        { full_name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employee_id: { $regex: search, $options: 'i' } }
      ];
    }
    
    const skip = (page - 1) * limit;
    
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password_hash -refresh_token_hash -two_factor_secret')
        .populate('manager_id', 'full_name email employee_id')
        .populate('created_by', 'full_name email')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    logger.error('Get users error:', error);
    next(error);
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password_hash -refresh_token_hash -two_factor_secret')
      .populate('manager_id', 'full_name email employee_id')
      .populate('created_by', 'full_name email')
      .populate('updated_by', 'full_name email');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }
    
    // Check access permission
    const canAccess = await checkUserAccess(req.user, user);
    if (!canAccess) {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied' 
      });
    }
    
    // Get user's shift
    const shift = await Shift.findShiftsForUser(user).then(shifts => shifts[0]);
    
    // Get revoked capabilities
    const revokedCapabilities = await RevokedPermission.getRevokedCapabilities(user._id);
    
    res.json({
      success: true,
      data: {
        ...user.toObject(),
        shift: shift ? { id: shift._id, name: shift.name } : null,
        revoked_capabilities: revokedCapabilities
      }
    });
    
  } catch (error) {
    logger.error('Get user error:', error);
    next(error);
  }
};

// @desc    Create new user
// @route   POST /api/users
// @access  Private (HR, Super Admin)
exports.createUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }
    
    const viewer = req.user;
    
    // Check permission
    if (viewer.role === 'HR' && req.body.role === 'SUPER_ADMIN') {
      return res.status(403).json({ 
        success: false,
        error: 'HR cannot create Super Admin accounts' 
      });
    }
    
    // Check if upload capability is revoked
    const isRevoked = await RevokedPermission.isCapabilityRevoked(
      viewer.id,
      'upload_employees'
    );
    
    if (isRevoked && viewer.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ 
        success: false,
        error: 'User creation permission revoked' 
      });
    }
    
    // Check for existing user
    const existingUser = await User.findOne({
      $or: [
        { employee_id: req.body.employee_id },
        { email: req.body.email },
        { phone: req.body.phone }
      ]
    });
    
    if (existingUser) {
      let field = '';
      if (existingUser.employee_id === req.body.employee_id) field = 'Employee ID';
      else if (existingUser.email === req.body.email) field = 'Email';
      else field = 'Phone';
      
      return res.status(400).json({ 
        success: false,
        error: `${field} already exists` 
      });
    }
    
    // Create user
    const userData = {
      ...req.body,
      created_by: viewer.id,
      password_hash: req.body.password || generateDefaultPassword()
    };
    
    const user = new User(userData);
    await user.save();
    
    // Log user creation
    await SystemActionLog.create({
      actor_user_id: viewer.id,
      actor_role: viewer.role,
      action_type: 'USER_CREATE',
      target_user_id: user._id,
      target_entity_type: 'User',
      new_value: {
        employee_id: user.employee_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        department: user.department
      },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      is_super_admin_action: viewer.role === 'SUPER_ADMIN'
    });
    
    // Send welcome email
    if (req.body.send_welcome_email) {
      await sendWelcomeEmail(user, req.body.password);
    }
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: user._id,
        employee_id: user.employee_id,
        email: user.email,
        full_name: user.full_name
      }
    });
    
  } catch (error) {
    logger.error('Create user error:', error);
    next(error);
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (HR, Super Admin)
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const viewer = req.user;
    
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }
    
    // Check permission
    const canManage = await canManageUser(viewer, user);
    if (!canManage) {
      return res.status(403).json({ 
        success: false,
        error: 'Cannot modify this user' 
      });
    }
    
    // Store old values for audit
    const oldValue = {
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      department: user.department,
      status: user.status,
      manager_id: user.manager_id
    };
    
    // Update allowed fields
    const allowedFields = [
      'full_name', 'phone', 'department', 'designation',
      'manager_id', 'status', 'address', 'emergency_contact',
      'bank_details', 'preferences'
    ];
    
    // HR and Super Admin can update additional fields
    if (viewer.role === 'SUPER_ADMIN' || viewer.role === 'HR') {
      allowedFields.push('role', 'joining_date', 'date_of_birth', 'gender');
    }
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });
    
    // Don't allow role change to Super Admin by HR
    if (viewer.role === 'HR' && req.body.role === 'SUPER_ADMIN') {
      return res.status(403).json({ 
        success: false,
        error: 'Cannot assign Super Admin role' 
      });
    }
    
    user.updated_by = viewer.id;
    
    await user.save();
    
    // Log update
    await SystemActionLog.create({
      actor_user_id: viewer.id,
      actor_role: viewer.role,
      action_type: 'USER_UPDATE',
      target_user_id: user._id,
      target_entity_type: 'User',
      old_value: oldValue,
      new_value: {
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        department: user.department,
        status: user.status,
        manager_id: user.manager_id
      },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      is_super_admin_action: viewer.role === 'SUPER_ADMIN'
    });
    
    res.json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
    
  } catch (error) {
    logger.error('Update user error:', error);
    next(error);
  }
};

// @desc    Delete user (soft delete)
// @route   DELETE /api/users/:id
// @access  Private (Super Admin only)
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const viewer = req.user;
    
    // Only Super Admin can delete users
    if (viewer.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ 
        success: false,
        error: 'Only Super Admin can delete users' 
      });
    }
    
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }
    
    // Don't allow deleting own account
    if (user._id.toString() === viewer.id) {
      return res.status(400).json({ 
        success: false,
        error: 'Cannot delete your own account' 
      });
    }
    
    // Soft delete - change status to TERMINATED
    user.status = 'TERMINATED';
    user.updated_by = viewer.id;
    await user.save();
    
    // Log deletion
    await SystemActionLog.create({
      actor_user_id: viewer.id,
      actor_role: viewer.role,
      action_type: 'USER_DELETE',
      target_user_id: user._id,
      target_entity_type: 'User',
      reason: req.body.reason || 'User terminated',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      is_super_admin_action: true
    });
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
    
  } catch (error) {
    logger.error('Delete user error:', error);
    next(error);
  }
};

// @desc    Bulk upload users
// @route   POST /api/users/bulk
// @access  Private (HR, Super Admin)
exports.bulkUploadUsers = async (req, res, next) => {
  try {
    const viewer = req.user;
    const { users } = req.body;
    
    // Check permission
    const isRevoked = await RevokedPermission.isCapabilityRevoked(
      viewer.id,
      'upload_employees'
    );
    
    if (isRevoked && viewer.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ 
        success: false,
        error: 'Bulk upload permission revoked' 
      });
    }
    
    const results = {
      successful: [],
      failed: []
    };
    
    for (const userData of users) {
      try {
        // Validate required fields
        const requiredFields = ['employee_id', 'email', 'full_name', 'phone', 'joining_date'];
        const missingFields = requiredFields.filter(field => !userData[field]);
        
        if (missingFields.length > 0) {
          throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }
        
        // Check for existing user
        const existingUser = await User.findOne({
          $or: [
            { employee_id: userData.employee_id },
            { email: userData.email },
            { phone: userData.phone }
          ]
        });
        
        if (existingUser) {
          throw new Error('User already exists with same Employee ID, Email, or Phone');
        }
        
        // Validate role
        if (userData.role === 'SUPER_ADMIN' && viewer.role !== 'SUPER_ADMIN') {
          throw new Error('Cannot create Super Admin accounts');
        }
        
        // Create user
        const user = new User({
          ...userData,
          password_hash: userData.password || generateDefaultPassword(),
          created_by: viewer.id,
          role: userData.role || 'EMPLOYEE',
          status: 'ACTIVE'
        });
        
        await user.save();
        
        results.successful.push({
          employee_id: user.employee_id,
          email: user.email,
          full_name: user.full_name
        });
        
      } catch (error) {
        results.failed.push({
          data: userData,
          error: error.message
        });
      }
    }
    
    // Log bulk upload
    await SystemActionLog.create({
      actor_user_id: viewer.id,
      actor_role: viewer.role,
      action_type: 'USER_BULK_UPLOAD',
      reason: `Uploaded ${results.successful.length} users, ${results.failed.length} failed`,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      is_super_admin_action: viewer.role === 'SUPER_ADMIN',
      metadata: new Map([
        ['successful_count', results.successful.length],
        ['failed_count', results.failed.length]
      ])
    });
    
    res.json({
      success: true,
      message: `Successfully created ${results.successful.length} users`,
      data: results
    });
    
  } catch (error) {
    logger.error('Bulk upload error:', error);
    next(error);
  }
};

// @desc    Get user's team members
// @route   GET /api/users/team
// @access  Private (Manager, HR, Super Admin)
exports.getTeamMembers = async (req, res, next) => {
  try {
    const viewer = req.user;
    let teamMembers = [];
    
    if (viewer.role === 'MANAGER') {
      teamMembers = await User.findTeamMembers(viewer.id);
    } else if (['HR', 'SUPER_ADMIN'].includes(viewer.role)) {
      const { manager_id } = req.query;
      if (manager_id) {
        teamMembers = await User.findTeamMembers(manager_id);
      } else {
        // Get all non-admin users
        teamMembers = await User.find({ 
          role: { $in: ['EMPLOYEE', 'MANAGER'] },
          status: 'ACTIVE'
        });
      }
    }
    
    // Get attendance summary for each team member
    const today = moment().startOf('day').toDate();
    const AttendanceLog = require('../models/AttendanceLog');
    
    const teamWithAttendance = await Promise.all(
      teamMembers.map(async (member) => {
        const todayAttendance = await AttendanceLog.findOne({
          user_id: member._id,
          date: {
            $gte: today,
            $lt: moment(today).add(1, 'day').toDate()
          }
        });
        
        return {
          ...member.toObject(),
          today_status: todayAttendance?.status || 'NOT_PUNCHED',
          punch_in: todayAttendance?.punch_in?.server_timestamp,
          punch_out: todayAttendance?.punch_out?.server_timestamp
        };
      })
    );
    
    res.json({
      success: true,
      data: teamWithAttendance
    });
    
  } catch (error) {
    logger.error('Get team members error:', error);
    next(error);
  }
};

// @desc    Change user password (admin)
// @route   POST /api/users/:id/change-password
// @access  Private (HR, Super Admin)
exports.adminChangePassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { new_password, reason } = req.body;
    const viewer = req.user;
    
    const user = await User.findById(id).select('+password_hash');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }
    
    // Check permission
    const canManage = await canManageUser(viewer, user);
    if (!canManage) {
      return res.status(403).json({ 
        success: false,
        error: 'Cannot modify this user' 
      });
    }
    
    // Validate password
    if (!new_password || new_password.length < 8) {
      return res.status(400).json({ 
        success: false,
        error: 'Password must be at least 8 characters' 
      });
    }
    
    // Update password
    user.password_hash = new_password;
    user.refresh_token_hash = null; // Invalidate all sessions
    user.updated_by = viewer.id;
    await user.save({ validateBeforeSave: false });
    
    // Log password change
    await SystemActionLog.create({
      actor_user_id: viewer.id,
      actor_role: viewer.role,
      action_type: 'USER_UPDATE',
      target_user_id: user._id,
      target_entity_type: 'User',
      reason: reason || 'Password reset by admin',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      is_super_admin_action: viewer.role === 'SUPER_ADMIN',
      is_sensitive: true
    });
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
    
  } catch (error) {
    logger.error('Admin change password error:', error);
    next(error);
  }
};

// @desc    Get user statistics
// @route   GET /api/users/stats
// @access  Private (HR, Super Admin)
exports.getUserStats = async (req, res, next) => {
  try {
    const stats = {
      total: await User.countDocuments(),
      by_role: {},
      by_department: {},
      by_status: {},
      active_today: 0
    };
    
    // Count by role
    const roleCounts = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    
    roleCounts.forEach(item => {
      stats.by_role[item._id] = item.count;
    });
    
    // Count by department
    const deptCounts = await User.aggregate([
      { $group: { _id: '$department', count: { $sum: 1 } } }
    ]);
    
    deptCounts.forEach(item => {
      stats.by_department[item._id] = item.count;
    });
    
    // Count by status
    const statusCounts = await User.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    statusCounts.forEach(item => {
      stats.by_status[item._id] = item.count;
    });
    
    // Count active today
    const today = moment().startOf('day').toDate();
    const AttendanceLog = require('../models/AttendanceLog');
    stats.active_today = await AttendanceLog.distinct('user_id', {
      date: {
        $gte: today,
        $lt: moment(today).add(1, 'day').toDate()
      }
    }).then(users => users.length);
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    logger.error('Get user stats error:', error);
    next(error);
  }
};

// Helper functions
async function checkUserAccess(viewer, targetUser) {
  if (viewer.role === 'SUPER_ADMIN') return true;
  if (viewer.role === 'HR' && targetUser.role !== 'SUPER_ADMIN') return true;
  if (viewer.role === 'MANAGER' && targetUser.manager_id?.toString() === viewer.id) return true;
  if (viewer.id === targetUser._id.toString()) return true;
  return false;
}

async function canManageUser(viewer, targetUser) {
  if (viewer.role === 'SUPER_ADMIN') return true;
  if (viewer.role === 'HR' && targetUser.role !== 'SUPER_ADMIN') return true;
  if (viewer.role === 'MANAGER' && targetUser.role === 'EMPLOYEE' && 
      targetUser.manager_id?.toString() === viewer.id) return true;
  return false;
}

function generateDefaultPassword() {
  const length = 10;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

async function sendWelcomeEmail(user, password) {
  // Implementation for sending welcome email
  const notificationService = require('../services/notificationService');
  await notificationService.sendEmail({
    to: user.email,
    subject: 'Welcome to Attendance Management System',
    template: 'welcome',
    data: {
      name: user.full_name,
      employee_id: user.employee_id,
      email: user.email,
      password: password,
      login_url: `${process.env.FRONTEND_URL}/login`
    }
  });
}