-- Exam timer (per-exam duration + anchor on unlock) and "paper" exam type

ALTER TABLE exams ADD COLUMN IF NOT EXISTS duration_minutes INT;
ALTER TABLE exam_deliveries ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ;

-- Allow 'paper' exam type (students write one formatted paper in the LMS)
ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_exam_type_check;
ALTER TABLE exams ADD CONSTRAINT exams_exam_type_check
  CHECK (exam_type IN ('essay', 'mcq', 'paper'));
