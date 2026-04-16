import app from './app.js'
import { env } from './config/env.js'
import { pool } from './db/pool.js'

const runMigrations = async () => {
  // Each step wrapped in PL/pgSQL so it's truly idempotent — safe every boot.
  await pool.query(`
    DO $$ BEGIN
      IF (SELECT is_nullable FROM information_schema.columns
          WHERE table_name = 'students' AND column_name = 'matric_no') = 'NO' THEN
        ALTER TABLE students ALTER COLUMN matric_no DROP NOT NULL;
      END IF;
    END $$`)

  await pool.query(`
    DO $$ BEGIN
      IF (SELECT character_maximum_length FROM information_schema.columns
          WHERE table_name = 'students' AND column_name = 'matric_no') < 20 THEN
        ALTER TABLE students ALTER COLUMN matric_no TYPE VARCHAR(20);
      END IF;
    END $$`)

  // Create a sequence for matric numbers if it doesn't exist, seeded from existing data.
  await pool.query(`
    DO $$
    DECLARE max_seq INT;
    BEGIN
      CREATE SEQUENCE IF NOT EXISTS students_matric_seq START 1;
      SELECT COALESCE(MAX(CAST(SUBSTRING(matric_no FROM 4) AS INT)), 0)
      INTO max_seq
      FROM students
      WHERE matric_no ~ '^GTT[0-9]+$';
      IF max_seq > 0 THEN
        PERFORM setval('students_matric_seq', max_seq, true);
      END IF;
    END $$`)
}

const start = async () => {
  try {
    await pool.query('SELECT 1')
    await runMigrations()
    app.listen(env.port, () => {
      console.log(`SAMS API running on port ${env.port}`)
    })
  } catch (error) {
    console.error('Failed to start server', error)
    process.exit(1)
  }
}

start()
