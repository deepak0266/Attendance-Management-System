const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const User = require('../models/User');
const { authMiddleware, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

// @route   POST /api/device/request
// @desc    Request a new device registration
// @access  Private (All authenticated)
router.post('/request', authMiddleware, async (req, res) => {
  try {
    const { device_id, device_name, user_agent } = req.body;
    
    if (!device_id) {
      return res.status(400).json({ success: false, error: 'Device ID is required' });
    }

    const existingDevice = await Device.findOne({ user_id: req.user.id, device_id });
    
    if (existingDevice) {
      return res.status(400).json({ 
        success: false, 
        error: `Device is already registered with status: ${existingDevice.status}` 
      });
    }

    const device = new Device({
      user_id: req.user.id,
      device_id,
      device_name,
      user_agent
    });

    await device.save();

    res.status(201).json({
      success: true,
      message: 'Device registration requested successfully',
      data: device
    });
  } catch (error) {
    logger.error('Device request error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/device/pending
// @desc    Get pending device requests
// @access  Private (HR, MANAGER, SUPER_ADMIN)
router.get('/pending', authMiddleware, authorize('HR', 'MANAGER', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const query = { status: 'PENDING' };
    
    // Managers can only see their team's requests
    if (req.user.role === 'MANAGER') {
      const teamMembers = await User.findTeamMembers(req.user.id);
      const teamIds = teamMembers.map(member => member._id);
      query.user_id = { $in: teamIds };
    }

    const devices = await Device.find(query).populate('user_id', 'full_name email employee_id');
    
    res.json({ success: true, data: devices });
  } catch (error) {
    logger.error('Get pending devices error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   POST /api/device/:id/approve
// @desc    Approve device registration
// @access  Private (HR, MANAGER, SUPER_ADMIN)
router.post('/:id/approve', authMiddleware, authorize('HR', 'MANAGER', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device request not found' });
    }

    // Set all other devices for this user to INACTIVE
    await Device.updateMany(
      { user_id: device.user_id, _id: { $ne: device._id } },
      { status: 'INACTIVE' }
    );

    device.status = 'APPROVED';
    device.approved_by = req.user.id;
    device.approved_at = new Date();
    await device.save();

    res.json({ success: true, message: 'Device approved', data: device });
  } catch (error) {
    logger.error('Approve device error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   POST /api/device/:id/reject
// @desc    Reject device registration
// @access  Private (HR, MANAGER, SUPER_ADMIN)
router.post('/:id/reject', authMiddleware, authorize('HR', 'MANAGER', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device request not found' });
    }

    device.status = 'REJECTED';
    await device.save();

    res.json({ success: true, message: 'Device rejected', data: device });
  } catch (error) {
    logger.error('Reject device error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/device/my-devices
// @desc    Get current user's devices
// @access  Private
router.get('/my-devices', authMiddleware, async (req, res) => {
  try {
    const devices = await Device.find({ user_id: req.user.id }).sort({ created_at: -1 });
    res.json({ success: true, data: devices });
  } catch (error) {
    logger.error('Get my devices error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
