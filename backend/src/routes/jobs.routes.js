const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const rateLimit = require('../middleware/rateLimit');
const controller = require('../controllers/jobs.controller');

const router = express.Router();
const limitJobViews = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  message: 'Bạn đã xem quá nhiều tin trong thời gian ngắn. Vui lòng thử lại sau.',
});

router.get('/', asyncHandler(controller.list));
router.post('/:id/view', limitJobViews, asyncHandler(controller.countView));
router.get('/:id', asyncHandler(controller.getById));

module.exports = router;
