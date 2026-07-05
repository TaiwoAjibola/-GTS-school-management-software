-- Run this in Supabase SQL Editor to fix the enrollment constraint immediately
DROP INDEX IF EXISTS unique_active_enrollment_per_student;
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_enrollment_per_student_course
  ON enrollments(student_id, course_id)
  WHERE status = 'active';
