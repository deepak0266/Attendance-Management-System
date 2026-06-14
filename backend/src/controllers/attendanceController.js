const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');
const Shift = require('../models/Shift');
const Policy = require('../models/Policy');
const GeoFence = require('../models/GeoFence');
const BreakLog = require('../models/BreakLog');
const SystemActionLog = require('../models/SystemActionLog');
const RevokedPermission = require('../models/RevokedPermission');
const RegularizationRequest = require('../models/RegularizationRequest');
const Device = require('../models/Device');
const locationService = require('../services/locationService');
const calculationEngine = require('../services/calculationEngine');
const notificationService = require('../services/notificationService');
const socketService = require('../services/socketService');
const cacheService = require('../services/cacheService');
const { uploadImage } = require('../services/cloudinaryService');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const jwt = require('jsonwebtoken');

// @desc    Generate dynamic QR code
// @route   GET /api/attendance/qr/dynamic
// @access  Private (Admin/HR/Manager/Device Presenter)
exports.generateDynamicQR = async (req, res, next) => {
  try {
    const policy = await Policy.findActivePolicy();
    const qrType = policy?.rules?.attendance?.qr_type || 'DYNAMIC';

    if (qrType === 'NONE') {
      return res.status(400).json({ success: false, error: 'QR attendance is disabled globally.' });
    }

    const payload = {
      type: 'DYNAMIC_QR',
      timestamp: Date.now(),
      location: 'OFFICE_MAIN' // Can be extended to support multiple locations
    };

    // Valid for 15 seconds
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '15s' });

    res.json({
      success: true,
      data: {
        token,
        expiresIn: 15,
        type: qrType
      }
    });
  } catch (error) {
    logger.error('Generate Dynamic QR error:', error);
    next(error);
  }
};

