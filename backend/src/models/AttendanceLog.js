const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  latitude: {
    type: Number,
    required: true,
    min: -90,
    max: 90
  },
  longitude: {
    type: Number,
    required: true,
    min: -180,
    max: 180
  },
  accuracy: {
    type: Number,
    min: 0
  }
});

const validationDetailsSchema = new mongoose.Schema({
  location_valid: {
    type: Boolean,
    default: true
  },
  accuracy_valid: {
    type: Boolean,
    default: true
  },
  time_valid: {
    type: Boolean,
    default: true
  },
  reason: {
    type: String
  },
  distance: {
    type: Number
  },
  isInside: {
    type: Boolean
  },
  geoFenceName: {
    type: String
  },
  overridden: {
    type: Boolean,
    default: false
  },
  override_reason: {
    type: String
  },
  auto_punched: {
    type: Boolean,
    default: false
  }
});

const punchSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    required: true
  },
  server_timestamp: {
    type: Date,
    required: true
  },
  client_timestamp: {
    type: Date
  },
  location: locationSchema,
  ip: {
    type: String
  },
  source: {
    type: String,
    enum: ['WEB', 'MOBILE', 'OFFLINE', 'SYSTEM', 'API'],
    default: 'WEB'
  },
  selfie_url: {
    type: String,
    default: null
  },
  is_valid: {
    type: Boolean,
    default: true
  },
  validation_details: {
    type: validationDetailsSchema,
    default: {}
  }
});

const computedDataSchema = new mongoose.Schema({
  total_work_minutes: {
    type: Number,
    default: 0
  },
  total_break_minutes: {
    type: Number,
    default: 0
  },
  net_work_minutes: {
    type: Number,
    default: 0
  },
  late_by_minutes: {
    type: Number,
    default: 0
  },
  early_exit_by_minutes: {
    type: Number,
    default: 0
  },
  overtime_minutes: {
    type: Number,
    default: 0
  },
  overtime_rate_applied: {
    type: Number,
    default: 1.0
  },
  expected_hours: {
    type: Number,
    default: 8
  },
  status: {
    type: String
  }
});

const attendanceLogSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  shift_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shift'
  },
  policy_version_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Policy'
  },
  punch_in: {
    type: punchSchema,
    default: null
  },
  punch_out: {
    type: punchSchema,
    default: null
  },
  breaks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BreakLog'
  }],
  computed_data: {
    type: computedDataSchema,
    default: {}
  },
  status: {
    type: String,
    enum: [
      'NOT_PUNCHED',
      'PUNCHED_IN',
      'ON_BREAK',
      'PUNCHED_OUT',
      'PRESENT',
      'ABSENT',
      'LATE',
      'HALF_DAY',
      'EARLY_EXIT',
      'HOLIDAY',
      'WEEKEND',
      'ON_LEAVE',
      'PENDING_APPROVAL'
    ],
    default: 'NOT_PUNCHED'
  },
  is_locked: {
    type: Boolean,
    default: false
  },
  requires_approval: {
    type: Boolean,
    default: false
  },
  approval_status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approved_at: {
    type: Date
  },
  rejection_reason: {
    type: String
  },
  location_invalid: {
    type: Boolean,
    default: false
  },
  sync_status: {
    type: String,
    enum: ['SYNCED', 'PENDING', 'CONFLICT'],
    default: 'SYNCED'
  },
  idempotency_key: {
    type: String,
    unique: true,
    sparse: true
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes
attendanceLogSchema.index({ user_id: 1, date: -1 });
attendanceLogSchema.index({ date: 1, status: 1 }); // Optimized for dashboard stats
attendanceLogSchema.index({ status: 1 });
attendanceLogSchema.index({ approval_status: 1 });
attendanceLogSchema.index({ 'punch_in.server_timestamp': 1 });
attendanceLogSchema.index({ created_at: -1 });

// Virtual for total work duration
attendanceLogSchema.virtual('total_work_duration').get(function() {
  if (this.punch_in && this.punch_out) {
    return this.punch_out.server_timestamp - this.punch_in.server_timestamp;
  }
  return 0;
});

// Method to get current state
attendanceLogSchema.methods.getCurrentState = function() {
  if (!this.punch_in) {
    return 'NOT_PUNCHED';
  }
  
  if (this.status === 'PENDING_APPROVAL') {
    return 'PENDING_APPROVAL';
  }
  
  if (this.punch_out) {
    return 'PUNCHED_OUT';
  }
  
  if (this.status === 'ON_BREAK') {
    return 'ON_BREAK';
  }
  
  return 'PUNCHED_IN';
};

// Method to check if attendance can be modified
attendanceLogSchema.methods.canBeModified = function(userRole) {
  if (this.is_locked) {
    return userRole === 'SUPER_ADMIN';
  }
  return true;
};

// Method to calculate work hours
attendanceLogSchema.methods.calculateWorkHours = function() {
  if (!this.punch_in || !this.punch_out) return 0;
  
  const workDuration = this.punch_out.server_timestamp - this.punch_in.server_timestamp;
  const breakDuration = this.computed_data?.total_break_minutes || 0;
  
  return Math.max(0, (workDuration / (1000 * 60)) - breakDuration);
};

// Method to check if late
attendanceLogSchema.methods.isLate = function(shiftStartTime, graceMinutes = 15) {
  if (!this.punch_in) return false;
  
  const punchTime = new Date(this.punch_in.server_timestamp);
  const shiftStart = new Date(shiftStartTime);
  const lateThreshold = new Date(shiftStart.getTime() + graceMinutes * 60 * 1000);
  
  return punchTime > lateThreshold;
};

// Method to check if early exit
attendanceLogSchema.methods.isEarlyExit = function(shiftEndTime, graceMinutes = 15) {
  if (!this.punch_out) return false;
  
  const punchTime = new Date(this.punch_out.server_timestamp);
  const shiftEnd = new Date(shiftEndTime);
  const earlyThreshold = new Date(shiftEnd.getTime() - graceMinutes * 60 * 1000);
  
  return punchTime < earlyThreshold;
};

// Static method to find today's attendance
attendanceLogSchema.statics.findTodayAttendance = function(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return this.findOne({
    user_id: userId,
    date: {
      $gte: today,
      $lt: tomorrow
    }
  });
};

// Static method to find attendance by date range
attendanceLogSchema.statics.findByDateRange = function(userId, startDate, endDate) {
  return this.find({
    user_id: userId,
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  }).sort({ date: -1 });
};

// Static method to get monthly summary
attendanceLogSchema.statics.getMonthlySummary = async function(userId, year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const logs = await this.find({
    user_id: userId,
    date: {
      $gte: startDate,
      $lte: endDate
    }
  });
  
  const summary = {
    total_days: logs.length,
    present_days: 0,
    absent_days: 0,
    late_days: 0,
    half_days: 0,
    early_exit_days: 0,
    total_work_minutes: 0,
    total_overtime_minutes: 0
  };
  
  logs.forEach(log => {
    switch (log.status) {
      case 'PRESENT':
        summary.present_days++;
        break;
      case 'ABSENT':
        summary.absent_days++;
        break;
      case 'LATE':
        summary.late_days++;
        break;
      case 'HALF_DAY':
        summary.half_days++;
        break;
      case 'EARLY_EXIT':
        summary.early_exit_days++;
        break;
    }
    
    if (log.computed_data) {
      summary.total_work_minutes += log.computed_data.net_work_minutes || 0;
      summary.total_overtime_minutes += log.computed_data.overtime_minutes || 0;
    }
  });
  
  return summary;
};

const AttendanceLog = mongoose.model('AttendanceLog', attendanceLogSchema);

module.exports = AttendanceLog;