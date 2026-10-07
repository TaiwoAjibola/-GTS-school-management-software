-- 017-graduating-sets.sql
-- Graduating Sets: group graduating students with the specific curriculum
-- (courses) they completed, and generate set-scoped graduation reports.

CREATE TABLE IF NOT EXISTS graduating_sets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  graduation_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'archived')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS graduating_set_members (
  id SERIAL PRIMARY KEY,
  set_id INTEGER NOT NULL REFERENCES graduating_sets(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (set_id, student_id)
);

CREATE TABLE IF NOT EXISTS graduating_set_courses (
  id SERIAL PRIMARY KEY,
  set_id INTEGER NOT NULL REFERENCES graduating_sets(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (set_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_graduating_set_members_set_id ON graduating_set_members(set_id);
CREATE INDEX IF NOT EXISTS idx_graduating_set_members_student_id ON graduating_set_members(student_id);
CREATE INDEX IF NOT EXISTS idx_graduating_set_courses_set_id ON graduating_set_courses(set_id);
CREATE INDEX IF NOT EXISTS idx_graduating_set_courses_course_id ON graduating_set_courses(course_id);