// @desc    Get static QR code
// @route   GET /api/attendance/qr/static
// @access  Private (Admin/HR/Manager/Device Presenter)
exports.getStaticQR = async (req, res, next) => {
  try {
    const policy = await Policy.findActivePolicy();
    const qrType = policy?.rules?.attendance?.qr_type || 'DYNAMIC';

    if (qrType === 'NONE') {
      return res.status(400).json({ success: false, error: 'QR attendance is disabled globally.' });
    }

    const payload = {
      type: 'STATIC_QR',
      location: 'OFFICE_MAIN'
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret');

    res.json({
      success: true,
      data: {
        token,
        type: qrType
      }
    });
  } catch (error) {
    logger.error('Get Static QR error:', error);
    next(error);
  }
};

// @desc    Submit punch (in/out/break)
// @route   POST /api/attendance/punch
// @access  Private
exports.submitPunch = async (req, res, next) => {
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
      type, 
      location, 
      client_timestamp, 
      photo, 
      idempotency_key,
      source = 'WEB',
      device_info = {}
    } = req.body;
    
    // Check idempotency
    const existingPunch = await AttendanceLog.findOne({ 
      idempotency_key 
    });
    
    if (existingPunch) {
      return res.json({
        success: true,
        message: 'Punch already recorded',
        data: existingPunch,
        duplicate: true
      });
    }
    
    // Get user with manager info
    const user = await User.findById(userId).populate('manager_id');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }
    
    // Check if user is active
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ 
        success: false,
        error: 'Account is not active' 
      });
    }
    
    // Get today's date (server time)
    const today = moment().startOf('day').toDate();
    const serverTimestamp = new Date();
    
    // Get active shift for user
    const shift = await Shift.findShiftsForUser(user).then(shifts => shifts[0]);
    
    if (!shift) {
      return res.status(400).json({ 
        success: false,
        error: 'No active shift assigned' 
      });
    }
    
    // Get active policy
    const policy = await Policy.findActivePolicy();
    
    if (!policy) {
      return res.status(400).json({ 
        success: false,
        error: 'No active policy found' 
      });
    }
    
    // --- ADVANCED FEATURES: DEVICE, QR, SELFIE ---
    const requireDevice = policy.rules.attendance.require_registered_device;
    if (requireDevice) {
      if (!device_info || !device_info.device_id) {
        return res.status(403).json({ success: false, error: 'Device ID is missing' });
      }
      const device = await Device.findOne({ user_id: userId, device_id: device_info.device_id, status: 'APPROVED' });
      if (!device) {
        return res.status(403).json({ success: false, error: 'Unregistered device. Please request approval.' });
      }
      device.last_used = new Date();
      await device.save();
    }

    const qrTypeGlobal = policy.rules.attendance.qr_type || 'DYNAMIC';
    const qrTypeOverride = user.preferences?.qr_type_override;
    const activeQrType = qrTypeOverride || qrTypeGlobal;

    if (activeQrType !== 'NONE') {
      const qrToken = req.body.qr_token;
      if (!qrToken) {
        return res.status(400).json({ success: false, error: 'QR token is required' });
      }
      try {
        const decoded = jwt.verify(qrToken, process.env.JWT_SECRET || 'fallback_secret');
        if (decoded.type !== `${activeQrType}_QR`) {
          return res.status(400).json({ success: false, error: `Invalid QR type. Expected ${activeQrType}` });
        }
      } catch (err) {
        return res.status(400).json({ success: false, error: 'Invalid or expired QR code' });
      }
    }

    let finalSelfieUrl = photo || null;
    const requireSelfieGlobal = policy.rules.attendance.require_selfie || false;
    const requireSelfieOverride = user.preferences?.require_selfie_override;
    const requireSelfie = requireSelfieOverride !== null ? requireSelfieOverride : requireSelfieGlobal;

    if (requireSelfie && !finalSelfieUrl) {
      return res.status(400).json({ success: false, error: 'Selfie is required to punch' });
    }

    if (finalSelfieUrl && finalSelfieUrl.startsWith('data:image')) {
      finalSelfieUrl = await uploadImage(finalSelfieUrl);
    }
    // ---------------------------------------------
    
    // Validate location
    let locationValid = true;
    let requiresApproval = false;
    let validationReason = '';
    let validationDetails = {};
    
    const geoFences = await GeoFence.findForUser(user);
    
    if (geoFences.length > 0 && policy.rules.attendance.require_location_for_punch) {
      let anyValid = false;
      let closestValidation = null;

      for (const fence of geoFences) {
        const validation = fence.validateLocation(
          location.latitude,
          location.longitude,
          location.accuracy
        );

        if (!closestValidation || validation.distance < closestValidation.distance) {
          closestValidation = { ...validation, geoFenceName: fence.name };
        }

        if (validation.valid) {
          anyValid = true;
          closestValidation = { ...validation, geoFenceName: fence.name };
          break;
        }
      }

      locationValid = anyValid;
      requiresApproval = closestValidation.requiresApproval;
      validationReason = closestValidation.reason;
      validationDetails = {
        distance: closestValidation.distance,
        isInside: closestValidation.isInside,
        geoFenceName: closestValidation.geoFenceName
      };
    }
    
    // Find or create attendance log for today
    let attendanceLog = await AttendanceLog.findOne({
      user_id: userId,
      date: {
        $gte: today,
        $lt: moment(today).add(1, 'day').toDate()
      }
    });
    
    if (!attendanceLog) {
      attendanceLog = new AttendanceLog({
        user_id: userId,
        date: today,
        shift_id: shift._id,
        policy_version_id: policy._id,
        requires_approval: requiresApproval,
        location_invalid: !locationValid
      });
    }
    
    // Check valid state transitions
    const currentState = attendanceLog.getCurrentState();
    
    const validTransitions = {
      'NOT_PUNCHED': ['IN'],
      'PUNCHED_IN': ['OUT', 'BREAK_START'],
      'ON_BREAK': ['BREAK_END'],
      'PUNCHED_OUT': ['IN'],
      'PENDING_APPROVAL': []
    };
    
    if (!validTransitions[currentState]?.includes(type)) {
      return res.status(400).json({ 
        success: false,
        error: `Invalid state transition from ${currentState} to ${type}` 
      });
    }
    
    // Prepare punch data
    const punchData = {
      timestamp: serverTimestamp,
      server_timestamp: serverTimestamp,
      client_timestamp: new Date(client_timestamp),
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy
      },
      ip: req.ip,
      source,
      selfie_url: finalSelfieUrl,
      is_valid: locationValid,
      validation_details: {
        location_valid: locationValid,
        accuracy_valid: location.accuracy <= policy.rules.attendance.location_accuracy_threshold_meters,
        time_valid: true,
        reason: validationReason,
        ...validationDetails
      }
    };
    
    // Handle different punch types
    switch (type) {
      case 'IN':
        if (attendanceLog.punch_in) {
          return res.status(400).json({ 
            success: false,
            error: 'Already punched in' 
          });
        }
        attendanceLog.punch_in = punchData;
        attendanceLog.status = requiresApproval ? 'PENDING_APPROVAL' : 'PRESENT';
        
        // Check if late
        const shiftStartTime = shift.getStartDateTime(today);
        const graceMinutes = shift.grace_period_minutes;
        const lateThreshold = moment(shiftStartTime).add(graceMinutes, 'minutes');
        
        if (moment(serverTimestamp).isAfter(lateThreshold)) {
          attendanceLog.status = 'LATE';
        }
        break;
        
      case 'OUT':
        if (!attendanceLog.punch_in) {
          return res.status(400).json({ 
            success: false,
            error: 'Not punched in' 
          });
        }
        if (attendanceLog.punch_out) {
          return res.status(400).json({ 
            success: false,
            error: 'Already punched out' 
          });
        }
        attendanceLog.punch_out = punchData;
        
        // Calculate work hours
        const calculations = await calculationEngine.calculateDailyAttendance(
          attendanceLog,
          shift,
          policy
        );
        attendanceLog.computed_data = calculations;
        
        // Check for early exit
        const shiftEndTime = shift.getEndDateTime(today);
        const earlyExitThreshold = moment(shiftEndTime).subtract(graceMinutes, 'minutes');
        
        if (moment(serverTimestamp).isBefore(earlyExitThreshold)) {
          attendanceLog.status = 'EARLY_EXIT';
        }
        break;
        
      case 'BREAK_START':
        if (!attendanceLog.punch_in || attendanceLog.punch_out) {
          return res.status(400).json({ 
            success: false,
            error: 'Invalid state for break' 
          });
        }
        
        // Check if already on break
        const activeBreak = await BreakLog.getActiveBreak(userId);
        if (activeBreak) {
          return res.status(400).json({ 
            success: false,
            error: 'Already on break' 
          });
        }
        
        // Create break log
        const breakLog = new BreakLog({
          user_id: userId,
          attendance_id: attendanceLog._id,
          break_type: req.body.break_type || 'UNPAID',
          break_start: serverTimestamp,
          location_start: location,
          is_paid: shift.break_is_paid
        });
        
        await breakLog.save();
        
        attendanceLog.breaks = attendanceLog.breaks || [];
        attendanceLog.breaks.push(breakLog._id);
        attendanceLog.status = 'ON_BREAK';
        break;
        
      case 'BREAK_END':
        const currentBreak = await BreakLog.getActiveBreak(userId);
        
        if (!currentBreak) {
          return res.status(400).json({ 
            success: false,
            error: 'No active break found' 
          });
        }
        
        await currentBreak.endBreak(location);
        attendanceLog.status = 'PUNCHED_IN';
        break;
        
      default:
        return res.status(400).json({ 
          success: false,
          error: 'Invalid punch type' 
        });
    }
    
    // Set idempotency key
    attendanceLog.idempotency_key = idempotency_key || `punch_${userId}_${Date.now()}_${uuidv4()}`;
    
    // Save attendance log
    await attendanceLog.save();
    
    // Send notification if approval required
    if (requiresApproval && user.manager_id) {
      await notificationService.sendApprovalRequest(user.manager_id, {
        type: 'ATTENDANCE_APPROVAL',
        userId: user._id,
        userName: user.full_name,
        attendanceId: attendanceLog._id,
        date: today,
        reason: validationReason,
        location: location
      });
    }
    
    // Send late notification
    if (type === 'IN' && attendanceLog.status === 'LATE' && user.manager_id) {
      await notificationService.sendLateNotification(user.manager_id, {
        userId: user._id,
        userName: user.full_name,
        punchTime: serverTimestamp,
        shiftStartTime: shift.start_time
      });
    }
    
    // Log the action
    await SystemActionLog.create({
      actor_user_id: userId,
      actor_role: user.role,
      action_type: `PUNCH_${type}`,
      target_user_id: userId,
      target_entity_id: attendanceLog._id,
      new_value: { type, locationValid, requiresApproval },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      session_id: req.session?.id,
      metadata: new Map([
        ['device_info', device_info],
        ['source', source]
      ])
    });
    
    // Clear dashboard cache
    cacheService.clear('dashboard_stats_*');
    // Notify clients for live dashboard update
    socketService.emitToRole('SUPER_ADMIN', 'dashboard_update', { type: 'PUNCH_EVENT' });
    socketService.emitToRole('HR', 'dashboard_update', { type: 'PUNCH_EVENT' });
    
    res.json({
      success: true,
      message: `Successfully punched ${type}`,
      data: {
        attendance: attendanceLog,
        currentState: attendanceLog.status,
        requires_approval: requiresApproval,
        validation_details: validationDetails
      }
    });
    
  } catch (error) {
    logger.error('Submit punch error:', error);
    next(error);
  }
};

