const express = require('express');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/candidate-content.controller');

const router = express.Router();
router.use(authenticate, requireRole('candidate', 'employer', 'admin'));

router.get('/cvs', requireRole('candidate'), asyncHandler(controller.listCvs));
router.post('/cvs', requireRole('candidate'), express.raw({ type: () => true, limit: '10mb' }), asyncHandler(controller.uploadCv));
router.patch('/cvs/:id/default', requireRole('candidate'), asyncHandler(controller.setDefaultCv));
router.delete('/cvs/:id', requireRole('candidate'), asyncHandler(controller.deleteCv));
router.get('/cvs/:id/file', asyncHandler(controller.downloadCv));

router.get('/cover-letters', requireRole('candidate'), asyncHandler(controller.listCoverLetters));
router.post('/cover-letters', requireRole('candidate'), asyncHandler(controller.createCoverLetter));
router.put('/cover-letters/:id', requireRole('candidate'), asyncHandler(controller.updateCoverLetter));
router.delete('/cover-letters/:id', requireRole('candidate'), asyncHandler(controller.deleteCoverLetter));

module.exports = router;
