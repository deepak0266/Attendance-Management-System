const Role = require('../models/Role');
const RoleDeletionRequest = require('../models/RoleDeletionRequest');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const SystemActionLog = require('../models/SystemActionLog');
const logger = require('../utils/logger');

// Create a new role
exports.createRole = async (req, res) => {
  try {
    const { name, description, permissions, approval_restrictions } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: 'Role name is required' });
    }

    const existingRole = await Role.findOne({ name: name.toUpperCase() });
    if (existingRole) {
      return res.status(400).json({ success: false, message: 'Role already exists' });
    }

    const role = await Role.create({
      name: name.toUpperCase(),
      description,
      permissions: permissions || [],
      approval_restrictions: approval_restrictions || {},
      is_system: false,
      created_by: req.user._id
    });

    await SystemActionLog.create({
      actor_user_id: req.user._id,
      actor_role: req.user.role,
      action_type: 'PERMISSION_CHANGE',
      target_resource: `Role (${role._id})`,
      reason: `Created custom role: ${role.name}`
    });

    res.status(201).json({ success: true, data: role });
  } catch (error) {
    logger.error('Create role error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Get all roles
exports.getRoles = async (req, res) => {
  try {
    const roles = await Role.find().sort({ is_system: -1, name: 1 });
    res.status(200).json({ success: true, data: roles });
  } catch (error) {
    logger.error('Get roles error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Update role permissions
exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { description, permissions, approval_restrictions } = req.body;

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    if (role.is_system) {
      // For system roles, only allow updating approval restrictions, not description/permissions.
      if (approval_restrictions !== undefined) {
        role.approval_restrictions = approval_restrictions;
      }
    } else {
      if (description !== undefined) role.description = description;
      if (permissions !== undefined) role.permissions = permissions;
      if (approval_restrictions !== undefined) role.approval_restrictions = approval_restrictions;
    }

    await role.save();

    await SystemActionLog.create({
      actor_user_id: req.user._id,
      actor_role: req.user.role,
      action_type: 'PERMISSION_CHANGE',
      target_resource: `Role (${role._id})`,
      reason: `Updated permissions for custom role: ${role.name}`
    });

    res.status(200).json({ success: true, data: role });
  } catch (error) {
    logger.error('Update role error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Request role deletion
exports.requestRoleDeletion = async (req, res) => {
  try {
    const { id } = req.params;

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    if (role.is_system) {
      return res.status(400).json({ success: false, message: 'System roles cannot be deleted' });
    }

    // Check if any users currently have this role
    const usersCount = await User.countDocuments({ role: role.name });
    if (usersCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete role. There are ${usersCount} users assigned to this role. Please reassign them first.` 
      });
    }

    // Check if an existing request is pending
    const existingReq = await RoleDeletionRequest.findOne({ role_id: role._id, status: 'PENDING' });
    if (existingReq) {
      return res.status(400).json({ success: false, message: 'A deletion request for this role is already pending' });
    }

    const deletionReq = await RoleDeletionRequest.create({
      role_id: role._id,
      role_name: role.name,
      requested_by: req.user._id,
      approvals: [{ super_admin_id: req.user._id }] // requester auto-approves
    });

    // Notify other super admins
    const superAdmins = await User.find({ role: 'SUPER_ADMIN', status: 'ACTIVE', _id: { $ne: req.user._id } });
    
    for (const admin of superAdmins) {
      await notificationService.sendNotification(admin._id, {
        title: 'Role Deletion Approval Required',
        message: `Super Admin ${req.user.full_name} has requested to delete the role "${role.name}".`,
        type: 'SYSTEM_ALERT',
        urgent: true
      });
    }

    // Check if the auto-approval is enough (e.g., only 1 or 2 admins total)
    await checkDeletionThreshold(deletionReq);

    res.status(200).json({ success: true, message: 'Deletion request submitted for approval' });
  } catch (error) {
    logger.error('Request role deletion error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Get pending deletion requests
exports.getDeletionRequests = async (req, res) => {
  try {
    const requests = await RoleDeletionRequest.find({ status: 'PENDING' })
      .populate('requested_by', 'full_name email')
      .sort({ createdAt: -1 });
    
    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    logger.error('Get deletion requests error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// Approve or Reject Role Deletion
exports.reviewDeletionRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body; // 'APPROVE' or 'REJECT'

    const deletionReq = await RoleDeletionRequest.findById(id);
    if (!deletionReq || deletionReq.status !== 'PENDING') {
      return res.status(404).json({ success: false, message: 'Pending request not found' });
    }

    // Check if already approved/rejected
    const alreadyApproved = deletionReq.approvals.some(a => a.super_admin_id.toString() === req.user._id.toString());
    const alreadyRejected = deletionReq.rejections.some(r => r.super_admin_id.toString() === req.user._id.toString());
    
    if (alreadyApproved || alreadyRejected) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this request' });
    }

    if (action === 'APPROVE') {
      deletionReq.approvals.push({ super_admin_id: req.user._id });
    } else if (action === 'REJECT') {
      deletionReq.rejections.push({ super_admin_id: req.user._id, reason });
      // If any rejection occurs, we can fail the whole request or require a consensus.
      // Let's mark it as REJECTED entirely if a single SuperAdmin vetos it.
      deletionReq.status = 'REJECTED';
      deletionReq.resolved_at = new Date();
      
      const requester = await User.findById(deletionReq.requested_by);
      if (requester) {
         await notificationService.sendNotification(requester._id, {
            title: 'Role Deletion Rejected',
            message: `Your request to delete role "${deletionReq.role_name}" was rejected by ${req.user.full_name}.`,
            type: 'ERROR'
         });
      }
    }

    await deletionReq.save();

    if (deletionReq.status === 'PENDING') {
      await checkDeletionThreshold(deletionReq);
    }

    res.status(200).json({ success: true, message: `Request successfully ${action.toLowerCase()}d` });
  } catch (error) {
    logger.error('Review deletion error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

async function checkDeletionThreshold(deletionReq) {
  const totalAdmins = await User.countDocuments({ role: 'SUPER_ADMIN', status: 'ACTIVE' });
  const requiredApprovals = Math.max(2, Math.ceil(totalAdmins / 2));

  // If there's only 1 admin in the system, they bypass the >2 rule
  const isSoloAdmin = totalAdmins <= 1;

  if (isSoloAdmin || deletionReq.approvals.length >= requiredApprovals) {
    // Approve and Delete
    deletionReq.status = 'APPROVED';
    deletionReq.resolved_at = new Date();
    await deletionReq.save();

    // Check users one last time before hard deletion
    const usersCount = await User.countDocuments({ role: deletionReq.role_name });
    if (usersCount === 0) {
      await Role.findByIdAndDelete(deletionReq.role_id);
      
      const allAdmins = await User.find({ role: 'SUPER_ADMIN', status: 'ACTIVE' });
      for (const admin of allAdmins) {
        await notificationService.sendNotification(admin._id, {
          title: 'Role Deleted',
          message: `The custom role "${deletionReq.role_name}" has been successfully deleted.`,
          type: 'INFO'
        });
      }
    } else {
      // Revert if users were assigned while pending
      deletionReq.status = 'REJECTED';
      await deletionReq.save();
    }
  }
}
