const express = require('express');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');
const rateLimit = require('../middleware/rateLimit');
const controller = require('../controllers/job-reports.controller');

const router = express.Router();
router.use(authenticate, requireRole('candidate'));
const limitReports = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  key: (req) => `user:${req.user.id}`,
  message: 'Bạn đã gửi quá nhiều phản ánh. Vui lòng thử lại sau.',
});

router.post('/', limitReports, asyncHandler(controller.create));

module.exports = router;
