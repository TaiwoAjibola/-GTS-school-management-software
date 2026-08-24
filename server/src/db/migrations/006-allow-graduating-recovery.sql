-- Allow recovery transitions from Graduating (bug fix: Graduating -> On Hold was blocked)
INSERT INTO status_transition_rules (from_status, to_status) VALUES
  ('Graduating', 'On Hold'),
  ('Graduating', 'Active'),
  ('Graduating', 'Suspended'),
  ('Graduating', 'Withdrawn')
ON CONFLICT (from_status, to_status) DO NOTHING;
