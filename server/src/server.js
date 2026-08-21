import dns from 'node:dns'
dns.setDefaultResultOrder('ipv4first')

import app from './app.js'
import { env } from './config/env.js'
import { pool } from './db/pool.js'
import { runAllMigrations } from './db/runMigrations.js'

const runMigrations = async () => {
  // 1. Drop NOT NULL from matric_no if still required (idempotent).
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

const bootDatabase = async () => {
  try {
    console.log('🔌 Connecting to database...')
    await pool.query('SELECT 1')
    console.log('✅ Database connected.')

    console.log('📦 Starting migrations...')
    await runAllMigrations()
    await runMigrations()
    console.log('✅ Migrations complete.')
  } catch (error) {
    console.error('⚠️  Database/migration error (API still serving):', error.message)
    console.error('   Fix DATABASE_URL / network, or redeploy. Health stays up so Render can start.')
  }
}

// Bind the port FIRST so Render health checks succeed during cold start.
// DB + migrations run in the background and must never block listen().
const port = env.port || Number(process.env.PORT) || 5000

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 SAMS API listening on 0.0.0.0:${port}`)
  console.log(`   Health: http://localhost:${port}/api/health`)
  bootDatabase()
})
