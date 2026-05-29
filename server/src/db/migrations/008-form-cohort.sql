-- Replace batch_id (course instance) with cohort_id (student group) on forms
ALTER TABLE forms DROP COLUMN IF EXISTS batch_id;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS cohort_id INTEGER REFERENCES cohorts(id);
