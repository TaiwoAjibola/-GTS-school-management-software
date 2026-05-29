-- Form builder enhancements: student mapping, layout, conditional fields, logos

ALTER TABLE forms
  ADD COLUMN IF NOT EXISTS maps_to_student BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS batch_id INTEGER REFERENCES batches(id),
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE form_fields
  ADD COLUMN IF NOT EXISTS width VARCHAR(10) DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS field_conditions JSONB,
  ADD COLUMN IF NOT EXISTS maps_to_column VARCHAR(50);

ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS student_id INTEGER REFERENCES students(id);
