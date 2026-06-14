const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Shift name is required'],
    trim: true,
    minlength: [3, 'Shift name must be at least 3 characters'],
    maxlength: [50, 'Shift name cannot exceed 50 characters']
  },
  code: {
    type: String,
    required: [true, 'Shift code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    match: [/^[A-Z0-9_-]+$/, 'Shift code can only contain letters, numbers, underscores and hyphens']
  },
  type: {
    type: String,
    enum: {
      values: ['Fixed', 'Flexible', 'Rotational', 'Night'],
      message: '{VALUE} is not a valid shift type'
    },
    required: [true, 'Shift type is required']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  start_time: {
    type: String,
    required: [true, 'Start time is required'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
  },
  end_time: {
    type: String,
    required: [true, 'End time is required'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
  },
  grace_period_minutes: {
    type: Number,
    default: 15,
    min: [0, 'Grace period cannot be negative'],
    max: [60, 'Grace period cannot exceed 60 minutes']
  },
  late_threshold_minutes: {
    type: Number,
    default: 30,
    min: [1, 'Late threshold must be at least 1 minute'],
    max: [120, 'Late threshold cannot exceed 120 minutes']
  },
  half_day_threshold_hours: {
    type: Number,
    default: 4,
    min: [1, 'Half day threshold must be at least 1 hour'],
    max: [8, 'Half day threshold cannot exceed 8 hours']
  },
  break_duration_minutes: {
    type: Number,
    default: 60,
    min: [0, 'Break duration cannot be negative'],
    max: [180, 'Break duration cannot exceed 180 minutes']
  },
  break_is_paid: {
    type: Boolean,
    default: false
  },
  multiple_breaks_allowed: {
    type: Boolean,
    default: true
  },
  max_break_instances: {
    type: Number,
    default: 3,
    min: [1, 'Maximum break instances must be at least 1'],
    max: [10, 'Maximum break instances cannot exceed 10']
  },
  working_days: {
    type: [Number],
    default: [1, 2, 3, 4, 5], // Monday to Friday (0 = Sunday)
    validate: {
      validator: function(days) {
        return days.length > 0 && days.every(d => d >= 0 && d <= 6);
      },
      message: 'Working days must be between 0 (Sunday) and 6 (Saturday)'
    }
  },
  flexible_hours: {
    enabled: {
      type: Boolean,
      default: false
    },
    core_start_time: {
      type: String,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
    },
    core_end_time: {
      type: String,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)']
    },
    min_hours_per_day: {
      type: Number,
      min: 4,
      max: 12
    },
    max_hours_per_day: {
      type: Number,
      min: 8,
      max: 16
    }
  },
  rotational_schedule: {
    enabled: {
      type: Boolean,
      default: false
    },
    rotation_type: {
      type: String,
      enum: ['Weekly', 'Bi-Weekly', 'Monthly']
    },
    shifts: [{
      shift_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shift'
      },
      duration_days: Number,
      order: Number
    }]
  },
  night_shift_config: {
    cross_midnight: {
      type: Boolean,
      default: false
    },
    night_shift_allowance: {
      type: Number,
      default: 0,
      min: 0
    },
    next_day_punch_out: {
      type: Boolean,
      default: true
    }
  },
  overtime_config: {
    enabled: {
      type: Boolean,
      default: true
    },
    min_overtime_minutes: {
      type: Number,
      default: 15,
      min: [0, 'Minimum overtime cannot be negative']
    },
    max_overtime_hours: {
      type: Number,
      default: 4,
      min: [0, 'Maximum overtime cannot be negative'],
      max: [12, 'Maximum overtime cannot exceed 12 hours']
    },
    rate_multiplier: {
      type: Number,
      default: 1.5,
      min: [1, 'Rate multiplier must be at least 1'],
      max: [3, 'Rate multiplier cannot exceed 3']
    },
    double_rate_after_hours: {
      type: Number,
      default: 12,
      min: [8, 'Double rate threshold must be at least 8 hours'],
      max: [16, 'Double rate threshold cannot exceed 16 hours']
    },
    require_approval: {
      type: Boolean,
      default: true
    }
  },
  holiday_config: {
    apply_holiday_rules: {
      type: Boolean,
      default: true
    },
    holiday_pay_multiplier: {
      type: Number,
      default: 2.0,
      min: [1, 'Holiday pay multiplier must be at least 1'],
      max: [3, 'Holiday pay multiplier cannot exceed 3']
    },
    compensate_with_leave: {
      type: Boolean,
      default: false
    }
  },
  weekend_config: {
    weekend_days: {
      type: [Number],
      default: [0, 6] // Saturday and Sunday
    },
    weekend_pay_multiplier: {
      type: Number,
      default: 1.5,
      min: [1, 'Weekend pay multiplier must be at least 1']
    }
  },
  applicable_departments: [{
    type: String,
    enum: [
      'Management',
      'Human Resources',
      'Engineering',
      'Sales',
      'Marketing',
      'Finance',
      'Operations',
      'Customer Support',
      'IT',
      'Administration'
    ]
  }],
  applicable_users: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  is_active: {
    type: Boolean,
    default: true
  },
  version: {
    type: Number,
    default: 1,
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
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
shiftSchema.index({ is_active: 1 });
shiftSchema.index({ type: 1 });
shiftSchema.index({ effective_from: -1 });
shiftSchema.index({ applicable_departments: 1 });
shiftSchema.index({ applicable_users: 1 });
shiftSchema.index({ version: 1 });
shiftSchema.index({ created_by: 1 });

// Virtual for shift duration in hours
shiftSchema.virtual('duration_hours').get(function() {
  const [startHour, startMin] = this.start_time.split(':').map(Number);
  const [endHour, endMin] = this.end_time.split(':').map(Number);
  
  let hours = endHour - startHour;
  let minutes = endMin - startMin;
  
  if (this.type === 'Night' && this.night_shift_config?.cross_midnight) {
    hours += 24;
  }
  
  if (minutes < 0) {
    hours -= 1;
    minutes += 60;
  }
  
  return hours + (minutes / 60);
});

// Virtual for shift duration in minutes
shiftSchema.virtual('duration_minutes').get(function() {
  return this.duration_hours * 60;
});

// Method to check if shift is currently active
shiftSchema.methods.isCurrentlyActive = function() {
  const now = new Date();
  
  if (!this.is_active) return false;
  
  if (this.effective_from && now < this.effective_from) return false;
  if (this.effective_to && now > this.effective_to) return false;
  
  return true;
};

// Method to check if user is eligible for this shift
shiftSchema.methods.isUserEligible = function(user) {
  if (this.applicable_users && this.applicable_users.length > 0) {
    return this.applicable_users.some(id => id.equals(user._id));
  }
  
  if (this.applicable_departments && this.applicable_departments.length > 0) {
    return this.applicable_departments.includes(user.department);
  }
  
  return true;
};

// Method to check if date is a working day
shiftSchema.methods.isWorkingDay = function(date) {
  const dayOfWeek = date.getDay();
  return this.working_days.includes(dayOfWeek);
};

// Method to get shift start datetime for a given date
shiftSchema.methods.getStartDateTime = function(date) {
  const [hours, minutes] = this.start_time.split(':').map(Number);
  const startDateTime = new Date(date);
  startDateTime.setHours(hours, minutes, 0, 0);
  return startDateTime;
};

// Method to get shift end datetime for a given date
shiftSchema.methods.getEndDateTime = function(date) {
  const [hours, minutes] = this.end_time.split(':').map(Number);
  const endDateTime = new Date(date);
  endDateTime.setHours(hours, minutes, 0, 0);
  
  if (this.type === 'Night' && this.night_shift_config?.cross_midnight) {
    endDateTime.setDate(endDateTime.getDate() + 1);
  }
  
  return endDateTime;
};

// Static method to find active shifts
shiftSchema.statics.findActiveShifts = function() {
  return this.find({
    is_active: true,
    $or: [
      { effective_to: null },
      { effective_to: { $gte: new Date() } }
    ],
    effective_from: { $lte: new Date() }
  });
};

// Static method to find shifts for user
shiftSchema.statics.findShiftsForUser = function(user) {
  return this.find({
    is_active: true,
    $or: [
      { applicable_users: user._id },
      { applicable_departments: user.department },
      { 
        applicable_users: { $size: 0 },
        applicable_departments: { $size: 0 }
      }
    ]
  });
};

const Shift = mongoose.model('Shift', shiftSchema);

module.exports = Shift;