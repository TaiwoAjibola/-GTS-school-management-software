-- ============================================================
-- SAMS - Feature: Student First Course Tracking
-- ============================================================

-- first_course_id: the course a student first took / was admitted into.
-- Auto-assigned on enrollment when unknown; manually editable per student.
ALTER TABLE students ADD COLUMN IF NOT EXISTS first_course_id INT REFERENCES courses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_first_course_id ON students(first_course_id);
