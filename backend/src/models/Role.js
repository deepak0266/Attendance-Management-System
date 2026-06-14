const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Role name is required'],
    unique: true,
    trim: true,
    uppercase: true, // e.g., 'DIRECTOR', 'VP'
    minlength: [2, 'Role name must be at least 2 characters'],
    maxlength: [50, 'Role name cannot exceed 50 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  permissions: [{
    type: String
    // We will not strictly enum this to allow future scalability, 
    // but typical values are: 'override_attendance', 'upload_employees', 'view_team_data', 'approve_requests', etc.
  }],
  approval_restrictions: {
    late_punch_in: { type: Boolean, default: false },
    early_punch_out: { type: Boolean, default: false },
    out_of_location: { type: Boolean, default: false }
  },
  is_system: {
    type: Boolean,
    default: false // True for built-in roles like SUPER_ADMIN, HR, MANAGER, EMPLOYEE which cannot be deleted
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Role', roleSchema);
