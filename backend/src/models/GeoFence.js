const mongoose = require('mongoose');

const geoFenceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Geo-fence name is required'],
    trim: true,
    minlength: [3, 'Name must be at least 3 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Geo-fence code is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  type: {
    type: String,
    required: [true, 'Geo-fence type is required'],
    enum: ['circle', 'polygon', 'rectangle']
  },
  // For circle type
  center: {
    lat: {
      type: Number,
      min: -90,
      max: 90
    },
    lng: {
      type: Number,
      min: -180,
      max: 180
    }
  },
  radius_meters: {
    type: Number,
    min: [10, 'Radius must be at least 10 meters'],
    max: [10000, 'Radius cannot exceed 10 kilometers']
  },
  // For polygon type
  polygon_coordinates: {
    type: [[Number, Number]], // Array of [lat, lng] pairs
    validate: {
      validator: function(coords) {
        return !coords || coords.length >= 3;
      },
      message: 'Polygon must have at least 3 points'
    }
  },
  // For rectangle type
  bounds: {
    northeast: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 }
    },
    southwest: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 }
    }
  },
  buffer_meters: {
    type: Number,
    default: 20,
    min: [0, 'Buffer cannot be negative'],
    max: [500, 'Buffer cannot exceed 500 meters']
  },
  address: {
    formatted: { type: String },
    street: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    postal_code: { type: String }
  },
  validation_rules: {
    strict_mode: {
      type: Boolean,
      default: true
    },
    accuracy_threshold_meters: {
      type: Number,
      default: 50,
      min: [10, 'Accuracy threshold must be at least 10 meters'],
      max: [500, 'Accuracy threshold cannot exceed 500 meters']
    },
    allow_manual_override: {
      type: Boolean,
      default: true
    },
    require_photo_on_failure: {
      type: Boolean,
      default: false
    },
    max_distance_for_approval_meters: {
      type: Number,
      default: 500,
      min: [100, 'Max distance must be at least 100 meters'],
      max: [5000, 'Max distance cannot exceed 5 kilometers']
    }
  },
  schedule: {
    always_active: {
      type: Boolean,
      default: true
    },
    active_days: {
      type: [Number],
      default: [1, 2, 3, 4, 5] // Monday to Friday
    },
    active_hours: {
      start: {
        type: String,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format']
      },
      end: {
        type: String,
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format']
      }
    }
  },
  applicable_departments: [{
    type: String,
    enum: [
      'Management', 'Human Resources', 'Engineering',
      'Sales', 'Marketing', 'Finance', 'Operations',
      'Customer Support', 'IT', 'Administration'
    ]
  }],
  applicable_users: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  applicable_shifts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shift'
  }],
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 100
  },
  is_active: {
    type: Boolean,
    default: true
  },
  is_default: {
    type: Boolean,
    default: false
  },
  version: {
    type: Number,
    default: 1,
    min: 1
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Indexes
geoFenceSchema.index({ is_active: 1, priority: -1 });
geoFenceSchema.index({ applicable_departments: 1 });
geoFenceSchema.index({ applicable_users: 1 });
geoFenceSchema.index({ type: 1 });
geoFenceSchema.index({ 
  'center.lat': 1, 
  'center.lng': 1 
}, { 
  sparse: true 
});

// Pre-save middleware
geoFenceSchema.pre('save', async function(next) {
  if (this.is_default) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id }, is_default: true },
      { is_default: false }
    );
  }
  next();
});

// Method to check if point is inside geo-fence
geoFenceSchema.methods.isPointInside = function(lat, lng) {
  if (this.type === 'circle') {
    return this.isPointInCircle(lat, lng);
  } else if (this.type === 'polygon') {
    return this.isPointInPolygon(lat, lng);
  } else if (this.type === 'rectangle') {
    return this.isPointInRectangle(lat, lng);
  }
  return false;
};

// Calculate distance between two points using Haversine formula
geoFenceSchema.methods.calculateDistance = function(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = this.toRad(lat2 - lat1);
  const dLon = this.toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

geoFenceSchema.methods.toRad = function(degrees) {
  return degrees * (Math.PI / 180);
};

// Check if point is inside circle
geoFenceSchema.methods.isPointInCircle = function(lat, lng) {
  if (!this.center) return false;
  
  const distance = this.calculateDistance(
    lat, lng,
    this.center.lat, this.center.lng
  );
  
  const effectiveRadius = this.radius_meters + (this.buffer_meters || 0);
  return distance <= effectiveRadius;
};

// Check if point is inside polygon
geoFenceSchema.methods.isPointInPolygon = function(lat, lng) {
  if (!this.polygon_coordinates || this.polygon_coordinates.length < 3) {
    return false;
  }
  
  let inside = false;
  const x = lat;
  const y = lng;
  
  for (let i = 0, j = this.polygon_coordinates.length - 1; 
       i < this.polygon_coordinates.length; 
       j = i++) {
    
    const xi = this.polygon_coordinates[i][0];
    const yi = this.polygon_coordinates[i][1];
    const xj = this.polygon_coordinates[j][0];
    const yj = this.polygon_coordinates[j][1];
    
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
};

// Check if point is inside rectangle
geoFenceSchema.methods.isPointInRectangle = function(lat, lng) {
  if (!this.bounds) return false;
  
  const { northeast, southwest } = this.bounds;
  
  return lat >= southwest.lat && 
         lat <= northeast.lat &&
         lng >= southwest.lng && 
         lng <= northeast.lng;
};

// Method to validate location with accuracy check
geoFenceSchema.methods.validateLocation = function(lat, lng, accuracy) {
  const isInside = this.isPointInside(lat, lng);
  const distance = (this.center && this.center.lat != null && this.center.lng != null) ? 
    this.calculateDistance(lat, lng, this.center.lat, this.center.lng) : 
    null;
  
  const accuracyValid = accuracy <= this.validation_rules.accuracy_threshold_meters;
  
  let valid = isInside && accuracyValid;
  let requiresApproval = false;
  let reason = '';
  
  if (!isInside) {
    const isNearby = distance !== null && !isNaN(distance) && 
      distance <= this.validation_rules.max_distance_for_approval_meters;
    
    requiresApproval = Boolean(this.validation_rules.allow_manual_override && isNearby);
    reason = isNearby ? 'Near but outside geo-fence' : 'Outside geo-fence';
  } else if (!accuracyValid) {
    requiresApproval = true;
    reason = 'Low GPS accuracy';
  }
  
  return {
    valid,
    requiresApproval,
    reason,
    distance,
    accuracy,
    isInside
  };
};

// Static method to find applicable geo-fence for user
geoFenceSchema.statics.findForUser = async function(user) {
  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  const fences = await this.find({
    is_active: true,
    $or: [
      { applicable_users: user._id },
      { applicable_departments: user.department },
      { 
        applicable_users: { $size: 0 },
        applicable_departments: { $size: 0 },
        is_default: true
      }
    ]
  }).sort({ priority: -1 });
  
  // Filter by schedule
  return fences.filter(fence => {
    if (fence.schedule.always_active) return true;
    
    const dayMatch = fence.schedule.active_days.includes(currentDay);
    if (!dayMatch) return false;
    
    if (fence.schedule.active_hours.start && fence.schedule.active_hours.end) {
      return currentTime >= fence.schedule.active_hours.start &&
             currentTime <= fence.schedule.active_hours.end;
    }
    
    return true;
  });
};

const GeoFence = mongoose.model('GeoFence', geoFenceSchema);

module.exports = GeoFence;