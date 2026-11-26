const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const rateLimit = require('../middleware/rateLimit');
const controller = require('../controllers/auth-email.controller');

const router = express.Router();
const limitSend = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: 'Bạn đã yêu cầu gửi mã quá nhiều lần. Vui lòng thử lại sau.' });
const limitVerify = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Bạn đã xác minh quá nhiều lần. Vui lòng thử lại sau.' });
router.post('/send-code', limitSend, asyncHandler(controller.sendCode));
router.post('/verify-code', limitVerify, asyncHandler(controller.verifyCode));

module.exports = router;
