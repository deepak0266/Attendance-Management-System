const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authMiddleware, authorize, checkPermission } = require('../middleware/auth');
const { validate, validateDateRange, validateExport } = require('../middleware/validation');
const { canAccessDepartment } = require('../middleware/rbac');

// Apply department access check
router.use(canAccessDepartment);

// @route   GET /api/reports/daily
// @desc    Generate daily attendance report
// @access  Private (HR, Manager, Super Admin)
router.get(
  '/daily',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR', 'MANAGER'),
  validate([...validateDateRange, ...validateExport]),
  reportController.getDailyReport
);

// @route   GET /api/reports/monthly
// @desc    Generate monthly summary report
// @access  Private (HR, Manager, Super Admin)
router.get(
  '/monthly',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR', 'MANAGER'),
  validate(validateExport),
  reportController.getMonthlyReport
);

// @route   GET /api/reports/overtime
// @desc    Generate overtime report
// @access  Private (HR, Manager, Super Admin)
router.get(
  '/overtime',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR', 'MANAGER'),
  reportController.getOvertimeReport
);

// @route   GET /api/reports/payroll
// @desc    Generate payroll report
// @access  Private (HR, Super Admin)
router.get(
  '/payroll',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR'),
  checkPermission('view_reports'),
  validate(validateExport),
  reportController.getPayrollReport
);

// @route   GET /api/reports/late-early
// @desc    Generate late/early report
// @access  Private (HR, Manager, Super Admin)
router.get(
  '/late-early',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR', 'MANAGER'),
  reportController.getLateEarlyReport
);

// @route   GET /api/reports/absenteeism
// @desc    Generate absenteeism report
// @access  Private (HR, Manager, Super Admin)
router.get(
  '/absenteeism',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR', 'MANAGER'),
  reportController.getAbsenteeismReport
);

// @route   GET /api/reports/export/daily
// @desc    Export daily report
// @access  Private (HR, Manager, Super Admin)
router.get(
  '/export/daily',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR', 'MANAGER'),
  (req, res, next) => {
    req.query.export_format = req.query.format || 'excel';
    next();
  },
  reportController.getDailyReport
);

// @route   GET /api/reports/export/monthly
// @desc    Export monthly report
// @access  Private (HR, Manager, Super Admin)
router.get(
  '/export/monthly',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR', 'MANAGER'),
  (req, res, next) => {
    req.query.export_format = req.query.format || 'excel';
    next();
  },
  reportController.getMonthlyReport
);

// @route   GET /api/reports/export/payroll
// @desc    Export payroll report
// @access  Private (HR, Super Admin)
router.get(
  '/export/payroll',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR'),
  (req, res, next) => {
    req.query.export_format = req.query.format || 'excel';
    next();
  },
  reportController.getPayrollReport
);

// @route   GET /api/reports/user/:userId
// @desc    Get individual user report
// @access  Private (HR, Manager, Super Admin)
router.get(
  '/user/:userId',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR', 'MANAGER'),
  async (req, res, next) => {
    req.query.user_id = req.params.userId;
    next();
  },
  reportController.getMonthlyReport
);

// @route   GET /api/reports/department/:department
// @desc    Get department report
// @access  Private (HR, Manager, Super Admin)
router.get(
  '/department/:department',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR', 'MANAGER'),
  async (req, res, next) => {
    req.query.department = req.params.department;
    next();
  },
  reportController.getMonthlyReport
);

// @route   GET /api/reports/summary
// @desc    Get quick summary stats
// @access  Private (HR, Manager, Super Admin)
router.get(
  '/summary',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR', 'MANAGER'),
  async (req, res, next) => {
    try {
      const AttendanceLog = require('../models/AttendanceLog');
      const User = require('../models/User');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const [totalEmployees, presentToday, lateToday, absentToday] = await Promise.all([
        User.countDocuments({ status: 'ACTIVE' }),
        AttendanceLog.countDocuments({
          date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
          status: 'PRESENT'
        }),
        AttendanceLog.countDocuments({
          date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
          status: 'LATE'
        }),
        AttendanceLog.countDocuments({
          date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
          status: 'ABSENT'
        })
      ]);
      
      res.json({
        success: true,
        data: {
          total_employees: totalEmployees,
          today: {
            present: presentToday,
            late: lateToday,
            absent: absentToday,
            attendance_rate: totalEmployees > 0 
              ? ((presentToday / totalEmployees) * 100).toFixed(2) 
              : '0.00'
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;