const RegularizationRequest = require('../models/RegularizationRequest');
const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');
const SystemActionLog = require('../models/SystemActionLog');
const RevokedPermission = require('../models/RevokedPermission');
const notificationService = require('../services/notificationService');
const calculationEngine = require('../services/calculationEngine');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');
const moment = require('moment');

// @desc    Get pending approvals
// @route   GET /api/approvals/pending
// @access  Private (Manager, HR, Super Admin)
exports.getPendingApprovals = async (req, res, next) => {
  try {
    const user = req.user;
    const { type, page = 1, limit = 20 } = req.query;
    
    let query = {};
    
    if (user.role === 'MANAGER') {
      // Manager sees their team's pending approvals
      const teamMembers = await User.findTeamMembers(user.id);
      const teamMemberIds = teamMembers.map(m => m._id);
      
      query = {
        user_id: { $in: teamMemberIds },
        status: 'PENDING_MANAGER'
      };
    } else if (['HR', 'SUPER_ADMIN'].includes(user.role)) {
      // HR and Super Admin see all pending
      query = {
        status: { $in: ['PENDING_MANAGER', 'PENDING_HR', 'ESCALATED'] }
      };
    } else {
      query = {
        user_id: user.id,
        status: { $ne: 'APPROVED' }
      };
    }
    
    if (type) {
      query.request_type = type;
    }
    
    const skip = (page - 1) * limit;
    
    const [requests, total] = await Promise.all([
      RegularizationRequest.find(query)
        .populate('user_id', 'full_name email employee_id department')
        .populate('manager_id', 'full_name email')
        .populate('attendance_id', 'date punch_in punch_out status')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      RegularizationRequest.countDocuments(query)
    ]);
    
    // Get counts by type
    const counts = await RegularizationRequest.aggregate([
      { $match: query },
      { $group: { _id: '$request_type', count: { $sum: 1 } } }
    ]);
    
    const typeCounts = {};
    counts.forEach(c => {
      typeCounts[c._id] = c.count;
    });
    
    res.json({
      success: true,
      data: requests,
      counts: typeCounts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    logger.error('Get pending approvals error:', error);
    next(error);
  }
};

// @desc    Get approval history
// @route   GET /api/approvals/history
// @access  Private
exports.getApprovalHistory = async (req, res, next) => {
  try {
    const user = req.user;
    const { status, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    let query = {};
    
    if (user.role === 'MANAGER') {
      const teamMembers = await User.findTeamMembers(user.id);
      query.user_id = { $in: teamMembers.map(m => m._id) };
    } else if (user.role === 'EMPLOYEE') {
      query.user_id = user.id;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (startDate && endDate) {
      query.created_at = {
        $gte: moment(startDate).startOf('day').toDate(),
        $lte: moment(endDate).endOf('day').toDate()
      };
    }
    
    const skip = (page - 1) * limit;
    
    const [requests, total] = await Promise.all([
      RegularizationRequest.find(query)
        .populate('user_id', 'full_name email employee_id department')
        .populate('manager_id', 'full_name email')
        .populate('hr_id', 'full_name email')
        .populate('final_decision_by', 'full_name email')
        .populate('attendance_id', 'date punch_in punch_out')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      RegularizationRequest.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    logger.error('Get approval history error:', error);
    next(error);
  }
};

// @desc    Get single approval request
// @route   GET /api/approvals/:id
// @access  Private
exports.getApprovalRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const request = await RegularizationRequest.findById(id)
      .populate('user_id', 'full_name email employee_id department manager_id')
      .populate('manager_id', 'full_name email')
      .populate('hr_id', 'full_name email')
      .populate('final_decision_by', 'full_name email')
      .populate({
        path: 'attendance_id',
        populate: {
          path: 'shift_id',
          select: 'name start_time end_time'
        }
      });
    
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }
    
    // Check access
    const canAccess = await checkApprovalAccess(req.user, request);
    if (!canAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: request
    });
    
  } catch (error) {
    logger.error('Get approval request error:', error);
    next(error);
  }
};

// @desc    Create regularization request
// @route   POST /api/approvals/regularization
// @access  Private (Employee)
exports.createRegularization = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const userId = req.user.id;
    const {
      attendance_id,
      request_type,
      date,
      requested_in_time,
      requested_out_time,
      requested_break_duration,
      reason,
      proof_urls,
      priority = 'MEDIUM'
    } = req.body;
    
    // Get user with manager info
    const user = await User.findById(userId).populate('manager_id');
    
    if (!user.manager_id) {
      return res.status(400).json({
        success: false,
        error: 'No manager assigned. Contact HR.'
      });
    }
    
    // Check if request already exists
    const existingRequest = await RegularizationRequest.findOne({
      user_id: userId,
      date: moment(date).startOf('day').toDate(),
      status: { $in: ['PENDING_MANAGER', 'PENDING_HR'] }
    });
    
    if (existingRequest) {
      return res.status(400).json({
        success: false,
        error: 'A pending request already exists for this date'
      });
    }
    
    // Check policy for allowed days back
    const Policy = require('../models/Policy');
    const policy = await Policy.findActivePolicy();
    const allowedDaysBack = policy?.rules?.regularization?.allowed_days_back || 7;
    
    const requestDate = moment(date).startOf('day');
    const today = moment().startOf('day');
    const daysDiff = today.diff(requestDate, 'days');
    
    if (daysDiff > allowedDaysBack) {
      return res.status(400).json({
        success: false,
        error: `Cannot regularize attendance older than ${allowedDaysBack} days`
      });
    }
    
    // Create request
    const regularizationRequest = new RegularizationRequest({
      user_id: userId,
      attendance_id,
      request_type,
      date: requestDate.toDate(),
      requested_in_time: requested_in_time ? new Date(requested_in_time) : null,
      requested_out_time: requested_out_time ? new Date(requested_out_time) : null,
      requested_break_duration,
      reason,
      proof_urls,
      priority,
      manager_id: user.manager_id._id,
      status: 'PENDING_MANAGER',
      created_by: userId
    });
    
    await regularizationRequest.save();
    
    // Notify manager
    await notificationService.sendApprovalRequest(user.manager_id._id, {
      type: 'REGULARIZATION_REQUEST',
      requestId: regularizationRequest._id,
      userId: user._id,
      userName: user.full_name,
      date: requestDate.format('YYYY-MM-DD'),
      requestType: request_type,
      reason
    });
    
    // Notify employee
    await notificationService.sendNotification(userId, {
      type: 'REQUEST_SUBMITTED',
      title: 'Regularization Request Submitted',
      message: 'Your regularization request is waiting for approval by your manager.',
      data: {
        requestId: regularizationRequest._id,
        date: requestDate.format('YYYY-MM-DD')
      }
    });
    
    // Log request creation
    await SystemActionLog.create({
      actor_user_id: userId,
      actor_role: user.role,
      action_type: 'REQUEST_CREATE',
      target_user_id: userId,
      target_entity_id: regularizationRequest._id,
      target_entity_type: 'RegularizationRequest',
      new_value: {
        request_type,
        date: requestDate.toDate(),
        priority
      },
      reason,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });
    
    res.status(201).json({
      success: true,
      message: 'Regularization request submitted successfully',
      data: regularizationRequest
    });
    
  } catch (error) {
    logger.error('Create regularization error:', error);
    next(error);
  }
};

