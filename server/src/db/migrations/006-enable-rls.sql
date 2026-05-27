-- Enable RLS on all public tables and create default deny policies.
-- Your Node.js backend connects directly via connection string (bypasses RLS),
-- so this only locks down Supabase's auto-generated REST API.
-- Run this in Supabase SQL Editor.

DO $$
DECLARE
  tbl TEXT;
  pol TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('schema_migrations')
  LOOP
    pol := tbl || '_deny_all';
    EXECUTE 'ALTER TABLE ' || quote_ident(tbl) || ' ENABLE ROW LEVEL SECURITY;';
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol) || ' ON ' || quote_ident(tbl) || ';';
    EXECUTE 'CREATE POLICY ' || quote_ident(pol) || ' ON ' || quote_ident(tbl) || ' FOR ALL USING (false) WITH CHECK (false);';
  END LOOP;
END $$;
