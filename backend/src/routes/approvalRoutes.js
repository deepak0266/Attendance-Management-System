const express = require('express');
const router = express.Router();
const approvalController = require('../controllers/approvalController');
const { authMiddleware, checkPermission } = require('../middleware/auth');
const { canApproveRequest } = require('../middleware/rbac');
const { 
  validate, 
  validateRegularization, 
  validateId, 
  validatePagination 
} = require('../middleware/validation');

// @route   GET /api/approvals/pending
// @desc    Get pending approvals
// @access  Private (Manager, HR, Super Admin)
router.get(
  '/pending',
  authMiddleware,
  validate(validatePagination),
  approvalController.getPendingApprovals
);

// @route   GET /api/approvals/history
// @desc    Get approval history
// @access  Private
router.get(
  '/history',
  authMiddleware,
  validate(validatePagination),
  approvalController.getApprovalHistory
);

// @route   GET /api/approvals/stats
// @desc    Get approval statistics
// @access  Private (Manager, HR, Super Admin)
router.get(
  '/stats',
  authMiddleware,
  approvalController.getApprovalStats
);

// @route   GET /api/approvals/:id
// @desc    Get single approval request
// @access  Private
router.get(
  '/:id',
  authMiddleware,
  validate(validateId),
  approvalController.getApprovalRequest
);

// @route   POST /api/approvals/regularization
// @desc    Create regularization request
// @access  Private (Employee)
router.post(
  '/regularization',
  authMiddleware,
  validate(validateRegularization),
  approvalController.createRegularization
);

// @route   POST /api/approvals/:id/approve
// @desc    Approve request
// @access  Private (Manager, HR, Super Admin)
router.post(
  '/:id/approve',
  authMiddleware,
  canApproveRequest,
  validate(validateId),
  approvalController.approveRequest
);

// @route   POST /api/approvals/:id/reject
// @desc    Reject request
// @access  Private (Manager, HR, Super Admin)
router.post(
  '/:id/reject',
  authMiddleware,
  canApproveRequest,
  validate(validateId),
  approvalController.rejectRequest
);

// @route   POST /api/approvals/:id/escalate
// @desc    Escalate request to HR
// @access  Private (Manager)
router.post(
  '/:id/escalate',
  authMiddleware,
  validate(validateId),
  approvalController.escalateRequest
);

// @route   POST /api/approvals/:id/cancel
// @desc    Cancel request
// @access  Private (Employee)
router.post(
  '/:id/cancel',
  authMiddleware,
  validate(validateId),
  approvalController.cancelRequest
);

// @route   POST /api/approvals/bulk-approve
// @desc    Bulk approve requests
// @access  Private (Manager, HR, Super Admin)
router.post(
  '/bulk-approve',
  authMiddleware,
  checkPermission('approve_requests'),
  approvalController.bulkApprove
);

// @route   GET /api/approvals/type/:type
// @desc    Get approvals by type
// @access  Private
router.get(
  '/type/:type',
  authMiddleware,
  async (req, res, next) => {
    req.query.type = req.params.type;
    next();
  },
  approvalController.getPendingApprovals
);

// @route   GET /api/approvals/user/:userId
// @desc    Get approvals for specific user
// @access  Private (Manager, HR, Super Admin)
router.get(
  '/user/:userId',
  authMiddleware,
  async (req, res, next) => {
    req.query.user_id = req.params.userId;
    next();
  },
  approvalController.getApprovalHistory
);

module.exports = router;