// @desc    Get current attendance status
// @route   GET /api/attendance/status
// @access  Private
exports.getCurrentStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = moment().startOf('day').toDate();
    
    const attendanceLog = await AttendanceLog.findOne({
      user_id: userId,
      date: {
        $gte: today,
        $lt: moment(today).add(1, 'day').toDate()
      }
    }).populate('shift_id', 'name start_time end_time grace_period_minutes');
    
    let state = 'NOT_PUNCHED';
    let lastPunch = null;
    let activeBreak = null;
    
    if (attendanceLog) {
      state = attendanceLog.getCurrentState();
      
      if (attendanceLog.punch_out) {
        lastPunch = attendanceLog.punch_out;
      } else if (attendanceLog.punch_in) {
        lastPunch = attendanceLog.punch_in;
      }
      
      if (state === 'ON_BREAK') {
        activeBreak = await BreakLog.getActiveBreak(userId);
      }
    }
    
    // Get user's shift for today
    const user = await User.findById(userId);
    const shift = await Shift.findShiftsForUser(user).then(shifts => shifts[0]);
    
    let shiftInfo = null;
    if (shift) {
      shiftInfo = {
        name: shift.name,
        start_time: shift.start_time,
        end_time: shift.end_time,
        grace_period_minutes: shift.grace_period_minutes,
        is_working_day: shift.isWorkingDay(today)
      };
    }
    
    res.json({
      success: true,
      data: {
        state,
        attendance: attendanceLog,
        last_punch: lastPunch,
        active_break: activeBreak,
        shift: shiftInfo,
        date: today
      }
    });
    
  } catch (error) {
    logger.error('Get current status error:', error);
    next(error);
  }
};

