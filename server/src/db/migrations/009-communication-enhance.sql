-- 009: Communication System Enhancement
-- Adds channel, rich_body, archived to email_processes
-- Creates template_variables table for variable library

ALTER TABLE email_processes
  ADD COLUMN IF NOT EXISTS channel VARCHAR(20) NOT NULL DEFAULT 'email'
    CHECK (channel IN ('email', 'sms', 'both')),
  ADD COLUMN IF NOT EXISTS rich_body TEXT,
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS template_variables (
  id SERIAL PRIMARY KEY,
  process_id INTEGER REFERENCES email_processes(id) ON DELETE CASCADE,
  variable_key VARCHAR(100) NOT NULL,
  display_label VARCHAR(200) NOT NULL,
  description TEXT,
  example_value VARCHAR(500),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default system variable categories
INSERT INTO template_variables (process_id, variable_key, display_label, description, example_value, sort_order)
SELECT
  ep.id, 'student_full_name', 'Student Full Name', 'The student''s full name', 'John Doe', 1
FROM email_processes ep
WHERE NOT EXISTS (
  SELECT 1 FROM template_variables tv WHERE tv.process_id = ep.id AND tv.variable_key = 'student_full_name'
);

INSERT INTO template_variables (process_id, variable_key, display_label, description, example_value, sort_order)
SELECT
  ep.id, 'student_email', 'Student Email', 'The student''s email address', 'john@example.com', 2
FROM email_processes ep
WHERE NOT EXISTS (
  SELECT 1 FROM template_variables tv WHERE tv.process_id = ep.id AND tv.variable_key = 'student_email'
);

INSERT INTO template_variables (process_id, variable_key, display_label, description, example_value, sort_order)
SELECT
  ep.id, 'student_phone', 'Student Phone', 'The student''s phone number', '+2348012345678', 3
FROM email_processes ep
WHERE NOT EXISTS (
  SELECT 1 FROM template_variables tv WHERE tv.process_id = ep.id AND tv.variable_key = 'student_phone'
);

INSERT INTO template_variables (process_id, variable_key, display_label, description, example_value, sort_order)
SELECT
  ep.id, 'institution_name', 'Institution Name', 'Your school/institution name', 'GTS Academy', 4
FROM email_processes ep
WHERE NOT EXISTS (
  SELECT 1 FROM template_variables tv WHERE tv.process_id = ep.id AND tv.variable_key = 'institution_name'
);

INSERT INTO template_variables (process_id, variable_key, display_label, description, example_value, sort_order)
SELECT
  ep.id, 'current_date', 'Current Date', 'Todays date', 'June 4, 2026', 5
FROM email_processes ep
WHERE NOT EXISTS (
  SELECT 1 FROM template_variables tv WHERE tv.process_id = ep.id AND tv.variable_key = 'current_date'
);

-- Add manual_send flag to email_processes
ALTER TABLE email_processes
  ADD COLUMN IF NOT EXISTS can_manual_send BOOLEAN NOT NULL DEFAULT false;

-- Create communication_log for audit trail
CREATE TABLE IF NOT EXISTS communication_log (
  id SERIAL PRIMARY KEY,
  process_id INTEGER REFERENCES email_processes(id) ON DELETE SET NULL,
  process_key VARCHAR(100),
  recipient_type VARCHAR(50) NOT NULL DEFAULT 'student',
  recipient_count INTEGER NOT NULL DEFAULT 0,
  recipient_preview TEXT,
  sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  subject_text TEXT,
  body_text TEXT,
  channel VARCHAR(20) NOT NULL DEFAULT 'email',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
