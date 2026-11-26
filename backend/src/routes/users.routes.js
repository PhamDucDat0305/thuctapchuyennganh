const express = require('express');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/users.controller');

const router = express.Router();

// Public profile contains only career details and is available only when the
// candidate has opted into discovery. Contact details remain private.
router.get('/:id/public', asyncHandler(controller.getPublicCandidate));

router.use(authenticate, requireRole('candidate', 'employer', 'admin'));

router.get('/candidates', requireRole('employer', 'admin'), asyncHandler(controller.listCandidates));
router.get('/:id', asyncHandler(controller.getById));

module.exports = router;
