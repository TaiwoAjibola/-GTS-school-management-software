-- ============================================================
-- SAMS - Post-Migration Sequence Reset for Supabase
-- Run this after importing data to Supabase
-- ============================================================

-- Reset matric number sequence
SELECT setval('students_matric_seq', COALESCE(
  (SELECT MAX(CAST(SUBSTRING(matric_no FROM 4) AS INT)) 
   FROM students WHERE matric_no ~ '^GTT[0-9]+$'), 
  0
));

-- Reset all SERIAL sequences to prevent duplicate key errors
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(MAX(id), 1)) FROM users;
SELECT setval(pg_get_serial_sequence('cohorts', 'id'), COALESCE(MAX(id), 1)) FROM cohorts;
SELECT setval(pg_get_serial_sequence('students', 'id'), COALESCE(MAX(id), 1)) FROM students;
SELECT setval(pg_get_serial_sequence('student_statuses', 'id'), COALESCE(MAX(id), 1)) FROM student_statuses;
SELECT setval(pg_get_serial_sequence('courses', 'id'), COALESCE(MAX(id), 1)) FROM courses;
SELECT setval(pg_get_serial_sequence('batches', 'id'), COALESCE(MAX(id), 1)) FROM batches;
SELECT setval(pg_get_serial_sequence('enrollments', 'id'), COALESCE(MAX(id), 1)) FROM enrollments;
SELECT setval(pg_get_serial_sequence('attendance_sessions', 'id'), COALESCE(MAX(id), 1)) FROM attendance_sessions;
SELECT setval(pg_get_serial_sequence('attendance_records', 'id'), COALESCE(MAX(id), 1)) FROM attendance_records;
SELECT setval(pg_get_serial_sequence('assignments', 'id'), COALESCE(MAX(id), 1)) FROM assignments;
SELECT setval(pg_get_serial_sequence('assignment_deliveries', 'id'), COALESCE(MAX(id), 1)) FROM assignment_deliveries;
SELECT setval(pg_get_serial_sequence('course_materials', 'id'), COALESCE(MAX(id), 1)) FROM course_materials;
SELECT setval(pg_get_serial_sequence('results', 'id'), COALESCE(MAX(id), 1)) FROM results;
SELECT setval(pg_get_serial_sequence('student_activity_logs', 'id'), COALESCE(MAX(id), 1)) FROM student_activity_logs;
SELECT setval(pg_get_serial_sequence('course_plans', 'id'), COALESCE(MAX(id), 1)) FROM course_plans;
SELECT setval(pg_get_serial_sequence('course_plan_items', 'id'), COALESCE(MAX(id), 1)) FROM course_plan_items;
SELECT setval(pg_get_serial_sequence('lecturers', 'id'), COALESCE(MAX(id), 1)) FROM lecturers;

-- Verify sequences
SELECT 
  'students_matric_seq' AS sequence_name, 
  last_value, 
  is_called 
FROM students_matric_seq

UNION ALL

SELECT 
  schemaname || '.' || sequencename, 
  last_value, 
  is_called 
FROM pg_sequences 
WHERE schemaname = 'public' 
ORDER BY sequence_name;
