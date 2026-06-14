const mongoose = require('mongoose');

const revokedPermissionSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  revoked_capabilities: [{
    type: String,
    enum: {
      values: [
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
        'view_sensitive_data',
        'export_data',
        'login',
        'api_access',
        'manage_shifts',
        'manage_geofence'
      ],
      message: '{VALUE} is not a valid capability'
    }
  }],
  revoked_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Revoked by user is required']
  },
  revoked_at: {
    type: Date,
    default: Date.now
  },
  reason: {
    type: String,
    required: [true, 'Reason is required'],
    maxlength: [500, 'Reason cannot exceed 500 characters']
  },
  expires_at: {
    type: Date,
    default: null
  },
  is_active: {
    type: Boolean,
    default: true
  },
  is_permanent: {
    type: Boolean,
    default: false
  },
  restored_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  restored_at: {
    type: Date
  },
  restore_reason: {
    type: String,
    maxlength: [500, 'Restore reason cannot exceed 500 characters']
  },
  approval_required: {
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
revokedPermissionSchema.index({ user_id: 1, is_active: 1 });
revokedPermissionSchema.index({ revoked_by: 1 });
revokedPermissionSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
revokedPermissionSchema.index({ 
  user_id: 1, 
  is_active: 1, 
  expires_at: 1 
});
revokedPermissionSchema.index({ 
  revoked_capabilities: 1 
});

// Pre-save middleware
revokedPermissionSchema.pre('save', function(next) {
  // Check if expiration is set
  if (this.expires_at && this.expires_at <= new Date()) {
    this.is_active = false;
  }
  
  // Check if permanent
  if (!this.expires_at) {
    this.is_permanent = true;
  }
  
  next();
});

// Method to check if revocation is currently active
revokedPermissionSchema.methods.isCurrentlyActive = function() {
  if (!this.is_active) return false;
  if (this.expires_at && new Date() > this.expires_at) {
    this.is_active = false;
    this.save();
    return false;
  }
  return true;
};

// Method to restore permission
revokedPermissionSchema.methods.restore = async function(restoredBy, reason) {
  this.is_active = false;
  this.restored_by = restoredBy;
  this.restored_at = new Date();
  this.restore_reason = reason;
  return this.save();
};

// Method to extend revocation
revokedPermissionSchema.methods.extend = async function(newExpiresAt, reason) {
  this.expires_at = newExpiresAt;
  this.metadata = this.metadata || new Map();
  this.metadata.set('extended_reason', reason);
  this.metadata.set('extended_at', new Date());
  return this.save();
};

// Static method to check if capability is revoked
revokedPermissionSchema.statics.isCapabilityRevoked = async function(userId, capability) {
  const activeRevocations = await this.find({
    user_id: userId,
    is_active: true,
    $or: [
      { expires_at: null },
      { expires_at: { $gt: new Date() } }
    ]
  });
  
  return activeRevocations.some(rev => 
    rev.revoked_capabilities.includes(capability)
  );
};

// Static method to get all revoked capabilities for a user
revokedPermissionSchema.statics.getRevokedCapabilities = async function(userId) {
  const activeRevocations = await this.find({
    user_id: userId,
    is_active: true,
    $or: [
      { expires_at: null },
      { expires_at: { $gt: new Date() } }
    ]
  });
  
  const capabilities = new Set();
  activeRevocations.forEach(rev => {
    rev.revoked_capabilities.forEach(cap => capabilities.add(cap));
  });
  
  return Array.from(capabilities);
};

// Static method to revoke capabilities
revokedPermissionSchema.statics.revokeCapabilities = async function(
  userId, 
  capabilities, 
  revokedBy, 
  reason,
  expiresAt = null,
  requiresApproval = false
) {
  const revocation = new this({
    user_id: userId,
    revoked_capabilities: Array.isArray(capabilities) ? capabilities : [capabilities],
    revoked_by: revokedBy,
    reason,
    expires_at: expiresAt,
    approval_required: requiresApproval
  });
  
  return revocation.save();
};

// Static method to get user's revocation history
revokedPermissionSchema.statics.getUserRevocationHistory = async function(userId) {
  return this.find({ user_id: userId })
    .sort({ created_at: -1 })
    .populate('revoked_by', 'full_name email')
    .populate('restored_by', 'full_name email')
    .populate('approved_by', 'full_name email');
};

const RevokedPermission = mongoose.model('RevokedPermission', revokedPermissionSchema);

module.exports = RevokedPermission;