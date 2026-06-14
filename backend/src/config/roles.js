// Role definitions and hierarchy
const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  HR: 'HR',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE'
};

// Role hierarchy levels (higher number = more privileges)
const ROLE_LEVELS = {
  [ROLES.SUPER_ADMIN]: 100,
  [ROLES.HR]: 80,
  [ROLES.MANAGER]: 50,
  [ROLES.EMPLOYEE]: 10
};

// Permission definitions
const PERMISSIONS = {
  // User management
  USER_CREATE: 'user:create',
  USER_READ: 'user:read',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  USER_BULK_UPLOAD: 'user:bulk_upload',
  USER_REVOKE_ACCESS: 'user:revoke_access',
  
  // Attendance management
  ATTENDANCE_READ: 'attendance:read',
  ATTENDANCE_CREATE: 'attendance:create',
  ATTENDANCE_UPDATE: 'attendance:update',
  ATTENDANCE_DELETE: 'attendance:delete',
  ATTENDANCE_OVERRIDE: 'attendance:override',
  ATTENDANCE_EDIT_TIME: 'attendance:edit_time',
  
  // Approval management
  APPROVAL_READ: 'approval:read',
  APPROVAL_CREATE: 'approval:create',
  APPROVAL_APPROVE: 'approval:approve',
  APPROVAL_REJECT: 'approval:reject',
  APPROVAL_ESCALATE: 'approval:escalate',
  
  // Report management
  REPORT_VIEW_ALL: 'report:view_all',
  REPORT_VIEW_TEAM: 'report:view_team',
  REPORT_VIEW_SELF: 'report:view_self',
  REPORT_EXPORT: 'report:export',
  
  // Policy management
  POLICY_CREATE: 'policy:create',
  POLICY_UPDATE: 'policy:update',
  POLICY_DELETE: 'policy:delete',
  POLICY_VIEW: 'policy:view',
  
  // Shift management
  SHIFT_CREATE: 'shift:create',
  SHIFT_UPDATE: 'shift:update',
  SHIFT_DELETE: 'shift:delete',
  SHIFT_VIEW: 'shift:view',
  
  // Geo-fence management
  GEOFENCE_CREATE: 'geofence:create',
  GEOFENCE_UPDATE: 'geofence:update',
  GEOFENCE_DELETE: 'geofence:delete',
  GEOFENCE_VIEW: 'geofence:view',
  
  // Payroll management
  PAYROLL_LOCK: 'payroll:lock',
  PAYROLL_UNLOCK: 'payroll:unlock',
  PAYROLL_VIEW: 'payroll:view',
  PAYROLL_EXPORT: 'payroll:export',
  
  // System management
  SYSTEM_CONFIG: 'system:config',
  SYSTEM_LOGS_VIEW_ALL: 'system:logs:view_all',
  SYSTEM_LOGS_VIEW_LIMITED: 'system:logs:view_limited',
  SYSTEM_BACKUP: 'system:backup',
  SYSTEM_RESTORE: 'system:restore',
  
  // Super admin specific
  SUPER_ADMIN_VIEW_ALL: 'super_admin:view_all',
  SUPER_ADMIN_MANAGE_ADMINS: 'super_admin:manage_admins',
  SUPER_ADMIN_EMERGENCY_OVERRIDE: 'super_admin:emergency_override'
};

