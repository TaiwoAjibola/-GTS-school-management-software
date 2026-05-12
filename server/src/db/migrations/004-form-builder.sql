-- Form Builder System
-- Supports dynamic forms for applications, onboarding, surveys, etc.

-- Forms table
CREATE TABLE IF NOT EXISTS forms (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  slug VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'draft', -- draft, active, closed
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Form fields table
CREATE TABLE IF NOT EXISTS form_fields (
  id SERIAL PRIMARY KEY,
  form_id INTEGER REFERENCES forms(id) ON DELETE CASCADE,
  field_type VARCHAR(50) NOT NULL, -- text, textarea, number, email, phone, select, multiselect, checkbox, radio, date, file
  label VARCHAR(255) NOT NULL,
  placeholder VARCHAR(255),
  required BOOLEAN DEFAULT false,
  options JSONB, -- for select, multiselect, radio: array of {label, value}
  validation JSONB, -- {min, max, pattern, min_length, max_length}
  order_index INTEGER DEFAULT 0,
  section VARCHAR(255), -- optional grouping of fields
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Form submissions table
CREATE TABLE IF NOT EXISTS form_submissions (
  id SERIAL PRIMARY KEY,
  form_id INTEGER REFERENCES forms(id) ON DELETE CASCADE,
  submitter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  submitter_name VARCHAR(255),
  submitter_email VARCHAR(255),
  data JSONB NOT NULL, -- {field_id: value, ...}
  status VARCHAR(50) DEFAULT 'submitted', -- submitted, reviewed, approved, rejected
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_forms_slug ON forms(slug);
CREATE INDEX IF NOT EXISTS idx_forms_status ON forms(status);
CREATE INDEX IF NOT EXISTS idx_form_fields_form_id ON form_fields(form_id);
CREATE INDEX IF NOT EXISTS idx_form_fields_order ON form_fields(form_id, order_index);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_id ON form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON form_submissions(form_id, status);
