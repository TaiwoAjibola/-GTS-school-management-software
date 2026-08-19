-- 015-exam-types.sql
-- Adds exam type (essay vs MCQ) support with per-student quiz access codes.

ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS exam_type VARCHAR(10) NOT NULL DEFAULT 'essay'
    CHECK (exam_type IN ('essay', 'mcq'));
ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS quiz_url TEXT;

ALTER TABLE exam_deliveries
  ADD COLUMN IF NOT EXISTS access_code VARCHAR(24);