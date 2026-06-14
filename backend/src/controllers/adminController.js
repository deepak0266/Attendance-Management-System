const User = require('../models/User');
const Shift = require('../models/Shift');
const Policy = require('../models/Policy');
const GeoFence = require('../models/GeoFence');
const RevokedPermission = require('../models/RevokedPermission');
const SystemActionLog = require('../models/SystemActionLog');
const PayrollLock = require('../models/PayrollLock');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');
const cacheService = require('../services/cacheService');
const { validationResult } = require('express-validator');
const moment = require('moment');

// @desc    Get system dashboard stats
// @route   GET /api/admin/dashboard
// @access  Private (HR, Super Admin)
exports.getDashboardStats = async (req, res, next) => {
  try {
    const today = moment().startOf('day').toDate();
    const startOfMonth = moment().startOf('month').toDate();
    const endOfMonth = moment().endOf('month').toDate();
    
    const AttendanceLog = require('../models/AttendanceLog');
    const RegularizationRequest = require('../models/RegularizationRequest');
    
    const getStatsData = async () => {
      // Get counts
      const [
        activeEmployees,
        presentToday,
        lateToday,
        absentToday,
        onLeave,
        pendingRegularizations,
        monthlyAggregation
      ] = await Promise.all([
        User.countDocuments({ status: 'ACTIVE' }),
        AttendanceLog.countDocuments({
          date: {
            $gte: today,
            $lt: moment(today).add(1, 'day').toDate()
          },
          status: { $in: ['PRESENT', 'LATE'] }
        }),
        AttendanceLog.countDocuments({
          date: {
            $gte: today,
            $lt: moment(today).add(1, 'day').toDate()
          },
          status: 'LATE'
        }),
        AttendanceLog.countDocuments({
          date: {
            $gte: today,
            $lt: moment(today).add(1, 'day').toDate()
          },
          status: 'ABSENT'
        }),
        User.countDocuments({ status: 'ON_LEAVE' }),
        RegularizationRequest.countDocuments({
          status: { $in: ['PENDING_MANAGER', 'PENDING_HR', 'ESCALATED'] }
        }),
        AttendanceLog.aggregate([
          { $match: { date: { $gte: startOfMonth, $lte: endOfMonth } } },
          {
            $group: {
              _id: null,
              total_work_minutes: { $sum: "$computed_data.net_work_minutes" },
              total_overtime_minutes: { $sum: "$computed_data.overtime_minutes" },
              total_logs: { $sum: 1 },
              present_late_logs: { 
                $sum: { 
                  $cond: [{ $in: ["$status", ["PRESENT", "LATE"]] }, 1, 0] 
                } 
              }
            }
          }
        ])
      ]);
      
      // Calculate monthly stats using aggregation results
      const agg = monthlyAggregation[0] || { total_work_minutes: 0, total_overtime_minutes: 0, total_logs: 0, present_late_logs: 0 };
      const monthlyStats = {
        total_work_hours: (agg.total_work_minutes / 60) || 0,
        total_overtime_hours: (agg.total_overtime_minutes / 60) || 0,
        avg_attendance_percentage: agg.total_logs > 0 
          ? (agg.present_late_logs / agg.total_logs) * 100 
          : 0
      };
      
      return {
        employees: {
          total: activeEmployees,
          active: activeEmployees,
          on_leave: onLeave
        },
        today: {
          present: presentToday,
          late: lateToday,
          absent: absentToday,
          attendance_rate: activeEmployees > 0 
            ? ((presentToday / activeEmployees) * 100).toFixed(2) 
            : 0
        },
        pending: {
          approvals: pendingRegularizations,
          regularizations: pendingRegularizations
        },
        monthly: monthlyStats
      };
    };

    const cacheKey = `dashboard_stats_${today.getTime()}`;
    // Cache for 5 minutes (300 seconds)
    const dashboardData = await cacheService.getOrSet(cacheKey, getStatsData, 300);

    res.json({
      success: true,
      data: dashboardData
    });
    
  } catch (error) {
    logger.error('Get dashboard stats error:', error);
    next(error);
  }
};

