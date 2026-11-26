const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/stats.controller');

const router = express.Router();

router.get('/', asyncHandler(controller.getOverview));

module.exports = router;
