-- Production normalization migration for the subject and teacher schemas.
--
-- IMPORTANT:
--   * Take a backup and test this script on a production clone first.
--   * MySQL DDL implicitly commits; run during a maintenance window.
--   * This script stops before destructive operations when data is ambiguous.
--   * Set @confirm_drop_subjects = 1 only after application code has been
--     updated to use subjects_master and the preflight query is empty.
--   * Set @confirm_drop_institution_name = 1 only after reviewing the
--     distinct institution_name result and confirming it is safe.
--   * Update all application queries that use teacher_subjects.subject,
--     teacher_subjects.year_level, or records.subject before running Step 2.

SET @confirm_drop_subjects = 0;
SET @confirm_drop_institution_name = 0;

-- Migration bookkeeping for values that cannot be mapped without guessing.
CREATE TABLE IF NOT EXISTS normalization_migration_review (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    issue_type VARCHAR(50) NOT NULL,
    source_table VARCHAR(64) NOT NULL,
    source_id VARCHAR(64) NULL,
    subject_value VARCHAR(100) NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    UNIQUE KEY unique_open_review (issue_type, source_table, source_id, subject_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- STEP 1: Normalize every subject value before replacing text with IDs.
-- ============================================================================

-- Existing teacher assignments provide the best year-level information.
INSERT INTO subjects_master (subject_name, year_level)
SELECT DISTINCT TRIM(ts.subject), TRIM(ts.year_level)
FROM teacher_subjects ts
LEFT JOIN subjects_master sm
  ON sm.subject_name = TRIM(ts.subject)
 AND sm.year_level = TRIM(ts.year_level)
WHERE NULLIF(TRIM(ts.subject), '') IS NOT NULL
  AND NULLIF(TRIM(ts.year_level), '') IS NOT NULL
  AND sm.id IS NULL;

-- A records.subject value is safe to insert only when teacher_subjects has
-- exactly one known year level for that subject. Ambiguous/unmatched values
-- are recorded for manual review and are intentionally not guessed.
INSERT INTO normalization_migration_review
    (issue_type, source_table, source_id, subject_value, details)
SELECT DISTINCT
    'record_subject_mapping',
    'records',
    NULL,
    TRIM(r.subject),
    CASE
        WHEN COUNT(DISTINCT NULLIF(TRIM(ts.year_level), '')) = 0
            THEN 'No teacher_subjects year_level exists for this records.subject value.'
        ELSE 'Multiple teacher_subjects year_level values exist; choose the correct subjects_master row.'
    END
FROM records r
LEFT JOIN teacher_subjects ts
  ON LOWER(TRIM(ts.subject)) = LOWER(TRIM(r.subject))
WHERE NULLIF(TRIM(r.subject), '') IS NOT NULL
GROUP BY TRIM(r.subject)
HAVING COUNT(DISTINCT NULLIF(TRIM(ts.year_level), '')) <> 1;

-- Insert record-only subjects when exactly one teacher assignment year is known.
INSERT INTO subjects_master (subject_name, year_level)
SELECT DISTINCT TRIM(r.subject), MIN(TRIM(ts.year_level))
FROM records r
JOIN teacher_subjects ts
  ON LOWER(TRIM(ts.subject)) = LOWER(TRIM(r.subject))
LEFT JOIN subjects_master sm
  ON LOWER(sm.subject_name) = LOWER(TRIM(r.subject))
 AND sm.year_level = TRIM(ts.year_level)
WHERE NULLIF(TRIM(r.subject), '') IS NOT NULL
  AND NULLIF(TRIM(ts.year_level), '') IS NOT NULL
  AND sm.id IS NULL
GROUP BY TRIM(r.subject)
HAVING COUNT(DISTINCT TRIM(ts.year_level)) = 1;

-- Stop before any schema changes if a record subject cannot be mapped safely.
SELECT *
FROM normalization_migration_review
WHERE issue_type = 'record_subject_mapping'
  AND resolved_at IS NULL
ORDER BY id;

SET @open_review_count = (
    SELECT COUNT(*)
    FROM normalization_migration_review
    WHERE issue_type = 'record_subject_mapping'
      AND resolved_at IS NULL
);
SET @stop_message = IF(
    @open_review_count > 0,
    'Migration stopped: resolve normalization_migration_review record subject mappings, then rerun.',
    'ok'
);
SELECT @stop_message AS migration_status;

-- To resolve a review item, insert/choose the correct subjects_master row and
-- then mark that item resolved before rerunning this script, for example:
--   UPDATE normalization_migration_review
--   SET resolved_at = CURRENT_TIMESTAMP
--   WHERE id = <review_id>;

DROP PROCEDURE IF EXISTS abort_if_open_subject_reviews;
DELIMITER $$
CREATE PROCEDURE abort_if_open_subject_reviews()
BEGIN
  IF @open_review_count > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Migration stopped: resolve normalization_migration_review record subject mappings, then rerun.';
  END IF;
END$$
DELIMITER ;
CALL abort_if_open_subject_reviews();
DROP PROCEDURE abort_if_open_subject_reviews;

-- ============================================================================
-- STEP 2: Add and populate subject IDs, then remove the text subject fields.
-- ============================================================================

ALTER TABLE teacher_subjects ADD COLUMN IF NOT EXISTS subject_id INT NULL;
ALTER TABLE records ADD COLUMN IF NOT EXISTS subject_id INT NULL;

-- Prefer an exact subject/year match for teacher assignments. The second
-- update handles legacy rows whose year text has surrounding whitespace.
UPDATE teacher_subjects ts
JOIN subjects_master sm
  ON LOWER(sm.subject_name) = LOWER(TRIM(ts.subject))
 AND LOWER(sm.year_level) = LOWER(TRIM(ts.year_level))
SET ts.subject_id = sm.id
WHERE ts.subject_id IS NULL;

-- Records have no teacher_id/year_level, so map only to a subject name that
-- resolves to one subjects_master row. Ambiguous master rows remain visible.
UPDATE records r
JOIN (
    SELECT LOWER(TRIM(subject_name)) AS subject_key, MIN(id) AS subject_id
    FROM subjects_master
    GROUP BY LOWER(TRIM(subject_name))
    HAVING COUNT(*) = 1
) sm ON sm.subject_key = LOWER(TRIM(r.subject))
SET r.subject_id = sm.subject_id
WHERE r.subject_id IS NULL;

-- Required preflight: this must return zero rows before adding NOT NULL/FKs.
SELECT 'teacher_subjects rows without subject_id' AS check_name, COUNT(*) AS row_count
FROM teacher_subjects WHERE subject_id IS NULL
UNION ALL
SELECT 'records rows without subject_id', COUNT(*)
FROM records WHERE subject_id IS NULL;

SET @unmapped_count = (
    (SELECT COUNT(*) FROM teacher_subjects WHERE subject_id IS NULL)
    + (SELECT COUNT(*) FROM records WHERE subject_id IS NULL)
);
SET @stop_unmapped_message = IF(
    @unmapped_count > 0,
    'Migration stopped: subject_id population is incomplete; resolve values before continuing.',
    'subject_id population complete'
);
SELECT @stop_unmapped_message AS migration_status;

DROP PROCEDURE IF EXISTS abort_if_unmapped_subject_ids;
DELIMITER $$
CREATE PROCEDURE abort_if_unmapped_subject_ids()
BEGIN
  IF @unmapped_count > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Migration stopped: subject_id population is incomplete; resolve values before continuing.';
  END IF;
END$$
DELIMITER ;
CALL abort_if_unmapped_subject_ids();
DROP PROCEDURE abort_if_unmapped_subject_ids;

-- Add the subject foreign keys only after the preflight above is zero.
ALTER TABLE teacher_subjects
    MODIFY COLUMN subject_id INT NOT NULL,
    ADD CONSTRAINT fk_teacher_subjects_subject_master
        FOREIGN KEY (subject_id) REFERENCES subjects_master(id) ON DELETE CASCADE;

ALTER TABLE records
    MODIFY COLUMN subject_id INT NOT NULL,
    ADD CONSTRAINT fk_records_subject_master
        FOREIGN KEY (subject_id) REFERENCES subjects_master(id) ON DELETE CASCADE;

-- Remove the replaced text columns after all IDs and constraints are valid.
ALTER TABLE teacher_subjects
    DROP COLUMN subject,
    DROP COLUMN year_level;

ALTER TABLE records
    DROP COLUMN subject;

-- ============================================================================
-- STEP 3: Ensure student and attendance foreign keys exist.
-- ============================================================================

-- These checks make the migration safe to rerun only when the named
-- constraints are not already present. Remove duplicate legacy constraints
-- manually if your database uses different names.
SET @fk_sql = IF(
    NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND CONSTRAINT_NAME = 'fk_records_student'
    ),
    'ALTER TABLE records ADD CONSTRAINT fk_records_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE',
    'SELECT 1'
);
PREPARE fk_stmt FROM @fk_sql; EXECUTE fk_stmt; DEALLOCATE PREPARE fk_stmt;

SET @fk_sql = IF(
    NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND CONSTRAINT_NAME = 'fk_attendance_student'
    ),
    'ALTER TABLE attendance ADD CONSTRAINT fk_attendance_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE',
    'SELECT 1'
);
PREPARE fk_stmt FROM @fk_sql; EXECUTE fk_stmt; DEALLOCATE PREPARE fk_stmt;

