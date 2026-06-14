const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const SystemActionLog = require('../models/SystemActionLog');
const RevokedPermission = require('../models/RevokedPermission');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');
const { sendEmail } = require('../services/notificationService');

// Generate tokens
const generateTokens = (userId, role) => {
  const accessToken = jwt.sign(
    { userId, role, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '8h' }
  );
  
  const refreshToken = jwt.sign(
    { userId, role, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );
  
  return { accessToken, refreshToken };
};

// Generate CSRF token
const generateCsrfToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const isProd = process.env.NODE_ENV === 'production';
const authCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  path: '/api',
  domain: process.env.COOKIE_DOMAIN || undefined
};

const parseCookies = (cookieHeader = '') => cookieHeader.split(';').reduce((cookies, cookieSegment) => {
  const [name, ...value] = cookieSegment.split('=');
  if (!name) return cookies;
  cookies[name.trim()] = decodeURIComponent(value.join('=').trim());
  return cookies;
}, {});

const getCookie = (req, key) => {
  if (!req.headers?.cookie) return undefined;
  const cookies = parseCookies(req.headers.cookie);
  return cookies[key];
};

const setAuthCookies = (res, tokens) => {
  res.cookie('accessToken', tokens.accessToken, authCookieOptions);
  res.cookie('refreshToken', tokens.refreshToken, authCookieOptions);
};

