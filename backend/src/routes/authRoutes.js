const express = require('express');
const authController = require('../controllers/authController');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

// Public authentication endpoints.
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.getMe);
router.get('/my-subjects', requireAuth, authController.getMySubjects);
router.put('/my-subjects', requireAuth, authController.updateMySubjects);
router.put('/change-password', requireAuth, authController.changePassword);

module.exports = router;