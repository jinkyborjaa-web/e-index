const Student = require('../models/student');
const TeacherSubject = require('../models/TeacherSubject');

exports.findByRFID = async (req, res) => {
    try {
        const student = await Student.findByRFID(req.params.rfidTag);
        if (student) {
            res.json({ success: true, student });
        } else {
            res.status(404).json({ success: false, message: 'Student not found' });
        }
    } catch (error) {
        console.error('Error in findByRFID:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getAllStudents = async (req, res) => {
    try {
        const { subject, section } = req.query;
        if (!subject) {
            return res.status(400).json({ success: false, message: 'Subject is required' });
        }
        const assignment = await TeacherSubject.getAssignment(req.teacher.id, subject);
        if (!assignment) {
            return res.status(403).json({ success: false, message: 'You are not assigned to this subject' });
        }
        const students = await Student.getAll(section || null, Number.parseInt(assignment.yearLevel, 10));
        
        res.json({ success: true, students });
    } catch (error) {
        console.error('Error in getAllStudents:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getStudentById = async (req, res) => {
    try {
        const student = await Student.getById(req.params.id);
        if (student) {
            res.json({ success: true, student });
        } else {
            res.status(404).json({ success: false, message: 'Student not found' });
        }
    } catch (error) {
        console.error('Error in getStudentById:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getStudentRecords = async (req, res) => {
    try {
        const studentId = req.params.id;
        const category = req.query.category;
        const subject = req.query.subject;
        
        const records = await Student.getRecords(studentId, category, subject, req.teacher.id);
        
        res.json({
            success: true,
            records: records
        });
    } catch (error) {
        console.error('Error getting student records:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get student records'
        });
    }
};

exports.createStudent = async (req, res) => {
    console.log('POST /api/students request body:', req.body);
    try {
        const { studentId, firstName, lastName, rfidTag, year, section } = req.body;
        const firstNameValue = String(firstName || '').trim();
        const lastNameValue = String(lastName || '').trim();
        
        // Basic validation
        if (!studentId || !firstNameValue || !lastNameValue || !rfidTag || !year || !section) {
            return res.status(400).json({ 
                success: false, 
                message: 'All fields are required' 
            });
        }

        // Validate student_id format (00-0000)
        const studentIdPattern = /^\d{2}-\d{4}$/;
        if (!studentIdPattern.test(studentId)) {
            return res.status(400).json({
                success: false,
                message: 'Student ID must be in the format 00-0000'
            });
        }

        // Type validation
        const yearNum = parseInt(year);
        if (isNaN(yearNum) || yearNum < 1 || yearNum > 5) {
            return res.status(400).json({
                success: false,
                message: 'Year must be a number between 1 and 5'
            });
        }

        // Create student with validated data
        const insertId = await Student.create({
            student_id: studentId.trim(),
            first_name: firstNameValue,
            last_name: lastNameValue,
            rfid_tag: rfidTag.trim(),
            year: yearNum,
            section: section.trim()
        });

        res.status(201).json({ 
            success: true, 
            message: 'Student created successfully',
            studentId: Number(insertId) // Convert BigInt to Number
        });
    } catch (error) {
        console.error('Error in createStudent:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ 
                success: false, 
                message: error.message.includes('student_id') ? 'Student ID already exists' : 'RFID tag already exists'
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: error.message || 'Server error' 
            });
        }
    }
};

exports.updateStudent = async (req, res) => {
    try {
        const { studentId: requestStudentId, firstName, lastName, rfidTag, year, section } = req.body;
        const studentId = req.params.id;
        const firstNameValue = String(firstName || '').trim();
        const lastNameValue = String(lastName || '').trim();

        // Basic validation
        if (!requestStudentId || !firstNameValue || !lastNameValue || !rfidTag || !year || !section) {
            return res.status(400).json({ 
                success: false, 
                message: 'All fields are required' 
            });
        }

        // Validate student_id format (00-0000)
        const studentIdPattern = /^\d{2}-\d{4}$/;
        if (!studentIdPattern.test(requestStudentId)) {
            return res.status(400).json({
                success: false,
                message: 'Student ID must be in the format 00-0000'
            });
        }

        const success = await Student.update(studentId, {
            student_id: requestStudentId.trim(),
            first_name: firstNameValue,
            last_name: lastNameValue,
            rfid_tag: rfidTag.trim(),
            year: parseInt(year),
            section: section.trim()
        });

        if (success) {
            res.json({ 
                success: true, 
                message: 'Student updated successfully' 
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: 'Student not found' 
            });
        }
    } catch (error) {
        console.error('Error in updateStudent:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ 
                success: false, 
                message: error.message.includes('student_id') ? 'Student ID already exists' : 'RFID tag already exists'
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: 'Server error' 
            });
        }
    }
};

exports.deleteStudent = async (req, res) => {
    try {
        const success = await Student.delete(req.params.id);
        if (success) {
            res.json({ 
                success: true, 
                message: 'Student deleted successfully' 
            });
        } else {
            res.status(404).json({ 
                success: false, 
                message: 'Student not found' 
            });
        }
    } catch (error) {
        console.error('Error in deleteStudent:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
}; 