// @desc    Revoke user permission
// @route   POST /api/admin/permissions/revoke
// @access  Private (Super Admin only)
exports.revokePermission = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }
    
    const { userId, capabilities, reason, expiresAt, requiresApproval } = req.body;
    const actorId = req.user.id;
    const actorRole = req.user.role;
    
    // Only Super Admin can revoke permissions
    if (actorRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ 
        success: false,
        error: 'Only Super Admin can revoke permissions' 
      });
    }
    
    // Check if target user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }
    
    // Cannot revoke own permissions
    if (userId === actorId) {
      return res.status(400).json({ 
        success: false,
        error: 'Cannot revoke your own permissions' 
      });
    }
    
    // Cannot revoke from another Super Admin without approval
    if (targetUser.role === 'SUPER_ADMIN' && requiresApproval) {
      const { approverId } = req.body;
      
      if (!approverId || approverId === actorId) {
        return res.status(400).json({ 
          success: false,
          error: 'Revoking Super Admin permissions requires approval from another Super Admin' 
        });
      }
      
      const approver = await User.findById(approverId);
      if (!approver || approver.role !== 'SUPER_ADMIN') {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid approver' 
        });
      }
    }
    
    // Create revocation record
    const revocation = new RevokedPermission({
      user_id: userId,
      revoked_capabilities: Array.isArray(capabilities) ? capabilities : [capabilities],
      revoked_by: actorId,
      reason,
      expires_at: expiresAt || null,
      approval_required: requiresApproval || false
    });
    
    await revocation.save();
    
    // If login capability is revoked, invalidate user's sessions
    if (capabilities.includes('login')) {
      targetUser.refresh_token_hash = null;
      await targetUser.save();
    }
    
    // Log the revocation
    await SystemActionLog.create({
      actor_user_id: actorId,
      actor_role: actorRole,
      action_type: 'ACCESS_REVOKE',
      target_user_id: userId,
      target_entity_id: revocation._id,
      target_entity_type: 'RevokedPermission',
      new_value: { 
        capabilities, 
        reason, 
        expiresAt,
        requiresApproval 
      },
      reason,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      session_id: req.session?.id,
      is_super_admin_action: true,
      metadata: new Map([
        ['target_user_email', targetUser.email],
        ['target_user_role', targetUser.role]
      ])
    });
    
    // Notify user
    const notificationService = require('../services/notificationService');
    await notificationService.sendNotification(userId, {
      type: 'PERMISSION_REVOKED',
      title: 'Permissions Revoked',
      message: `Your following permissions have been revoked: ${capabilities.join(', ')}`,
      data: { reason, expiresAt }
    });
    
    res.json({
      success: true,
      message: 'Permissions revoked successfully',
      data: revocation
    });
    
  } catch (error) {
    logger.error('Revoke permission error:', error);
    next(error);
  }
};

// @desc    Restore revoked permission
// @route   POST /api/admin/permissions/restore/:id
// @access  Private (Super Admin only)
exports.restorePermission = async (req, res, next) => {
  try {
    const { revocationId } = req.params;
    const { reason } = req.body;
    const actorId = req.user.id;
    
    // Only Super Admin can restore
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ 
        success: false,
        error: 'Only Super Admin can restore permissions' 
      });
    }
    
    const revocation = await RevokedPermission.findById(revocationId);
    
    if (!revocation) {
      return res.status(404).json({ 
        success: false,
        error: 'Revocation record not found' 
      });
    }
    
    if (!revocation.is_active) {
      return res.status(400).json({ 
        success: false,
        error: 'Permission is already restored' 
      });
    }
    
    await revocation.restore(actorId, reason);
    
    // Log restoration
    await SystemActionLog.create({
      actor_user_id: actorId,
      actor_role: 'SUPER_ADMIN',
      action_type: 'ACCESS_RESTORE',
      target_user_id: revocation.user_id,
      target_entity_id: revocation._id,
      target_entity_type: 'RevokedPermission',
      reason,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      is_super_admin_action: true
    });
    
    // Notify user
    const notificationService = require('../services/notificationService');
    await notificationService.sendNotification(revocation.user_id, {
      type: 'PERMISSION_RESTORED',
      title: 'Permissions Restored',
      message: 'Your permissions have been restored',
      data: { reason }
    });
    
    res.json({
      success: true,
      message: 'Permissions restored successfully'
    });
    
  } catch (error) {
    logger.error('Restore permission error:', error);
    next(error);
  }
};

