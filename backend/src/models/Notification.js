const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['SUCCESS', 'WARNING', 'INFO', 'ERROR'],
    default: 'INFO'
  },
  notification_type: {
    type: String,
    required: true
    // Examples: 'PUNCH_RECORDED', 'REQUEST_APPROVED', 'REQUEST_REJECTED', 'SYSTEM_ALERT'
  },
  is_read: {
    type: Boolean,
    default: false,
    index: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  related_entity: {
    entity_type: {
      type: String
    },
    entity_id: {
      type: mongoose.Schema.Types.ObjectId
    }
  }
}, {
  timestamps: true
});

// Index for getting user's unread notifications quickly
notificationSchema.index({ user_id: 1, is_read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
