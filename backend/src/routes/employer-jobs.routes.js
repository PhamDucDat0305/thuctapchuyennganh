const express = require('express');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/employer-jobs.controller');

const router = express.Router();
router.use(authenticate, requireRole('employer'));

router.get('/', asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.get));
router.post('/', asyncHandler(controller.create));
router.patch('/:id', asyncHandler(controller.update));
router.patch('/:id/close', asyncHandler(controller.close));

module.exports = router;
