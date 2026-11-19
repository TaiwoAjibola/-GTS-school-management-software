-- ============================================================
-- SAMS - Feature: Admission Emails & Admission Letters
-- ============================================================

-- Flags admission-type email templates so the admission letter
-- workflow can resolve the correct template per student.
ALTER TABLE email_processes ADD COLUMN IF NOT EXISTS is_admission BOOLEAN NOT NULL DEFAULT FALSE;

-- Seed the default Admission Offer email template (dynamic per-student letter).
-- Body/subject use template variables such as {{student_name}}, {{admission_no}},
-- {{course_name}}, {{course_start_date}}, {{academic_session}}.
INSERT INTO email_processes (name, subject_template, body_template, rich_body, channel, archived, is_admission, created_by)
SELECT
  'Admission Offer',
  'Offer of Admission — {{student_name}}',
  $body$OFFER OF ADMISSION INTO THE {{course_name}} PROGRAMME
{{academic_session}} ACADEMIC SESSION

Dear {{student_name}},

Regarding your application for admission into {{course_name}}, I am pleased to inform you that you have been offered admission to pursue an academic programme with effect from {{course_start_date}}.

Please take note of the following conditions related to your admission:
1. That you commit to submitting to the seminary's rules.
2. That you commit to attending all classes as stipulated in the time-table.
3. That you commit to completing all assignments on time as at when due.
4. That you commit to all practical ministry tasks assigned.
5. That you behave respectfully to both colleagues and faculty.
6. That you commit to complete the entire (chosen) course.

GTS has the right to terminate this admission at will, without contest or arbitration.

My prayer is that you may not only grow in grace and the knowledge of our Saviour Jesus Christ, but that you may be a doer of God's word.

Congratulations and welcome to GTS.

Yours in Christ

Pastor Tony Okoroh
President

Joel Uzamere
Rector

Admission Number: {{admission_no}}
Admission Date: {{admission_date}}$body$,
  NULL,
  'email',
  FALSE,
  TRUE,
  (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM email_processes WHERE is_admission = TRUE);

-- Admission-specific template variables (new keys) — existing keys are reused
-- for student/course/school context (student_name, matric_no, course_name, course_code,
-- course_start_date, school_name, current_date, instructor_name, ...).
INSERT INTO template_variables (category, variable_key, display_label, description, example_value, sort_order)
VALUES
  ('admission', 'admission_no', 'Admission Number', 'Admission/offer number assigned to the student', '2025/GTT00168', 200),
  ('admission', 'admission_date', 'Admission Date', 'Date of admission/offer', 'February 2025', 201),
  ('admission', 'academic_session', 'Academic Session', 'Academic session year the admission falls in', '2025', 202),
  ('admission', 'degree_award', 'Degree Award', 'Award the student will receive', 'Associate of Arts (AA)', 203)
ON CONFLICT (variable_key) DO NOTHING;
