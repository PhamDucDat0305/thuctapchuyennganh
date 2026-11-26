const express = require('express');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/me.controller');

const router = express.Router();

router.get('/', authenticate, controller.getCurrent);
router.patch('/profile', authenticate, asyncHandler(controller.updateProfile));
router.post('/password', authenticate, asyncHandler(controller.changePassword));

module.exports = router;
