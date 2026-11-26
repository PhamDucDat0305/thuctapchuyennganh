const express = require('express');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');
const rateLimit = require('../middleware/rateLimit');
const controller = require('../controllers/invites.controller');

const router = express.Router();
router.use(authenticate, requireRole('candidate', 'employer'));
const limitInviteSend = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  key: (req) => `user:${req.session?.userId || req.ip}`,
  message: 'Bạn đã gửi quá nhiều lời mời. Vui lòng thử lại sau.',
});

router.get('/', requireRole('candidate'), asyncHandler(controller.list));
router.get('/sent', requireRole('employer'), asyncHandler(controller.listSent));
router.get('/connections', requireRole('employer'), asyncHandler(controller.listConnections));
router.delete('/connections/:candidateId', requireRole('employer'), asyncHandler(controller.removeConnection));
router.post('/', requireRole('employer'), limitInviteSend, asyncHandler(controller.create));
router.patch('/:id/status', requireRole('candidate'), asyncHandler(controller.updateStatus));

module.exports = router;
