-- Create the teacher account table with split-name fields while preserving the legacy combined name field.
CREATE TABLE IF NOT EXISTS teachers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL DEFAULT '',
    first_name VARCHAR(50) NULL,
    last_name VARCHAR(50) NULL,
    staff_id VARCHAR(50) NOT NULL DEFAULT '',
    institution_name VARCHAR(150) NOT NULL DEFAULT '',
    phone_number VARCHAR(30) NOT NULL DEFAULT '',
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    role VARCHAR(20) NOT NULL DEFAULT 'teacher',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE teachers ADD COLUMN IF NOT EXISTS first_name VARCHAR(50) NULL AFTER name;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS last_name VARCHAR(50) NULL AFTER first_name;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS institution_name VARCHAR(150) NOT NULL DEFAULT '' AFTER last_name;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS staff_id VARCHAR(50) NOT NULL DEFAULT '' AFTER name;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30) NOT NULL DEFAULT '' AFTER institution_name;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN NOT NULL DEFAULT FALSE AFTER password;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'teacher' AFTER terms_accepted;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending' AFTER role;

-- Backfill the new columns from the legacy combined name column when possible.
UPDATE teachers
SET
    first_name = TRIM(SUBSTRING_INDEX(name, ' ', 1)),
    last_name = TRIM(SUBSTRING(name, LOCATE(' ', name) + 1))
WHERE first_name IS NULL AND last_name IS NULL AND name IS NOT NULL AND name <> '' AND name LIKE '% %';

UPDATE teachers
SET first_name = TRIM(name), last_name = ''
WHERE first_name IS NULL AND last_name IS NULL AND name IS NOT NULL AND name <> '' AND name NOT LIKE '% %';

CREATE TABLE IF NOT EXISTS password_resets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teacher_subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    teacher_id INT NOT NULL,
    subject VARCHAR(100) NOT NULL,
    year_level VARCHAR(20) NOT NULL,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_teacher_subject (teacher_id, subject, year_level)
);

CREATE TABLE IF NOT EXISTS subjects_master (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subject_name VARCHAR(100) NOT NULL,
    year_level VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_master_subject_year (subject_name, year_level)
);

INSERT IGNORE INTO subjects_master (subject_name, year_level) VALUES
('Comp 111', '1st Year'), ('Comp 112', '1st Year'), ('IT 111', '1st Year'),
('IT 121', '1st Year'), ('Comp 121', '1st Year'), ('Comp 122', '1st Year'),
('IT 211', '2nd Year'), ('IT 212', '2nd Year'), ('Comp 211', '2nd Year'),
('Comp 212', '2nd Year'), ('IT 221', '2nd Year'), ('IT 222', '2nd Year'),
('IT 223', '2nd Year'), ('Comp 221', '2nd Year');

CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    actor_id INT NOT NULL,
    actor_name VARCHAR(100) NOT NULL,
    action VARCHAR(255) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(50),
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Migrate legacy assignments before dropping the old columns.
SET @has_legacy_subject = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teachers' AND COLUMN_NAME = 'subject'
);
SET @has_legacy_year = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teachers' AND COLUMN_NAME = 'year_level'
);
SET @copy_legacy_sql = IF(
    @has_legacy_subject = 1,
    IF(@has_legacy_year = 1,
        'INSERT IGNORE INTO teacher_subjects (teacher_id, subject, year_level) SELECT id, subject, COALESCE(NULLIF(year_level, ''''), ''1st Year'') FROM teachers WHERE subject IS NOT NULL AND subject <> ''''',
        'INSERT IGNORE INTO teacher_subjects (teacher_id, subject, year_level) SELECT id, subject, ''1st Year'' FROM teachers WHERE subject IS NOT NULL AND subject <> '''''
    ),
    'SELECT 1'
);
PREPARE copy_legacy FROM @copy_legacy_sql;
EXECUTE copy_legacy;
DEALLOCATE PREPARE copy_legacy;

SET @drop_legacy_subject_sql = IF(@has_legacy_subject = 1, 'ALTER TABLE teachers DROP COLUMN subject', 'SELECT 1');
PREPARE drop_legacy_subject FROM @drop_legacy_subject_sql;
EXECUTE drop_legacy_subject;
DEALLOCATE PREPARE drop_legacy_subject;

SET @drop_legacy_year_sql = IF(@has_legacy_year = 1, 'ALTER TABLE teachers DROP COLUMN year_level', 'SELECT 1');
PREPARE drop_legacy_year FROM @drop_legacy_year_sql;
EXECUTE drop_legacy_year;
DEALLOCATE PREPARE drop_legacy_year;

CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NULL,
    first_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NULL,
    rfid_tag VARCHAR(50) UNIQUE NOT NULL,
    course VARCHAR(50) NULL DEFAULT 'BSIT',
    year INT NOT NULL,
    section VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE students MODIFY COLUMN course VARCHAR(50) NULL DEFAULT 'BSIT';

CREATE TABLE IF NOT EXISTS subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subject_code VARCHAR(20) UNIQUE NOT NULL,
    subject_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS academic_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    subject_id INT NOT NULL,
    category ENUM('quizzes', 'exams', 'activities') NOT NULL,
    record_number INT NOT NULL,
    items INT NOT NULL,
    score INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attendance_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    subject_id INT NOT NULL,
    date_time DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);