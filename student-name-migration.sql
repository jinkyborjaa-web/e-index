-- Step 1: Add the new nullable name columns.
ALTER TABLE students
  ADD COLUMN first_name VARCHAR(100) NULL,
  ADD COLUMN last_name VARCHAR(100) NULL;

ALTER TABLE students MODIFY COLUMN name VARCHAR(255) NULL;

-- Step 2: Preview the proposed split before changing any existing data.
SELECT
  id,
  name AS current_name,
  SUBSTRING_INDEX(TRIM(name), ' ', 1) AS proposed_first_name,
  CASE
    WHEN LOCATE(' ', TRIM(name)) > 0
    THEN NULLIF(TRIM(SUBSTRING(TRIM(name), LOCATE(' ', TRIM(name)) + 1)), '')
    ELSE NULL
  END AS proposed_last_name
FROM students
ORDER BY id;

-- Step 3: After reviewing the preview above, run the backfill.
-- UPDATE students
-- SET
--   first_name = SUBSTRING_INDEX(TRIM(name), ' ', 1),
--   last_name = CASE
--     WHEN LOCATE(' ', TRIM(name)) > 0
--     THEN NULLIF(TRIM(SUBSTRING(TRIM(name), LOCATE(' ', TRIM(name)) + 1)), '')
--     ELSE NULL
--   END
-- WHERE name IS NOT NULL AND TRIM(name) <> '';

-- Step 4: After verifying first_name and last_name, remove the legacy column.
-- ALTER TABLE students DROP COLUMN name;