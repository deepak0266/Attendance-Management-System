const { body, param, query, validationResult } = require('express-validator');
const { VALIDATION, ATTENDANCE_STATES, PUNCH_TYPES } = require('../config/constants');

// Validation error handler
exports.validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    
    const errors = validationResult(req);
    
    if (errors.isEmpty()) {
      return next();
    }
    
    const formattedErrors = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));
    
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: formattedErrors
    });
  };
};

// Login validation
exports.validateLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email or Employee ID is required')
    .isLength({ max: 100 }).withMessage('Email cannot exceed 100 characters'),
  
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 1, max: 128 }).withMessage('Invalid password length'),
  
  body('device_info')
    .optional()
    .isObject().withMessage('Device info must be an object')
];

// User creation validation
exports.validateUserCreate = [
  body('employee_id')
    .trim()
    .notEmpty().withMessage('Employee ID is required')
    .matches(VALIDATION.EMPLOYEE_ID_REGEX).withMessage('Invalid Employee ID format')
    .isLength({ min: 3, max: 20 }).withMessage('Employee ID must be 3-20 characters'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail()
    .isLength({ max: 100 }).withMessage('Email cannot exceed 100 characters'),
  
  body('phone')
    .trim()
    .notEmpty().withMessage('Phone number is required')
    .matches(VALIDATION.PHONE_REGEX).withMessage('Invalid phone number format'),
  
  body('full_name')
    .trim()
    .notEmpty().withMessage('Full name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  
  body('department')
    .trim()
    .notEmpty().withMessage('Department is required')
    .isIn(['Management', 'Human Resources', 'Engineering', 'Sales', 'Marketing', 'Finance', 'Operations', 'Customer Support', 'IT', 'Administration'])
    .withMessage('Invalid department'),
  
  body('role')
    .optional()
    .isIn(['SUPER_ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']).withMessage('Invalid role'),
  
  body('joining_date')
    .notEmpty().withMessage('Joining date is required')
    .isISO8601().withMessage('Invalid date format')
    .custom(value => {
      const date = new Date(value);
      const today = new Date();
      if (date > today) {
        throw new Error('Joining date cannot be in the future');
      }
      return true;
    }),
  
  body('password')
    .optional()
    .isLength({ min: VALIDATION.MIN_PASSWORD_LENGTH }).withMessage(`Password must be at least ${VALIDATION.MIN_PASSWORD_LENGTH} characters`)
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
];

// User update validation
exports.validateUserUpdate = [
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('phone')
    .optional()
    .trim()
    .matches(VALIDATION.PHONE_REGEX).withMessage('Invalid phone number format'),
  
  body('full_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  
  body('status')
    .optional()
    .isIn(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED', 'ON_LEAVE'])
    .withMessage('Invalid status')
];

// Attendance punch validation
exports.validatePunch = [
  body('type')
    .notEmpty().withMessage('Punch type is required')
    .isIn(Object.values(PUNCH_TYPES)).withMessage('Invalid punch type'),
  
  body('location')
    .notEmpty().withMessage('Location is required')
    .custom(value => {
      if (!value || typeof value !== 'object') {
        throw new Error('Location must be an object');
      }
      if (typeof value.latitude !== 'number' || value.latitude < -90 || value.latitude > 90) {
        throw new Error('Invalid latitude');
      }
      if (typeof value.longitude !== 'number' || value.longitude < -180 || value.longitude > 180) {
        throw new Error('Invalid longitude');
      }
      return true;
    }),
  
  body('client_timestamp')
    .notEmpty().withMessage('Client timestamp is required')
    .isISO8601().withMessage('Invalid timestamp format'),
  
  body('idempotency_key')
    .optional()
    .isString().withMessage('Idempotency key must be a string')
    .isLength({ max: 255 }).withMessage('Idempotency key too long'),
  
  body('source')
    .optional()
    .isIn(['WEB', 'MOBILE', 'OFFLINE']).withMessage('Invalid source'),
  
  body('photo')
    .optional()
    .isString().withMessage('Photo must be a base64 string or URL')
];

// Regularization request validation
exports.validateRegularization = [
  body('request_type')
    .notEmpty().withMessage('Request type is required')
    .isIn(['MISSED_PUNCH', 'INCORRECT_TIME', 'INVALID_LOCATION', 'OFFLINE_SYNC', 'OVERTIME', 'LEAVE_ADJUSTMENT'])
    .withMessage('Invalid request type'),
  
  body('date')
    .notEmpty().withMessage('Date is required')
    .isISO8601().withMessage('Invalid date format')
    .custom(value => {
      const date = new Date(value);
      const today = new Date();
      const maxDaysBack = 30;
      const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));
      
      if (diffDays > maxDaysBack) {
        throw new Error(`Cannot regularize attendance older than ${maxDaysBack} days`);
      }
      if (date > today) {
        throw new Error('Cannot regularize future dates');
      }
      return true;
    }),
  
  body('requested_in_time')
    .optional()
    .isISO8601().withMessage('Invalid time format'),
  
  body('requested_out_time')
    .optional()
    .isISO8601().withMessage('Invalid time format'),
  
  body('reason')
    .notEmpty().withMessage('Reason is required')
    .isLength({ min: 10, max: 1000 }).withMessage('Reason must be 10-1000 characters'),
  
  body('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).withMessage('Invalid priority')
];

// Shift validation
exports.validateShift = [
  body('name')
    .notEmpty().withMessage('Shift name is required')
    .isLength({ min: 3, max: 50 }).withMessage('Shift name must be 3-50 characters'),
  
  body('code')
    .notEmpty().withMessage('Shift code is required')
    .matches(/^[A-Z0-9_-]+$/).withMessage('Invalid shift code format')
    .isLength({ max: 20 }).withMessage('Shift code too long'),
  
  body('type')
    .notEmpty().withMessage('Shift type is required')
    .isIn(['Fixed', 'Flexible', 'Rotational', 'Night']).withMessage('Invalid shift type'),
  
  body('start_time')
    .notEmpty().withMessage('Start time is required')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format (HH:MM)'),
  
  body('end_time')
    .notEmpty().withMessage('End time is required')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format (HH:MM)'),
  
  body('grace_period_minutes')
    .optional()
    .isInt({ min: 0, max: 60 }).withMessage('Grace period must be 0-60 minutes'),
  
  body('working_days')
    .optional()
    .isArray().withMessage('Working days must be an array')
    .custom(value => {
      if (!value.every(d => d >= 0 && d <= 6)) {
        throw new Error('Working days must be between 0 (Sunday) and 6 (Saturday)');
      }
      return true;
    })
];

// Geo-fence validation
exports.validateGeoFence = [
  body('name')
    .notEmpty().withMessage('Geo-fence name is required')
    .isLength({ min: 3, max: 100 }).withMessage('Name must be 3-100 characters'),
  
  body('code')
    .notEmpty().withMessage('Geo-fence code is required')
    .matches(/^[A-Z0-9_-]+$/).withMessage('Invalid code format'),
  
  body('type')
    .notEmpty().withMessage('Geo-fence type is required')
    .isIn(['circle', 'polygon', 'rectangle']).withMessage('Invalid type'),
  
  body('center')
    .if(body('type').equals('circle'))
    .notEmpty().withMessage('Center coordinates required for circle type')
    .custom(value => {
      if (!value || typeof value.lat !== 'number' || typeof value.lng !== 'number') {
        throw new Error('Invalid center coordinates');
      }
      if (value.lat < -90 || value.lat > 90) throw new Error('Invalid latitude');
      if (value.lng < -180 || value.lng > 180) throw new Error('Invalid longitude');
      return true;
    }),
  
  body('radius_meters')
    .if(body('type').equals('circle'))
    .notEmpty().withMessage('Radius required for circle type')
    .isInt({ min: 10, max: 10000 }).withMessage('Radius must be 10-10000 meters')
];

// Password change validation
exports.validatePasswordChange = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),
  
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: VALIDATION.MIN_PASSWORD_LENGTH }).withMessage(`Password must be at least ${VALIDATION.MIN_PASSWORD_LENGTH} characters`)
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    })
];

