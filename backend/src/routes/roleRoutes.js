const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { authorize } = require('../middleware/auth');

// All role management is restricted to SUPER_ADMIN only
router.use(authorize('SUPER_ADMIN'));

router.get('/', roleController.getRoles);
router.post('/', roleController.createRole);
router.put('/:id', roleController.updateRole);

// Deletion workflow
router.post('/:id/request-deletion', roleController.requestRoleDeletion);
router.get('/deletion-requests', roleController.getDeletionRequests);
router.post('/deletion-requests/:id/review', roleController.reviewDeletionRequest);

module.exports = router;
