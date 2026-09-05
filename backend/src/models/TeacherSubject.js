const { pool } = require('../config/database');

// Stores and reads the subject/year assignments owned by each teacher.
class TeacherSubject {
    static async addSubjects(teacherId, subjectsArray, db = pool) {
        if (!subjectsArray.length) return;
        const values = subjectsArray.map(({ subject, yearLevel }) => [teacherId, subject, yearLevel]);
        await db.query(
            'INSERT INTO teacher_subjects (teacher_id, subject, year_level) VALUES ?',
            [values]
        );
    }

    static async getSubjectsByTeacher(teacherId) {
        const [rows] = await pool.query(
            'SELECT subject, year_level AS yearLevel FROM teacher_subjects WHERE teacher_id = ? ORDER BY id',
            [teacherId]
        );
        return rows;
    }

    static async belongsToTeacher(teacherId, subject, yearLevel) {
        const [rows] = await pool.query(
            'SELECT id FROM teacher_subjects WHERE teacher_id = ? AND subject = ? AND year_level = ? LIMIT 1',
            [teacherId, subject, yearLevel]
        );
        return rows.length > 0;
    }

    static async getAssignment(teacherId, subject) {
        const [rows] = await pool.query(
            'SELECT subject, year_level AS yearLevel FROM teacher_subjects WHERE teacher_id = ? AND subject = ? LIMIT 1',
            [teacherId, subject]
        );
        return rows[0];
    }

    static yearLevelForYear(year) {
        const suffixes = { 1: 'st', 2: 'nd', 3: 'rd', 4: 'th', 5: 'th' };
        return `${year}${suffixes[year] || 'th'} Year`;
    }
}

module.exports = TeacherSubject;