// ID parameter validation
exports.validateId = [
  param('id')
    .isMongoId().withMessage('Invalid ID format')
];

// Pagination validation
exports.validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt()
];

// Date range validation
exports.validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601().withMessage('Invalid start date format'),
  
  query('endDate')
    .optional()
    .isISO8601().withMessage('Invalid end date format')
    .custom((value, { req }) => {
      if (req.query.startDate && value) {
        const start = new Date(req.query.startDate);
        const end = new Date(value);
        if (end < start) {
          throw new Error('End date must be after start date');
        }
      }
      return true;
    })
];

// Permission revocation validation
exports.validateRevokePermission = [
  body('userId')
    .notEmpty().withMessage('User ID is required')
    .isMongoId().withMessage('Invalid user ID'),
  
  body('capabilities')
    .notEmpty().withMessage('Capabilities are required')
    .isArray({ min: 1 }).withMessage('At least one capability must be specified')
    .custom(value => {
      const validCapabilities = [
        'override_attendance', 'upload_employees', 'lock_payroll',
        'define_policies', 'view_all_data', 'handle_escalations',
        'approve_requests', 'edit_punch_times', 'view_reports',
        'manage_users', 'login'
      ];
      
      for (const cap of value) {
        if (!validCapabilities.includes(cap)) {
          throw new Error(`Invalid capability: ${cap}`);
        }
      }
      return true;
    }),
  
  body('reason')
    .notEmpty().withMessage('Reason is required')
    .isLength({ min: 10, max: 500 }).withMessage('Reason must be 10-500 characters'),
  
  body('expiresAt')
    .optional()
    .isISO8601().withMessage('Invalid expiry date format')
    .custom(value => {
      if (new Date(value) <= new Date()) {
        throw new Error('Expiry date must be in the future');
      }
      return true;
    })
];

// Export validation
exports.validateExport = [
  query('export_format')
    .optional()
    .isIn(['excel', 'pdf', 'csv']).withMessage('Invalid export format'),
  
  query('month')
    .optional()
    .isInt({ min: 1, max: 12 }).withMessage('Invalid month'),
  
  query('year')
    .optional()
    .isInt({ min: 2000, max: 2100 }).withMessage('Invalid year')
];