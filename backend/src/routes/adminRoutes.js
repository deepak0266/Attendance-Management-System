const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authMiddleware, authorize, checkPermission } = require('../middleware/auth');
const { logSuperAdminAction } = require('../middleware/rbac');
const { 
  validate, 
  validateShift, 
  validateGeoFence, 
  validateRevokePermission,
  validateId,
  validatePagination,
  validateDateRange
} = require('../middleware/validation');

// Apply Super Admin action logging to all routes
router.use(logSuperAdminAction);

// ==================== Dashboard Routes ====================

// @route   GET /api/admin/dashboard
// @desc    Get system dashboard stats
// @access  Private (HR, Super Admin)
router.get(
  '/dashboard',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR'),
  adminController.getDashboardStats
);

// @route   GET /api/admin/attendance-trend
// @desc    Get attendance trend for dashboard
// @access  Private (HR, Super Admin)
router.get(
  '/attendance-trend',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR'),
  adminController.getAttendanceTrend
);

// @route   GET /api/admin/department-distribution
// @desc    Get department distribution
// @access  Private (HR, Super Admin)
router.get(
  '/department-distribution',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR'),
  adminController.getDepartmentDistribution
);

// ==================== Permission Management Routes ====================

// @route   POST /api/admin/permissions/revoke
// @desc    Revoke user permission
// @access  Private (Super Admin only)
router.post(
  '/permissions/revoke',
  authMiddleware,
  authorize('SUPER_ADMIN'),
  validate(validateRevokePermission),
  adminController.revokePermission
);

// @route   POST /api/admin/permissions/restore/:revocationId
// @desc    Restore revoked permission
// @access  Private (Super Admin only)
router.post(
  '/permissions/restore/:revocationId',
  authMiddleware,
  authorize('SUPER_ADMIN'),
  validate(validateId),
  adminController.restorePermission
);

// ==================== Log Management Routes ====================

// @route   GET /api/admin/logs
// @desc    Get system logs
// @access  Private (HR, Super Admin)
router.get(
  '/logs',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR'),
  validate([...validateDateRange, ...validatePagination]),
  adminController.getSystemLogs
);

// @route   GET /api/admin/audit-logs
// @desc    Get audit logs
// @access  Private (Super Admin only)
router.get(
  '/audit-logs',
  authMiddleware,
  authorize('SUPER_ADMIN'),
  validate([...validateDateRange, ...validatePagination]),
  adminController.getAuditLogs
);

// ==================== Shift Management Routes ====================

// @route   GET /api/admin/shifts
// @desc    Get all shifts
// @access  Private (HR, Super Admin)
router.get(
  '/shifts',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR'),
  adminController.getShifts
);

// @route   POST /api/admin/shifts
// @desc    Create new shift
// @access  Private (HR, Super Admin)
router.post(
  '/shifts',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR'),
  validate(validateShift),
  adminController.manageShift
);

// @route   PUT /api/admin/shifts/:shiftId
// @desc    Update shift
// @access  Private (HR, Super Admin)
router.put(
  '/shifts/:shiftId',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR'),
  validate([...validateId, ...validateShift]),
  (req, res, next) => {
    req.params.shiftId = req.params.shiftId;
    next();
  },
  adminController.manageShift
);

// @route   DELETE /api/admin/shifts/:id
// @desc    Delete shift (soft delete)
// @access  Private (HR, Super Admin)
router.delete(
  '/shifts/:id',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR'),
  validate(validateId),
  adminController.deleteShift
);

// ==================== Policy Management Routes ====================

// @route   GET /api/admin/policies
// @desc    Get all policies
// @access  Private (HR, Super Admin)
router.get(
  '/policies',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR'),
  adminController.getPolicies
);

// @route   POST /api/admin/policies
// @desc    Create new policy
// @access  Private (HR, Super Admin)
router.post(
  '/policies',
  authMiddleware,
  checkPermission('define_policies'),
  adminController.managePolicy
);

// @route   PUT /api/admin/policies/:policyId
// @desc    Update policy
// @access  Private (HR, Super Admin)
router.put(
  '/policies/:policyId',
  authMiddleware,
  checkPermission('define_policies'),
  validate(validateId),
  (req, res, next) => {
    req.params.policyId = req.params.policyId;
    next();
  },
  adminController.managePolicy
);

// @route   POST /api/admin/policies/:id/approve
// @desc    Approve policy
// @access  Private (Super Admin only)
router.post(
  '/policies/:id/approve',
  authMiddleware,
  authorize('SUPER_ADMIN'),
  validate(validateId),
  adminController.approvePolicy
);

// ==================== Geo-fence Management Routes ====================

// @route   GET /api/admin/geofence
// @desc    Get all geo-fences
// @access  Private (HR, Super Admin)
router.get(
  '/geofence',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR'),
  adminController.getGeoFences
);

// @route   POST /api/admin/geofence
// @desc    Create new geo-fence
// @access  Private (HR, Super Admin)
router.post(
  '/geofence',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR'),
  validate(validateGeoFence),
  adminController.manageGeoFence
);

// @route   PUT /api/admin/geofence/:fenceId
// @desc    Update geo-fence
// @access  Private (HR, Super Admin)
router.put(
  '/geofence/:fenceId',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR'),
  validate([...validateId, ...validateGeoFence]),
  (req, res, next) => {
    req.params.fenceId = req.params.fenceId;
    next();
  },
  adminController.manageGeoFence
);

// ==================== Payroll Management Routes ====================

// @route   GET /api/admin/payroll/locks
// @desc    Get payroll lock status
// @access  Private (HR, Super Admin)
router.get(
  '/payroll/locks',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR'),
  adminController.getPayrollLocks
);

// @route   POST /api/admin/payroll/lock
// @desc    Lock payroll for a month
// @access  Private (HR, Super Admin)
router.post(
  '/payroll/lock',
  authMiddleware,
  checkPermission('lock_payroll'),
  adminController.lockPayroll
);

// @route   POST /api/admin/payroll/unlock
// @desc    Unlock payroll
// @access  Private (Super Admin only)
router.post(
  '/payroll/unlock',
  authMiddleware,
  authorize('SUPER_ADMIN'),
  adminController.unlockPayroll
);

// ==================== System Configuration Routes ====================

// @route   GET /api/admin/config
// @desc    Get system configuration
// @access  Private (Super Admin only)
router.get(
  '/config',
  authMiddleware,
  authorize('SUPER_ADMIN'),
  adminController.getSystemConfig
);

// @route   PUT /api/admin/config
// @desc    Update system configuration
// @access  Private (Super Admin only)
router.put(
  '/config',
  authMiddleware,
  authorize('SUPER_ADMIN'),
  adminController.updateSystemConfig
);

module.exports = router;