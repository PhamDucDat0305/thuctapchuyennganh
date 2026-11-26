const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/companies.controller');

const router = express.Router();

router.get('/:id', asyncHandler(controller.getById));

module.exports = router;