// Role-based permission matrix
const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: [
    // Super Admin has ALL permissions
    ...Object.values(PERMISSIONS)
  ],
  
  [ROLES.HR]: [
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_BULK_UPLOAD,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.ATTENDANCE_OVERRIDE,
    PERMISSIONS.ATTENDANCE_EDIT_TIME,
    PERMISSIONS.APPROVAL_READ,
    PERMISSIONS.APPROVAL_APPROVE,
    PERMISSIONS.APPROVAL_REJECT,
    PERMISSIONS.APPROVAL_ESCALATE,
    PERMISSIONS.REPORT_VIEW_ALL,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.POLICY_CREATE,
    PERMISSIONS.POLICY_UPDATE,
    PERMISSIONS.POLICY_VIEW,
    PERMISSIONS.SHIFT_CREATE,
    PERMISSIONS.SHIFT_UPDATE,
    PERMISSIONS.SHIFT_VIEW,
    PERMISSIONS.GEOFENCE_CREATE,
    PERMISSIONS.GEOFENCE_UPDATE,
    PERMISSIONS.GEOFENCE_VIEW,
    PERMISSIONS.PAYROLL_LOCK,
    PERMISSIONS.PAYROLL_VIEW,
    PERMISSIONS.PAYROLL_EXPORT,
    PERMISSIONS.SYSTEM_LOGS_VIEW_LIMITED
  ],
  
  [ROLES.MANAGER]: [
    PERMISSIONS.USER_READ,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.APPROVAL_READ,
    PERMISSIONS.APPROVAL_APPROVE,
    PERMISSIONS.APPROVAL_REJECT,
    PERMISSIONS.APPROVAL_ESCALATE,
    PERMISSIONS.REPORT_VIEW_TEAM,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.POLICY_VIEW,
    PERMISSIONS.SHIFT_VIEW,
    PERMISSIONS.GEOFENCE_VIEW
  ],
  
  [ROLES.EMPLOYEE]: [
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.ATTENDANCE_CREATE,
    PERMISSIONS.APPROVAL_CREATE,
    PERMISSIONS.REPORT_VIEW_SELF,
    PERMISSIONS.POLICY_VIEW,
    PERMISSIONS.SHIFT_VIEW
  ]
};

// Capability to permission mapping (for revocation system)
const CAPABILITY_TO_PERMISSIONS = {
  'override_attendance': [PERMISSIONS.ATTENDANCE_OVERRIDE, PERMISSIONS.ATTENDANCE_EDIT_TIME],
  'upload_employees': [PERMISSIONS.USER_CREATE, PERMISSIONS.USER_BULK_UPLOAD],
  'lock_payroll': [PERMISSIONS.PAYROLL_LOCK, PERMISSIONS.PAYROLL_UNLOCK],
  'define_policies': [PERMISSIONS.POLICY_CREATE, PERMISSIONS.POLICY_UPDATE],
  'view_all_data': [PERMISSIONS.REPORT_VIEW_ALL, PERMISSIONS.USER_READ],
  'handle_escalations': [PERMISSIONS.APPROVAL_ESCALATE],
  'approve_requests': [PERMISSIONS.APPROVAL_APPROVE, PERMISSIONS.APPROVAL_REJECT],
  'edit_punch_times': [PERMISSIONS.ATTENDANCE_EDIT_TIME],
  'view_reports': [PERMISSIONS.REPORT_VIEW_ALL, PERMISSIONS.REPORT_EXPORT],
  'manage_users': [PERMISSIONS.USER_UPDATE, PERMISSIONS.USER_DELETE],
  'login': ['login']
};

// Helper functions
const hasPermission = (userRole, permission) => {
  const permissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.includes(permission);
};

const getRoleLevel = (role) => {
  return ROLE_LEVELS[role] || 0;
};

const canManageRole = (actorRole, targetRole) => {
  const actorLevel = ROLE_LEVELS[actorRole] || 0;
  const targetLevel = ROLE_LEVELS[targetRole] || 0;
  
  // Super Admin can manage everyone
  if (actorRole === ROLES.SUPER_ADMIN) return true;
  
  // HR can manage Manager and Employee
  if (actorRole === ROLES.HR) {
    return [ROLES.MANAGER, ROLES.EMPLOYEE].includes(targetRole);
  }
  
  // Manager can manage Employee
  if (actorRole === ROLES.MANAGER) {
    return targetRole === ROLES.EMPLOYEE;
  }
  
  return false;
};

const getRoleHierarchy = () => {
  return Object.entries(ROLE_LEVELS)
    .sort(([, a], [, b]) => b - a)
    .map(([role, level]) => ({ role, level }));
};

module.exports = {
  ROLES,
  ROLE_LEVELS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  CAPABILITY_TO_PERMISSIONS,
  hasPermission,
  getRoleLevel,
  canManageRole,
  getRoleHierarchy
};