-- Settings table for dynamic email configuration and templates
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email configuration settings
INSERT INTO settings (key, value, description) VALUES
  ('smtp_host', 'smtp.gmail.com', 'SMTP server hostname'),
  ('smtp_port', '587', 'SMTP server port (587 for TLS, 465 for SSL)'),
  ('smtp_user', '', 'SMTP authentication username'),
  ('smtp_pass', '', 'SMTP authentication password or app password'),
  ('email_from', '"GTS School Management" <no-reply@gts.local>', 'Default From address for outgoing emails'),
  ('email_enabled', 'true', 'Whether email sending is enabled (true/false)')
ON CONFLICT (key) DO NOTHING;

-- Email templates
INSERT INTO settings (key, value, description) VALUES
  ('template_welcome_subject', 'Welcome to GTS — You Have Been Activated', 'Subject line for welcome/activation email'),
  ('template_welcome_body', 'Dear {{studentName}},\n\nCongratulations! Your student account has been activated.\n\nYour Matriculation Number is: {{matricNo}}\n\nPlease keep this number safe — you will need it for future reference.\n\nGod bless you,\nThe GTS Team', 'Body text for welcome email. Variables: {{studentName}}, {{matricNo}}'),
  ('template_graduation_subject', 'Congratulations on Your Graduation — GTS', 'Subject line for graduation email'),
  ('template_graduation_body', 'Dear {{studentName}},\n\nOn behalf of the GTS faculty and staff, we congratulate you on successfully completing all requirements for graduation.\n\nMay God continue to guide and bless you in your ministry.\n\nWith blessings,\nThe GTS Team', 'Body text for graduation email. Variables: {{studentName}}'),
  ('template_result_subject', 'Your {{resultType}} Result — {{courseTitle}}', 'Subject line for result notification email. Variables: {{resultType}}, {{courseTitle}}'),
  ('template_result_body', 'Dear {{studentName}},\n\nYour {{resultType}} result for "{{courseTitle}}" is now available.\n\nResult: {{status}}{{#score}} (Score: {{score}}/100){{/score}}\n\nGod bless you,\nThe GTS Team', 'Body text for result email. Variables: {{studentName}}, {{resultType}}, {{courseTitle}}, {{status}}, {{score}}'),
  ('template_assignment_subject', 'New Assignment: {{assignmentTitle}}', 'Subject line for assignment notification email. Variables: {{assignmentTitle}}'),
  ('template_assignment_body', 'Hello {{studentName}},\n\nYou have a new assignment in {{courseTitle}}: {{assignmentTitle}}.\nDue date: {{dueDate}}\n\nGTS', 'Body text for assignment email. Variables: {{studentName}}, {{courseTitle}}, {{assignmentTitle}}, {{dueDate}}'),
  ('template_material_subject', 'New Course Material: {{materialTitle}}', 'Subject line for course material email. Variables: {{materialTitle}}'),
  ('template_material_body', 'Hello {{studentName}},\n\nA new material has been shared for {{courseTitle}}.\nTitle: {{materialTitle}}\nScope: {{sectionText}}\n{{#materialDescription}}Description: {{materialDescription}}{{/materialDescription}}\nLink: {{materialUrl}}\n\nGTS', 'Body text for material email. Variables: {{studentName}}, {{courseTitle}}, {{materialTitle}}, {{sectionText}}, {{materialDescription}}, {{materialUrl}}')
ON CONFLICT (key) DO NOTHING;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
