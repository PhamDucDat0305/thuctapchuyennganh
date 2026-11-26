const express = require('express');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/interviews.controller');

const router = express.Router();
router.use(authenticate, requireRole('candidate', 'employer', 'admin'));
router.get('/', asyncHandler(controller.list));
router.get('/application/:applicationId', asyncHandler(controller.findForApplication));
router.post('/', requireRole('employer'), asyncHandler(controller.schedule));
router.patch('/:id/decision', requireRole('employer'), asyncHandler(controller.decide));
router.patch('/:id/status', asyncHandler(controller.updateStatus));

module.exports = router;
