const mongoose = require('mongoose');

const breakLogSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  attendance_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AttendanceLog',
    required: [true, 'Attendance ID is required']
  },
  break_type: {
    type: String,
    enum: ['PAID', 'UNPAID', 'MEAL', 'REST', 'OTHER'],
    default: 'UNPAID'
  },
  break_start: {
    type: Date,
    required: [true, 'Break start time is required']
  },
  break_end: {
    type: Date,
    default: null
  },
  planned_duration_minutes: {
    type: Number,
    min: 0
  },
  actual_duration_minutes: {
    type: Number,
    min: 0
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'COMPLETED', 'AUTO_CLOSED', 'CANCELLED'],
    default: 'ACTIVE'
  },
  auto_closed_reason: {
    type: String
  },
  location_start: {
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    accuracy: { type: Number }
  },
  location_end: {
    latitude: { type: Number, min: -90, max: 90 },
    longitude: { type: Number, min: -180, max: 180 },
    accuracy: { type: Number }
  },
  is_paid: {
    type: Boolean,
    default: false
  },
  is_approved: {
    type: Boolean,
    default: true
  },
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approval_reason: {
    type: String
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes
breakLogSchema.index({ user_id: 1, created_at: -1 });
breakLogSchema.index({ attendance_id: 1 });
breakLogSchema.index({ status: 1 });
breakLogSchema.index({ break_start: -1 });
breakLogSchema.index({ break_type: 1 });

// Pre-save middleware
breakLogSchema.pre('save', function(next) {
  // Calculate duration if break has ended
  if (this.break_start && this.break_end) {
    this.actual_duration_minutes = Math.floor(
      (this.break_end - this.break_start) / (1000 * 60)
    );
  }
  
  // Auto-close long breaks
  if (this.status === 'ACTIVE' && this.break_start) {
    const now = new Date();
    const durationMinutes = Math.floor((now - this.break_start) / (1000 * 60));
    
    // Auto-close after 4 hours
    if (durationMinutes > 240) {
      this.break_end = new Date(this.break_start.getTime() + 240 * 60 * 1000);
      this.status = 'AUTO_CLOSED';
      this.auto_closed_reason = 'Exceeded maximum break duration (4 hours)';
      this.actual_duration_minutes = 240;
    }
  }
  
  next();
});

// Method to end break
breakLogSchema.methods.endBreak = async function(endLocation = null) {
  this.break_end = new Date();
  this.status = 'COMPLETED';
  
  if (endLocation) {
    this.location_end = endLocation;
  }
  
  this.actual_duration_minutes = Math.floor(
    (this.break_end - this.break_start) / (1000 * 60)
  );
  
  return this.save();
};

// Method to cancel break
breakLogSchema.methods.cancelBreak = async function(reason) {
  this.status = 'CANCELLED';
  this.metadata = this.metadata || new Map();
  this.metadata.set('cancellation_reason', reason);
  
  return this.save();
};

// Method to approve break (if approval required)
breakLogSchema.methods.approveBreak = async function(approvedBy, reason = null) {
  this.is_approved = true;
  this.approved_by = approvedBy;
  
  if (reason) {
    this.approval_reason = reason;
  }
  
  return this.save();
};

// Static method to get active breaks for user
breakLogSchema.statics.getActiveBreak = async function(userId) {
  return this.findOne({
    user_id: userId,
    status: 'ACTIVE'
  });
};

// Static method to get breaks for attendance
breakLogSchema.statics.getBreaksForAttendance = async function(attendanceId) {
  return this.find({ attendance_id: attendanceId })
    .sort({ break_start: 1 });
};

// Static method to calculate total break time
breakLogSchema.statics.calculateTotalBreakTime = async function(attendanceId, breakType = null) {
  const query = { 
    attendance_id: attendanceId,
    status: { $in: ['COMPLETED', 'AUTO_CLOSED'] }
  };
  
  if (breakType) {
    query.break_type = breakType;
  }
  
  const breaks = await this.find(query);
  
  return breaks.reduce((total, br) => {
    return total + (br.actual_duration_minutes || 0);
  }, 0);
};

// Static method to auto-close stale breaks
breakLogSchema.statics.autoCloseStaleBreaks = async function() {
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
  
  const result = await this.updateMany(
    {
      status: 'ACTIVE',
      break_start: { $lt: fourHoursAgo }
    },
    {
      status: 'AUTO_CLOSED',
      auto_closed_reason: 'Auto-closed by system (stale break)',
      break_end: new Date()
    }
  );
  
  return result;
};

const BreakLog = mongoose.model('BreakLog', breakLogSchema);

module.exports = BreakLog;