// @desc    Get attendance history
// @route   GET /api/attendance/history
// @access  Private
exports.getAttendanceHistory = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user.id;
    const { 
      startDate, 
      endDate, 
      status,
      page = 1, 
      limit = 20 
    } = req.query;
    
    // Check permission if viewing other user's attendance
    if (userId !== req.user.id) {
      const canView = await checkUserAccess(req.user, userId);
      if (!canView) {
        return res.status(403).json({ 
          success: false,
          error: 'Access denied' 
        });
      }
    }
    
    const query = { user_id: userId };
    
    if (startDate && endDate) {
      query.date = {
        $gte: moment(startDate).startOf('day').toDate(),
        $lte: moment(endDate).endOf('day').toDate()
      };
    }
    
    if (status) {
      query.status = status;
    }
    
    const skip = (page - 1) * limit;
    
    const [attendance, total] = await Promise.all([
      AttendanceLog.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('shift_id', 'name start_time end_time')
        .populate('breaks', 'break_start break_end actual_duration_minutes break_type'),
      AttendanceLog.countDocuments(query)
    ]);
    
    // Calculate summary
    const summary = await calculateAttendanceSummary(userId, startDate, endDate);
    
    res.json({
      success: true,
      data: attendance,
      summary,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    logger.error('Get attendance history error:', error);
    next(error);
  }
};

