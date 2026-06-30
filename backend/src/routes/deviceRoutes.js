const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const User = require('../models/User');
const { authMiddleware, authorize, checkPermission } = require('../middleware/auth');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

// @route   POST /api/device/request
// @desc    Request a new device registration (sends notifications up the hierarchy)
// @access  Private (All authenticated)
router.post('/request', async (req, res) => {
  try {
    const { device_id, device_name, platform } = req.body;
    
    if (!device_id) {
      return res.status(400).json({ success: false, error: 'Device ID is required' });
    }

    // Check if this exact device already has a pending/approved request
    const existingDevice = await Device.findOne({ user_id: req.user.id, device_id });
    
    if (existingDevice) {
      if (existingDevice.status === 'PENDING') {
        return res.status(400).json({ 
          success: false, 
          error: 'A request for this device is already pending approval' 
        });
      }
      if (existingDevice.status === 'APPROVED') {
        return res.status(400).json({ 
          success: false, 
          error: 'This device is already approved' 
        });
      }
      // If REJECTED or INACTIVE, allow re-request by deleting old record
      await Device.deleteOne({ _id: existingDevice._id });
    }

    const device = new Device({
      user_id: req.user.id,
      device_id,
      device_name: device_name || platform || 'Unknown Device',
      user_agent: req.headers['user-agent'] || 'Unknown'
    });

    await device.save();

    // Send notifications up the hierarchy: Manager → HR → Head HR → Super Admin
    const superiors = await req.user.getAllSuperiors();
    const notificationPromises = superiors.map(superiorId =>
      notificationService.sendNotification(superiorId, {
        type: 'DEVICE_APPROVAL_REQUEST',
        title: '📱 New Device Approval Request',
        message: `${req.user.full_name} (${req.user.employee_id}) has requested approval for a new device.`,
        data: {
          deviceId: device._id,
          userId: req.user.id,
          userName: req.user.full_name,
          employeeId: req.user.employee_id,
          deviceName: device.device_name,
          redirectUrl: '/admin/device-approvals'
        }
      })
    );

    // Also notify all Super Admins (in case they're not in the hierarchy chain)
    const superAdmins = await User.find({ role: 'SUPER_ADMIN', _id: { $nin: superiors } });
    for (const sa of superAdmins) {
      notificationPromises.push(
        notificationService.sendNotification(sa._id, {
          type: 'DEVICE_APPROVAL_REQUEST',
          title: '📱 New Device Approval Request',
          message: `${req.user.full_name} (${req.user.employee_id}) has requested approval for a new device.`,
          data: {
            deviceId: device._id,
            userId: req.user.id,
            userName: req.user.full_name,
            employeeId: req.user.employee_id,
            deviceName: device.device_name,
            redirectUrl: '/admin/device-approvals'
          }
        })
      );
    }

    // Fire and forget (don't block the response)
    Promise.allSettled(notificationPromises).catch(err => 
      logger.error('Device notification error:', err)
    );

    res.status(201).json({
      success: true,
      message: 'Device approval request sent to your superiors',
      data: device
    });
  } catch (error) {
    logger.error('Device request error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/device/pending
// @desc    Get pending device requests with full device history
router.get('/pending', checkPermission('approve_requests'), async (req, res) => {
  try {
    const query = { status: 'PENDING' };
    
    // Managers can only see their direct team's requests
    if (req.user.role === 'MANAGER') {
      const teamMembers = await User.findTeamMembers(req.user.id);
      const teamIds = teamMembers.map(member => member._id);
      query.user_id = { $in: teamIds };
    }

    const devices = await Device.find(query)
      .populate('user_id', 'full_name email employee_id department role manager_id')
      .sort({ created_at: -1 });
    
    // For each pending request, attach the user's FULL device history
    const devicesWithHistory = await Promise.all(devices.map(async (device) => {
      if (!device.user_id) {
        return {
          ...device.toObject(),
          history: [],
          managerInfo: null
        };
      }

      const history = await Device.find({ 
        user_id: device.user_id._id, 
        _id: { $ne: device._id } 
      })
      .sort({ created_at: -1 })
      .populate('approved_by', 'full_name email role');
      
      // Get the user's manager info for context
      let managerInfo = null;
      if (device.user_id.manager_id) {
        managerInfo = await User.findById(device.user_id.manager_id)
          .select('full_name email role');
      }

      return {
        ...device.toObject(),
        history,
        managerInfo
      };
    }));
    
    res.json({ success: true, data: devicesWithHistory });
  } catch (error) {
    logger.error('Get pending devices error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   POST /api/device/:id/approve
// @desc    Approve device registration and notify the employee
// @access  Private (HR, HEAD_HR, MANAGER, SUPER_ADMIN)
router.post('/:id/approve', checkPermission('approve_requests'), async (req, res) => {
  try {
    const device = await Device.findById(req.params.id).populate('user_id', 'full_name email employee_id');
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device request not found' });
    }
    if (!device.user_id) {
      return res.status(400).json({ success: false, error: 'User for this device no longer exists' });
    }

    if (device.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: `Cannot approve device with status: ${device.status}` });
    }

    // Set all other devices for this user to INACTIVE
    await Device.updateMany(
      { user_id: device.user_id._id, _id: { $ne: device._id }, status: 'APPROVED' },
      { status: 'INACTIVE' }
    );

    device.status = 'APPROVED';
    device.approved_by = req.user.id;
    device.approved_at = new Date();
    await device.save();

    // Notify the employee that their device was approved
    await notificationService.sendNotification(device.user_id._id, {
      type: 'DEVICE_APPROVED',
      title: '✅ Device Approved',
      message: `Your device "${device.device_name}" has been approved by ${req.user.full_name}. You can now use this device for attendance.`,
      data: {
        deviceId: device._id,
        approvedBy: req.user.full_name,
        approvedByRole: req.user.role
      }
    });

    res.json({ success: true, message: 'Device approved successfully', data: device });
  } catch (error) {
    logger.error('Approve device error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   POST /api/device/:id/reject
// @desc    Reject device registration and notify the employee
// @access  Private (HR, HEAD_HR, MANAGER, SUPER_ADMIN)
router.post('/:id/reject', checkPermission('approve_requests'), async (req, res) => {
  try {
    const device = await Device.findById(req.params.id).populate('user_id', 'full_name email employee_id');
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device request not found' });
    }
    if (!device.user_id) {
      return res.status(400).json({ success: false, error: 'User for this device no longer exists' });
    }

    if (device.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: `Cannot reject device with status: ${device.status}` });
    }

    device.status = 'REJECTED';
    await device.save();

    // Notify the employee that their device was rejected
    await notificationService.sendNotification(device.user_id._id, {
      type: 'DEVICE_REJECTED',
      title: '❌ Device Rejected',
      message: `Your device "${device.device_name}" has been rejected by ${req.user.full_name}. Please contact your manager.`,
      data: {
        deviceId: device._id,
        rejectedBy: req.user.full_name,
        rejectedByRole: req.user.role
      }
    });

    res.json({ success: true, message: 'Device rejected', data: device });
  } catch (error) {
    logger.error('Reject device error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// @route   GET /api/device/my-devices
// @desc    Get current user's devices
// @access  Private
router.get('/my-devices', async (req, res) => {
  try {
    const devices = await Device.find({ user_id: req.user.id })
      .sort({ created_at: -1 })
      .populate('approved_by', 'full_name email role');
    res.json({ success: true, data: devices });
  } catch (error) {
    logger.error('Get my devices error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
