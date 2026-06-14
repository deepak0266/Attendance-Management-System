const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const { validate, validateLogin, validatePasswordChange } = require('../middleware/validation');
const { loginRateLimiter } = require('../middleware/rateLimiter');

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post(
  '/login',
  loginRateLimiter,
  validate(validateLogin),
  authController.login
);

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post(
  '/logout',
  authMiddleware,
  authController.logout
);

// @route   POST /api/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post(
  '/refresh',
  authController.refreshToken
);

// @route   POST /api/auth/change-password
// @desc    Change password
// @access  Private
router.post(
  '/change-password',
  authMiddleware,
  validate(validatePasswordChange),
  authController.changePassword
);

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post(
  '/forgot-password',
  loginRateLimiter,
  authController.forgotPassword
);

// @route   POST /api/auth/reset-password/:token
// @desc    Reset password with token
// @access  Public
router.post(
  '/reset-password/:token',
  authController.resetPassword
);

// @route   GET /api/auth/verify-email/:token
// @desc    Verify email address
// @access  Public
router.get(
  '/verify-email/:token',
  authController.verifyEmail
);

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get(
  '/me',
  authMiddleware,
  authController.getCurrentUser
);

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put(
  '/profile',
  authMiddleware,
  authController.updateProfile
);

// @route   GET /api/auth/check
// @desc    Check authentication status
// @access  Private
router.get(
  '/check',
  authMiddleware,
  authController.checkAuth
);

// @route   GET /api/auth/csrf-token
// @desc    Get CSRF token
// @access  Private
router.get(
  '/csrf-token',
  authMiddleware,
  authController.getCsrfToken
);

module.exports = router;