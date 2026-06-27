-- 012: Academic Lifecycle Enhancements
-- Adds auto-enrollment tracking, enrollment lifecycle auto-completion,
-- unified student timeline support, book ministry placeholder tables,
-- and course plan date enforcement.

-- 1. Add auto_enrolled flag to enrollments
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS auto_enrolled BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Create enrollment_lifecycle_log for tracking auto-actions
CREATE TABLE IF NOT EXISTS enrollment_lifecycle_log (
  id SERIAL PRIMARY KEY,
  enrollment_id INTEGER REFERENCES enrollments(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL CHECK (action IN ('auto_enrolled', 'auto_completed', 'auto_withdrawn', 'manual_completed', 'manual_withdrawn')),
  triggered_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrl_log_enrollment ON enrollment_lifecycle_log(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_enrl_log_created ON enrollment_lifecycle_log(created_at DESC);

-- 3. Create function: auto_complete_enrollments()
-- Marks active enrollments as 'completed' when the course end_date (from course_plan_items) has passed.
-- Returns a table of affected enrollments for auditing.
CREATE OR REPLACE FUNCTION auto_complete_enrollments()
RETURNS TABLE (
  enrollment_id INTEGER,
  student_name TEXT,
  course_title TEXT,
  course_code TEXT,
  completed_date DATE
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH expired AS (
    SELECT e.id, e.student_id, e.course_id, cpi.end_date
    FROM enrollments e
    JOIN course_plan_items cpi ON cpi.course_id = e.course_id
    WHERE e.status = 'active'
      AND cpi.end_date IS NOT NULL
      AND cpi.end_date <= CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM enrollment_lifecycle_log ell
        WHERE ell.enrollment_id = e.id AND ell.action = 'auto_completed'
      )
  ),
  updated AS (
    UPDATE enrollments e
    SET status = 'completed',
        completed_at = NOW()
    FROM expired ex
    WHERE e.id = ex.id
    RETURNING e.id, ex.student_id, ex.course_id
  ),
  logged AS (
    INSERT INTO enrollment_lifecycle_log (enrollment_id, action, details)
    SELECT u.id, 'auto_completed', jsonb_build_object('completed_at', NOW(), 'course_id', u.course_id)
    FROM updated u
    RETURNING enrollment_id
  )
  SELECT
    u.id AS enrollment_id,
    u2.full_name AS student_name,
    c.title AS course_title,
    c.course_code,
    CURRENT_DATE AS completed_date
  FROM updated u
  JOIN students s ON s.id = u.student_id
  JOIN users u2 ON u2.id = s.user_id
  JOIN courses c ON c.id = u.course_id;

  RETURN;
END;
$$;

-- 4. Create function: auto_enroll_students()
-- Enrolls eligible (Active/Graduating, not already enrolled, not already passed) students
-- into courses that are starting (based on course_plan_items start_date <= CURRENT_DATE
-- and end_date IS NULL OR end_date >= CURRENT_DATE).
CREATE OR REPLACE FUNCTION auto_enroll_students()
RETURNS TABLE (
  enrollment_id INTEGER,
  student_name TEXT,
  course_title TEXT,
  course_code TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH starting_courses AS (
    SELECT cpi.id AS item_id, cpi.course_id, cpi.start_date
    FROM course_plan_items cpi
    WHERE cpi.start_date IS NOT NULL
      AND cpi.start_date <= CURRENT_DATE
      AND (cpi.end_date IS NULL OR cpi.end_date >= CURRENT_DATE)
  ),
  eligible AS (
    SELECT s.id AS student_id, sc.course_id
    FROM students s
    CROSS JOIN starting_courses sc
    WHERE s.status IN ('Active', 'Graduating')
      AND NOT EXISTS (
        SELECT 1 FROM enrollments e
        WHERE e.student_id = s.id AND e.course_id = sc.course_id AND e.status = 'active'
      )
      AND NOT EXISTS (
        SELECT 1 FROM results r
        WHERE r.student_id = s.id AND r.course_id = sc.course_id AND r.status = 'Pass'
      )
  ),
  inserted AS (
    INSERT INTO enrollments (course_id, student_id, status, auto_enrolled, enrolled_at)
    SELECT course_id, student_id, 'active', TRUE, NOW()
    FROM eligible
    WHERE NOT EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.student_id = eligible.student_id
        AND e.course_id = eligible.course_id
        AND e.status = 'active'
    )
    RETURNING id, course_id, student_id
  ),
  logged AS (
    INSERT INTO enrollment_lifecycle_log (enrollment_id, action, details)
    SELECT i.id, 'auto_enrolled', jsonb_build_object('enrolled_at', NOW(), 'course_id', i.course_id)
    FROM inserted i
    RETURNING enrollment_id
  )
  SELECT
    i.id AS enrollment_id,
    u.full_name AS student_name,
    c.title AS course_title,
    c.course_code
  FROM inserted i
  JOIN students s ON s.id = i.student_id
  JOIN users u ON u.id = s.user_id
  JOIN courses c ON c.id = i.course_id;

  RETURN;
END;
$$;

-- 5. Add withdrawn_reason to enrollments for audit trail
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS withdrawn_reason TEXT;

-- 6. Add course_plan_item_id to enrollments for direct date reference
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS course_plan_item_id INTEGER REFERENCES course_plan_items(id) ON DELETE SET NULL;

-- 7. Create unified student timeline view
CREATE OR REPLACE VIEW student_timeline AS
SELECT
  s.id AS student_id,
  s.status AS current_status,
  u.full_name AS student_name,
  u.email,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'type', 'status_transition',
        'id', sst.id,
        'from_status', sst.from_status,
        'to_status', sst.to_status,
        'reason', sst.reason,
        'changed_by_name', cu.full_name,
        'timestamp', sst.changed_at
      )
      ORDER BY sst.changed_at DESC
    ) FILTER (WHERE sst.id IS NOT NULL),
    '[]'::jsonb
  ) AS status_transitions,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'type', 'enrollment',
        'id', e.id,
        'course_title', c.title,
        'course_code', c.course_code,
        'status', e.status,
        'auto_enrolled', e.auto_enrolled,
        'enrolled_at', e.enrolled_at,
        'completed_at', e.completed_at,
        'result_status', r.status,
        'result_score', r.score,
        'cohort_name', co.name
      )
      ORDER BY e.enrolled_at DESC
    ) FILTER (WHERE e.id IS NOT NULL),
    '[]'::jsonb
  ) AS enrollments,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'type', 'activity',
        'id', sal.id,
        'action', sal.action,
        'details', sal.details,
        'timestamp', sal.created_at
      )
      ORDER BY sal.created_at DESC
    ) FILTER (WHERE sal.id IS NOT NULL),
    '[]'::jsonb
  ) AS activities
