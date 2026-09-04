const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');

// Get all students
router.get('/', studentController.getAllStudents);

// Get student by RFID
router.get('/rfid/:rfidTag', studentController.findByRFID);

// Get student by ID
router.get('/:id', studentController.getStudentById);

// Get student records
router.get('/:id/records', studentController.getStudentRecords);

// Create new student
router.post('/', studentController.createStudent);

// Update student
router.put('/:id', studentController.updateStudent);

// Delete student
router.delete('/:id', studentController.deleteStudent);

module.exports = router; 