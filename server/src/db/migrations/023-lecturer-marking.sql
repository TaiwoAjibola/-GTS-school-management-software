-- Lecturer marking pipeline: MCQ results release dates + exam-linked results

ALTER TABLE exams ADD COLUMN IF NOT EXISTS results_release_at TIMESTAMPTZ;

-- Tie result rows to the exam that produced them (drives released-gating + feedback display)
ALTER TABLE results ADD COLUMN IF NOT EXISTS exam_id INT REFERENCES exams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_results_exam_id ON results(exam_id);
