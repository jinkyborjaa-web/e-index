const { pool } = require('../config/database');

class Student {
    static async findByRFID(rfidTag) {
        let conn;
        try {
            conn = await pool.getConnection();
            const [rows] = await conn.query(
                `SELECT id, student_id, first_name, last_name,
                    first_name AS firstName, last_name AS lastName,
                    CONCAT(first_name, ' ', last_name) AS fullName,
                    rfid_tag, year, section
                 FROM students WHERE rfid_tag = ?`,
                [rfidTag]
            );
            return rows[0];
        } catch (error) {
            throw error;
        } finally {
            if (conn) conn.release();
        }
    }

    static async getAll(section = null, year = null) {
        let conn;
        try {
            conn = await pool.getConnection();
                 let query = `SELECT id, student_id, first_name, last_name,
                            first_name AS firstName, last_name AS lastName,
                            CONCAT(first_name, ' ', last_name) AS fullName,
                            rfid_tag, year, section
                        FROM students`;
            const params = [];
            if (section) {
                query += ' WHERE section = ?';
                params.push(section);
            }
            if (year) {
                query += section ? ' AND year = ?' : ' WHERE year = ?';
                params.push(year);
            }
            query += ' ORDER BY id DESC';
            const [rows] = await conn.query(query, params);
            return rows;
        } catch (error) {
            throw error;
        } finally {
            if (conn) conn.release();
        }
    }

    static async getById(id) {
        let conn;
        try {
            conn = await pool.getConnection();
            const [rows] = await conn.query(
                `SELECT id, student_id, first_name, last_name,
                    first_name AS firstName, last_name AS lastName,
                    CONCAT(first_name, ' ', last_name) AS fullName,
                    rfid_tag, year, section
                 FROM students WHERE id = ?`,
                [id]
            );
            return rows[0];
        } catch (error) {
            throw error;
        } finally {
            if (conn) conn.release();
        }
    }

    static async create(studentData) {
        let conn;
        try {
            conn = await pool.getConnection();
            const [result] = await conn.query(
                'INSERT INTO students (student_id, first_name, last_name, rfid_tag, year, section) VALUES (?, ?, ?, ?, ?, ?)',
                [studentData.student_id, studentData.first_name, studentData.last_name, studentData.rfid_tag, studentData.year, studentData.section]
            );
            return result.insertId;
        } catch (error) {
            throw error;
        } finally {
            if (conn) conn.release();
        }
    }

    static async update(id, studentData) {
        let conn;
        try {
            conn = await pool.getConnection();
            const [result] = await conn.query(
                'UPDATE students SET student_id = ?, first_name = ?, last_name = ?, rfid_tag = ?, year = ?, section = ? WHERE id = ?',
                [studentData.student_id, studentData.first_name, studentData.last_name, studentData.rfid_tag, studentData.year, studentData.section, id]
            );
            return result.affectedRows > 0;
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
                'DELETE FROM students WHERE id = ?',
                [id]
            );
            return result.affectedRows > 0;
        } catch (error) {
            throw error;
        } finally {
            if (conn) conn.release();
        }
    }

    static async getRecords(studentId, category = null, subject = null, teacherId = null) {
        let conn;
        try {
            conn = await pool.getConnection();
            let query = 'SELECT * FROM records WHERE student_id = ?';
            let params = [studentId];

            if (teacherId) {
                query += ` AND EXISTS (
                    SELECT 1 FROM teacher_subjects ts
                    WHERE ts.teacher_id = ? AND REPLACE(ts.subject, ' ', '') = REPLACE(records.subject, ' ', '')
                )`;
                params.push(teacherId);
            }

            if (category && category !== 'all') {
                query += ' AND category = ?';
                params.push(category);
            }

            if (subject && subject !== 'all') {
                query += ' AND subject = ?';
                params.push(subject);
            }

            query += ' ORDER BY date_time DESC';
            
            const [rows] = await conn.query(query, params);
            return rows;
        } catch (error) {
            throw error;
        } finally {
            if (conn) conn.release();
        }
    }
}

module.exports = Student; 