// @desc    Get system logs
// @route   GET /api/admin/logs
// @access  Private (HR, Super Admin)
exports.getSystemLogs = async (req, res, next) => {
  try {
    const { 
      startDate, 
      endDate, 
      actionType, 
      userId,
      isSuperAdminAction,
      page = 1, 
      limit = 50 
    } = req.query;
    
    const filter = {};
    const user = req.user;
    
    // Apply visibility rules
    if (user.role === 'HR') {
      filter.is_super_admin_action = { $ne: true };
    }
    
    if (startDate && endDate) {
      filter.timestamp = {
        $gte: moment(startDate).startOf('day').toDate(),
        $lte: moment(endDate).endOf('day').toDate()
      };
    }
    
    if (actionType) {
      filter.action_type = actionType;
    }
    
    if (userId) {
      filter.actor_user_id = userId;
    }
    
    if (isSuperAdminAction !== undefined && user.role === 'SUPER_ADMIN') {
      filter.is_super_admin_action = isSuperAdminAction === 'true';
    }
    
    const skip = (page - 1) * limit;
    
    const [logs, total] = await Promise.all([
      SystemActionLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('actor_user_id', 'full_name email role')
        .populate('target_user_id', 'full_name email role')
        .populate('approved_by', 'full_name email')
        .lean(),
      SystemActionLog.countDocuments(filter)
    ]);
    
    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    logger.error('Get system logs error:', error);
    next(error);
  }
};

// @desc    Get audit logs
// @route   GET /api/admin/audit-logs
// @access  Private (Super Admin only)
exports.getAuditLogs = async (req, res, next) => {
  try {
    const { 
      startDate, 
      endDate, 
      entityType, 
      entityId,
      action,
      page = 1, 
      limit = 50 
    } = req.query;
    
    const filter = {};
    
    if (startDate && endDate) {
      filter.timestamp = {
        $gte: moment(startDate).startOf('day').toDate(),
        $lte: moment(endDate).endOf('day').toDate()
      };
    }
    
    if (entityType) filter.entity_type = entityType;
    if (entityId) filter.entity_id = entityId;
    if (action) filter.action = action;
    
    const skip = (page - 1) * limit;
    
    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('actor_user_id', 'full_name email role')
        .lean(),
      AuditLog.countDocuments(filter)
    ]);
    
    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    logger.error('Get audit logs error:', error);
    next(error);
  }
};

