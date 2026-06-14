const mongoose = require('mongoose');

const policySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Policy name is required'],
    trim: true,
    minlength: [3, 'Policy name must be at least 3 characters'],
    maxlength: [100, 'Policy name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Policy code is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  version: {
    type: Number,
    required: true,
    min: 1
  },
  effective_from: {
    type: Date,
    required: [true, 'Effective from date is required']
  },
  effective_to: {
    type: Date,
    default: null
  },
  rules: {
    attendance: {
      auto_punch_out: {
        enabled: { type: Boolean, default: true },
        after_shift_end_hours: { type: Number, default: 2, min: 0, max: 24 }
      },
      min_work_hours_for_present: {
        type: Number,
        default: 4,
        min: 1,
        max: 12
      },
      allow_weekend_punch: {
        type: Boolean,
        default: true
      },
      allow_holiday_punch: {
        type: Boolean,
        default: true
      },
      require_location_for_punch: {
        type: Boolean,
        default: true
      },
      location_accuracy_threshold_meters: {
        type: Number,
        default: 50,
        min: 10,
        max: 500
      },
      qr_type: {
        type: String,
        enum: ['DYNAMIC', 'STATIC', 'NONE'],
        default: 'DYNAMIC'
      },
      require_selfie: {
        type: Boolean,
        default: false
      },
      require_registered_device: {
        type: Boolean,
        default: true
      }
    },
    overtime: {
      enabled: { type: Boolean, default: true },
      rate_multiplier: { type: Number, default: 1.5, min: 1, max: 3 },
      threshold_hours: { type: Number, default: 8, min: 1, max: 24 },
      double_rate_after_hours: { type: Number, default: 12, min: 8, max: 24 },
      approval_required: { type: Boolean, default: true },
      min_overtime_minutes: { type: Number, default: 15, min: 0, max: 60 },
      max_overtime_hours_per_day: { type: Number, default: 4, min: 0, max: 12 },
      max_overtime_hours_per_week: { type: Number, default: 20, min: 0, max: 40 },
      max_overtime_hours_per_month: { type: Number, default: 50, min: 0, max: 100 }
    },
    late_arrival: {
      grace_minutes: { type: Number, default: 15, min: 0, max: 60 },
      deduction_per_minute: { type: Number, default: 0.5, min: 0, max: 10 },
      max_deduction_minutes: { type: Number, default: 60, min: 0, max: 240 },
      allowed_instances_per_month: { type: Number, default: 3, min: 0, max: 10 },
      escalate_after_instances: { type: Number, default: 5, min: 1, max: 20 }
    },
    early_exit: {
      grace_minutes: { type: Number, default: 15, min: 0, max: 60 },
      penalty_per_minute: { type: Number, default: 1, min: 0, max: 10 },
      allowed_instances_per_month: { type: Number, default: 3, min: 0, max: 10 }
    },
    half_day: {
      threshold_hours_worked: { type: Number, default: 4, min: 1, max: 8 },
      requires_approval: { type: Boolean, default: false },
      auto_apply: { type: Boolean, default: true }
    },
    absence: {
      auto_mark_after_hours: { type: Number, default: 2, min: 0, max: 8 },
      requires_justification: { type: Boolean, default: true },
      consecutive_absences_threshold: { type: Number, default: 3, min: 1, max: 10 },
      notify_manager_after_days: { type: Number, default: 1, min: 0, max: 5 },
      notify_hr_after_days: { type: Number, default: 3, min: 1, max: 10 }
    },
    breaks: {
      auto_deduct_unpaid_after_minutes: { type: Number, default: 60, min: 15, max: 180 },
      max_break_minutes_per_day: { type: Number, default: 120, min: 30, max: 240 },
      min_break_between_shifts_hours: { type: Number, default: 11, min: 8, max: 16 },
      require_break_after_hours: { type: Number, default: 5, min: 2, max: 8 },
      mandatory_break_minutes: { type: Number, default: 30, min: 0, max: 60 }
    },
    regularization: {
      allowed_days_back: { type: Number, default: 7, min: 1, max: 30 },
      require_proof_for_old_requests: { type: Boolean, default: true },
      max_requests_per_month: { type: Number, default: 5, min: 1, max: 20 },
      auto_approve_after_days: { type: Number, default: 7, min: 1, max: 30 }
    },
    leave: {
      casual_leave_days: { type: Number, default: 12, min: 0, max: 30 },
      sick_leave_days: { type: Number, default: 12, min: 0, max: 30 },
      earned_leave_days: { type: Number, default: 15, min: 0, max: 45 },
      maternity_leave_days: { type: Number, default: 180, min: 0, max: 365 },
      paternity_leave_days: { type: Number, default: 15, min: 0, max: 30 },
      bereavement_leave_days: { type: Number, default: 5, min: 0, max: 10 },
      require_approval_for: {
        casual: { type: Boolean, default: true },
        sick: { type: Boolean, default: true },
        earned: { type: Boolean, default: true }
      },
      allow_negative_balance: { type: Boolean, default: false },
      max_negative_balance_days: { type: Number, default: 5, min: 0, max: 10 },
      carry_forward_enabled: { type: Boolean, default: true },
      max_carry_forward_days: { type: Number, default: 45, min: 0, max: 90 }
    },
    payroll: {
      lock_period_days: { type: Number, default: 5, min: 0, max: 10 },
      allow_edits_after_lock: { type: Boolean, default: false },
      require_super_admin_approval_for_edits: { type: Boolean, default: true },
      auto_lock_after_days: { type: Number, default: 10, min: 1, max: 30 },
      working_days_per_month: { type: Number, default: 22, min: 1, max: 31 },
      daily_work_hours: { type: Number, default: 8, min: 1, max: 24 }
    },
    notifications: {
      punch_reminder_before_shift_minutes: { type: Number, default: 15, min: 0, max: 60 },
      punch_reminder_after_shift_start_minutes: { type: Number, default: 15, min: 0, max: 60 },
      missed_punch_notification_delay_hours: { type: Number, default: 1, min: 0, max: 4 },
      weekly_summary_day: { type: Number, default: 5, min: 0, max: 6 },
      monthly_summary_day: { type: Number, default: 1, min: 1, max: 28 }
    }
  },
  is_active: {
    type: Boolean,
    default: true
  },
  is_default: {
    type: Boolean,
    default: false
  },
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 100
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approved_at: {
    type: Date
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes
policySchema.index({ version: 1 });
policySchema.index({ is_active: 1 });
policySchema.index({ effective_from: -1 });
policySchema.index({ priority: -1 });
policySchema.index({ is_default: 1 });
policySchema.index({ created_by: 1 });

// Pre-save middleware
policySchema.pre('save', async function(next) {
  if (this.is_default) {
    // Ensure only one default policy
    await this.constructor.updateMany(
      { _id: { $ne: this._id }, is_default: true },
      { is_default: false }
    );
  }
  next();
});

// Method to check if policy is currently active
policySchema.methods.isCurrentlyActive = function() {
  const now = new Date();
  
  if (!this.is_active) return false;
  if (this.effective_from && now < this.effective_from) return false;
  if (this.effective_to && now > this.effective_to) return false;
  
  return true;
};

// Method to get specific rule value
policySchema.methods.getRule = function(path, defaultValue = null) {
  return path.split('.').reduce((obj, key) => obj?.[key], this.rules) || defaultValue;
};

// Static method to find active policy
policySchema.statics.findActivePolicy = function() {
  return this.findOne({
    is_active: true,
    effective_from: { $lte: new Date() },
    $or: [
      { effective_to: null },
      { effective_to: { $gte: new Date() } }
    ]
  }).sort({ priority: -1, version: -1 });
};

// Static method to find default policy
policySchema.statics.findDefaultPolicy = function() {
  return this.findOne({ is_default: true, is_active: true });
};

const Policy = mongoose.model('Policy', policySchema);

module.exports = Policy;