FROM students s
JOIN users u ON u.id = s.user_id
LEFT JOIN student_status_transitions sst ON sst.student_id = s.id
LEFT JOIN users cu ON cu.id = sst.changed_by
LEFT JOIN enrollments e ON e.student_id = s.id
LEFT JOIN courses c ON c.id = e.course_id
LEFT JOIN LATERAL (
  SELECT r.status, r.score
  FROM results r
  WHERE r.student_id = e.student_id AND r.course_id = e.course_id
  ORDER BY r.uploaded_at DESC
  LIMIT 1
) r ON TRUE
LEFT JOIN cohorts co ON co.id = s.cohort_id
GROUP BY s.id, u.full_name, u.email;

-- 8. Book Ministry placeholder tables
CREATE TABLE IF NOT EXISTS book_ministry_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS book_requests (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  book_title VARCHAR(300) NOT NULL,
  author VARCHAR(200),
  isbn VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'fulfilled', 'cancelled')),
  notes TEXT,
  requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_requests_student ON book_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_book_requests_status ON book_requests(status);

-- 9. Seed default book ministry settings
INSERT INTO book_ministry_settings (key, value, description) VALUES
  ('enabled', 'false', 'Enable or disable Book Ministry features'),
  ('max_requests_per_student', '5', 'Maximum number of active book requests per student'),
  ('notification_email', '', 'Email address for book request notifications')
ON CONFLICT (key) DO NOTHING;

-- 10. Fix unique constraint: allow one active enrollment per student PER COURSE,
--     not one active enrollment per student across ALL courses.
DROP INDEX IF EXISTS unique_active_enrollment_per_student;
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_enrollment_per_student_course
  ON enrollments(student_id, course_id)
  WHERE status = 'active';
