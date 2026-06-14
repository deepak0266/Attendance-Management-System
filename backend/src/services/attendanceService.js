const AttendanceLog = require('../models/AttendanceLog');
const User = require('../models/User');
const Shift = require('../models/Shift');
const Policy = require('../models/Policy');
const BreakLog = require('../models/BreakLog');
const Role = require('../models/Role');
const SystemActionLog = require('../models/SystemActionLog');
const calculationEngine = require('./calculationEngine');
const locationService = require('./locationService');
const notificationService = require('./notificationService');
const logger = require('../utils/logger');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

class AttendanceService {
  /**
   * Process punch in/out
   */
  async processPunch(userId, punchData) {
    try {
      const {
        type,
        location,
        client_timestamp,
        photo,
        idempotency_key,
        source = 'WEB',
        device_info = {}
      } = punchData;

      // Check idempotency
      if (idempotency_key) {
        const existing = await AttendanceLog.findOne({ idempotency_key });
        if (existing) {
          return {
            success: true,
            message: 'Punch already recorded',
            data: existing,
            duplicate: true
          };
        }
      }

      // Get user
      const user = await User.findById(userId).populate('manager_id');
      if (!user) {
        throw new Error('User not found');
      }

      if (user.status !== 'ACTIVE') {
        throw new Error('Account is not active');
      }

      // Get today's date
      const today = moment().startOf('day').toDate();
      const serverTimestamp = new Date();

      // Get active shift
      const shift = await this.getUserShift(user);
      if (!shift) {
        throw new Error('No active shift assigned');
      }

      // Get active policy
      const policy = await Policy.findActivePolicy();
      if (!policy) {
        throw new Error('No active policy found');
      }

      // Get user's role document
      const userRoleDoc = await Role.findOne({ name: user.role });
      const approvalRestrictions = userRoleDoc?.approval_restrictions || {
        late_punch_in: false,
        early_punch_out: false,
        out_of_location: false
      };

      // Validate location
      const locationValidation = await this.validatePunchLocation(
        user, 
        location, 
        policy,
        approvalRestrictions
      );

      // Find or create attendance log
      let attendanceLog = await this.getOrCreateAttendanceLog(
        userId, 
        today, 
        shift, 
        policy,
        locationValidation
      );

      // Validate state transition
      const currentState = attendanceLog.getCurrentState();
      if (!this.isValidTransition(currentState, type)) {
        throw new Error(`Invalid state transition from ${currentState} to ${type}`);
      }

      // Prepare punch data
      const punchRecord = {
        timestamp: serverTimestamp,
        server_timestamp: serverTimestamp,
        client_timestamp: new Date(client_timestamp),
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy
        },
        ip: punchData.ip,
        source,
        selfie_url: photo || null,
        is_valid: locationValidation.valid,
        validation_details: {
          location_valid: locationValidation.valid,
          accuracy_valid: location.accuracy <= policy.rules.attendance.location_accuracy_threshold_meters,
          time_valid: true,
          reason: locationValidation.reason,
          ...locationValidation.details
        }
      };

      // Process based on punch type
      switch (type) {
        case 'IN':
          await this.processPunchIn(attendanceLog, punchRecord, shift, today, approvalRestrictions);
          break;
        case 'OUT':
          await this.processPunchOut(attendanceLog, punchRecord, shift, policy, today, approvalRestrictions);
          break;
        case 'BREAK_START':
          await this.processBreakStart(attendanceLog, userId, punchRecord, req.body.break_type);
          break;
        case 'BREAK_END':
          await this.processBreakEnd(attendanceLog, userId, punchRecord);
          break;
        default:
          throw new Error('Invalid punch type');
      }

      // Set idempotency key
      attendanceLog.idempotency_key = idempotency_key || this.generateIdempotencyKey(userId, type);

      // Save attendance log
      await attendanceLog.save();

      // Send notifications if needed
      await this.sendPunchNotifications(user, attendanceLog, type, locationValidation);

      // Log the action
      await this.logPunchAction(user, attendanceLog, type, locationValidation, punchData);

      return {
        success: true,
        message: `Successfully punched ${type}`,
        data: {
          attendance: attendanceLog,
          currentState: attendanceLog.status,
          requires_approval: locationValidation.requiresApproval,
          validation_details: locationValidation.details
        }
      };

    } catch (error) {
      logger.error('Process punch error:', error);
      throw error;
    }
  }

  /**
   * Get user's active shift
   */
  async getUserShift(user) {
    const shifts = await Shift.findShiftsForUser(user);
    return shifts[0] || null;
  }

  /**
   * Validate punch location
   */
  async validatePunchLocation(user, location, policy, approvalRestrictions) {
    const geoFences = await locationService.getGeoFencesForUser(user);
    
    if (geoFences.length === 0) {
      return {
        valid: true,
        requiresApproval: false,
        reason: 'No geo-fence configured',
        details: {}
      };
    }

    const primaryGeoFence = geoFences[0];
    const validation = primaryGeoFence.validateLocation(
      location.latitude,
      location.longitude,
      location.accuracy
    );

    return {
      ...validation,
      requiresApproval: !validation.valid && approvalRestrictions.out_of_location,
      details: {
        distance: validation.distance,
        isInside: validation.isInside,
        geoFenceName: primaryGeoFence.name
      }
    };
  }

  /**
   * Get or create attendance log for today
   */
  async getOrCreateAttendanceLog(userId, date, shift, policy, locationValidation) {
    let attendanceLog = await AttendanceLog.findOne({
      user_id: userId,
      date: {
        $gte: date,
        $lt: moment(date).add(1, 'day').toDate()
      }
    });

    if (!attendanceLog) {
      attendanceLog = new AttendanceLog({
        user_id: userId,
        date,
        shift_id: shift._id,
        policy_version_id: policy._id,
        requires_approval: locationValidation.requiresApproval,
        location_invalid: !locationValidation.valid
      });
    }

    return attendanceLog;
  }

  /**
   * Check if state transition is valid
   */
  isValidTransition(currentState, action) {
    const validTransitions = {
      'NOT_PUNCHED': ['IN'],
      'PUNCHED_IN': ['OUT', 'BREAK_START'],
      'ON_BREAK': ['BREAK_END'],
      'PUNCHED_OUT': ['IN'],
      'PENDING_APPROVAL': []
    };

    return validTransitions[currentState]?.includes(action) || false;
  }

  /**
   * Process punch in
   */
  async processPunchIn(attendanceLog, punchRecord, shift, date, approvalRestrictions) {
    if (attendanceLog.punch_in) {
      throw new Error('Already punched in');
    }

    attendanceLog.punch_in = punchRecord;
    
    // Check if late
    const shiftStartTime = shift.getStartDateTime(date);
    const graceMinutes = shift.grace_period_minutes || 15;
    const lateThreshold = moment(shiftStartTime).add(graceMinutes, 'minutes');
    
    if (moment(punchRecord.server_timestamp).isAfter(lateThreshold)) {
      attendanceLog.status = 'LATE';
      if (approvalRestrictions.late_punch_in) {
        attendanceLog.requires_approval = true;
        attendanceLog.status = 'PENDING_APPROVAL';
      }
    } else {
      attendanceLog.status = 'PRESENT';
    }
    
    if (attendanceLog.requires_approval) {
      attendanceLog.status = 'PENDING_APPROVAL';
    }
  }

  /**
   * Process punch out
   */
  async processPunchOut(attendanceLog, punchRecord, shift, policy, date, approvalRestrictions) {
    if (!attendanceLog.punch_in) {
      throw new Error('Not punched in');
    }
    if (attendanceLog.punch_out) {
      throw new Error('Already punched out');
    }

    attendanceLog.punch_out = punchRecord;
    
    // Calculate work hours
    const calculations = await calculationEngine.calculateDailyAttendance(
      attendanceLog,
      shift,
      policy
    );
    attendanceLog.computed_data = calculations;

    // Check for early exit
    const shiftEndTime = shift.getEndDateTime(date);
    const graceMinutes = shift.grace_period_minutes || 15;
    const earlyExitThreshold = moment(shiftEndTime).subtract(graceMinutes, 'minutes');
    
    if (moment(punchRecord.server_timestamp).isBefore(earlyExitThreshold)) {
      attendanceLog.status = 'EARLY_EXIT';
      if (approvalRestrictions.early_punch_out) {
        attendanceLog.requires_approval = true;
        attendanceLog.status = 'PENDING_APPROVAL';
      }
    } else {
      if (attendanceLog.status !== 'PENDING_APPROVAL') {
         attendanceLog.status = 'PRESENT';
      }
    }
    
    if (attendanceLog.requires_approval) {
      attendanceLog.status = 'PENDING_APPROVAL';
    }
  }

  /**
   * Process break start
   */
  async processBreakStart(attendanceLog, userId, punchRecord, breakType = 'UNPAID') {
    if (!attendanceLog.punch_in || attendanceLog.punch_out) {
      throw new Error('Invalid state for break');
    }

    // Check if already on break
    const activeBreak = await BreakLog.getActiveBreak(userId);
    if (activeBreak) {
      throw new Error('Already on break');
    }

    // Create break log
    const breakLog = new BreakLog({
      user_id: userId,
      attendance_id: attendanceLog._id,
      break_type: breakType,
      break_start: punchRecord.server_timestamp,
      location_start: punchRecord.location,
      is_paid: breakType === 'PAID'
    });

    await breakLog.save();

    attendanceLog.breaks = attendanceLog.breaks || [];
    attendanceLog.breaks.push(breakLog._id);
    attendanceLog.status = 'ON_BREAK';
  }

  /**
   * Process break end
   */
  async processBreakEnd(attendanceLog, userId, punchRecord) {
    const activeBreak = await BreakLog.getActiveBreak(userId);
    
    if (!activeBreak) {
      throw new Error('No active break found');
    }

    await activeBreak.endBreak(punchRecord.location);
    attendanceLog.status = 'PUNCHED_IN';
  }

  /**
   * Send punch notifications
   */
  async sendPunchNotifications(user, attendanceLog, punchType, locationValidation) {
    const superiors = await user.getAllSuperiors();
    
    // Notify superiors if approval required
    if (attendanceLog.requires_approval && superiors.length > 0) {
      for (const managerId of superiors) {
        await notificationService.sendApprovalRequest(managerId, {
          type: 'ATTENDANCE_APPROVAL',
          userId: user._id,
          userName: user.full_name,
          attendanceId: attendanceLog._id,
          date: attendanceLog.date,
          reason: locationValidation.reason || attendanceLog.status
        });
      }
    }

    // Always notify superiors for specific events (even if approval not required)
    if (superiors.length > 0) {
      // Late Punch-In
      if (punchType === 'IN' && (attendanceLog.status === 'LATE' || attendanceLog.requires_approval)) {
        await notificationService.sendLateNotification(superiors, {
          userId: user._id,
          userName: user.full_name,
          punchTime: new Date(),
          lateBy: attendanceLog.computed_data?.late_by_minutes
        });
      }
      
      // Out of Geo-fence
      if (!locationValidation.valid) {
        await notificationService.sendLocationFlagNotification(superiors, {
          userId: user._id,
          userName: user.full_name,
          punchTime: new Date(),
          punchType,
          reason: locationValidation.reason
        });
      }
      
      // Early Punch-Out
      if (punchType === 'OUT' && (attendanceLog.status === 'EARLY_EXIT' || attendanceLog.requires_approval)) {
        await notificationService.sendEarlyExitNotification(superiors, {
          userId: user._id,
          userName: user.full_name,
          punchTime: new Date(),
          earlyBy: attendanceLog.computed_data?.early_exit_by_minutes
        });
      }
    }

    // Notify employee if punch recorded
    await notificationService.sendNotification(user._id, {
      type: 'PUNCH_RECORDED',
      title: attendanceLog.requires_approval ? `Punch ${punchType} Sent for Approval` : `Punch ${punchType} Recorded`,
      message: attendanceLog.requires_approval 
        ? `Your ${punchType.toLowerCase()} is pending approval.` 
        : `Your ${punchType.toLowerCase()} has been recorded at ${moment().format('HH:mm:ss')}`,
      data: {
        attendanceId: attendanceLog._id,
        punchType,
        timestamp: new Date()
      }
    });
  }

  /**
   * Log punch action
   */
  async logPunchAction(user, attendanceLog, punchType, locationValidation, punchData) {
    await SystemActionLog.create({
      actor_user_id: user._id,
      actor_role: user.role,
      action_type: `PUNCH_${punchType}`,
      target_user_id: user._id,
      target_entity_id: attendanceLog._id,
      new_value: {
        type: punchType,
        locationValid: locationValidation.valid,
        requiresApproval: locationValidation.requiresApproval
      },
      ip_address: punchData.ip,
      user_agent: punchData.user_agent,
      metadata: new Map([
        ['device_info', punchData.device_info],
        ['source', punchData.source]
      ])
    });
  }

  /**
   * Generate idempotency key
   */
  generateIdempotencyKey(userId, type) {
    return `punch_${userId}_${Date.now()}_${type}_${uuidv4()}`;
  }

  /**
   * Get current attendance status
   */
  async getCurrentStatus(userId) {
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

    const user = await User.findById(userId);
    const shift = await this.getUserShift(user);

    return {
      state,
      attendance: attendanceLog,
      last_punch: lastPunch,
      active_break: activeBreak,
      shift: shift ? {
        name: shift.name,
        start_time: shift.start_time,
        end_time: shift.end_time,
        grace_period_minutes: shift.grace_period_minutes
      } : null,
      date: today
    };
  }

  /**
   * Get attendance history
   */
  async getAttendanceHistory(userId, filters = {}, pagination = {}) {
    const { startDate, endDate, status } = filters;
    const { page = 1, limit = 20 } = pagination;

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
        .limit(limit)
        .populate('shift_id', 'name start_time end_time')
        .populate('breaks', 'break_start break_end actual_duration_minutes break_type'),
      AttendanceLog.countDocuments(query)
    ]);

    const summary = await this.calculateSummary(userId, startDate, endDate);

    return {
      data: attendance,
      summary,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Calculate attendance summary
   */
  async calculateSummary(userId, startDate, endDate) {
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
      total_work_hours: (totalWorkMinutes / 60).toFixed(2),
      total_overtime_hours: (totalOvertimeMinutes / 60).toFixed(2),
      average_hours_per_day: attendance.length > 0 
        ? (totalWorkMinutes / 60 / attendance.length).toFixed(2) 
        : '0.00'
    };
  }

  /**
   * Override attendance
   */
  async overrideAttendance(attendanceId, overrideData, actor) {
    const attendanceLog = await AttendanceLog.findById(attendanceId);
    
    if (!attendanceLog) {
      throw new Error('Attendance log not found');
    }

    const oldValue = {
      punch_in: attendanceLog.punch_in,
      punch_out: attendanceLog.punch_out,
      status: attendanceLog.status
    };

    // Update punches
    if (overrideData.punch_in) {
      attendanceLog.punch_in = {
        ...attendanceLog.punch_in,
        timestamp: new Date(overrideData.punch_in),
        server_timestamp: new Date(),
        is_valid: true,
        validation_details: {
          ...attendanceLog.punch_in?.validation_details,
          overridden: true,
          override_reason: overrideData.reason
        }
      };
    }

    if (overrideData.punch_out) {
      attendanceLog.punch_out = {
        ...attendanceLog.punch_out,
        timestamp: new Date(overrideData.punch_out),
        server_timestamp: new Date(),
        is_valid: true,
        validation_details: {
          ...attendanceLog.punch_out?.validation_details,
          overridden: true,
          override_reason: overrideData.reason
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
    attendanceLog.approved_by = actor.id;
    attendanceLog.approved_at = new Date();

    await attendanceLog.save();

    // Log override
    await SystemActionLog.create({
      actor_user_id: actor.id,
      actor_role: actor.role,
      action_type: 'ATTENDANCE_OVERRIDE',
      target_user_id: attendanceLog.user_id,
      target_entity_id: attendanceLog._id,
      old_value: oldValue,
      new_value: {
        punch_in: attendanceLog.punch_in,
        punch_out: attendanceLog.punch_out,
        status: attendanceLog.status
      },
      reason: overrideData.reason,
      ip_address: overrideData.ip,
      user_agent: overrideData.user_agent,
      is_super_admin_action: actor.role === 'SUPER_ADMIN'
    });

    return attendanceLog;
  }

  /**
   * Auto punch out for missed punches
   */
  async autoPunchOut() {
    const yesterday = moment().subtract(1, 'day').endOf('day').toDate();
    const openSessions = await AttendanceLog.find({
      date: { $lte: yesterday },
      punch_in: { $exists: true },
      punch_out: { $exists: false },
      status: { $in: ['PRESENT', 'LATE', 'PUNCHED_IN'] }
    }).populate('shift_id');

    const results = {
      processed: 0,
      auto_punched: 0,
      failed: 0
    };

    for (const session of openSessions) {
      try {
        const shift = session.shift_id;
        const shiftEndTime = shift.getEndDateTime(session.date);
        const autoOutTime = moment(shiftEndTime).add(2, 'hours');
        
        if (moment().isAfter(autoOutTime)) {
          session.punch_out = {
            timestamp: autoOutTime.toDate(),
            server_timestamp: new Date(),
            source: 'SYSTEM',
            is_valid: true,
            validation_details: {
              auto_punched: true,
              reason: 'Auto punch-out applied'
            }
          };
          
          session.status = 'PRESENT';
          
          const policy = await Policy.findById(session.policy_version_id);
          if (policy) {
            const calculations = await calculationEngine.calculateDailyAttendance(
              session,
              shift,
              policy
            );
            session.computed_data = calculations;
          }
          
          await session.save();
          results.auto_punched++;
        }
        
        results.processed++;
      } catch (error) {
        logger.error(`Auto punch-out failed for session ${session._id}:`, error);
        results.failed++;
      }
    }

    logger.info('Auto punch-out completed', results);
    return results;
  }

  /**
   * Get attendance chart data
   */
  async getChartData(userId, period = 'month') {
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
    }

    const attendance = await AttendanceLog.find({
      user_id: userId,
      date: dateRange
    }).sort({ date: 1 });

    return attendance.map(log => ({
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
  }
}

module.exports = new AttendanceService();