// @desc    Approve request (Manager)
// @route   POST /api/approvals/:id/approve
// @access  Private (Manager, HR, Super Admin)
exports.approveRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const approver = req.user;
    
    const request = await RegularizationRequest.findById(id)
      .populate('user_id')
      .populate('attendance_id');
    
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }
    
    // Check approval permission
    const canApprove = await checkApprovalPermission(approver, request);
    if (!canApprove) {
      return res.status(403).json({
        success: false,
        error: 'Cannot approve this request'
      });
    }
    
    // Check if approval capability is revoked
    const isRevoked = await RevokedPermission.isCapabilityRevoked(
      approver.id,
      'approve_requests'
    );
    
    if (isRevoked && approver.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Approval permission revoked'
      });
    }
    
    // Handle approval based on role
    if (approver.role === 'MANAGER' && request.status === 'PENDING_MANAGER') {
      await request.approveByManager(approver.id, comment);
      
      // Update attendance if needed
      if (request.attendance_id) {
        await updateAttendanceFromRequest(request);
      }
    } else if (['HR', 'SUPER_ADMIN'].includes(approver.role)) {
      await request.approveByHR(approver.id, comment);
      
      // Update attendance
      if (request.attendance_id) {
        await updateAttendanceFromRequest(request);
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid approval state'
      });
    }
    
    // Log approval
    await SystemActionLog.create({
      actor_user_id: approver.id,
      actor_role: approver.role,
      action_type: 'REQUEST_APPROVE',
      target_user_id: request.user_id._id,
      target_entity_id: request._id,
      target_entity_type: 'RegularizationRequest',
      reason: comment,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      is_super_admin_action: approver.role === 'SUPER_ADMIN'
    });
    
    // Notify employee
    await notificationService.sendNotification(request.user_id._id, {
      type: 'REQUEST_APPROVED',
      title: 'Regularization Request Approved',
      message: `Your regularization request for ${moment(request.date).format('DD/MM/YYYY')} has been approved.`,
      data: {
        requestId: request._id,
        date: request.date,
        approvedBy: approver.full_name
      }
    });
    
    res.json({
      success: true,
      message: 'Request approved successfully',
      data: request
    });
    
  } catch (error) {
    logger.error('Approve request error:', error);
    next(error);
  }
};

