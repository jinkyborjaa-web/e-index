const express = require('express');
const router = express.Router();
const {
    getStudentAttendance,
    getSubjects,
    createAttendance,
    deleteAttendance
} = require('../controllers/attendanceController');

// Get all subjects
router.get('/subjects', getSubjects);

// Get student attendance (with optional subject filter)
router.get('/students/:studentId', getStudentAttendance);

// Create attendance record
router.post('/', createAttendance);

// Delete attendance record
router.delete('/:id', deleteAttendance);

module.exports = router; 