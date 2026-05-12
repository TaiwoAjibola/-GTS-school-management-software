-- ============================================================
-- SAMS - Feature: Process-Based Email Configuration
-- ============================================================

-- Email processes table — stores per-process templates and configuration
CREATE TABLE IF NOT EXISTS email_processes (
  id SERIAL PRIMARY KEY,
  process_key VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'general',
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  available_variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_processes_key ON email_processes(process_key);
CREATE INDEX IF NOT EXISTS idx_email_processes_category ON email_processes(category);

-- Seed default email processes
INSERT INTO email_processes (process_key, display_name, description, category, subject_template, body_template, available_variables, enabled) VALUES
  (
    'student_activated',
    'Student Activation',
    'Sent when a student status changes to Active (welcome email with matric number)',
    'lifecycle',
    'Welcome to GTS — You Have Been Activated',
    'Dear {{studentName}},

Congratulations! Your student account has been activated.

Your Matriculation Number is: {{matricNo}}

Please keep this number safe — you will need it for future reference.

God bless you,
The GTS Team',
    '["studentName", "matricNo", "email"]'::jsonb,
    true
  ),
  (
    'application_received',
    'Application Received',
    'Sent when a new student applies or is created with "Applied" status',
    'lifecycle',
    'Application Received — GTS',
    'Dear {{studentName}},

Thank you for your application to Grace Theological Seminary.

Your application has been received and is being processed. We will notify you once it has been reviewed.

God bless you,
The GTS Team',
    '["studentName", "email"]'::jsonb,
    true
  ),
  (
    'application_accepted',
    'Application Accepted',
    'Sent when a student status changes from Under Review to Accepted',
    'lifecycle',
    'Your Application Has Been Accepted — GTS',
    'Dear {{studentName}},

We are pleased to inform you that your application to Grace Theological Seminary has been accepted.

Please await further instructions regarding your enrollment and orientation.

With blessings,
The GTS Team',
    '["studentName", "email"]'::jsonb,
    true
  ),
  (
    'result_published',
    'Result Published',
    'Sent when a student result is uploaded or updated',
    'academic',
    'Your {{resultType}} Result — {{courseTitle}}',
    'Dear {{studentName}},

Your {{resultType}} result for "{{courseTitle}}" is now available.

Result: {{status}}{{#score}} (Score: {{score}}/100){{/score}}

God bless you,
The GTS Team',
    '["studentName", "courseTitle", "resultType", "status", "score"]'::jsonb,
    true
  ),
  (
    'assignment_released',
    'Assignment Released',
    'Sent when a new assignment is created and distributed to enrolled students',
    'academic',
    'New Assignment: {{assignmentTitle}}',
    'Hello {{studentName}},

You have a new assignment in {{courseTitle}}: {{assignmentTitle}}.
Due date: {{dueDate}}

GTS',
    '["studentName", "courseTitle", "assignmentTitle", "dueDate"]'::jsonb,
    true
  ),
  (
    'course_material_shared',
    'Course Material Shared',
    'Sent when new course material is uploaded and shared with enrolled students',
    'academic',
    'New Course Material: {{materialTitle}}',
    'Hello {{studentName}},

A new material has been shared for {{courseTitle}}.
Title: {{materialTitle}}
Scope: {{sectionText}}
{{#materialDescription}}Description: {{materialDescription}}{{/materialDescription}}
Link: {{materialUrl}}

GTS',
    '["studentName", "courseTitle", "materialTitle", "sectionText", "materialDescription", "materialUrl"]'::jsonb,
    true
  ),
  (
    'graduation',
    'Graduation Notification',
    'Sent when a student status changes to Graduated',
    'lifecycle',
    'Congratulations on Your Graduation — GTS',
    'Dear {{studentName}},

On behalf of the GTS faculty and staff, we congratulate you on successfully completing all requirements for graduation.

May God continue to guide and bless you in your ministry.

With blessings,
The GTS Team',
    '["studentName"]'::jsonb,
    true
  ),
  (
    'student_suspended',
    'Student Suspended',
    'Sent when a student status changes to Suspended',
    'lifecycle',
    'Important Notice Regarding Your Student Status — GTS',
    'Dear {{studentName}},

We are writing to inform you that your student status has been changed to Suspended.

{{#reason}}Reason: {{reason}}{{/reason}}

Please contact the administration for further information.

The GTS Team',
    '["studentName", "reason"]'::jsonb,
    true
  ),
  (
    'student_on_hold',
    'Student On Hold',
    'Sent when a student status changes to On Hold',
    'lifecycle',
    'Your Student Status Has Been Updated — GTS',
    'Dear {{studentName}},

Your student status has been placed on hold.

{{#reason}}Reason: {{reason}}{{/reason}}

Please contact the administration if you have any questions.

The GTS Team',
    '["studentName", "reason"]'::jsonb,
    true
  ),
  (
    'interview_invitation',
    'Interview Invitation',
    'Sent to invite applicants for an interview',
    'lifecycle',
    'Interview Invitation — GTS',
    'Dear {{studentName}},

You are invited for an interview as part of the admissions process at Grace Theological Seminary.

Please confirm your availability by replying to this email.

God bless you,
The GTS Team',
    '["studentName", "email"]'::jsonb,
    false
  )
ON CONFLICT (process_key) DO NOTHING;

-- Add is_active column to users for credential management
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
