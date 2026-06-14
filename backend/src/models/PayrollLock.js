const mongoose = require('mongoose');

const payrollLockSchema = new mongoose.Schema({
  month: {
    type: Number,
    required: [true, 'Month is required'],
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: [true, 'Year is required'],
    min: 2000,
    max: 2100
  },
  locked_at: {
    type: Date,
    default: Date.now
  },
  locked_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  locked_by_role: {
    type: String,
    required: true,
    enum: ['SUPER_ADMIN', 'HR']
  },
  is_locked: {
    type: Boolean,
    default: true
  },
  unlocked_at: {
    type: Date,
    default: null
  },
  unlocked_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  unlock_reason: {
    type: String,
    maxlength: [500, 'Unlock reason cannot exceed 500 characters']
  },
  unlock_approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  payroll_export_id: {
    type: String
  },
  payroll_period_start: {
    type: Date
  },
  payroll_period_end: {
    type: Date
  },
  total_employees_processed: {
    type: Number,
    default: 0
  },
  total_work_hours: {
    type: Number,
    default: 0
  },
  total_overtime_hours: {
    type: Number,
    default: 0
  },
  total_payable_amount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['DRAFT', 'LOCKED', 'PROCESSED', 'UNLOCKED', 'ARCHIVED'],
    default: 'LOCKED'
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  lock_version: {
    type: Number,
    default: 1
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Compound unique index for month and year
payrollLockSchema.index({ month: 1, year: 1 }, { unique: true });
payrollLockSchema.index({ is_locked: 1 });
payrollLockSchema.index({ status: 1 });
payrollLockSchema.index({ locked_by: 1 });
payrollLockSchema.index({ created_at: -1 });

// Pre-save middleware
payrollLockSchema.pre('save', function(next) {
  // Set payroll period dates
  if (!this.payroll_period_start) {
    this.payroll_period_start = new Date(this.year, this.month - 1, 1);
  }
  
  if (!this.payroll_period_end) {
    this.payroll_period_end = new Date(this.year, this.month, 0);
  }
  
  next();
});

// Method to unlock payroll
payrollLockSchema.methods.unlock = async function(unlockedBy, reason, approvedBy = null) {
  // Only Super Admin can unlock without approval
  this.is_locked = false;
  this.status = 'UNLOCKED';
  this.unlocked_at = new Date();
  this.unlocked_by = unlockedBy;
  this.unlock_reason = reason;
  
  if (approvedBy) {
    this.unlock_approved_by = approvedBy;
  }
  
  this.lock_version += 1;
  
  return this.save();
};

// Method to relock payroll
payrollLockSchema.methods.relock = async function(lockedBy) {
  this.is_locked = true;
  this.status = 'LOCKED';
  this.locked_at = new Date();
  this.locked_by = lockedBy;
  this.unlocked_at = null;
  this.unlocked_by = null;
  this.unlock_reason = null;
  this.unlock_approved_by = null;
  
  return this.save();
};

// Method to mark as processed
payrollLockSchema.methods.markAsProcessed = async function(exportId, summary) {
  this.status = 'PROCESSED';
  this.payroll_export_id = exportId;
  
  if (summary) {
    this.total_employees_processed = summary.totalEmployees || 0;
    this.total_work_hours = summary.totalWorkHours || 0;
    this.total_overtime_hours = summary.totalOvertimeHours || 0;
    this.total_payable_amount = summary.totalPayableAmount || 0;
  }
  
  return this.save();
};

// Method to archive
payrollLockSchema.methods.archive = async function() {
  this.status = 'ARCHIVED';
  return this.save();
};

// Static method to check if payroll is locked
payrollLockSchema.statics.isLocked = async function(month, year) {
  const lock = await this.findOne({ 
    month, 
    year, 
    is_locked: true 
  });
  
  return !!lock;
};

// Static method to get lock details
payrollLockSchema.statics.getLockDetails = async function(month, year) {
  return this.findOne({ month, year })
    .populate('locked_by', 'full_name email')
    .populate('unlocked_by', 'full_name email')
    .populate('unlock_approved_by', 'full_name email');
};

// Static method to lock payroll
payrollLockSchema.statics.lockPayroll = async function(month, year, lockedBy, lockedByRole) {
  // Check if already locked
  const existing = await this.findOne({ month, year });
  
  if (existing && existing.is_locked) {
    throw new Error(`Payroll for ${month}/${year} is already locked`);
  }
  
  if (existing) {
    // Update existing
    existing.is_locked = true;
    existing.status = 'LOCKED';
    existing.locked_at = new Date();
    existing.locked_by = lockedBy;
    existing.locked_by_role = lockedByRole;
    existing.lock_version += 1;
    return existing.save();
  }
  
  // Create new lock
  return this.create({
    month,
    year,
    locked_by: lockedBy,
    locked_by_role: lockedByRole
  });
};

// Static method to get locked months
payrollLockSchema.statics.getLockedMonths = async function(year) {
  const query = { is_locked: true };
  if (year) {
    query.year = year;
  }
  
  return this.find(query).sort({ year: -1, month: -1 });
};

// Static method to get payroll history
payrollLockSchema.statics.getPayrollHistory = async function(limit = 12) {
  return this.find()
    .sort({ year: -1, month: -1 })
    .limit(limit)
    .populate('locked_by', 'full_name email');
};

const PayrollLock = mongoose.model('PayrollLock', payrollLockSchema);

module.exports = PayrollLock;