const { pool } = require('../config/database');

class Teacher {
    static async findByEmail(email) {
        const [rows] = await pool.query(
            'SELECT id, first_name, last_name, staff_id, email, password, terms_accepted, role, status, created_at FROM teachers WHERE email = ?',
            [email]
        );
        return rows[0] || null;
    }

    static async findById(id) {
        const [rows] = await pool.query(
            'SELECT id, first_name, last_name, staff_id, email, terms_accepted, role, status, created_at FROM teachers WHERE id = ?',
            [id]
        );
        return rows[0] || null;
    }

    static async findByIdWithPassword(id) {
        const [rows] = await pool.query(
            'SELECT id, password FROM teachers WHERE id = ?',
            [id]
        );
        return rows[0] || null;
    }

    static async create({ firstName, lastName, staffId, email, password, termsAccepted }) {
        const normalizedFirstName = String(firstName || '').trim();
        const normalizedLastName = String(lastName || '').trim();

        const [result] = await pool.query(
            'INSERT INTO teachers (first_name, last_name, staff_id, email, password, terms_accepted) VALUES (?, ?, ?, ?, ?, ?)',
            [normalizedFirstName, normalizedLastName, staffId, email, password, termsAccepted]
        );
        return result.insertId;
    }

    static async updatePassword(id, password) {
        await pool.query('UPDATE teachers SET password = ? WHERE id = ?', [password, id]);
    }

    static async listAll() {
        const [rows] = await pool.query(
            'SELECT id, first_name, last_name, staff_id, email, role, status, terms_accepted, created_at FROM teachers ORDER BY created_at DESC'
        );
        return rows;
    }

    static async updateStatus(id, status) {
        const [result] = await pool.query('UPDATE teachers SET status = ? WHERE id = ?', [status, id]);
        return result.affectedRows > 0;
    }

    static async updateRole(id, role) {
        const [result] = await pool.query('UPDATE teachers SET role = ? WHERE id = ?', [role, id]);
        return result.affectedRows > 0;
    }

    static async delete(id) {
        const [result] = await pool.query('DELETE FROM teachers WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }
}

module.exports = Teacher;