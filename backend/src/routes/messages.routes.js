const express = require('express');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');
const rateLimit = require('../middleware/rateLimit');
const controller = require('../controllers/messages.controller');

const router = express.Router();
router.use(authenticate, requireRole('candidate', 'employer'));
const limitMessageSend = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  key: (req) => `user:${req.session?.userId || req.ip}`,
  message: 'Bạn đang gửi tin quá nhanh. Vui lòng thử lại sau.',
});
router.get('/conversations', asyncHandler(controller.conversations));
router.get('/conversation/:contactId', asyncHandler(controller.conversation));
router.post('/', limitMessageSend, asyncHandler(controller.send));
router.patch('/read/:contactId', asyncHandler(controller.markRead));

module.exports = router;
