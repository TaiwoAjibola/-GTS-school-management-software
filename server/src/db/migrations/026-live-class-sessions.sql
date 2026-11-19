-- ============================================================
-- SAMS - Feature: Live class (physical/online) + Zoom for LMS
-- ============================================================

ALTER TABLE attendance_sessions
  ADD COLUMN IF NOT EXISTS class_mode VARCHAR(10)
     CHECK (class_mode IN ('physical', 'online')),
  ADD COLUMN IF NOT EXISTS zoom_meeting_number TEXT,
  ADD COLUMN IF NOT EXISTS zoom_passcode TEXT,
  ADD COLUMN IF NOT EXISTS is_live BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_class_mode ON attendance_sessions(class_mode);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_is_live ON attendance_sessions(is_live);

-- ============================================================
-- Pre-scheduled class-to-Zoom link (per course)
-- ============================================================
ALTER TABLE courses ADD COLUMN IF NOT EXISTS zoom_meeting_number TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS zoom_meeting_name TEXT;

-- ============================================================
-- live_classes: pre-scheduled class-level calendar (class 1..6 per course)
-- ============================================================
CREATE TABLE IF NOT EXISTS live_classes (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  class_number INT NOT NULL,
  date DATE,
  start_time TIME,
  end_time TIME,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  class_mode VARCHAR(10) NOT NULL DEFAULT 'physical' CHECK (class_mode IN ('physical', 'online')),
  zoom_meeting_number TEXT,
  zoom_passcode TEXT,
  attendance_session_id INT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (class_number BETWEEN 1 AND 6),
  UNIQUE (course_id, class_number)
);

CREATE INDEX IF NOT EXISTS idx_live_classes_course_id ON live_classes(course_id);
CREATE INDEX IF NOT EXISTS idx_live_classes_class_number ON live_classes(class_number);
CREATE INDEX IF NOT EXISTS idx_live_classes_date ON live_classes(date);