// @desc    Get attendance chart data
// @route   GET /api/attendance/chart
// @access  Private
exports.getChartData = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.user.id;
    const { period = 'month', startDate, endDate } = req.query;
    
    let dateRange = {};
    
    if (period === 'week') {
      dateRange = {
        $gte: moment().startOf('week').toDate(),
        $lte: moment().endOf('week').toDate()
      };
    } else if (period === 'month') {
      dateRange = {
        $gte: moment().startOf('month').toDate(),
        $lte: moment().endOf('month').toDate()
      };
    } else if (startDate && endDate) {
      dateRange = {
        $gte: moment(startDate).startOf('day').toDate(),
        $lte: moment(endDate).endOf('day').toDate()
      };
    }
    
    const attendance = await AttendanceLog.find({
      user_id: userId,
      date: dateRange
    }).sort({ date: 1 });
    
    // Format data for chart
    const chartData = attendance.map(log => ({
      date: moment(log.date).format('YYYY-MM-DD'),
      hours_worked: log.computed_data?.net_work_minutes / 60 || 0,
      expected_hours: log.computed_data?.expected_hours || 8,
      status: log.status,
      punch_in: log.punch_in?.server_timestamp,
      punch_out: log.punch_out?.server_timestamp,
      late_by_minutes: log.computed_data?.late_by_minutes || 0,
      early_exit_by_minutes: log.computed_data?.early_exit_by_minutes || 0,
      overtime_minutes: log.computed_data?.overtime_minutes || 0
    }));
    
    res.json({
      success: true,
      data: chartData
    });
    
  } catch (error) {
    logger.error('Get chart data error:', error);
    next(error);
  }
};

