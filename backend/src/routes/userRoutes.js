const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware, checkPermission, authorize } = require('../middleware/auth');
const { canManageUser } = require('../middleware/rbac');
const { 
  validate, 
  validateUserCreate, 
  validateUserUpdate, 
  validateId, 
  validatePagination 
} = require('../middleware/validation');

// @route   GET /api/users
// @desc    Get all users (with filtering)
// @access  Private (HR, Manager, Super Admin)
router.get(
  '/',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR', 'MANAGER'),
  validate(validatePagination),
  userController.getUsers
);

// @route   GET /api/users/stats
// @desc    Get user statistics
// @access  Private (HR, Super Admin)
router.get(
  '/stats',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR'),
  userController.getUserStats
);

// @route   GET /api/users/team
// @desc    Get user's team members
// @access  Private (Manager, HR, Super Admin)
router.get(
  '/team',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR', 'MANAGER'),
  userController.getTeamMembers
);

// @route   POST /api/users
// @desc    Create new user
// @access  Private (HR, Super Admin)
router.post(
  '/',
  authMiddleware,
  checkPermission('upload_employees'),
  validate(validateUserCreate),
  userController.createUser
);

// @route   POST /api/users/bulk
// @desc    Bulk upload users
// @access  Private (HR, Super Admin)
router.post(
  '/bulk',
  authMiddleware,
  checkPermission('upload_employees'),
  userController.bulkUploadUsers
);

// @route   GET /api/users/:id
// @desc    Get single user
// @access  Private
router.get(
  '/:id',
  authMiddleware,
  validate(validateId),
  userController.getUser
);

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private (HR, Super Admin)
router.put(
  '/:id',
  authMiddleware,
  canManageUser,
  validate([...validateId, ...validateUserUpdate]),
  userController.updateUser
);

// @route   DELETE /api/users/:id
// @desc    Delete user (soft delete)
// @access  Private (Super Admin only)
router.delete(
  '/:id',
  authMiddleware,
  authorize('SUPER_ADMIN'),
  validate(validateId),
  userController.deleteUser
);

// @route   POST /api/users/:id/change-password
// @desc    Change user password (admin)
// @access  Private (HR, Super Admin)
router.post(
  '/:id/change-password',
  authMiddleware,
  canManageUser,
  validate(validateId),
  userController.adminChangePassword
);

// @route   GET /api/users/:id/attendance
// @desc    Get user's attendance (redirect to attendance routes)
// @access  Private (Manager, HR, Super Admin)
router.get(
  '/:id/attendance',
  authMiddleware,
  (req, res) => {
    res.redirect(`/api/attendance/history/${req.params.id}`);
  }
);

// @route   GET /api/users/:id/shift
// @desc    Get user's assigned shift
// @access  Private
router.get(
  '/:id/shift',
  authMiddleware,
  validate(validateId),
  async (req, res, next) => {
    try {
      const Shift = require('../models/Shift');
      const User = require('../models/User');
      
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      
      const shift = await Shift.findShiftsForUser(user).then(shifts => shifts[0]);
      
      res.json({ success: true, data: shift || null });
    } catch (error) {
      next(error);
    }
  }
);

// @route   GET /api/users/department/:department
// @desc    Get users by department
// @access  Private (HR, Manager, Super Admin)
router.get(
  '/department/:department',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR', 'MANAGER'),
  async (req, res, next) => {
    req.query.department = req.params.department;
    next();
  },
  userController.getUsers
);

// @route   GET /api/users/role/:role
// @desc    Get users by role
// @access  Private (HR, Super Admin)
router.get(
  '/role/:role',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR'),
  async (req, res, next) => {
    req.query.role = req.params.role;
    next();
  },
  userController.getUsers
);

// @route   GET /api/users/search
// @desc    Search users
// @access  Private (HR, Manager, Super Admin)
router.get(
  '/search',
  authMiddleware,
  authorize('SUPER_ADMIN', 'HR', 'MANAGER'),
  async (req, res, next) => {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, error: 'Search query required' });
    }
    req.query.search = q;
    next();
  },
  userController.getUsers
);

module.exports = router;