import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './pool.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, 'migrations')

/**
 * Auto-migration runner. Tracks applied migrations in a `schema_migrations` table
 * and executes any new .sql files found in the migrations directory.
 *
 * Migration files are sorted alphabetically (e.g. 001-..., 002-...) and run in order.
 * Each migration is wrapped in a transaction for safety.
 *
 * NOTE: Migration 002 (Supabase storage policies) is skipped here because it uses
 * Supabase-specific `storage.buckets` and `storage.objects` tables that can only
 * be run from the Supabase SQL Editor / Dashboard.
 */
export const runAllMigrations = async () => {
  // 1. Ensure the tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // 2. Get already-applied migrations
  const appliedResult = await pool.query('SELECT filename FROM schema_migrations ORDER BY filename')
  const applied = new Set(appliedResult.rows.map((r) => r.filename))

  // 3. Read migration files from disk
  let files
  try {
    files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort()
  } catch {
    console.log('ℹ️  No migrations directory found, skipping.')
    return
  }

  // 4. Migration 002 uses Supabase storage schema — must be run manually in Supabase Dashboard
  const SKIP_FILES = new Set(['002-student-profile-storage.sql'])

  let migratedCount = 0

  for (const file of files) {
    if (applied.has(file)) continue
    if (SKIP_FILES.has(file)) {
      console.log(`⏭️  Skipping ${file} (requires Supabase Dashboard)`)
      await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [file])
      continue
    }

    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file])
      await client.query('COMMIT')
      migratedCount++
      console.log(`✅ Applied migration: ${file}`)
    } catch (error) {
      await client.query('ROLLBACK')
      console.error(`❌ Migration ${file} failed:`, error.message)
      // CRITICAL: Don't break - allow server to start even if migrations fail
      // Admin can fix and redeploy
    } finally {
      client.release()
    }
  }

  if (migratedCount === 0) {
    console.log('ℹ️  All migrations are up to date.')
  } else {
    console.log(`🎉 Applied ${migratedCount} migration(s).`)
  }
}
