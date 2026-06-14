const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  device_id: {
    type: String,
    required: true,
    trim: true
  },
  device_name: {
    type: String,
    trim: true
  },
  user_agent: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'INACTIVE'],
    default: 'PENDING'
  },
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  approved_at: {
    type: Date,
    default: null
  },
  last_used: {
    type: Date,
    default: null
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes
deviceSchema.index({ user_id: 1, status: 1 });
deviceSchema.index({ device_id: 1 });

const Device = mongoose.model('Device', deviceSchema);

module.exports = Device;
