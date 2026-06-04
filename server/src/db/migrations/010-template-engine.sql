-- 010: Template Engine Redesign
-- Removes hard-coded email processes, rebuilds as admin-managed templates
-- Creates global variable library with categories

-- Remove all seed/hard-coded rows
DELETE FROM communication_log;
DELETE FROM template_variables;
DELETE FROM email_processes;

-- Drop old constraints
ALTER TABLE email_processes DROP CONSTRAINT IF EXISTS email_processes_process_key_key;
ALTER TABLE email_processes DROP CONSTRAINT IF EXISTS email_processes_channel_check;

-- Remove old columns that are no longer needed
ALTER TABLE email_processes
  DROP COLUMN IF EXISTS process_key,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS available_variables,
  DROP COLUMN IF EXISTS enabled,
  DROP COLUMN IF EXISTS can_manual_send;

-- Rename display_name -> name for clarity
ALTER TABLE email_processes RENAME COLUMN display_name TO name;

-- Add created_by
ALTER TABLE email_processes ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Rebuild template_variables as a global library (no process_id FK)
DROP TABLE IF EXISTS template_variables CASCADE;
CREATE TABLE template_variables (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  variable_key VARCHAR(100) NOT NULL UNIQUE,
  display_label VARCHAR(200) NOT NULL,
  description TEXT,
  example_value VARCHAR(500),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed global variable library
INSERT INTO template_variables (category, variable_key, display_label, description, example_value, sort_order) VALUES
  -- Student variables
  ('student', 'student_name', 'Student Name', 'Full name of the student', 'Taiwo Ajibola', 1),
  ('student', 'student_email', 'Student Email', 'Email address of the student', 'taiwo@example.com', 2),
  ('student', 'student_phone', 'Student Phone', 'Phone number of the student', '+2348012345678', 3),
  ('student', 'student_id', 'Student ID', 'Unique identifier for the student', 'STU-001', 4),
  ('student', 'student_status', 'Student Status', 'Current status of the student', 'Active', 5),
  ('student', 'enrollment_date', 'Enrollment Date', 'Date the student enrolled', 'January 15, 2026', 6),
  ('student', 'matric_no', 'Matriculation Number', 'Matriculation number of the student', 'GTS/2026/001', 7),
  ('student', 'cohort_name', 'Cohort Name', 'Name of the student cohort/batch', 'Cohort 2026 A', 8),

  -- Course variables
  ('course', 'course_name', 'Course Name', 'Title of the course', 'Introduction to Programming', 10),
  ('course', 'course_code', 'Course Code', 'Code identifying the course', 'CS101', 11),
  ('course', 'course_start_date', 'Course Start Date', 'Date the course begins', 'March 1, 2026', 12),
  ('course', 'course_end_date', 'Course End Date', 'Date the course ends', 'June 30, 2026', 13),
  ('course', 'course_description', 'Course Description', 'Brief description of the course', 'Learn the fundamentals of programming.', 14),

  -- Assignment variables
  ('assignment', 'assignment_title', 'Assignment Title', 'Title of the assignment', 'Week 4 Coding Exercise', 20),
  ('assignment', 'assignment_description', 'Assignment Description', 'Description of what the assignment entails', 'Build a calculator application', 21),
  ('assignment', 'due_date', 'Due Date', 'Deadline for the assignment submission', 'April 15, 2026', 22),
  ('assignment', 'assignment_instructions', 'Assignment Instructions', 'Instructions for completing the assignment', 'Submit via the student portal.', 23),
  ('assignment', 'total_points', 'Total Points', 'Maximum points for the assignment', '100', 24),

  -- Instructor variables
  ('instructor', 'instructor_name', 'Instructor Name', 'Name of the instructor', 'Dr. John Smith', 30),
  ('instructor', 'instructor_email', 'Instructor Email', 'Email address of the instructor', 'john.smith@school.edu', 31),

  -- School variables
  ('school', 'school_name', 'School Name', 'Name of the institution', 'GTS Academy', 40),
  ('school', 'school_email', 'School Email', 'General email of the institution', 'info@gtsacademy.edu', 41),
  ('school', 'school_address', 'School Address', 'Physical address of the institution', '123 Education Street, Lagos', 42),
  ('school', 'school_phone', 'School Phone', 'Phone number of the institution', '+2349012345678', 43),
  ('school', 'current_date', 'Current Date', 'Todays date', 'June 4, 2026', 44),

  -- Custom / future-ready
  ('custom', 'custom_01', 'Custom Variable 01', 'Reserved for future custom variables', '', 100),
  ('custom', 'custom_02', 'Custom Variable 02', 'Reserved for future custom variables', '', 101);

-- Enable RLS on template_variables
ALTER TABLE template_variables ENABLE ROW LEVEL SECURITY;
CREATE POLICY deny_all_template_variables ON template_variables FOR ALL USING (false);
