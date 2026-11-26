const express = require('express');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/profile-views.controller');

const router = express.Router();
router.use(authenticate, requireRole('candidate', 'employer'));

router.get('/', requireRole('candidate'), asyncHandler(controller.list));
router.post('/', requireRole('employer'), asyncHandler(controller.record));

module.exports = router;
