const mongoose = require('mongoose');
const crypto = require('crypto');

const systemActionLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  actor_user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  actor_role: {
    type: String,
    required: true,
    enum: ['SUPER_ADMIN', 'HR', 'MANAGER', 'EMPLOYEE', 'SYSTEM']
  },
  action_type: {
    type: String,
    required: true,
    enum: [
      'PUNCH_IN',
      'PUNCH_OUT',
      'BREAK_START',
      'BREAK_END',
      'PUNCH_EDIT',
      'ACCESS_REVOKE',
      'ACCESS_RESTORE',
      'ATTENDANCE_OVERRIDE',
      'POLICY_CHANGE',
      'USER_CREATE',
      'USER_UPDATE',
      'USER_DELETE',
      'USER_BULK_UPLOAD',
      'SHIFT_CHANGE',
      'PAYROLL_LOCK',
      'PAYROLL_UNLOCK',
      'PERMISSION_CHANGE',
      'LOGIN',
      'LOGOUT',
      'FAILED_LOGIN',
      'SYSTEM_CONFIG',
      'BACKUP_CREATE',
      'BACKUP_RESTORE',
      'GEOFENCE_CHANGE',
      'REPORT_EXPORT',
      'EMERGENCY_OVERRIDE',
      'SUPER_ADMIN_ACTION',
      'REQUEST_CREATE',
      'REQUEST_APPROVE',
      'REQUEST_REJECT',
      'REQUEST_ESCALATE',
      'REQUEST_CANCEL'
    ]
  },
  target_user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  target_entity_id: {
    type: mongoose.Schema.Types.ObjectId
  },
  target_entity_type: {
    type: String
  },
  old_value: {
    type: mongoose.Schema.Types.Mixed
  },
  new_value: {
    type: mongoose.Schema.Types.Mixed
  },
  reason: {
    type: String,
    maxlength: [1000, 'Reason cannot exceed 1000 characters']
  },
  ip_address: {
    type: String,
    required: true
  },
  user_agent: {
    type: String
  },
  session_id: {
    type: String
  },
  request_method: {
    type: String
  },
  request_path: {
    type: String
  },
  response_status: {
    type: Number
  },
  execution_time_ms: {
    type: Number
  },
  is_super_admin_action: {
    type: Boolean,
    default: false,
    immutable: true
  },
  requires_second_approval: {
    type: Boolean,
    default: false
  },
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approved_at: {
    type: Date
  },
  is_read_only: {
    type: Boolean,
    default: true,
    immutable: true
  },
  is_sensitive: {
    type: Boolean,
    default: false
  },
  previous_log_hash: {
    type: String
  },
  log_hash: {
    type: String,
    immutable: true
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: false,
  strict: true
});

// Indexes
systemActionLogSchema.index({ timestamp: -1 });
systemActionLogSchema.index({ actor_user_id: 1, timestamp: -1 });
systemActionLogSchema.index({ action_type: 1, timestamp: -1 });
systemActionLogSchema.index({ is_super_admin_action: 1, timestamp: -1 });
systemActionLogSchema.index({ target_user_id: 1 });
systemActionLogSchema.index({ target_entity_id: 1 });
systemActionLogSchema.index({ session_id: 1 });
systemActionLogSchema.index({ 
  actor_role: 1, 
  action_type: 1, 
  timestamp: -1 
});
systemActionLogSchema.index({ 
  is_super_admin_action: 1, 
  actor_role: 1 
});

// Pre-save middleware
systemActionLogSchema.pre('save', async function(next) {
  try {
    // Mark as Super Admin action if applicable
    if (this.actor_role === 'SUPER_ADMIN') {
      this.is_super_admin_action = true;
    }
    
    // Get previous log for hash chain
    if (!this.previous_log_hash) {
      const previousLog = await this.constructor
        .findOne({
          is_super_admin_action: this.is_super_admin_action
        })
        .sort({ timestamp: -1 })
        .select('log_hash');
      
      if (previousLog) {
        this.previous_log_hash = previousLog.log_hash;
      }
    }
    
    // Calculate log hash
    const hashData = {
      timestamp: this.timestamp,
      actor_user_id: this.actor_user_id ? this.actor_user_id.toString() : null,
      action_type: this.action_type,
      target_user_id: this.target_user_id?.toString(),
      target_entity_id: this.target_entity_id?.toString(),
      old_value: this.old_value,
      new_value: this.new_value,
      is_super_admin_action: this.is_super_admin_action,
      previous_log_hash: this.previous_log_hash
    };
    
    this.log_hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(hashData))
      .digest('hex');
    
    next();
  } catch (error) {
    next(error);
  }
});

// Static method to get logs with role-based filtering
systemActionLogSchema.statics.getFilteredLogs = async function(userRole, filters = {}) {
  const query = { ...filters };
  
  // HR cannot see Super Admin actions
  if (userRole === 'HR') {
    query.is_super_admin_action = { $ne: true };
  }
  
  // Manager can only see their team's logs
  if (userRole === 'MANAGER') {
    query.$or = [
      { actor_user_id: { $in: filters.teamMemberIds || [] } },
      { target_user_id: { $in: filters.teamMemberIds || [] } }
    ];
  }
  
  // Employee can only see their own logs
  if (userRole === 'EMPLOYEE') {
    query.$or = [
      { actor_user_id: filters.userId },
      { target_user_id: filters.userId }
    ];
  }
  
  return this.find(query).sort({ timestamp: -1 });
};

// Static method to get Super Admin actions
systemActionLogSchema.statics.getSuperAdminActions = async function(startDate, endDate) {
  return this.find({
    is_super_admin_action: true,
    timestamp: { $gte: startDate, $lte: endDate }
  }).sort({ timestamp: -1 });
};

// Static method to verify log integrity
systemActionLogSchema.statics.verifyIntegrity = async function() {
  const logs = await this.find({ is_super_admin_action: true })
    .sort({ timestamp: 1 });
  
  const results = {
    valid: true,
    totalLogs: logs.length,
    invalidLogs: []
  };
  
  for (let i = 1; i < logs.length; i++) {
    const currentLog = logs[i];
    const previousLog = logs[i - 1];
    
    if (currentLog.previous_log_hash !== previousLog.log_hash) {
      results.valid = false;
      results.invalidLogs.push({
        logId: currentLog._id,
        expected: previousLog.log_hash,
        actual: currentLog.previous_log_hash
      });
    }
  }
  
  return results;
};

const SystemActionLog = mongoose.model('SystemActionLog', systemActionLogSchema);

module.exports = SystemActionLog;