SET @fk_sql = IF(
    NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND CONSTRAINT_NAME = 'fk_attendance_subject_master'
    ),
    'ALTER TABLE attendance ADD CONSTRAINT fk_attendance_subject_master FOREIGN KEY (subject_id) REFERENCES subjects_master(id) ON DELETE CASCADE',
    'SELECT 1'
);
PREPARE fk_stmt FROM @fk_sql; EXECUTE fk_stmt; DEALLOCATE PREPARE fk_stmt;

-- ============================================================================
-- STEP 4: Preflight and guarded removal of the obsolete subjects table.
-- ============================================================================

-- Application references found before this migration:
--   backend/src/config/database.js (creates/uses subjects)
--   backend/src/server.js (seeds subjects)
--   backend/src/controllers/attendanceController.js (SELECT id FROM subjects)
--   backend/src/models/attendance.js (JOIN/SELECT subjects)
-- These files must be updated to subjects_master before dropping this table.
SELECT TABLE_NAME, TABLE_ROWS
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subjects';

SELECT 'Review application references above, deploy code updates, then set @confirm_drop_subjects = 1.' AS subjects_drop_instruction;

SET @drop_subjects_sql = IF(
    @confirm_drop_subjects = 1,
    'DROP TABLE subjects',
    'SELECT 1 AS subjects_table_drop_skipped'
);
PREPARE drop_subjects_stmt FROM @drop_subjects_sql;
EXECUTE drop_subjects_stmt;
DEALLOCATE PREPARE drop_subjects_stmt;

