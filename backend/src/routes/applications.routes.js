const express = require('express');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');
const rateLimit = require('../middleware/rateLimit');
const controller = require('../controllers/applications.controller');

const router = express.Router();
router.use(authenticate, requireRole('candidate', 'employer', 'admin'));

const limitApplications = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  key: (req) => `user:${req.session?.userId || req.ip}`,
  message: 'Bạn đã gửi quá nhiều đơn ứng tuyển trong thời gian ngắn. Vui lòng thử lại sau.',
});

router.get('/', asyncHandler(controller.list));
router.get('/check/:jobId', requireRole('candidate'), asyncHandler(controller.check));
router.get('/job/:jobId', requireRole('employer', 'admin'), asyncHandler(controller.listForJob));
router.post('/', requireRole('candidate'), limitApplications, asyncHandler(controller.create));
router.get('/:id', asyncHandler(controller.get));
router.patch('/:id', requireRole('candidate', 'employer', 'admin'), asyncHandler(controller.updateStatus));
router.delete('/:id', requireRole('candidate'), asyncHandler(controller.withdraw));

module.exports = router;
