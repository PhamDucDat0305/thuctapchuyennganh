const express = require('express');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/admin.controller');

const router = express.Router();
router.use(authenticate, requireRole('admin'));
router.get('/overview', asyncHandler(controller.overview));
router.get('/users', asyncHandler(controller.users));
router.patch('/users/:id/lock', asyncHandler(controller.lockUser));
router.get('/jobs', asyncHandler(controller.jobs));
router.patch('/jobs/:id/visibility', asyncHandler(controller.visibility));
router.get('/companies', asyncHandler(controller.companies));
router.patch('/companies/:id/status', asyncHandler(controller.companyStatus));
router.get('/audit-logs', asyncHandler(controller.auditLogs));
router.get('/job-reports', asyncHandler(controller.reports));
router.patch('/job-reports/:id', asyncHandler(controller.updateReport));

module.exports = router;
