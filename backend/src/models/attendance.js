const { pool } = require('../config/database');

class Attendance {
    static async getByStudentId(studentId, subjectId = null, subjectCode = null, teacherId = null, yearLevel = null) {
        let conn;
        try {
            conn = await pool.getConnection();
            let query = `
                SELECT a.*, s.code as subject_code, s.teacher 
                FROM attendance a
                JOIN subjects s ON a.subject_id = s.id
                WHERE a.student_id = ?
            `;
            let params = [studentId];

            if (teacherId) {
                query += ` AND EXISTS (
                    SELECT 1 FROM teacher_subjects ts
                    WHERE ts.teacher_id = ? AND ts.year_level = ? AND REPLACE(ts.subject, ' ', '') = REPLACE(s.code, ' ', '')
                )`;
                params.push(teacherId);
                params.push(yearLevel);
            }

            if (subjectId) {
                query += ' AND a.subject_id = ?';
                params.push(subjectId);
            }

            if (subjectCode) {
                query += ' AND REPLACE(s.code, \' \', \'\') = REPLACE(?, \' \', \'\')';
                params.push(subjectCode);
            }

            query += ' ORDER BY a.date_time DESC';
            
            const [rows] = await conn.query(query, params);
            
            // Convert BigInt to Number for all rows
            return rows.map(row => ({
                ...row,
                id: Number(row.id),
                student_id: Number(row.student_id),
                subject_id: Number(row.subject_id)
            }));
        } catch (error) {
            throw error;
        } finally {
            if (conn) conn.release();
        }
    }

    static async getSubjects() {
        let conn;
        try {
            conn = await pool.getConnection();
            const [rows] = await conn.query('SELECT * FROM subjects ORDER BY code');
            
            // Convert BigInt to Number for all rows
            return rows.map(row => ({
                ...row,
                id: Number(row.id)
            }));
        } catch (error) {
            throw error;
        } finally {
            if (conn) conn.release();
        }
    }

    static async create(attendanceData) {
        let conn;
        try {
            conn = await pool.getConnection();
            const dateTime = attendanceData.date_time ? attendanceData.date_time : new Date();
            const [result] = await conn.query(
                'INSERT INTO attendance (student_id, subject_id, date_time) VALUES (?, ?, ?)',
                [attendanceData.student_id, attendanceData.subject_id, dateTime]
            );
            // Convert BigInt to Number to avoid JSON serialization issues
            return Number(result.insertId);
        } catch (error) {
            throw error;
        } finally {
            if (conn) conn.release();
        }
    }

    static async delete(id) {
        let conn;
        try {
            conn = await pool.getConnection();
            const [result] = await conn.query(
                'DELETE FROM attendance WHERE id = ?',
                [id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            throw error;
        } finally {
            if (conn) conn.release();
        }
    }
}

module.exports = Attendance; 