const clearAuthCookies = (res) => {
  res.clearCookie('accessToken', authCookieOptions);
  res.clearCookie('refreshToken', authCookieOptions);
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }
    
    const { email, password, device_info } = req.body;
    
    // Find user by email or employee ID
    const user = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { employee_id: email.toUpperCase() }
      ]
    }).select('+password_hash');
    
    // Generic error message for security
    if (!user) {
      await SystemActionLog.create({
        actor_role: 'SYSTEM',
        action_type: 'FAILED_LOGIN',
        reason: 'User not found',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        metadata: new Map([['attempted_email', email]])
      });
      
      return res.status(401).json({ 
        success: false,
        error: 'Invalid credentials' 
      });
    }
    
    // Check if account is locked
    if (user.isAccountLocked()) {
      const lockTimeRemaining = Math.ceil(
        (user.account_locked_until - new Date()) / 1000 / 60
      );
      
      return res.status(403).json({ 
        success: false,
        error: `Account is locked. Try again in ${lockTimeRemaining} minutes.` 
      });
    }
    
    // Check if login capability is revoked
    const loginRevoked = await RevokedPermission.isCapabilityRevoked(user._id, 'login');
    if (loginRevoked) {
      return res.status(403).json({ 
        success: false,
        error: 'Login access has been revoked. Contact administrator.' 
      });
    }
    
    // Check if user is active
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ 
        success: false,
        error: 'Account is not active. Contact HR.' 
      });
    }
    
    // Verify password
    const isValidPassword = await user.comparePassword(password);
    
    if (!isValidPassword) {
      await user.incrementFailedAttempts();
      
      await SystemActionLog.create({
        actor_user_id: user._id,
        actor_role: user.role,
        action_type: 'FAILED_LOGIN',
        target_user_id: user._id,
        reason: 'Invalid password',
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
      
      const attemptsLeft = 5 - user.failed_login_attempts;
      const message = attemptsLeft > 0 
        ? `Invalid credentials. ${attemptsLeft} attempts remaining.`
        : 'Invalid credentials. Account locked for 30 minutes.';
      
      return res.status(401).json({ 
        success: false,
        error: message 
      });
    }
    
    // Reset failed attempts on successful login
    await user.resetFailedAttempts();
    
    // Generate tokens
    const tokens = generateTokens(user._id, user.role);
    
    // Save refresh token hash
    user.refresh_token_hash = await bcrypt.hash(tokens.refreshToken, 10);
    user.last_login = new Date();
    user.last_login_ip = req.ip;
    await user.save({ validateBeforeSave: false });
    
    // Generate CSRF token
    const csrfToken = generateCsrfToken();
    
    // Log successful login
    await SystemActionLog.create({
      actor_user_id: user._id,
      actor_role: user.role,
      action_type: 'LOGIN',
      target_user_id: user._id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      session_id: req.session?.id,
      is_super_admin_action: user.role === 'SUPER_ADMIN',
      metadata: new Map([
        ['device_info', device_info],
        ['login_method', 'password']
      ])
    });
    
    // Prepare user data (remove sensitive info)
    const userData = user.toObject();
    delete userData.password_hash;
    delete userData.refresh_token_hash;
    delete userData.two_factor_secret;
    delete userData.password_reset_token;
    delete userData.password_reset_expires;
    
    // Set session
    req.session.userId = user._id;
    req.session.role = user.role;
    req.session.csrfToken = csrfToken;

    setAuthCookies(res, tokens);
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userData,
        csrfToken,
        expiresIn: 8 * 60 * 60 // 8 hours in seconds
      }
    });
    
  } catch (error) {
    logger.error('Login error:', error);
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  try {
    const user = req.user;
    
    // Clear refresh token
    user.refresh_token_hash = null;
    await user.save();
    
    // Destroy session
    req.session.destroy(async (err) => {
      if (err) {
        logger.error('Session destroy error:', err);
      }
    });

    clearAuthCookies(res);
    
    // Log logout
    await SystemActionLog.create({
      actor_user_id: user._id,
      actor_role: user.role,
      action_type: 'LOGOUT',
      target_user_id: user._id,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      is_super_admin_action: user.role === 'SUPER_ADMIN'
    });
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
    
  } catch (error) {
    logger.error('Logout error:', error);
    next(error);
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
exports.refreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.body.refreshToken || getCookie(req, 'refreshToken');
    
    if (!refreshToken) {
      return res.status(400).json({ 
        success: false,
        error: 'Refresh token required' 
      });
    }
    
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ 
        success: false,
        error: 'Invalid token type' 
      });
    }
    
    const user = await User.findById(decoded.userId).select('+refresh_token_hash');
    
    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({ 
        success: false,
        error: 'User not found' 
      });
    }
    
    // Check if user is active
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ 
        success: false,
        error: 'Account is not active' 
      });
    }
    
    // Verify refresh token hash
    if (!user.refresh_token_hash) {
      clearAuthCookies(res);
      return res.status(401).json({ 
        success: false,
        error: 'Invalid refresh token' 
      });
    }
    
    const isValid = await bcrypt.compare(refreshToken, user.refresh_token_hash);
    
    if (!isValid) {
      // Possible token reuse - invalidate all sessions
      user.refresh_token_hash = null;
      await user.save();
      
      await SystemActionLog.create({
        actor_user_id: user._id,
        actor_role: user.role,
        action_type: 'FAILED_LOGIN',
        target_user_id: user._id,
        reason: 'Invalid refresh token attempt',
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });
      
      return res.status(401).json({ 
        success: false,
        error: 'Invalid refresh token' 
      });
    }
    
    // Check if login is revoked
    const loginRevoked = await RevokedPermission.isCapabilityRevoked(user._id, 'login');
    if (loginRevoked) {
      return res.status(403).json({ 
        success: false,
        error: 'Login access has been revoked' 
      });
    }
    
    // Generate new tokens
    const tokens = generateTokens(user._id, user.role);
    
    // Update refresh token hash
    user.refresh_token_hash = await bcrypt.hash(tokens.refreshToken, 10);
    await user.save();
    
    // Generate new CSRF token
    const csrfToken = generateCsrfToken();
    req.session.csrfToken = csrfToken;

    setAuthCookies(res, tokens);
    
    res.json({
      success: true,
      data: {
        csrfToken,
        expiresIn: 8 * 60 * 60
      }
    });
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      clearAuthCookies(res);
      return res.status(401).json({ 
        success: false,
        error: 'Invalid token' 
      });
    }
    if (error.name === 'TokenExpiredError') {
      clearAuthCookies(res);
      return res.status(401).json({ 
        success: false,
        error: 'Token expired. Please login again.' 
      });
    }
    
    logger.error('Refresh token error:', error);
    next(error);
  }
};

// @desc    Change password
// @route   POST /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id).select('+password_hash');
    
    // Verify current password
    const isValid = await user.comparePassword(currentPassword);
    
    if (!isValid) {
      return res.status(401).json({ 
        success: false,
        error: 'Current password is incorrect' 
      });
    }
    
    // Validate new password
    if (newPassword.length < 8) {
      return res.status(400).json({ 
        success: false,
        error: 'Password must be at least 8 characters' 
      });
    }
    
    // Check if new password is same as old
    if (currentPassword === newPassword) {
      return res.status(400).json({ 
        success: false,
        error: 'New password must be different from current password' 
      });
    }
    
    // Update password
    user.password_hash = newPassword;
    await user.save();
    
    // Invalidate all refresh tokens (force re-login on other devices)
    user.refresh_token_hash = null;
    await user.save();
    
    // Log password change
    await SystemActionLog.create({
      actor_user_id: user._id,
      actor_role: user.role,
      action_type: 'USER_UPDATE',
      target_user_id: user._id,
      reason: 'Password changed',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      is_super_admin_action: user.role === 'SUPER_ADMIN',
      is_sensitive: true
    });
    
    res.json({
      success: true,
      message: 'Password changed successfully. Please login again on other devices.'
    });
    
  } catch (error) {
    logger.error('Change password error:', error);
    next(error);
  }
};

