-- Extended Student Lifecycle Status Pipeline
-- Adds granular stages for better tracking of student journey

-- 1. Add new allowed statuses to students table
-- First, drop the existing constraint
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_status_check;

-- Add new constraint with extended statuses
ALTER TABLE students ADD CONSTRAINT students_status_check
  CHECK (status IN (
    'Applied', 'Under Review', 'Accepted', 'Prospective', 'Active', 'On Hold',
    'Suspended', 'Withdrawn', 'Transferred', 'Graduating', 'Completed',
    'Graduated', 'Alumni'
  ));

-- 2. Create status transition history table
CREATE TABLE IF NOT EXISTS student_status_transitions (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  from_status VARCHAR(50) NOT NULL,
  to_status VARCHAR(50) NOT NULL,
  reason TEXT,
  changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_transitions_student ON student_status_transitions(student_id);
CREATE INDEX IF NOT EXISTS idx_status_transitions_changed_at ON student_status_transitions(changed_at DESC);

-- 3. Define valid status transitions (as a reference table)
CREATE TABLE IF NOT EXISTS status_transition_rules (
  id SERIAL PRIMARY KEY,
  from_status VARCHAR(50) NOT NULL,
  to_status VARCHAR(50) NOT NULL,
  UNIQUE (from_status, to_status)
);

-- Insert valid transition rules
INSERT INTO status_transition_rules (from_status, to_status) VALUES
  -- Application flow
  ('Applied', 'Under Review'),
  ('Under Review', 'Accepted'),
  ('Under Review', 'Rejected'),
  ('Accepted', 'Prospective'),
  ('Accepted', 'Active'),
  -- Activation flow
  ('Prospective', 'Active'),
  ('Prospective', 'Withdrawn'),
  -- Active student transitions
  ('Active', 'On Hold'),
  ('Active', 'Suspended'),
  ('Active', 'Withdrawn'),
  ('Active', 'Transferred'),
  ('Active', 'Graduating'),
  -- Recovery transitions
  ('On Hold', 'Active'),
  ('On Hold', 'Withdrawn'),
  ('Suspended', 'Active'),
  ('Suspended', 'Withdrawn'),
  -- Graduation flow
  ('Graduating', 'Completed'),
  ('Graduating', 'Graduated'),
  ('Completed', 'Graduated'),
  -- Post-graduation
  ('Graduated', 'Alumni'),
  -- Re-enrollment
  ('Withdrawn', 'Applied'),
  ('Withdrawn', 'Prospective'),
  ('Transferred', 'Applied'),
  ('Transferred', 'Prospective'),
  ('Alumni', 'Applied')
ON CONFLICT (from_status, to_status) DO NOTHING;

-- 4. Migrate existing statuses to new pipeline
-- 'Prospective' stays as is
-- 'Active' stays as is
-- 'Graduating' stays as is
-- 'Graduated' stays as is
-- 'Alumni' stays as is
-- (No data migration needed since existing statuses are subset of new ones)
