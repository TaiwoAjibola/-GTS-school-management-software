-- Allow backward transitions for graduation corrections
-- (fix: Graduated -> Graduating/Active should be allowed)
INSERT INTO status_transition_rules (from_status, to_status) VALUES
  ('Graduated', 'Graduating'),
  ('Graduated', 'Active'),
  ('Graduated', 'Completed'),
  ('Graduated', 'On Hold'),
  ('Graduated', 'Suspended'),
  ('Graduated', 'Withdrawn'),
  ('Completed', 'Graduating'),
  ('Completed', 'Active'),
  ('Alumni', 'Graduated'),
  ('Alumni', 'Graduating'),
  ('Alumni', 'Active'),
  ('Alumni', 'Completed')
ON CONFLICT (from_status, to_status) DO NOTHING;
