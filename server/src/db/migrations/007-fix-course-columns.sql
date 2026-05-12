-- Fix missing columns in courses table that cause 500 errors in listCourses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS lecturer_name VARCHAR(255);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS secondary_lecturer_name VARCHAR(255);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT true;

-- Ensure attendance_sessions also has the secondary lecturer name if needed (optional but good for consistency)
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS secondary_lecturer_name VARCHAR(255);