// @desc    Forgot password - send reset email
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email: email.toLowerCase() });
    
    // Don't reveal if user exists or not (security)
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.'
      });
    }
    
    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false });
    
    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    
    // Send email
    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset Request - Attendance Management System',
        template: 'password_reset',
        data: {
          name: user.full_name,
          resetUrl,
          expiryHours: 24
        }
      });
      
      res.json({
        success: true,
        message: 'Password reset link sent to your email.'
      });
    } catch (emailError) {
      // Reset token fields if email fails
      user.password_reset_token = null;
      user.password_reset_expires = null;
      await user.save({ validateBeforeSave: false });
      
      logger.error('Password reset email error:', emailError);
      
      return res.status(500).json({
        success: false,
        error: 'Failed to send reset email. Please try again.'
      });
    }
    
  } catch (error) {
    logger.error('Forgot password error:', error);
    next(error);
  }
};

// @desc    Reset password using token
// @route   POST /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    
    // Hash token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    // Find user with valid token
    const user = await User.findOne({
      password_reset_token: hashedToken,
      password_reset_expires: { $gt: new Date() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }
    
    // Validate password
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters'
      });
    }
    
    // Update password
    user.password_hash = password;
    user.password_reset_token = null;
    user.password_reset_expires = null;
    user.refresh_token_hash = null; // Invalidate all sessions
    await user.save();
    
    // Log password reset
    await SystemActionLog.create({
      actor_user_id: user._id,
      actor_role: user.role,
      action_type: 'USER_UPDATE',
      target_user_id: user._id,
      reason: 'Password reset via email',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      is_sensitive: true
    });
    
    res.json({
      success: true,
      message: 'Password reset successful. Please login with your new password.'
    });
    
  } catch (error) {
    logger.error('Reset password error:', error);
    next(error);
  }
};

// @desc    Verify email
// @route   GET /api/auth/verify-email/:token
// @access  Public
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification token'
      });
    }
    
    if (user.email_verified) {
      return res.json({
        success: true,
        message: 'Email already verified'
      });
    }
    
    user.email_verified = true;
    await user.save();
    
    res.json({
      success: true,
      message: 'Email verified successfully'
    });
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification token'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({
        success: false,
        error: 'Verification token expired'
      });
    }
    
    logger.error('Email verification error:', error);
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
exports.getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('manager_id', 'full_name email employee_id')
      .populate('created_by', 'full_name email');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Get revoked capabilities
    const revokedCapabilities = await RevokedPermission.getRevokedCapabilities(user._id);
    
    res.json({
      success: true,
      data: {
        ...user.toObject(),
        revoked_capabilities: revokedCapabilities
      }
    });
    
  } catch (error) {
    logger.error('Get current user error:', error);
    next(error);
  }
};

// @desc    Update profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const { full_name, phone, preferences, emergency_contact } = req.body;
    const user = await User.findById(req.user.id);
    
    // Update allowed fields
    if (full_name) user.full_name = full_name;
    if (phone) user.phone = phone;
    if (preferences) user.preferences = { ...user.preferences, ...preferences };
    if (emergency_contact) user.emergency_contact = emergency_contact;
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
    
  } catch (error) {
    logger.error('Update profile error:', error);
    next(error);
  }
};

// @desc    Check authentication status
// @route   GET /api/auth/check
// @access  Private
exports.checkAuth = async (req, res) => {
  res.json({
    success: true,
    authenticated: true,
    user: {
      id: req.user._id,
      role: req.user.role,
      email: req.user.email
    }
  });
};

// @desc    Get CSRF token
// @route   GET /api/auth/csrf-token
// @access  Private
exports.getCsrfToken = (req, res) => {
  const csrfToken = generateCsrfToken();
  req.session.csrfToken = csrfToken;
  
  res.json({
    success: true,
    data: { csrfToken }
  });
};