// @desc    Override attendance (HR/Super Admin only)
// @route   POST /api/attendance/override/:id
// @access  Private (HR, Super Admin)
exports.overrideAttendance = async (req, res, next) => {
  try {
    const { attendanceId } = req.params;
    const { punch_in, punch_out, reason, override_type } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Check if capability is revoked
    const isRevoked = await RevokedPermission.isCapabilityRevoked(
      userId,
      'override_attendance'
    );
    
    if (isRevoked && userRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ 
        success: false,
        error: 'Override permission has been revoked' 
      });
    }
    
    const attendanceLog = await AttendanceLog.findById(attendanceId)
      .populate('user_id', 'full_name email employee_id');
    
    if (!attendanceLog) {
      return res.status(404).json({ 
        success: false,
        error: 'Attendance log not found' 
      });
    }
    
    // Check if payroll is locked
    const PayrollLock = require('../models/PayrollLock');
    const isLocked = await PayrollLock.isLocked(
      attendanceLog.date.getMonth() + 1,
      attendanceLog.date.getFullYear()
    );
    
    if (isLocked && userRole !== 'SUPER_ADMIN') {
      return res.status(400).json({ 
        success: false,
        error: 'Payroll is locked for this month. Contact Super Admin.' 
      });
    }
    
    // Store old values for audit
    const oldValue = {
      punch_in: attendanceLog.punch_in,
      punch_out: attendanceLog.punch_out,
      status: attendanceLog.status
    };
    
    // Update punches
    if (punch_in) {
      attendanceLog.punch_in = {
        ...attendanceLog.punch_in,
        timestamp: new Date(punch_in),
        server_timestamp: new Date(),
        is_valid: true,
        validation_details: {
          ...attendanceLog.punch_in?.validation_details,
          overridden: true,
          override_reason: reason
        }
      };
    }
    
    if (punch_out) {
      attendanceLog.punch_out = {
        ...attendanceLog.punch_out,
        timestamp: new Date(punch_out),
        server_timestamp: new Date(),
        is_valid: true,
        validation_details: {
          ...attendanceLog.punch_out?.validation_details,
          overridden: true,
          override_reason: reason
        }
      };
    }
    
    // Recalculate
    const shift = await Shift.findById(attendanceLog.shift_id);
    const policy = await Policy.findById(attendanceLog.policy_version_id);
    
    if (shift && policy) {
      const calculations = await calculationEngine.calculateDailyAttendance(
        attendanceLog,
        shift,
        policy
      );
      attendanceLog.computed_data = calculations;
    }
    
    attendanceLog.requires_approval = false;
    attendanceLog.approval_status = 'APPROVED';
    attendanceLog.approved_by = userId;
    attendanceLog.approved_at = new Date();
    
    await attendanceLog.save();
    
    // Log the override
    await SystemActionLog.create({
      actor_user_id: userId,
      actor_role: userRole,
      action_type: 'ATTENDANCE_OVERRIDE',
      target_user_id: attendanceLog.user_id._id,
      target_entity_id: attendanceLog._id,
      target_entity_type: 'AttendanceLog',
      old_value: oldValue,
      new_value: {
        punch_in: attendanceLog.punch_in,
        punch_out: attendanceLog.punch_out,
        status: attendanceLog.status
      },
      reason,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      session_id: req.session?.id,
      is_super_admin_action: userRole === 'SUPER_ADMIN',
      metadata: new Map([
        ['override_type', override_type],
        ['employee_name', attendanceLog.user_id.full_name]
      ])
    });
    
    // Notify employee
    await notificationService.sendNotification(attendanceLog.user_id._id, {
      type: 'ATTENDANCE_OVERRIDDEN',
      title: 'Attendance Record Updated',
      message: `Your attendance for ${moment(attendanceLog.date).format('DD/MM/YYYY')} has been updated by ${userRole}`,
      data: {
        attendanceId: attendanceLog._id,
        date: attendanceLog.date,
        reason
      }
    });
    
    res.json({
      success: true,
      message: 'Attendance override successful',
      data: attendanceLog
    });
    
  } catch (error) {
    logger.error('Override attendance error:', error);
    next(error);
  }
};

// @desc    Get photo capture configuration
// @route   GET /api/attendance/photo-config
// @access  Private
exports.getPhotoCaptureConfig = async (req, res, next) => {
  try {
    const policy = await Policy.findActivePolicy();
    
    const config = {
      enabled: process.env.PHOTO_CAPTURE_ENABLED === 'true',
      required: process.env.PHOTO_CAPTURE_REQUIRED === 'true',
      require_on_failure: policy?.rules?.attendance?.require_photo_on_failure || false,
      storage_provider: process.env.PHOTO_STORAGE_PROVIDER || 'local',
      max_size_mb: 5,
      allowed_formats: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      compression_quality: 0.8
    };
    
    res.json({
      success: true,
      data: config
    });
    
  } catch (error) {
    logger.error('Get photo config error:', error);
    next(error);
  }
};

