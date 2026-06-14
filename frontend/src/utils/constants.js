// Application Constants

// API Configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || '/api',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000
};

// User Roles
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  HR: 'HR',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE'
};

// Role Labels
export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.HR]: 'HR Admin',
  [ROLES.MANAGER]: 'Manager',
  [ROLES.EMPLOYEE]: 'Employee'
};

// Role Colors
export const ROLE_COLORS = {
  [ROLES.SUPER_ADMIN]: 'danger',
  [ROLES.HR]: 'info',
  [ROLES.MANAGER]: 'warning',
  [ROLES.EMPLOYEE]: 'success'
};

// Attendance States
export const ATTENDANCE_STATES = {
  NOT_PUNCHED: 'NOT_PUNCHED',
  PUNCHED_IN: 'PUNCHED_IN',
  ON_BREAK: 'ON_BREAK',
  PUNCHED_OUT: 'PUNCHED_OUT',
  PENDING_APPROVAL: 'PENDING_APPROVAL'
};

// State Labels
export const STATE_LABELS = {
  [ATTENDANCE_STATES.NOT_PUNCHED]: 'Not Punched In',
  [ATTENDANCE_STATES.PUNCHED_IN]: 'Working',
  [ATTENDANCE_STATES.ON_BREAK]: 'On Break',
  [ATTENDANCE_STATES.PUNCHED_OUT]: 'Punched Out',
  [ATTENDANCE_STATES.PENDING_APPROVAL]: 'Pending Approval'
};

// State Colors
export const STATE_COLORS = {
  [ATTENDANCE_STATES.NOT_PUNCHED]: 'secondary',
  [ATTENDANCE_STATES.PUNCHED_IN]: 'success',
  [ATTENDANCE_STATES.ON_BREAK]: 'warning',
  [ATTENDANCE_STATES.PUNCHED_OUT]: 'danger',
  [ATTENDANCE_STATES.PENDING_APPROVAL]: 'info'
};

// Attendance Status
export const ATTENDANCE_STATUS = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  LATE: 'LATE',
  HALF_DAY: 'HALF_DAY',
  EARLY_EXIT: 'EARLY_EXIT',
  HOLIDAY: 'HOLIDAY',
  WEEKEND: 'WEEKEND',
  ON_LEAVE: 'ON_LEAVE'
};

// Punch Types
export const PUNCH_TYPES = {
  IN: 'IN',
  OUT: 'OUT',
  BREAK_START: 'BREAK_START',
  BREAK_END: 'BREAK_END'
};

// Request Types
export const REQUEST_TYPES = {
  MISSED_PUNCH: 'MISSED_PUNCH',
  INCORRECT_TIME: 'INCORRECT_TIME',
  INVALID_LOCATION: 'INVALID_LOCATION',
  OFFLINE_SYNC: 'OFFLINE_SYNC',
  OVERTIME: 'OVERTIME',
  LEAVE_ADJUSTMENT: 'LEAVE_ADJUSTMENT'
};

// Request Type Labels
export const REQUEST_TYPE_LABELS = {
  [REQUEST_TYPES.MISSED_PUNCH]: 'Missed Punch',
  [REQUEST_TYPES.INCORRECT_TIME]: 'Incorrect Time',
  [REQUEST_TYPES.INVALID_LOCATION]: 'Invalid Location',
  [REQUEST_TYPES.OFFLINE_SYNC]: 'Offline Sync',
  [REQUEST_TYPES.OVERTIME]: 'Overtime',
  [REQUEST_TYPES.LEAVE_ADJUSTMENT]: 'Leave Adjustment'
};

// Approval Status
export const APPROVAL_STATUS = {
  PENDING_MANAGER: 'PENDING_MANAGER',
  PENDING_HR: 'PENDING_HR',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  ESCALATED: 'ESCALATED'
};

// Priority Levels
export const PRIORITIES = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT'
};

// Priority Colors
export const PRIORITY_COLORS = {
  [PRIORITIES.LOW]: 'secondary',
  [PRIORITIES.MEDIUM]: 'info',
  [PRIORITIES.HIGH]: 'warning',
  [PRIORITIES.URGENT]: 'danger'
};

// User Status
export const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
  TERMINATED: 'TERMINATED',
  ON_LEAVE: 'ON_LEAVE'
};

// Departments
export const DEPARTMENTS = [
  'Management',
  'Human Resources',
  'Engineering',
  'Sales',
  'Marketing',
  'Finance',
  'Operations',
  'Customer Support',
  'IT',
  'Administration'
];

// Shift Types
export const SHIFT_TYPES = {
  FIXED: 'Fixed',
  FLEXIBLE: 'Flexible',
  ROTATIONAL: 'Rotational',
  NIGHT: 'Night'
};

// Break Types
export const BREAK_TYPES = {
  PAID: 'PAID',
  UNPAID: 'UNPAID',
  MEAL: 'MEAL',
  REST: 'REST'
};

// Week Days
export const WEEK_DAYS = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' }
];

// Months
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Chart Colors
export const CHART_COLORS = [
  '#667eea', '#764ba2', '#f093fb', '#f5576c',
  '#4facfe', '#00f2fe', '#43e97b', '#38f9d7',
  '#fa709a', '#fee140', '#ff6b6b', '#c471f5'
];

// Pagination Defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100]
};

// Date Formats
export const DATE_FORMATS = {
  DISPLAY: 'DD/MM/YYYY',
  DISPLAY_TIME: 'DD/MM/YYYY HH:mm',
  TIME: 'HH:mm:ss',
  API: 'YYYY-MM-DD',
  API_DATETIME: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  MONTH_YEAR: 'MMMM YYYY'
};

// File Upload Limits
export const UPLOAD_LIMITS = {
  PHOTO_MAX_SIZE: 5 * 1024 * 1024, // 5MB
  DOCUMENT_MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_PHOTO_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'image/jpeg', 'image/png']
};

// Validation Rules
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  PHONE_REGEX: /^\+?[1-9]\d{1,14}$/,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  EMPLOYEE_ID_REGEX: /^[A-Z0-9]{3,20}$/
};

// Notification Types
export const NOTIFICATION_TYPES = {
  INFO: 'INFO',
  SUCCESS: 'SUCCESS',
  WARNING: 'WARNING',
  ERROR: 'ERROR'
};

// Local Storage Keys
export const STORAGE_KEYS = {
  CSRF_TOKEN: 'csrfToken',
  THEME: 'theme',
  USER: 'user'
};

// Routes
export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  ATTENDANCE: '/attendance',
  REPORTS: '/reports',
  ADMIN: '/admin',
  PROFILE: '/profile',
  APPROVALS: '/approvals'
};

// Permissions
export const PERMISSIONS = {
  OVERRIDE_ATTENDANCE: 'override_attendance',
  UPLOAD_EMPLOYEES: 'upload_employees',
  LOCK_PAYROLL: 'lock_payroll',
  DEFINE_POLICIES: 'define_policies',
  VIEW_ALL_DATA: 'view_all_data',
  HANDLE_ESCALATIONS: 'handle_escalations',
  APPROVE_REQUESTS: 'approve_requests',
  EDIT_PUNCH_TIMES: 'edit_punch_times',
  VIEW_REPORTS: 'view_reports',
  MANAGE_USERS: 'manage_users'
};