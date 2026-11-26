const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const rateLimit = require('../middleware/rateLimit');
const controller = require('../controllers/auth.controller');
const authEmailRoutes = require('./auth-email.routes');

const router = express.Router();
router.use('/email', authEmailRoutes);
const limitRegister = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: 'Bạn đã đăng ký quá nhiều lần. Vui lòng thử lại sau.' });
const limitLogin = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.' });
router.post('/register', limitRegister, asyncHandler(controller.register));
router.post('/login', limitLogin, asyncHandler(controller.login));
router.post('/logout', asyncHandler(controller.logout));

module.exports = router;
