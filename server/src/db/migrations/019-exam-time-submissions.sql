-- Exam time windows, submission marking pipeline, and published results gate

ALTER TABLE exams ADD COLUMN IF NOT EXISTS open_at TIMESTAMPTZ;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS close_at TIMESTAMPTZ;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS duration_minutes INT;

ALTER TABLE exam_submissions ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'submitted';
ALTER TABLE exam_submissions ADD COLUMN IF NOT EXISTS feedback_text TEXT;
ALTER TABLE exam_submissions ADD COLUMN IF NOT EXISTS graded_by INT;
ALTER TABLE exam_submissions ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ;

ALTER TABLE results ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE results ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE results ADD COLUMN IF NOT EXISTS feedback_text TEXT;