// @desc    Reject request
// @route   POST /api/approvals/:id/reject
// @access  Private (Manager, HR, Super Admin)
exports.rejectRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const approver = req.user;
    
    const request = await RegularizationRequest.findById(id)
      .populate('user_id');
    
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }
    
    // Check permission
    const canApprove = await checkApprovalPermission(approver, request);
    if (!canApprove) {
      return res.status(403).json({
        success: false,
        error: 'Cannot reject this request'
      });
    }
    
    // Reject based on role
    if (approver.role === 'MANAGER' && request.status === 'PENDING_MANAGER') {
      await request.rejectByManager(approver.id, comment);
    } else if (['HR', 'SUPER_ADMIN'].includes(approver.role)) {
      await request.rejectByHR(approver.id, comment);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid rejection state'
      });
    }
    
    // Log rejection
    await SystemActionLog.create({
      actor_user_id: approver.id,
      actor_role: approver.role,
      action_type: 'REQUEST_REJECT',
      target_user_id: request.user_id._id,
      target_entity_id: request._id,
      target_entity_type: 'RegularizationRequest',
      reason: comment,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      is_super_admin_action: approver.role === 'SUPER_ADMIN'
    });
    
    // Notify employee
    await notificationService.sendNotification(request.user_id._id, {
      type: 'REQUEST_REJECTED',
      title: 'Regularization Request Rejected',
      message: `Your regularization request for ${moment(request.date).format('DD/MM/YYYY')} has been rejected.`,
      data: {
        requestId: request._id,
        date: request.date,
        rejectedBy: approver.full_name,
        reason: comment
      }
    });
    
    res.json({
      success: true,
      message: 'Request rejected successfully',
      data: request
    });
    
  } catch (error) {
    logger.error('Reject request error:', error);
    next(error);
  }
};