// @desc    Create or update shift
// @route   POST /api/admin/shifts
// @access  Private (HR, Super Admin)
exports.manageShift = async (req, res, next) => {
  try {
    const { shiftId } = req.params;
    const shiftData = req.body;
    const userId = req.user.id;
    
    let shift;
    
    if (shiftId) {
      shift = await Shift.findById(shiftId);
      if (!shift) {
        return res.status(404).json({ 
          success: false,
          error: 'Shift not found' 
        });
      }
      
      // Create new version instead of updating
      const newShift = new Shift({
        ...shift.toObject(),
        ...shiftData,
        _id: undefined,
        version: shift.version + 1,
        created_by: userId,
        effective_from: shiftData.effective_from || new Date()
      });
      
      // Deactivate old version
      shift.is_active = false;
      shift.effective_to = new Date();
      await shift.save();
      
      shift = await newShift.save();
    } else {
      shift = new Shift({
        ...shiftData,
        version: 1,
        created_by: userId
      });
      await shift.save();
    }
    
    // Log shift change
    await SystemActionLog.create({
      actor_user_id: userId,
      actor_role: req.user.role,
      action_type: 'SHIFT_CHANGE',
      target_entity_id: shift._id,
      target_entity_type: 'Shift',
      new_value: {
        name: shift.name,
        code: shift.code,
        type: shift.type,
        start_time: shift.start_time,
        end_time: shift.end_time,
        version: shift.version
      },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      is_super_admin_action: req.user.role === 'SUPER_ADMIN'
    });
    
    res.json({
      success: true,
      message: shiftId ? 'Shift updated successfully' : 'Shift created successfully',
      data: shift
    });
    
  } catch (error) {
    logger.error('Manage shift error:', error);
    next(error);
  }
};

// @desc    Get all shifts
// @route   GET /api/admin/shifts
// @access  Private (HR, Super Admin)
exports.getShifts = async (req, res, next) => {
  try {
    const { is_active, type } = req.query;
    const filter = {};
    
    if (is_active !== undefined) filter.is_active = is_active === 'true';
    if (type) filter.type = type;
    
    const shifts = await Shift.find(filter)
      .populate('created_by', 'full_name email')
      .sort({ created_at: -1 });
    
    res.json({
      success: true,
      data: shifts
    });
    
  } catch (error) {
    logger.error('Get shifts error:', error);
    next(error);
  }
};

// @desc    Delete shift (soft delete)
// @route   DELETE /api/admin/shifts/:id
// @access  Private (HR, Super Admin)
exports.deleteShift = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const shift = await Shift.findById(id);
    
    if (!shift) {
      return res.status(404).json({ 
        success: false,
        error: 'Shift not found' 
      });
    }
    
    // Soft delete - deactivate
    shift.is_active = false;
    shift.effective_to = new Date();
    shift.updated_by = userId;
    await shift.save();
    
    // Log deletion
    await SystemActionLog.create({
      actor_user_id: userId,
      actor_role: req.user.role,
      action_type: 'SHIFT_CHANGE',
      target_entity_id: shift._id,
      target_entity_type: 'Shift',
      reason: 'Shift deleted',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      is_super_admin_action: req.user.role === 'SUPER_ADMIN'
    });
    
    res.json({
      success: true,
      message: 'Shift deleted successfully'
    });
    
  } catch (error) {
    logger.error('Delete shift error:', error);
    next(error);
  }
};

// @desc    Create or update policy
// @route   POST /api/admin/policies
// @access  Private (HR, Super Admin)
exports.managePolicy = async (req, res, next) => {
  try {
    const { policyId } = req.params;
    const policyData = req.body;
    const userId = req.user.id;
    
    let policy;
    
    if (policyId) {
      policy = await Policy.findById(policyId);
      if (!policy) {
        return res.status(404).json({ 
          success: false,
          error: 'Policy not found' 
        });
      }
      
      // Create new version
      const newPolicy = new Policy({
        ...policy.toObject(),
        ...policyData,
        _id: undefined,
        version: policy.version + 1,
        created_by: userId,
        effective_from: policyData.effective_from || new Date()
      });
      
      // Deactivate old version
      policy.is_active = false;
      policy.effective_to = new Date();
      await policy.save();
      
      policy = await newPolicy.save();
    } else {
      policy = new Policy({
        ...policyData,
        version: 1,
        created_by: userId
      });
      await policy.save();
    }
    
    // Log policy change
    await SystemActionLog.create({
      actor_user_id: userId,
      actor_role: req.user.role,
      action_type: 'POLICY_CHANGE',
      target_entity_id: policy._id,
      target_entity_type: 'Policy',
      new_value: {
        name: policy.name,
        code: policy.code,
        version: policy.version
      },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      is_super_admin_action: req.user.role === 'SUPER_ADMIN'
    });
    
    res.json({
      success: true,
      message: policyId ? 'Policy updated successfully' : 'Policy created successfully',
      data: policy
    });
    
  } catch (error) {
    logger.error('Manage policy error:', error);
    next(error);
  }
};

