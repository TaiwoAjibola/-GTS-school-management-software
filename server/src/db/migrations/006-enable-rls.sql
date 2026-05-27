-- Enable RLS on all public tables and create default deny policies.
-- Your Node.js backend connects directly via connection string (bypasses RLS),
-- so this only locks down Supabase's auto-generated REST API.
-- Run this in Supabase SQL Editor.

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('schema_migrations')
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);

    -- Drop existing policies if any
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', tbl || '_deny_all', tbl);

    -- Create default deny policy (blocks all access via Supabase API)
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (false) WITH CHECK (false);',
      tbl || '_deny_all',
      tbl
    );
  END LOOP;
END $$;
