const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/test.controller');

const router = express.Router();

router.get('/', asyncHandler(controller.checkDatabase));

module.exports = router;