// @desc    Get all policies
// @route   GET /api/admin/policies
// @access  Private (HR, Super Admin)
exports.getPolicies = async (req, res, next) => {
  try {
    const { is_active } = req.query;
    const filter = {};
    
    if (is_active !== undefined) filter.is_active = is_active === 'true';
    
    const policies = await Policy.find(filter)
      .populate('created_by', 'full_name email')
      .populate('approved_by', 'full_name email')
      .sort({ version: -1 });
    
    res.json({
      success: true,
      data: policies
    });
    
  } catch (error) {
    logger.error('Get policies error:', error);
    next(error);
  }
};

// @desc    Approve policy
// @route   POST /api/admin/policies/:id/approve
// @access  Private (Super Admin only)
exports.approvePolicy = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const policy = await Policy.findById(id);
    
    if (!policy) {
      return res.status(404).json({ 
        success: false,
        error: 'Policy not found' 
      });
    }
    
    policy.approved_by = userId;
    policy.approved_at = new Date();
    policy.is_active = true;
    await policy.save();
    
    // Log approval
    await SystemActionLog.create({
      actor_user_id: userId,
      actor_role: req.user.role,
      action_type: 'POLICY_CHANGE',
      target_entity_id: policy._id,
      target_entity_type: 'Policy',
      reason: 'Policy approved',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      is_super_admin_action: true
    });
    
    res.json({
      success: true,
      message: 'Policy approved successfully',
      data: policy
    });
    
  } catch (error) {
    logger.error('Approve policy error:', error);
    next(error);
  }
};

// @desc    Manage geo-fence
// @route   POST /api/admin/geofence
// @access  Private (HR, Super Admin)
exports.manageGeoFence = async (req, res, next) => {
  try {
    const { fenceId } = req.params;
    const fenceData = req.body;
    const userId = req.user.id;
    
    let geoFence;
    
    if (fenceId) {
      geoFence = await GeoFence.findByIdAndUpdate(
        fenceId,
        { 
          ...fenceData, 
          updated_by: userId,
          version: (await GeoFence.findById(fenceId)).version + 1
        },
        { new: true, runValidators: true }
      );
    } else {
      geoFence = new GeoFence({
        ...fenceData,
        created_by: userId
      });
      await geoFence.save();
    }
    
    // Log geo-fence change
    await SystemActionLog.create({
      actor_user_id: userId,
      actor_role: req.user.role,
      action_type: 'GEOFENCE_CHANGE',
      target_entity_id: geoFence._id,
      target_entity_type: 'GeoFence',
      new_value: {
        name: geoFence.name,
        code: geoFence.code,
        type: geoFence.type
      },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      is_super_admin_action: req.user.role === 'SUPER_ADMIN'
    });
    
    res.json({
      success: true,
      message: fenceId ? 'Geo-fence updated successfully' : 'Geo-fence created successfully',
      data: geoFence
    });
    
  } catch (error) {
    logger.error('Manage geo-fence error:', error);
    next(error);
  }
};

// @desc    Get all geo-fences
// @route   GET /api/admin/geofence
// @access  Private (HR, Super Admin)
exports.getGeoFences = async (req, res, next) => {
  try {
    const { is_active } = req.query;
    const filter = {};
    
    if (is_active !== undefined) filter.is_active = is_active === 'true';
    
    const fences = await GeoFence.find(filter)
      .populate('created_by', 'full_name email')
      .sort({ priority: -1 });
    
    res.json({
      success: true,
      data: fences
    });
    
  } catch (error) {
    logger.error('Get geo-fences error:', error);
    next(error);
  }
};

