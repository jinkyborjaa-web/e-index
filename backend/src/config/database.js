const fs = require('fs');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Use Aiven cloud MySQL credentials from .env.
// HeidiSQL is only a client for these same values.
const sslConfig = {};
const sslEnabled = process.env.DB_SSL !== 'false' && process.env.DB_SSL !== '0' && process.env.DB_SSL !== 'no';
const sslCaPath = process.env.DB_SSL_CA_PATH;

if (sslEnabled) {
    if (sslCaPath) {
        const caFullPath = path.resolve(__dirname, '../../', sslCaPath);
        if (fs.existsSync(caFullPath)) {
            sslConfig.ca = fs.readFileSync(caFullPath, 'utf8');
        } else {
            console.warn(`SSL CA file not found at ${caFullPath}; using a permissive TLS setting instead.`);
        }
    }

    const rejectUnauthorizedValue = process.env.DB_SSL_REJECT_UNAUTHORIZED;
    sslConfig.rejectUnauthorized = rejectUnauthorizedValue === undefined
        ? false
        : rejectUnauthorizedValue !== 'false' && rejectUnauthorizedValue !== '0' && rejectUnauthorizedValue !== 'no';
}

const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    ssl: sslEnabled ? sslConfig : false
};

const pool = mysql.createPool(dbConfig);

async function migrateLegacyTeacherSubjects() {
    const [subjectColumns] = await pool.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teachers' AND COLUMN_NAME = 'subject'");
    const [yearColumns] = await pool.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teachers' AND COLUMN_NAME = 'year_level'");

    if (subjectColumns.length) {
        const yearExpression = yearColumns.length ? "COALESCE(NULLIF(year_level, ''), '1st Year')" : "'1st Year'";
        await pool.query(`INSERT IGNORE INTO teacher_subjects (teacher_id, subject, year_level) SELECT id, subject, ${yearExpression} FROM teachers WHERE subject IS NOT NULL AND subject <> ''`);
        await pool.query('ALTER TABLE teachers DROP COLUMN subject');
    }
    if (yearColumns.length) await pool.query('ALTER TABLE teachers DROP COLUMN year_level');
}

