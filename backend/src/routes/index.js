const express = require('express');
const router = express.Router();

// Import all route files
const authRoutes = require('./authRoutes');
const attendanceRoutes = require('./attendanceRoutes');
const userRoutes = require('./userRoutes');
const adminRoutes = require('./adminRoutes');
const reportRoutes = require('./reportRoutes');
const approvalRoutes = require('./approvalRoutes');
const deviceRoutes = require('./deviceRoutes');
const holidayRoutes = require('./holidayRoutes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
router.use('/reports', reportRoutes);
router.use('/approvals', approvalRoutes);
router.use('/device', deviceRoutes);
router.use('/holiday', holidayRoutes);

// API version and health check
router.get('/', (req, res) => {
  res.json({
    name: 'Attendance Management System API',
    version: '1.0.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      attendance: '/api/attendance',
      users: '/api/users',
      admin: '/api/admin',
      reports: '/api/reports',
      approvals: '/api/approvals'
    }
  });
});

module.exports = router;