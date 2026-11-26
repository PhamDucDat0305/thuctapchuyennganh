const express = require('express');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/saved-jobs.controller');

const router = express.Router();
router.use(authenticate, requireRole('candidate'));

router.get('/', asyncHandler(controller.list));
router.get('/check/:jobId', asyncHandler(controller.check));
router.post('/:jobId/toggle', asyncHandler(controller.toggle));
router.delete('/:jobId', asyncHandler(controller.remove));

module.exports = router;
