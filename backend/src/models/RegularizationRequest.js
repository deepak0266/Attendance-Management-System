const mongoose = require('mongoose');

const regularizationRequestSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  attendance_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AttendanceLog'
  },
  request_type: {
    type: String,
    required: [true, 'Request type is required'],
    enum: [
      'MISSED_PUNCH',
      'INCORRECT_TIME',
      'INVALID_LOCATION',
      'OFFLINE_SYNC',
      'OVERTIME',
      'LEAVE_ADJUSTMENT'
    ]
  },
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  requested_in_time: {
    type: Date
  },
  requested_out_time: {
    type: Date
  },
  requested_break_duration: {
    type: Number,
    min: 0,
    max: 240
  },
  reason: {
    type: String,
    required: [true, 'Reason is required'],
    maxlength: [1000, 'Reason cannot exceed 1000 characters']
  },
  proof_urls: [{
    type: String,
    validate: {
      validator: function(url) {
        return /^https?:\/\/.+/.test(url);
      },
      message: 'Invalid URL format'
    }
  }],
  status: {
    type: String,
    enum: [
      'PENDING_MANAGER',
      'PENDING_HR',
      'APPROVED',
      'REJECTED',
      'CANCELLED',
      'ESCALATED'
    ],
    default: 'PENDING_MANAGER'
  },
  manager_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  manager_comment: {
    type: String,
    maxlength: [500, 'Comment cannot exceed 500 characters']
  },
  manager_action_at: {
    type: Date
  },
  hr_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  hr_comment: {
    type: String,
    maxlength: [500, 'Comment cannot exceed 500 characters']
  },
  hr_action_at: {
    type: Date
  },
  final_decision_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  final_decision_at: {
    type: Date
  },
  escalation_reason: {
    type: String
  },
  escalated_at: {
    type: Date
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    default: 'MEDIUM'
  },
  sla_breached: {
    type: Boolean,
    default: false
  },
  sla_deadline: {
    type: Date
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes
regularizationRequestSchema.index({ user_id: 1, created_at: -1 });
regularizationRequestSchema.index({ status: 1, created_at: -1 });
regularizationRequestSchema.index({ manager_id: 1, status: 1 });
regularizationRequestSchema.index({ hr_id: 1, status: 1 });
regularizationRequestSchema.index({ date: -1 });
regularizationRequestSchema.index({ request_type: 1 });
regularizationRequestSchema.index({ priority: 1 });
regularizationRequestSchema.index({ sla_deadline: 1 });

// Pre-save middleware
regularizationRequestSchema.pre('save', function(next) {
  // Set SLA deadline based on priority
  if (!this.sla_deadline) {
    const slaHours = {
      'URGENT': 4,
      'HIGH': 24,
      'MEDIUM': 48,
      'LOW': 72
    };
    
    this.sla_deadline = new Date(
      Date.now() + slaHours[this.priority] * 60 * 60 * 1000
    );
  }
  
  // Check if SLA is breached
  if (this.sla_deadline && new Date() > this.sla_deadline) {
    this.sla_breached = true;
  }
  
  next();
});

// Method to approve by manager
regularizationRequestSchema.methods.approveByManager = async function(managerId, comment) {
  if (!this.created_by) {
    this.created_by = this.user_id?._id || this.user_id || managerId;
  }

  this.status = 'APPROVED';
  this.manager_id = managerId;
  this.manager_comment = comment;
  this.manager_action_at = new Date();
  this.final_decision_by = managerId;
  this.final_decision_at = new Date();
  
  return this.save();
};

// Method to reject by manager
regularizationRequestSchema.methods.rejectByManager = async function(managerId, comment) {
  if (!this.created_by) {
    this.created_by = this.user_id?._id || this.user_id || managerId;
  }

  this.status = 'REJECTED';
  this.manager_id = managerId;
  this.manager_comment = comment;
  this.manager_action_at = new Date();
  this.final_decision_by = managerId;
  this.final_decision_at = new Date();
  
  return this.save();
};

// Method to escalate to HR
regularizationRequestSchema.methods.escalateToHR = async function(reason) {
  if (!this.created_by) {
    this.created_by = this.user_id?._id || this.user_id;
  }

  this.status = 'ESCALATED';
  this.escalation_reason = reason;
  this.escalated_at = new Date();
  
  return this.save();
};

// Method to approve by HR
regularizationRequestSchema.methods.approveByHR = async function(hrId, comment) {
  if (!this.created_by) {
    this.created_by = this.user_id?._id || this.user_id || hrId;
  }

  this.status = 'APPROVED';
  this.hr_id = hrId;
  this.hr_comment = comment;
  this.hr_action_at = new Date();
  this.final_decision_by = hrId;
  this.final_decision_at = new Date();
  
  return this.save();
};

// Method to reject by HR
regularizationRequestSchema.methods.rejectByHR = async function(hrId, comment) {
  if (!this.created_by) {
    this.created_by = this.user_id?._id || this.user_id || hrId;
  }

  this.status = 'REJECTED';
  this.hr_id = hrId;
  this.hr_comment = comment;
  this.hr_action_at = new Date();
  this.final_decision_by = hrId;
  this.final_decision_at = new Date();
  
  return this.save();
};

// Method to cancel request
regularizationRequestSchema.methods.cancel = async function(reason) {
  this.status = 'CANCELLED';
  this.metadata = this.metadata || new Map();
  this.metadata.set('cancellation_reason', reason);
  
  return this.save();
};

// Static method to get pending requests for manager
regularizationRequestSchema.statics.getPendingForManager = async function(managerId) {
  return this.find({
    manager_id: managerId,
    status: 'PENDING_MANAGER'
  }).sort({ priority: -1, created_at: 1 });
};

// Static method to get pending requests for HR
regularizationRequestSchema.statics.getPendingForHR = async function() {
  return this.find({
    status: { $in: ['PENDING_HR', 'ESCALATED'] }
  }).sort({ priority: -1, created_at: 1 });
};

// Static method to get user's requests
regularizationRequestSchema.statics.getUserRequests = async function(userId, status = null) {
  const query = { user_id: userId };
  if (status) {
    query.status = status;
  }
  return this.find(query).sort({ created_at: -1 });
};

// Static method to check SLA breaches
regularizationRequestSchema.statics.checkSLABreaches = async function() {
  const breached = await this.updateMany(
    {
      status: { $in: ['PENDING_MANAGER', 'PENDING_HR'] },
      sla_deadline: { $lt: new Date() },
      sla_breached: false
    },
    {
      sla_breached: true,
      priority: 'URGENT'
    }
  );
  
  return breached;
};

const RegularizationRequest = mongoose.model('RegularizationRequest', regularizationRequestSchema);

module.exports = RegularizationRequest;