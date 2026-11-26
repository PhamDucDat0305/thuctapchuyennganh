const express = require('express');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/employer-company.controller');

const router = express.Router();
router.use(authenticate, requireRole('employer'));

router.get('/', asyncHandler(controller.getMine));
router.post('/logo', express.raw({
  type: ['image/png', 'image/jpeg', 'image/webp'],
  limit: '2mb',
}), asyncHandler(controller.uploadLogo));
router.post('/', asyncHandler(controller.createOrUpdate));
router.put('/', asyncHandler(controller.update));

module.exports = router;
