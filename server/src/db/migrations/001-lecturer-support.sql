-- ============================================================
-- SAMS - Feature 1: Primary/Secondary Lecturer Support
-- ============================================================

-- Add secondary_lecturer_id to courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS secondary_lecturer_id INT REFERENCES users(id) ON DELETE SET NULL;

-- Add secondary_lecturer_id to attendance_sessions (for session-specific lecturer assignment)
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS secondary_lecturer_id INT REFERENCES users(id) ON DELETE SET NULL;

-- Add lecturer_notes to attendance_sessions
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS lecturer_notes TEXT;

-- Create index for secondary lecturer lookups
CREATE INDEX IF NOT EXISTS idx_courses_secondary_lecturer ON courses(secondary_lecturer_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_secondary_lecturer ON attendance_sessions(secondary_lecturer_id);
