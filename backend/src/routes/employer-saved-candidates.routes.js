const express = require('express');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/employer-saved-candidates.controller');

const router = express.Router();
router.use(authenticate, requireRole('employer'));

router.get('/', asyncHandler(controller.list));
router.post('/:candidateId', asyncHandler(controller.save));
router.delete('/:candidateId', asyncHandler(controller.remove));

module.exports = router;
