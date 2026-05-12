-- ============================================================
-- SAMS - Post-Migration Verification Queries
-- Run these in Supabase SQL Editor after migration
-- ============================================================

-- 1. Verify all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 2. Row counts for all tables
SELECT 'users' AS table_name, COUNT(*) AS row_count FROM users
UNION ALL SELECT 'cohorts', COUNT(*) FROM cohorts
UNION ALL SELECT 'students', COUNT(*) FROM students
UNION ALL SELECT 'student_statuses', COUNT(*) FROM student_statuses
UNION ALL SELECT 'courses', COUNT(*) FROM courses
UNION ALL SELECT 'batches', COUNT(*) FROM batches
UNION ALL SELECT 'enrollments', COUNT(*) FROM enrollments
UNION ALL SELECT 'attendance_sessions', COUNT(*) FROM attendance_sessions
UNION ALL SELECT 'attendance_records', COUNT(*) FROM attendance_records
UNION ALL SELECT 'assignments', COUNT(*) FROM assignments
UNION ALL SELECT 'assignment_deliveries', COUNT(*) FROM assignment_deliveries
UNION ALL SELECT 'course_materials', COUNT(*) FROM course_materials
UNION ALL SELECT 'results', COUNT(*) FROM results
UNION ALL SELECT 'student_activity_logs', COUNT(*) FROM student_activity_logs
UNION ALL SELECT 'course_plans', COUNT(*) FROM course_plans
UNION ALL SELECT 'course_plan_items', COUNT(*) FROM course_plan_items
UNION ALL SELECT 'lecturers', COUNT(*) FROM lecturers
ORDER BY table_name;

-- 3. Verify constraints
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
  AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE', 'CHECK')
ORDER BY tc.table_name, tc.constraint_type;

-- 4. Verify indexes
SELECT 
  tablename AS table_name, 
  indexname AS index_name
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 5. Check for orphaned records (should return 0 rows)
-- Students without users
SELECT s.id AS orphaned_student_id
FROM students s
LEFT JOIN users u ON u.id = s.user_id
WHERE u.id IS NULL;

-- Enrollments without students
SELECT e.id AS orphaned_enrollment_id
FROM enrollments e
LEFT JOIN students s ON s.id = e.student_id
WHERE s.id IS NULL;

-- Results without students
SELECT r.id AS orphaned_result_id
FROM results r
LEFT JOIN students s ON s.id = r.student_id
WHERE s.id IS NULL;

-- 6. Verify default users exist
SELECT id, full_name, email, role, created_at
FROM users
WHERE email IN ('admin@sams.local', 'lecturer@sams.local', 'student@sams.local');

-- 7. Check sequence values
SELECT 
  sequencename, 
  last_value, 
  is_called
FROM pg_sequences
WHERE schemaname = 'public'
ORDER BY sequencename;

-- 8. Verify foreign key relationships
SELECT 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;