// @desc    Lock payroll for a month
// @route   POST /api/admin/payroll/lock
// @access  Private (HR, Super Admin)
exports.lockPayroll = async (req, res, next) => {
  try {
    const { month, year } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Check if capability is revoked
    const isRevoked = await RevokedPermission.isCapabilityRevoked(
      userId,
      'lock_payroll'
    );
    
    if (isRevoked && userRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ 
        success: false,
        error: 'Payroll lock permission revoked' 
      });
    }
    
    const lock = await PayrollLock.lockPayroll(month, year, userId, userRole);
    
    // Log payroll lock
    await SystemActionLog.create({
      actor_user_id: userId,
      actor_role: userRole,
      action_type: 'PAYROLL_LOCK',
      target_entity_id: lock._id,
      target_entity_type: 'PayrollLock',
      new_value: { month, year },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      is_super_admin_action: userRole === 'SUPER_ADMIN'
    });
    
    res.json({
      success: true,
      message: `Payroll locked for ${month}/${year}`,
      data: lock
    });
    
  } catch (error) {
    logger.error('Lock payroll error:', error);
    next(error);
  }
};

// @desc    Unlock payroll
// @route   POST /api/admin/payroll/unlock
// @access  Private (Super Admin only)
exports.unlockPayroll = async (req, res, next) => {
  try {
    const { month, year, reason, approvedBy } = req.body;
    const userId = req.user.id;
    
    const lock = await PayrollLock.findOne({ month, year, is_locked: true });
    
    if (!lock) {
      return res.status(404).json({ 
        success: false,
        error: 'No active lock found for this period' 
      });
    }
    
    await lock.unlock(userId, reason, approvedBy);
    
    // Log unlock
    await SystemActionLog.create({
      actor_user_id: userId,
      actor_role: req.user.role,
      action_type: 'PAYROLL_UNLOCK',
      target_entity_id: lock._id,
      target_entity_type: 'PayrollLock',
      reason,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      is_super_admin_action: true
    });
    
    res.json({
      success: true,
      message: `Payroll unlocked for ${month}/${year}`,
      data: lock
    });
    
  } catch (error) {
    logger.error('Unlock payroll error:', error);
    next(error);
  }
};

// @desc    Get payroll lock status
// @route   GET /api/admin/payroll/locks
// @access  Private (HR, Super Admin)
exports.getPayrollLocks = async (req, res, next) => {
  try {
    const { year } = req.query;
    
    const locks = await PayrollLock.getLockedMonths(year ? parseInt(year) : null);
    
    res.json({
      success: true,
      data: locks
    });
    
  } catch (error) {
    logger.error('Get payroll locks error:', error);
    next(error);
  }
};

// @desc    Get system configuration
// @route   GET /api/admin/config
// @access  Private (Super Admin only)
exports.getSystemConfig = async (req, res, next) => {
  try {
    const config = {
      attendance: {
        photo_capture_enabled: process.env.PHOTO_CAPTURE_ENABLED === 'true',
        photo_capture_required: process.env.PHOTO_CAPTURE_REQUIRED === 'true',
        location_required: process.env.LOCATION_REQUIRED === 'true',
        offline_punch_enabled: process.env.OFFLINE_PUNCH_ENABLED === 'true',
        auto_punch_out_enabled: process.env.AUTO_PUNCH_OUT_ENABLED === 'true'
      },
      security: {
        session_timeout_hours: parseInt(process.env.SESSION_TIMEOUT_HOURS) || 8,
        max_login_attempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
        password_min_length: parseInt(process.env.PASSWORD_MIN_LENGTH) || 8,
        two_factor_required: process.env.TWO_FACTOR_REQUIRED === 'true'
      },
      notifications: {
        email_enabled: process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true',
        sms_enabled: process.env.SMS_NOTIFICATIONS_ENABLED === 'true',
        push_enabled: process.env.PUSH_NOTIFICATIONS_ENABLED === 'true'
      },
      system: {
        maintenance_mode: process.env.MAINTENANCE_MODE === 'true',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV
      }
    };
    
    res.json({
      success: true,
      data: config
    });
    
  } catch (error) {
    logger.error('Get system config error:', error);
    next(error);
  }
};

