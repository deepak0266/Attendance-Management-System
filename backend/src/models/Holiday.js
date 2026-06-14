const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Holiday name is required'],
    trim: true,
    maxlength: [100, 'Holiday name cannot exceed 100 characters']
  },
  date: {
    type: Date,
    required: [true, 'Holiday date is required']
  },
  type: {
    type: String,
    enum: ['PUBLIC', 'OPTIONAL'],
    default: 'PUBLIC'
  },
  is_active: {
    type: Boolean,
    default: true
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
holidaySchema.index({ date: 1 });
holidaySchema.index({ is_active: 1 });

const Holiday = mongoose.model('Holiday', holidaySchema);

module.exports = Holiday;