// @desc    Escalate request to HR
// @route   POST /api/approvals/:id/escalate
// @access  Private (Manager)
exports.escalateRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const manager = req.user;
    
    const request = await RegularizationRequest.findById(id);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }
    
    // Check if manager is assigned
    if (request.manager_id.toString() !== manager.id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to escalate this request'
      });
    }
    
    if (request.status !== 'PENDING_MANAGER') {
      return res.status(400).json({
        success: false,
        error: 'Request cannot be escalated in current state'
      });
    }
    
    await request.escalateToHR(reason);
    
    // Find HR users to notify
    const hrUsers = await User.find({ role: 'HR', status: 'ACTIVE' });
    
    for (const hr of hrUsers) {
      await notificationService.sendNotification(hr._id, {
        type: 'REQUEST_ESCALATED',
        title: 'Request Escalated to HR',
        message: `A regularization request has been escalated by ${manager.full_name}`,
        data: {
          requestId: request._id,
          managerName: manager.full_name,
          reason
        }
      });
    }
    
    // Log escalation
    await SystemActionLog.create({
      actor_user_id: manager.id,
      actor_role: manager.role,
      action_type: 'REQUEST_ESCALATE',
      target_entity_id: request._id,
      target_entity_type: 'RegularizationRequest',
      reason,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });
    
    res.json({
      success: true,
      message: 'Request escalated to HR successfully',
      data: request
    });
    
  } catch (error) {
    logger.error('Escalate request error:', error);
    next(error);
  }
};

// @desc    Cancel request
// @route   POST /api/approvals/:id/cancel
// @access  Private (Employee)
exports.cancelRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;
    
    const request = await RegularizationRequest.findById(id);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }
    
    // Check if user owns the request
    if (request.user_id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to cancel this request'
      });
    }
    
    // Can only cancel pending requests
    if (!['PENDING_MANAGER', 'PENDING_HR'].includes(request.status)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot cancel request in current state'
      });
    }
    
    await request.cancel(reason);
    
    // Log cancellation
    await SystemActionLog.create({
      actor_user_id: userId,
      actor_role: req.user.role,
      action_type: 'REQUEST_CREATE',
      target_entity_id: request._id,
      target_entity_type: 'RegularizationRequest',
      reason: `Request cancelled: ${reason}`,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    });
    
    res.json({
      success: true,
      message: 'Request cancelled successfully'
    });
    
  } catch (error) {
    logger.error('Cancel request error:', error);
    next(error);
  }
};

// @desc    Bulk approve requests
// @route   POST /api/approvals/bulk-approve
// @access  Private (Manager, HR, Super Admin)
exports.bulkApprove = async (req, res, next) => {
  try {
    const { requestIds, comment } = req.body;
    const approver = req.user;
    
    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No request IDs provided'
      });
    }
    
    const results = {
      successful: [],
      failed: []
    };
    
    for (const requestId of requestIds) {
      try {
        const request = await RegularizationRequest.findById(requestId);
        
        if (!request) {
          results.failed.push({ requestId, error: 'Request not found' });
          continue;
        }
        
        const canApprove = await checkApprovalPermission(approver, request);
        if (!canApprove) {
          results.failed.push({ requestId, error: 'Permission denied' });
          continue;
        }
        
        if (approver.role === 'MANAGER' && request.status === 'PENDING_MANAGER') {
          await request.approveByManager(approver.id, comment);
          results.successful.push(requestId);
        } else if (['HR', 'SUPER_ADMIN'].includes(approver.role)) {
          await request.approveByHR(approver.id, comment);
          results.successful.push(requestId);
        } else {
          results.failed.push({ requestId, error: 'Invalid approval state' });
        }
      } catch (error) {
        results.failed.push({ requestId, error: error.message });
      }
    }
    
    // Log bulk approval
    await SystemActionLog.create({
      actor_user_id: approver.id,
      actor_role: approver.role,
      action_type: 'REQUEST_APPROVE',
      reason: `Bulk approved ${results.successful.length} requests`,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      is_super_admin_action: approver.role === 'SUPER_ADMIN',
      metadata: new Map([
        ['successful_count', results.successful.length],
        ['failed_count', results.failed.length]
      ])
    });
    
    res.json({
      success: true,
      message: `Approved ${results.successful.length} requests, ${results.failed.length} failed`,
      data: results
    });
    
  } catch (error) {
    logger.error('Bulk approve error:', error);
    next(error);
  }
};

