const mongoose = require('mongoose');

const roleDeletionRequestSchema = new mongoose.Schema({
  role_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: true
  },
  role_name: {
    type: String,
    required: true
  },
  requested_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  approvals: [{
    super_admin_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approved_at: {
      type: Date,
      default: Date.now
    }
  }],
  rejections: [{
    super_admin_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rejected_at: {
      type: Date,
      default: Date.now
    },
    reason: {
      type: String
    }
  }],
  resolved_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('RoleDeletionRequest', roleDeletionRequestSchema);
