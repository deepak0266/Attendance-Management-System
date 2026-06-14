const mongoose = require('mongoose');
const crypto = require('crypto');

const auditLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    immutable: true,
    index: true
  },
  actor_user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  actor_role: {
    type: String,
    required: true,
    enum: ['SUPER_ADMIN', 'HR', 'MANAGER', 'EMPLOYEE', 'SYSTEM']
  },
  actor_ip: {
    type: String,
    required: true
  },
  actor_user_agent: {
    type: String
  },
  session_id: {
    type: String
  },
  action: {
    type: String,
    required: true,
    enum: [
      'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 
      'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT', 'VIEW',
      'LOCK', 'UNLOCK', 'OVERRIDE', 'REVOKE', 'RESTORE'
    ]
  },
  entity_type: {
    type: String,
    required: true,
    enum: [
      'USER', 'ATTENDANCE', 'REQUEST', 'POLICY', 'SHIFT',
      'GEOFENCE', 'PAYROLL', 'REPORT', 'SYSTEM', 'PERMISSION'
    ]
  },
  entity_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  entity_name: {
    type: String
  },
  old_value: {
    type: mongoose.Schema.Types.Mixed
  },
  new_value: {
    type: mongoose.Schema.Types.Mixed
  },
  changes: {
    type: Map,
    of: {
      from: mongoose.Schema.Types.Mixed,
      to: mongoose.Schema.Types.Mixed
    }
  },
  reason: {
    type: String,
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  status: {
    type: String,
    enum: ['SUCCESS', 'FAILED', 'PENDING'],
    default: 'SUCCESS'
  },
  error_message: {
    type: String
  },
  previous_log_hash: {
    type: String
  },
  log_hash: {
    type: String,
    immutable: true
  },
  is_sensitive: {
    type: Boolean,
    default: false
  },
  retention_days: {
    type: Number,
    default: 365 // 1 year
  },
  expire_at: {
    type: Date,
    default: function() {
      return new Date(Date.now() + this.retention_days * 24 * 60 * 60 * 1000);
    }
  }
}, {
  timestamps: false,
  strict: true
});

// Indexes
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ actor_user_id: 1, timestamp: -1 });
auditLogSchema.index({ entity_type: 1, entity_id: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ status: 1 });
auditLogSchema.index({ expire_at: 1 }, { expireAfterSeconds: 0 });
auditLogSchema.index({ 
  actor_role: 1,
  action: 1,
  timestamp: -1 
});

// Pre-save middleware to calculate hash and detect changes
auditLogSchema.pre('save', async function(next) {
  try {
    // Calculate changes if old_value and new_value are provided
    if (this.old_value && this.new_value) {
      this.changes = this.calculateChanges(this.old_value, this.new_value);
    }
    
    // Get previous log for hash chain
    if (!this.previous_log_hash) {
      const previousLog = await this.constructor
        .findOne({})
        .sort({ timestamp: -1 })
        .select('log_hash');
      
      if (previousLog) {
        this.previous_log_hash = previousLog.log_hash;
      }
    }
    
    // Calculate log hash for tamper detection
    const hashData = {
      timestamp: this.timestamp,
      actor_user_id: this.actor_user_id.toString(),
      action: this.action,
      entity_type: this.entity_type,
      entity_id: this.entity_id.toString(),
      changes: this.changes,
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

// Method to calculate changes between old and new values
auditLogSchema.methods.calculateChanges = function(oldVal, newVal) {
  const changes = new Map();
  
  const findChanges = (oldObj, newObj, path = '') => {
    if (typeof oldObj !== 'object' || typeof newObj !== 'object') {
      if (oldObj !== newObj) {
        changes.set(path || 'value', { from: oldObj, to: newObj });
      }
      return;
    }
    
    const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
    
    for (const key of allKeys) {
      const oldValue = oldObj?.[key];
      const newValue = newObj?.[key];
      const currentPath = path ? `${path}.${key}` : key;
      
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.set(currentPath, { from: oldValue, to: newValue });
      }
    }
  };
  
  findChanges(oldVal, newVal);
  return changes;
};

// Static method to verify audit log integrity
auditLogSchema.statics.verifyIntegrity = async function(startDate, endDate) {
  const logs = await this.find({
    timestamp: { $gte: startDate, $lte: endDate }
  }).sort({ timestamp: 1 });
  
  const results = {
    valid: true,
    totalLogs: logs.length,
    invalidLogs: [],
    brokenChainAt: null
  };
  
  for (let i = 1; i < logs.length; i++) {
    const currentLog = logs[i];
    const previousLog = logs[i - 1];
    
    // Verify hash chain
    if (currentLog.previous_log_hash !== previousLog.log_hash) {
      results.valid = false;
      results.brokenChainAt = currentLog._id;
      results.invalidLogs.push({
        logId: currentLog._id,
        reason: 'Hash chain broken'
      });
    }
    
    // Verify individual log hash
    const hashData = {
      timestamp: currentLog.timestamp,
      actor_user_id: currentLog.actor_user_id.toString(),
      action: currentLog.action,
      entity_type: currentLog.entity_type,
      entity_id: currentLog.entity_id.toString(),
      changes: currentLog.changes,
      previous_log_hash: currentLog.previous_log_hash
    };
    
    const calculatedHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(hashData))
      .digest('hex');
    
    if (calculatedHash !== currentLog.log_hash) {
      results.valid = false;
      results.invalidLogs.push({
        logId: currentLog._id,
        reason: 'Log tampered'
      });
    }
  }
  
  return results;
};

// Static method to get user activity timeline
auditLogSchema.statics.getUserActivityTimeline = async function(userId, limit = 100) {
  return this.find({ actor_user_id: userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .select('-old_value -new_value -changes');
};

// Static method to get entity history
auditLogSchema.statics.getEntityHistory = async function(entityType, entityId) {
  return this.find({ 
    entity_type: entityType,
    entity_id: entityId 
  }).sort({ timestamp: -1 });
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;