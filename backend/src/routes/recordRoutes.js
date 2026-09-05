const express = require('express');
const router = express.Router();
const recordController = require('../controllers/recordController');

// Get student records
router.get('/:studentId/records', recordController.getStudentRecords);

// Get single record
router.get('/:studentId/records/:id', recordController.getRecord);

// Create new record
router.post('/:studentId/records', recordController.createRecord);

// Update record
router.put('/:studentId/records/:id', recordController.updateRecord);

// Delete record
router.delete('/:studentId/records/:id', recordController.deleteRecord);

module.exports = router; 