// @desc    Get approval statistics
// @route   GET /api/approvals/stats
// @access  Private (Manager, HR, Super Admin)
exports.getApprovalStats = async (req, res, next) => {
  try {
    const user = req.user;
    let query = {};
    
    if (user.role === 'MANAGER') {
      const teamMembers = await User.findTeamMembers(user.id);
      query.user_id = { $in: teamMembers.map(m => m._id) };
    }
    
    const stats = {
      pending: await RegularizationRequest.countDocuments({
        ...query,
        status: { $in: ['PENDING_MANAGER', 'PENDING_HR'] }
      }),
      approved_this_month: await RegularizationRequest.countDocuments({
        ...query,
        status: 'APPROVED',
        created_at: {
          $gte: moment().startOf('month').toDate(),
          $lte: moment().endOf('month').toDate()
        }
      }),
      rejected_this_month: await RegularizationRequest.countDocuments({
        ...query,
        status: 'REJECTED',
        created_at: {
          $gte: moment().startOf('month').toDate(),
          $lte: moment().endOf('month').toDate()
        }
      }),
      escalated: await RegularizationRequest.countDocuments({
        ...query,
        status: 'ESCALATED'
      }),
      by_type: {}
    };
    
    // Count by request type
    const typeCounts = await RegularizationRequest.aggregate([
      { $match: { ...query, status: { $in: ['PENDING_MANAGER', 'PENDING_HR'] } } },
      { $group: { _id: '$request_type', count: { $sum: 1 } } }
    ]);
    
    typeCounts.forEach(t => {
      stats.by_type[t._id] = t.count;
    });
    
    // SLA breach count
    stats.sla_breached = await RegularizationRequest.countDocuments({
      ...query,
      status: { $in: ['PENDING_MANAGER', 'PENDING_HR'] },
      sla_breached: true
    });
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    logger.error('Get approval stats error:', error);
    next(error);
  }
};

// Helper functions
async function checkApprovalAccess(user, request) {
  if (user.role === 'SUPER_ADMIN') return true;
  if (user.role === 'HR') return true;
  if (user.role === 'MANAGER' && request.manager_id?.toString() === user.id) return true;
  if (user.role === 'EMPLOYEE' && request.user_id.toString() === user.id) return true;
  return false;
}

async function checkApprovalPermission(user, request) {
  if (user.role === 'SUPER_ADMIN') return true;
  if (user.role === 'HR' && ['PENDING_HR', 'ESCALATED'].includes(request.status)) return true;
  if (user.role === 'MANAGER' && 
      request.manager_id?.toString() === user.id && 
      request.status === 'PENDING_MANAGER') return true;
  return false;
}

async function updateAttendanceFromRequest(request) {
  let attendance = request.attendance_id;
  
  if (!attendance) {
    const Shift = require('../models/Shift');
    const Policy = require('../models/Policy');
    const AttendanceLog = require('../models/AttendanceLog');
    const User = require('../models/User');

    const user = await User.findById(request.user_id);
    const policy = await Policy.findActivePolicy();
    const shift = await Shift.findById(user.shift_id);

    attendance = new AttendanceLog({
      user_id: request.user_id,
      date: request.date,
      shift_id: shift ? shift._id : null,
      policy_version_id: policy ? policy._id : null,
      requires_approval: false,
      status: 'PRESENT'
    });
    
    request.attendance_id = attendance._id;
    await request.save();
  }
  
  if (request.requested_in_time) {
    attendance.punch_in = {
      ...attendance.punch_in,
      timestamp: request.requested_in_time,
      server_timestamp: new Date(),
      is_valid: true
    };
  }
  
  if (request.requested_out_time) {
    attendance.punch_out = {
      ...attendance.punch_out,
      timestamp: request.requested_out_time,
      server_timestamp: new Date(),
      is_valid: true
    };
  }
  
  attendance.requires_approval = false;
  attendance.approval_status = 'APPROVED';
  attendance.approved_by = request.final_decision_by;
  attendance.approved_at = new Date();
  
  // Recalculate
  const Shift = require('../models/Shift');
  const Policy = require('../models/Policy');
  
  const shift = await Shift.findById(attendance.shift_id);
  const policy = await Policy.findById(attendance.policy_version_id);
  
  if (shift && policy) {
    const calculations = await calculationEngine.calculateDailyAttendance(
      attendance,
      shift,
      policy
    );
    attendance.computed_data = calculations;
  }
  
  await attendance.save();
}