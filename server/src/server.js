import app from './app.js'
import { env } from './config/env.js'
import { pool } from './db/pool.js'

const runMigrations = async () => {
  // Make matric_no nullable so Prospective students can be uploaded without one.
  // ALTER COLUMN is idempotent — safe to run every boot.
  await pool.query(`ALTER TABLE students ALTER COLUMN matric_no DROP NOT NULL`)
  await pool.query(`ALTER TABLE students ALTER COLUMN matric_no TYPE VARCHAR(20)`)
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
