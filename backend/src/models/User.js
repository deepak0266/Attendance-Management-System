const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  employee_id: {
    type: String,
    required: [true, 'Employee ID is required'],
    unique: true,
    trim: true,
    uppercase: true,
    minlength: [3, 'Employee ID must be at least 3 characters'],
    maxlength: [20, 'Employee ID cannot exceed 20 characters'],
    match: [/^[A-Z0-9]+$/, 'Employee ID can only contain letters and numbers']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true,
    match: [/^\+?[1-9]\d{1,14}$/, 'Please provide a valid phone number']
  },
  full_name: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    trim: true,
    enum: {
      values: [
        'Management',
        'Human Resources',
        'Engineering',
        'Product',
        'Design',
        'Quality Assurance',
        'Sales',
        'Marketing',
        'Finance',
        'Operations',
        'Customer Support',
        'IT',
        'Administration'
      ],
      message: '{VALUE} is not a valid department'
    }
  },
  designation: {
    type: String,
    trim: true,
    maxlength: [100, 'Designation cannot exceed 100 characters']
  },
  role: {
    type: String,
    uppercase: true,
    default: 'EMPLOYEE'
  },
  manager_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    validate: {
      validator: async function(value) {
        if (!value) return true;
        const manager = await mongoose.model('User').findById(value);
        return !!manager;
      },
      message: 'Invalid manager ID'
    }
  },
  status: {
    type: String,
    enum: {
      values: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED', 'ON_LEAVE'],
      message: '{VALUE} is not a valid status'
    },
    default: 'ACTIVE'
  },
  password_hash: {
    type: String,
    required: [true, 'Password is required']
  },
  refresh_token_hash: {
    type: String,
    default: null
  },
  password_reset_token: {
    type: String,
    default: null
  },
  password_reset_expires: {
    type: Date,
    default: null
  },
  profile_pic_url: {
    type: String,
    default: null
  },
  joining_date: {
    type: Date,
    required: [true, 'Joining date is required'],
    validate: {
      validator: function(value) {
        return value <= new Date();
      },
      message: 'Joining date cannot be in the future'
    }
  },
  date_of_birth: {
    type: Date,
    validate: {
      validator: function(value) {
        if (!value) return true;
        const age = (new Date() - value) / (365.25 * 24 * 60 * 60 * 1000);
        return age >= 18 && age <= 100;
      },
      message: 'Employee must be between 18 and 100 years old'
    }
  },
  gender: {
    type: String,
    enum: {
      values: ['MALE', 'FEMALE', 'OTHER'],
      message: '{VALUE} is not a valid gender'
    }
  },
  address: {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },
    postal_code: { type: String, trim: true }
  },
  emergency_contact: {
    name: { type: String, trim: true },
    relationship: { type: String, trim: true },
    phone: { type: String, trim: true }
  },
  bank_details: {
    account_holder: { type: String, trim: true },
    account_number: { type: String, trim: true },
    bank_name: { type: String, trim: true },
    ifsc_code: { type: String, trim: true },
    pan_number: { type: String, trim: true }
  },
  last_login: {
    type: Date,
    default: null
  },
  last_login_ip: {
    type: String,
    default: null
  },
  failed_login_attempts: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  account_locked_until: {
    type: Date,
    default: null
  },
  email_verified: {
    type: Boolean,
    default: false
  },
  phone_verified: {
    type: Boolean,
    default: false
  },
  two_factor_enabled: {
    type: Boolean,
    default: false
  },
  two_factor_secret: {
    type: String,
    default: null
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light'
    },
    language: {
      type: String,
      enum: ['en', 'hi', 'es', 'fr'],
      default: 'en'
    },
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true }
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    },
    qr_type_override: {
      type: String,
      enum: ['DYNAMIC', 'STATIC', null],
      default: null
    },
    require_selfie_override: {
      type: Boolean,
      default: null
    }
  },
  permissions: [{
    type: String,
    enum: [
      'override_attendance',
      'upload_employees',
      'lock_payroll',
      'define_policies',
      'view_all_data',
      'handle_escalations',
      'approve_requests',
      'edit_punch_times',
      'view_reports',
      'manage_users',
      'view_sensitive_data'
    ]
  }],
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  },
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password_hash;
      delete ret.refresh_token_hash;
      delete ret.password_reset_token;
      delete ret.two_factor_secret;
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password_hash;
      delete ret.refresh_token_hash;
      delete ret.password_reset_token;
      delete ret.two_factor_secret;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes
