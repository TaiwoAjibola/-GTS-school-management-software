CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(120) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'lecturer', 'student')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cohorts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  start_date DATE,
  end_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('upcoming', 'active', 'completed')),
  display_order INT NOT NULL DEFAULT 0,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  user_id INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  matric_no VARCHAR(8) UNIQUE NOT NULL,
  student_number VARCHAR(20),
  phone VARCHAR(30) NOT NULL,
  profile_image_url TEXT,
  status VARCHAR(20) NOT NULL CHECK (status IN ('Prospective', 'Active', 'Graduating', 'Graduated', 'Alumni')),
  comments TEXT,
  cohort_id INT REFERENCES cohorts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_statuses (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, status_name)
);

CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  description TEXT,
  course_code VARCHAR(20),
  duration_weeks INT NOT NULL CHECK (duration_weeks > 0),
  min_attendance_required INT NOT NULL CHECK (min_attendance_required >= 0),
  has_assignment BOOLEAN NOT NULL DEFAULT FALSE,
  has_exam BOOLEAN NOT NULL DEFAULT FALSE,
  requires_score BOOLEAN NOT NULL DEFAULT TRUE,
  start_date DATE,
  end_date DATE,
  class_day VARCHAR(20),
  class_time TIME,
  lecturer_id INT REFERENCES users(id) ON DELETE SET NULL,
  lecturer_name VARCHAR(120),
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enrollments (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  batch_id INT,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'withdrawn')),
  notes TEXT,
  completed_at TIMESTAMPTZ,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (batch_id, student_id)
);


CREATE TABLE IF NOT EXISTS batches (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name VARCHAR(100),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed', 'suspended')),
  suspension_reason TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_batches_course_id ON batches(course_id);

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  batch_id INT REFERENCES batches(id) ON DELETE CASCADE,
  class_number INT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_time IS NULL OR end_time > start_time)
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_session_per_course
ON attendance_sessions(course_id)
WHERE is_active = TRUE;


CREATE TABLE IF NOT EXISTS attendance_records (
  id SERIAL PRIMARY KEY,
  session_id INT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (session_id, student_id)
);

CREATE TABLE IF NOT EXISTS assignments (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  batch_id INT REFERENCES batches(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  due_date DATE,
  attachment_url TEXT,
  created_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_materials (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  section_number INT CHECK (section_number > 0),
  material_url TEXT NOT NULL,
  created_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assignment_deliveries (
  id SERIAL PRIMARY KEY,
  assignment_id INT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ DEFAULT NOW(),
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS results (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  batch_id INT REFERENCES batches(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  result_type VARCHAR(20) NOT NULL DEFAULT 'Final' CHECK (result_type IN ('Assignment', 'Exam', 'Final')),
  score NUMERIC(5,2) CHECK (score >= 0 AND score <= 100),
  status VARCHAR(10) NOT NULL CHECK (status IN ('Pass', 'Fail')),
  uploaded_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (course_id, student_id, result_type),
  UNIQUE (batch_id, student_id)
);

CREATE TABLE IF NOT EXISTS student_activity_logs (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  action VARCHAR(80) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
