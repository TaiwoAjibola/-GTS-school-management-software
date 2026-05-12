import dns from 'node:dns'
import pg from 'pg'
import { env } from '../config/env.js'

const { Pool } = pg

// Force IPv4 for database connections to avoid Render/Supabase connection issues
const lookup = (hostname, options, callback) => {
  dns.lookup(hostname, { family: 4 }, callback)
}

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
  lookup,
})

export const query = (text, params = []) => pool.query(text, params)

export const healthCheck = async () => {
  try {
    await query('SELECT 1')
    return { status: 'ok', database: 'connected' }
  } catch (err) {
    console.error('Database health check failed:', err)
    return { status: 'error', database: 'disconnected', message: err.message }
  }
}