userSchema.index({ manager_id: 1 });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ department: 1 });
userSchema.index({ joining_date: -1 });
userSchema.index({ created_at: -1 });
userSchema.index({ 
  full_name: 'text', 
  email: 'text', 
  employee_id: 'text' 
}, {
  weights: {
    full_name: 10,
    email: 5,
    employee_id: 8
  },
  name: 'text_search_index'
});

// Virtual for full address
userSchema.virtual('full_address').get(function() {
  if (!this.address) return '';
  const parts = [
    this.address.street,
    this.address.city,
    this.address.state,
    this.address.country,
    this.address.postal_code
  ].filter(Boolean);
  return parts.join(', ');
});

// Virtual for age
userSchema.virtual('age').get(function() {
  if (!this.date_of_birth) return null;
  return Math.floor((new Date() - this.date_of_birth) / (365.25 * 24 * 60 * 60 * 1000));
});

// Virtual for employment duration (in months)
userSchema.virtual('employment_duration_months').get(function() {
  if (!this.joining_date) return 0;
  return Math.floor((new Date() - this.joining_date) / (30 * 24 * 60 * 60 * 1000));
});

// Pre-save middleware
userSchema.pre('save', async function(next) {
  // Hash password if modified
  if (this.isModified('password_hash')) {
    try {
      const salt = await bcrypt.genSalt(12);
      this.password_hash = await bcrypt.hash(this.password_hash, salt);
    } catch (error) {
      return next(error);
    }
  }
  
  // Set default manager for HR and Super Admin
  if (['HR', 'SUPER_ADMIN'].includes(this.role) && !this.manager_id) {
    this.manager_id = null;
  }
  
  next();
});

// Pre-update middleware
userSchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate();
  
  // Hash password if being updated
  if (update.password_hash) {
    try {
      const salt = await bcrypt.genSalt(12);
      update.password_hash = await bcrypt.hash(update.password_hash, salt);
    } catch (error) {
      return next(error);
    }
  }
  
  next();
});

// Instance methods
userSchema.methods.getAllSuperiors = async function() {
  const superiors = [];
  let currentManagerId = this.manager_id;
  const visited = new Set(); // Prevent infinite loops
  
  while (currentManagerId && !visited.has(currentManagerId.toString())) {
    visited.add(currentManagerId.toString());
    superiors.push(currentManagerId);
    
    // Fetch the manager's manager
    const manager = await mongoose.model('User').findById(currentManagerId).select('manager_id');
    if (manager && manager.manager_id) {
      currentManagerId = manager.manager_id;
    } else {
      currentManagerId = null;
    }
  }
  
  return superiors;
};

userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password_hash) return false;
  return bcrypt.compare(candidatePassword, this.password_hash);
};

userSchema.methods.isAccountLocked = function() {
  if (!this.account_locked_until) return false;
  return new Date() < this.account_locked_until;
};

userSchema.methods.incrementFailedAttempts = async function() {
  this.failed_login_attempts += 1;
  
  if (this.failed_login_attempts >= 5) {
    const lockMinutes = this.role === 'SUPER_ADMIN' ? 15 : 30;
    this.account_locked_until = new Date(Date.now() + lockMinutes * 60 * 1000);
  }
  
  await this.save();
};

userSchema.methods.resetFailedAttempts = async function() {
  this.failed_login_attempts = 0;
  this.account_locked_until = null;
  await this.save();
};

userSchema.methods.generatePasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.password_reset_token = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.password_reset_expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  return resetToken;
};

userSchema.methods.hasPermission = function(permission) {
  if (this.role === 'SUPER_ADMIN') return true;
  return this.permissions && this.permissions.includes(permission);
};

// Static methods
userSchema.statics.findByEmailOrEmployeeId = function(login) {
  return this.findOne({
    $or: [
      { email: login.toLowerCase() },
      { employee_id: login.toUpperCase() }
    ]
  });
};

userSchema.statics.findActiveUsers = function() {
  return this.find({ status: 'ACTIVE' });
};

userSchema.statics.findByDepartment = function(department) {
  return this.find({ department, status: 'ACTIVE' });
};

userSchema.statics.findTeamMembers = function(managerId) {
  return this.find({ 
    manager_id: managerId,
    status: 'ACTIVE'
  });
};

const User = mongoose.model('User', userSchema);

module.exports = User;