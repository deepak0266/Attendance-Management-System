const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authMiddleware, checkPermission, checkResourceAccess } = require('../middleware/auth');
const { validate, validatePunch, validateId, validateDateRange, validatePagination } = require('../middleware/validation');
const { punchRateLimiter } = require('../middleware/rateLimiter');

// @route   GET /api/attendance/qr/dynamic
// @desc    Generate dynamic QR code
// @access  Private (Admin/HR/Manager/Device Presenter)
router.get(
  '/qr/dynamic',
  authMiddleware,
  attendanceController.generateDynamicQR
);

// @route   GET /api/attendance/qr/static
// @desc    Get static QR code
// @access  Private (Admin/HR/Manager/Device Presenter)
router.get(
  '/qr/static',
  authMiddleware,
  attendanceController.getStaticQR
);

// @route   POST /api/attendance/punch
// @desc    Submit punch (in/out/break)
// @access  Private
router.post(
  '/punch',
  authMiddleware,
  punchRateLimiter,
  validate(validatePunch),
  attendanceController.submitPunch
);

// @route   GET /api/attendance/status
// @desc    Get current attendance status
// @access  Private
router.get(
  '/status',
  authMiddleware,
  attendanceController.getCurrentStatus
);

// @route   GET /api/attendance/history
// @desc    Get attendance history
// @access  Private
router.get(
  '/history',
  authMiddleware,
  validate([...validateDateRange, ...validatePagination]),
  attendanceController.getAttendanceHistory
);

// @route   GET /api/attendance/history/:userId
// @desc    Get attendance history for specific user
// @access  Private (Manager, HR, Super Admin)
router.get(
  '/history/:userId',
  authMiddleware,
  checkResourceAccess('attendance'),
  validate([...validateId, ...validateDateRange, ...validatePagination]),
  attendanceController.getAttendanceHistory
);

// @route   GET /api/attendance/chart
// @desc    Get attendance chart data
// @access  Private
router.get(
  '/chart',
  authMiddleware,
  attendanceController.getChartData
);

// @route   GET /api/attendance/chart/:userId
// @desc    Get attendance chart data for specific user
// @access  Private (Manager, HR, Super Admin)
router.get(
  '/chart/:userId',
  authMiddleware,
  checkResourceAccess('attendance'),
  attendanceController.getChartData
);

// @route   POST /api/attendance/override/:attendanceId
// @desc    Override attendance (HR/Super Admin only)
// @access  Private (HR, Super Admin)
router.post(
  '/override/:attendanceId',
  authMiddleware,
  checkPermission('override_attendance'),
  validate(validateId),
  attendanceController.overrideAttendance
);

// @route   GET /api/attendance/photo-config
// @desc    Get photo capture configuration
// @access  Private
router.get(
  '/photo-config',
  authMiddleware,
  attendanceController.getPhotoCaptureConfig
);

// @route   GET /api/attendance/summary
// @desc    Get attendance summary for dashboard
// @access  Private
router.get(
  '/summary',
  authMiddleware,
  attendanceController.getAttendanceSummary
);

// @route   GET /api/attendance/summary/:userId
// @desc    Get attendance summary for specific user
// @access  Private (Manager, HR, Super Admin)
router.get(
  '/summary/:userId',
  authMiddleware,
  checkResourceAccess('attendance'),
  attendanceController.getAttendanceSummary
);

// @route   GET /api/attendance/today
// @desc    Get today's attendance for all (HR/Super Admin)
// @access  Private (HR, Super Admin)
router.get(
  '/today',
  authMiddleware,
  checkPermission('view_all_data'),
  async (req, res, next) => {
    req.params.userId = null;
    next();
  },
  attendanceController.getAttendanceHistory
);

// @route   GET /api/attendance/monthly/:month/:year
// @desc    Get monthly attendance summary
// @access  Private
router.get(
  '/monthly/:month/:year',
  authMiddleware,
  async (req, res, next) => {
    const { month, year } = req.params;
    req.query.startDate = new Date(year, month - 1, 1);
    req.query.endDate = new Date(year, month, 0);
    next();
  },
  attendanceController.getAttendanceHistory
);

// @route   POST /api/attendance/break/start
// @desc    Start break
// @access  Private
router.post(
  '/break/start',
  authMiddleware,
  (req, res, next) => {
    req.body.type = 'BREAK_START';
    next();
  },
  validate(validatePunch),
  attendanceController.submitPunch
);

// @route   POST /api/attendance/break/end
// @desc    End break
// @access  Private
router.post(
  '/break/end',
  authMiddleware,
  (req, res, next) => {
    req.body.type = 'BREAK_END';
    next();
  },
  validate(validatePunch),
  attendanceController.submitPunch
);

// @route   GET /api/attendance/breaks/:attendanceId
// @desc    Get breaks for attendance
// @access  Private
router.get(
  '/breaks/:attendanceId',
  authMiddleware,
  validate(validateId),
  async (req, res, next) => {
    const BreakLog = require('../models/BreakLog');
    try {
      const breaks = await BreakLog.getBreaksForAttendance(req.params.attendanceId);
      res.json({ success: true, data: breaks });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;