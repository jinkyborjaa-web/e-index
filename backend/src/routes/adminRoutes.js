const express = require('express');
const adminController = require('../controllers/adminController');

const router = express.Router();

router.get('/teachers', adminController.listTeachers);
router.get('/dashboard-stats', adminController.dashboardStats);
router.put('/teachers/:id/approve', adminController.updateTeacherStatus('approved'));
router.put('/teachers/:id/reject', adminController.updateTeacherStatus('rejected'));
router.put('/teachers/:id/deactivate', adminController.updateTeacherStatus('deactivated'));
router.put('/teachers/:id/set-role', adminController.setTeacherRole);
router.delete('/teachers/:id', adminController.deleteTeacher);
router.post('/teachers/:id/reset-password', adminController.resetTeacherPassword);

module.exports = router;