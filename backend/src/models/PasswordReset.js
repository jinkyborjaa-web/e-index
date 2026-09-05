const { pool } = require('../config/database');

// Persists only a hash of each reset token so database access cannot recover reset URLs.
class PasswordReset {
    static async create(teacherId, tokenHash, expiresAt) {
        await pool.query('DELETE FROM password_resets WHERE teacher_id = ?', [teacherId]);
        await pool.query(
            'INSERT INTO password_resets (teacher_id, token_hash, expires_at) VALUES (?, ?, ?)',
            [teacherId, tokenHash, expiresAt]
        );
    }

    static async findValid(tokenHash) {
        const [rows] = await pool.query(
            'SELECT id, teacher_id FROM password_resets WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP()',
            [tokenHash]
        );
        return rows[0] || null;
    }

    static async delete(id) {
        await pool.query('DELETE FROM password_resets WHERE id = ?', [id]);
    }
}

module.exports = PasswordReset;