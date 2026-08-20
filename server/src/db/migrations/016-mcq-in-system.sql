-- 016-mcq-in-system.sql
-- In-system MCQ exams: options + correct answer, public take token, submissions + auto-score.

ALTER TABLE exams
  ADD COLUMN IF NOT EXISTS public_token VARCHAR(48);

CREATE UNIQUE INDEX IF NOT EXISTS idx_exams_public_token
  ON exams (public_token)
  WHERE public_token IS NOT NULL;

ALTER TABLE exam_questions
  ADD COLUMN IF NOT EXISTS options JSONB,
  ADD COLUMN IF NOT EXISTS correct_answer VARCHAR(8);

CREATE TABLE IF NOT EXISTS exam_submissions (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  delivery_id INTEGER REFERENCES exam_deliveries(id) ON DELETE SET NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  score NUMERIC(6,2),
  total_questions INTEGER,
  correct_count INTEGER,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  result_sent_at TIMESTAMPTZ,
  UNIQUE (exam_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_submissions_exam_id ON exam_submissions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_submissions_student_id ON exam_submissions(student_id);
