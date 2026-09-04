const bcrypt = require('bcryptjs');
const { pool } = require('./src/config/database');

const targetEmail = 'jinkyborjaa@gmail.com';
const password = 'password';

async function resetAdminPassword() {
    try {
        const passwordHash = await bcrypt.hash(password, 12);
        const [result] = await pool.query(
            `UPDATE teachers
             SET password = ?,
                 role = 'admin',
                 status = 'approved',
                 first_name = 'Jinky',
                 last_name = 'Borja',
                 name = 'Jinky Borja'
             WHERE email = ?`,
            [passwordHash, targetEmail]
        );

        if (result.affectedRows === 0) {
            throw new Error(`No teacher account found for ${targetEmail}`);
        }

        console.log(`Password reset and account repaired successfully for ${targetEmail}.`);

        const [rows] = await pool.query(
            'SELECT id, email, role, status, first_name, last_name, name FROM teachers WHERE email = ?',
            [targetEmail]
        );
        console.log('Resulting row:', rows[0]);
    } finally {
        await pool.end();
    }
}

resetAdminPassword().catch(error => {
    console.error('Failed to reset admin password:', error.message || error);
    process.exitCode = 1;
});
