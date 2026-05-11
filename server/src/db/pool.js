import dns from 'node:dns'
import pg from 'pg'
import { env } from '../config/env.js'

const { Pool } = pg

const parseDbUrl = (url) => {
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/)
  if (!match) return null
  return {
    user: match[1],
    password: decodeURIComponent(match[2]),
    host: match[3],
    port: parseInt(match[4], 10),
    database: match[5],
  }
}

const dbConfig = parseDbUrl(env.databaseUrl)

const lookup = (hostname, options, callback) => {
  dns.lookup(hostname, { family: 4 }, callback)
}

export const pool = new Pool({
  ...(dbConfig || { connectionString: env.databaseUrl }),
  ssl: env.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
  lookup,
})

export const query = (text, params = []) => pool.query(text, params)
