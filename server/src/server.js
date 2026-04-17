import app from './app.js'
import { env } from './config/env.js'
import { pool } from './db/pool.js'

const runMigrations = async () => {
  // 1. Drop NOT NULL from matric_no if still required (idempotent).
  //    Uses EXISTS so the result is always boolean — never NULL.
  await pool.query(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'students'
          AND column_name = 'matric_no' AND is_nullable = 'NO'
      ) THEN
        ALTER TABLE students ALTER COLUMN matric_no DROP NOT NULL;
      END IF;
    END $$`)

  // 2. Widen matric_no to VARCHAR(20) if still narrow (idempotent).
  await pool.query(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'students'
          AND column_name = 'matric_no' AND character_maximum_length < 20
      ) THEN
        ALTER TABLE students ALTER COLUMN matric_no TYPE VARCHAR(20);
      END IF;
    END $$`)

  // 3. Create the matric sequence if it doesn't yet exist.
  await pool.query(`CREATE SEQUENCE IF NOT EXISTS students_matric_seq START 1`)

  // 4. Seed the sequence from existing data so new matric numbers don't collide.
  //    Done in JS so the compare-and-setval logic is easy to follow.
  const maxRow = await pool.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(matric_no FROM 4) AS INT)), 0)::int AS max
     FROM students WHERE matric_no ~ '^GTT[0-9]+$'`
  )
  const dbMax = Number(maxRow.rows[0].max)
  if (dbMax > 0) {
    const seqRow = await pool.query(`SELECT last_value, is_called FROM students_matric_seq`)
    const seqCur = seqRow.rows[0].is_called ? Number(seqRow.rows[0].last_value) : 0
    if (dbMax > seqCur) {
      await pool.query(`SELECT setval('students_matric_seq', $1, true)`, [dbMax])
    }
  }
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