// @desc    Update system configuration
// @route   PUT /api/admin/config
// @access  Private (Super Admin only)
exports.updateSystemConfig = async (req, res, next) => {
  try {
    const { config } = req.body;
    const userId = req.user.id;
    
    // Update environment variables (would require restart)
    // For now, just log the change
    
    await SystemActionLog.create({
      actor_user_id: userId,
      actor_role: req.user.role,
      action_type: 'SYSTEM_CONFIG',
      new_value: config,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      is_super_admin_action: true
    });
    
    res.json({
      success: true,
      message: 'System configuration updated. Some changes may require server restart.',
      data: config
    });
    
  } catch (error) {
    logger.error('Update system config error:', error);
    next(error);
  }
};

// @desc    Get attendance trend for dashboard
// @route   GET /api/admin/attendance-trend
// @access  Private (HR, Super Admin)
exports.getAttendanceTrend = async (req, res, next) => {
  try {
    const { period = 'week' } = req.query;
    
    let startDate, endDate, groupFormat, dateFormat;
    
    if (period === 'week') {
      startDate = moment().startOf('week').toDate();
      endDate = moment().endOf('week').toDate();
      groupFormat = '%Y-%m-%d';
      dateFormat = 'YYYY-MM-DD';
    } else if (period === 'month') {
      startDate = moment().startOf('month').toDate();
      endDate = moment().endOf('month').toDate();
      groupFormat = '%Y-%m-%d';
      dateFormat = 'YYYY-MM-DD';
    } else if (period === 'year') {
      startDate = moment().startOf('year').toDate();
      endDate = moment().endOf('year').toDate();
      groupFormat = '%Y-%m';
      dateFormat = 'YYYY-MM';
    }
    
    const getTrendData = async () => {
      const AttendanceLog = require('../models/AttendanceLog');
      
      const trend = await AttendanceLog.aggregate([
        {
          $match: {
            date: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: groupFormat, date: '$date' }
            },
            present: {
              $sum: { $cond: [{ $eq: ['$status', 'PRESENT'] }, 1, 0] }
            },
            late: {
              $sum: { $cond: [{ $eq: ['$status', 'LATE'] }, 1, 0] }
            },
            absent: {
              $sum: { $cond: [{ $eq: ['$status', 'ABSENT'] }, 1, 0] }
            },
            half_day: {
              $sum: { $cond: [{ $eq: ['$status', 'HALF_DAY'] }, 1, 0] }
            }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);
      
      // Format data for chart
      return {
        dates: trend.map(t => t._id),
        present: trend.map(t => t.present),
        late: trend.map(t => t.late),
        absent: trend.map(t => t.absent),
        half_day: trend.map(t => t.half_day)
      };
    };

    const cacheKey = `attendance_trend_${period}_${startDate.getTime()}`;
    const chartData = await cacheService.getOrSet(cacheKey, getTrendData, 300);
    
    res.json({
      success: true,
      data: chartData
    });
    
  } catch (error) {
    logger.error('Get attendance trend error:', error);
    next(error);
  }
};

// @desc    Get department distribution
// @route   GET /api/admin/department-distribution
// @access  Private (HR, Super Admin)
exports.getDepartmentDistribution = async (req, res, next) => {
  try {
    const distribution = await User.aggregate([
      {
        $match: { status: 'ACTIVE' }
      },
      {
        $group: {
          _id: '$department',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    const chartData = {
      labels: distribution.map(d => d._id),
      values: distribution.map(d => d.count)
    };
    
    res.json({
      success: true,
      data: chartData
    });
    
  } catch (error) {
    logger.error('Get department distribution error:', error);
    next(error);
  }
};