async function initializeDatabase() {
    const statements = [
        `CREATE TABLE IF NOT EXISTS teachers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            staff_id VARCHAR(50) NOT NULL DEFAULT '',
            institution_name VARCHAR(150) NOT NULL DEFAULT '',
            phone_number VARCHAR(30) NOT NULL DEFAULT '',
            email VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
            role VARCHAR(20) NOT NULL DEFAULT 'teacher',
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS password_resets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            teacher_id INT NOT NULL,
            token_hash CHAR(64) NOT NULL UNIQUE,
            expires_at DATETIME NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS teacher_subjects (
            id INT AUTO_INCREMENT PRIMARY KEY,
            teacher_id INT NOT NULL,
            subject VARCHAR(100) NOT NULL,
            year_level VARCHAR(20) NOT NULL,
            FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
            UNIQUE KEY unique_teacher_subject (teacher_id, subject, year_level)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS students (
            id INT AUTO_INCREMENT PRIMARY KEY,
            student_id VARCHAR(8) NOT NULL UNIQUE,
            first_name VARCHAR(100) NULL,
            last_name VARCHAR(100) NULL,
            rfid_tag VARCHAR(50) NOT NULL UNIQUE,
            course VARCHAR(50) NULL DEFAULT 'BSIT',
            year INT NOT NULL,
            section VARCHAR(20) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT chk_student_id_format CHECK (student_id REGEXP '^[0-9]{2}-[0-9]{4}$')
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS subjects (
            id INT AUTO_INCREMENT PRIMARY KEY,
            code VARCHAR(10) NOT NULL,
            teacher VARCHAR(100) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS subjects_master (
            id INT AUTO_INCREMENT PRIMARY KEY,
            subject_name VARCHAR(100) NOT NULL,
            year_level VARCHAR(20) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_master_subject_year (subject_name, year_level)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS records (
            id INT AUTO_INCREMENT PRIMARY KEY,
            student_id INT NOT NULL,
            category ENUM('quizzes', 'exams', 'activities') NOT NULL,
            record_number INT NOT NULL,
            items INT NOT NULL,
            score FLOAT NOT NULL,
            subject ENUM('IT223', 'IT221') NOT NULL,
            date_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
            UNIQUE KEY category_number (student_id, category, record_number, subject)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS attendance (
            id INT AUTO_INCREMENT PRIMARY KEY,
            student_id INT NOT NULL,
            subject_id INT NOT NULL,
            date_time DATETIME NOT NULL,
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
            FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS audit_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            actor_id INT NOT NULL,
            actor_name VARCHAR(100) NOT NULL,
            action VARCHAR(255) NOT NULL,
            target_type VARCHAR(50),
            target_id VARCHAR(50),
            details TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    ];

    const ensureColumnExists = async (tableName, columnName, definition, positionClause = '') => {
        const [columns] = await pool.query(`SHOW COLUMNS FROM ${tableName} LIKE '${columnName}'`);
        if (columns.length === 0) {
            const alterSql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}${positionClause ? ` ${positionClause}` : ''}`;
            await pool.query(alterSql);
        }
    };

    for (const statement of statements) {
        await pool.query(statement);
    }

    const [courseColumn] = await pool.query(
        `SHOW COLUMNS FROM students LIKE 'course'`
    );
    if (courseColumn.length > 0) {
        await pool.query(
            `ALTER TABLE students MODIFY COLUMN course VARCHAR(50) NULL DEFAULT 'BSIT'`
        );
    }

    await ensureColumnExists('records', 'item_description', 'VARCHAR(255) NULL', 'AFTER category');
    await ensureColumnExists('students', 'first_name', 'VARCHAR(100) NULL');
    await ensureColumnExists('students', 'last_name', 'VARCHAR(100) NULL');

    const [legacyStudentNameColumn] = await pool.query(
        `SHOW COLUMNS FROM students LIKE 'name'`
    );
    if (legacyStudentNameColumn.length > 0) {
        await pool.query(
            `ALTER TABLE students MODIFY COLUMN name VARCHAR(100) NULL`
        );
    }

    await ensureColumnExists('teachers', 'name', 'VARCHAR(100) NOT NULL DEFAULT \'\'');
    await ensureColumnExists('teachers', 'first_name', 'VARCHAR(100) NOT NULL DEFAULT \'\'', 'AFTER name');
    await ensureColumnExists('teachers', 'last_name', 'VARCHAR(100) NOT NULL DEFAULT \'\'', 'AFTER first_name');
    await ensureColumnExists('teachers', 'institution_name', 'VARCHAR(150) NOT NULL DEFAULT \'\'', 'AFTER name');
    await ensureColumnExists('teachers', 'staff_id', 'VARCHAR(50) NOT NULL DEFAULT \'\'', 'AFTER name');
    await ensureColumnExists('teachers', 'phone_number', 'VARCHAR(30) NOT NULL DEFAULT \'\'', 'AFTER institution_name');
    await ensureColumnExists('teachers', 'terms_accepted', 'BOOLEAN NOT NULL DEFAULT FALSE', 'AFTER password');
    await ensureColumnExists('teachers', 'role', "VARCHAR(20) NOT NULL DEFAULT 'teacher'", 'AFTER terms_accepted');
    await ensureColumnExists('teachers', 'status', "VARCHAR(20) NOT NULL DEFAULT 'pending'", 'AFTER role');
    await pool.query(
        `UPDATE teachers
         SET name = TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))
         WHERE name IS NULL OR TRIM(name) = ''`
    );

    await pool.query(
        `INSERT IGNORE INTO subjects_master (subject_name, year_level) VALUES
        ('Comp 111', '1st Year'), ('Comp 112', '1st Year'), ('IT 111', '1st Year'),
        ('IT 121', '1st Year'), ('Comp 121', '1st Year'), ('Comp 122', '1st Year'),
        ('IT 211', '2nd Year'), ('IT 212', '2nd Year'), ('Comp 211', '2nd Year'),
        ('Comp 212', '2nd Year'), ('IT 221', '2nd Year'), ('IT 222', '2nd Year'),
        ('IT 223', '2nd Year'), ('Comp 221', '2nd Year')`
    );

    await migrateLegacyTeacherSubjects();
}

async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('Database connection successful');
        connection.release();
        return true;
    } catch (error) {
        console.error('Database connection failed:', error.message || error);
        return false;
    }
}

module.exports = {
    pool,
    initializeDatabase,
    testConnection
}; 