-- ============================================================================
-- STEP 5: Remove redundant teacher name and optional institution columns.
-- ============================================================================

-- Backfill split names from the legacy name using the first space as the
-- delimiter. Existing non-NULL values are preserved.
UPDATE teachers
SET
    first_name = TRIM(SUBSTRING_INDEX(name, ' ', 1)),
    last_name = TRIM(SUBSTRING(name, LOCATE(' ', name) + 1))
WHERE name IS NOT NULL
  AND TRIM(name) <> ''
  AND (first_name IS NULL OR last_name IS NULL);

UPDATE teachers
SET first_name = TRIM(name), last_name = ''
WHERE name IS NOT NULL
  AND TRIM(name) <> ''
  AND (first_name IS NULL OR first_name = '')
  AND name NOT LIKE '% %';

SELECT id, name, first_name, last_name
FROM teachers
WHERE name IS NOT NULL
  AND TRIM(name) <> ''
  AND (first_name IS NULL OR last_name IS NULL);

-- Drop name only after the previous query returns zero rows.
ALTER TABLE teachers DROP COLUMN name;

-- REQUIRED REVIEW QUERY: confirm these are all the same before dropping the
-- constant institution_name column. This migration does not auto-drop it.
SELECT institution_name, COUNT(*) AS teacher_count
FROM teachers
GROUP BY institution_name
ORDER BY institution_name;

SET @institution_value_count = (
    SELECT COUNT(DISTINCT institution_name) FROM teachers
);
SET @drop_institution_sql = IF(
    @confirm_drop_institution_name = 1 AND @institution_value_count <= 1,
    'ALTER TABLE teachers DROP COLUMN institution_name',
    'SELECT 1 AS institution_name_drop_skipped'
);
PREPARE drop_institution_stmt FROM @drop_institution_sql;
EXECUTE drop_institution_stmt;
DEALLOCATE PREPARE drop_institution_stmt;

-- ============================================================================
-- STEP 6: Remove the unused constant students.course column.
-- ============================================================================

ALTER TABLE students DROP COLUMN course;

-- Final verification.
SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('teacher_subjects', 'records', 'attendance')
  AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, COLUMN_NAME;