// @desc    Get attendance summary for dashboard
// @route   GET /api/attendance/summary
// @access  Private
exports.getAttendanceSummary = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = moment().startOf('day').toDate();
    const startOfMonth = moment().startOf('month').toDate();
    const endOfMonth = moment().endOf('month').toDate();
    
    // Today's attendance
    const todayAttendance = await AttendanceLog.findOne({
      user_id: userId,
      date: {
        $gte: today,
        $lt: moment(today).add(1, 'day').toDate()
      }
    });
    
    // Monthly summary
    const monthlyAttendance = await AttendanceLog.find({
      user_id: userId,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    });
    
    const summary = {
      today: {
        status: todayAttendance?.status || 'NOT_PUNCHED',
        punch_in: todayAttendance?.punch_in?.server_timestamp,
        punch_out: todayAttendance?.punch_out?.server_timestamp,
        work_hours: todayAttendance?.computed_data?.net_work_minutes / 60 || 0,
        is_late: todayAttendance?.status === 'LATE',
        is_early_exit: todayAttendance?.status === 'EARLY_EXIT'
      },
      monthly: {
        total_days: monthlyAttendance.length,
        present_days: monthlyAttendance.filter(a => a.status === 'PRESENT').length,
        absent_days: monthlyAttendance.filter(a => a.status === 'ABSENT').length,
        half_days: monthlyAttendance.filter(a => a.status === 'HALF_DAY').length,
        late_days: monthlyAttendance.filter(a => a.status === 'LATE').length,
        total_work_hours: monthlyAttendance.reduce((sum, a) => 
          sum + (a.computed_data?.net_work_minutes || 0), 0) / 60,
        total_overtime_hours: monthlyAttendance.reduce((sum, a) => 
          sum + (a.computed_data?.overtime_minutes || 0), 0) / 60,
        average_hours_per_day: monthlyAttendance.length > 0 
          ? monthlyAttendance.reduce((sum, a) => 
              sum + (a.computed_data?.net_work_minutes || 0), 0) / 60 / monthlyAttendance.length 
          : 0
      },
      pending_approvals: await RegularizationRequest.countDocuments({
        user_id: userId,
        status: { $in: ['PENDING_MANAGER', 'PENDING_HR'] }
      })
    };
    
    res.json({
      success: true,
      data: summary
    });
    
  } catch (error) {
    logger.error('Get attendance summary error:', error);
    next(error);
  }
};

// Helper function to check user access
async function checkUserAccess(viewer, targetUserId) {
  if (viewer.role === 'SUPER_ADMIN') return true;
  if (viewer.role === 'HR') {
    const targetUser = await User.findById(targetUserId);
    return targetUser && targetUser.role !== 'SUPER_ADMIN';
  }
  if (viewer.role === 'MANAGER') {
    const targetUser = await User.findById(targetUserId);
    return targetUser && targetUser.manager_id?.toString() === viewer.id;
  }
  return false;
}

// Helper function to calculate attendance summary
async function calculateAttendanceSummary(userId, startDate, endDate) {
  const query = { user_id: userId };
  
  if (startDate && endDate) {
    query.date = {
      $gte: moment(startDate).startOf('day').toDate(),
      $lte: moment(endDate).endOf('day').toDate()
    };
  }
  
  const attendance = await AttendanceLog.find(query);
  
  const statusCounts = attendance.reduce((acc, log) => {
    acc[log.status] = (acc[log.status] || 0) + 1;
    return acc;
  }, {});
  
  const totalWorkMinutes = attendance.reduce((sum, log) => 
    sum + (log.computed_data?.net_work_minutes || 0), 0);
  
  const totalOvertimeMinutes = attendance.reduce((sum, log) => 
    sum + (log.computed_data?.overtime_minutes || 0), 0);
  
  return {
    total_days: attendance.length,
    ...statusCounts,
    total_work_hours: totalWorkMinutes / 60,
    total_overtime_hours: totalOvertimeMinutes / 60,
    average_hours_per_day: attendance.length > 0 ? totalWorkMinutes / 60 / attendance.length : 0
  };
}