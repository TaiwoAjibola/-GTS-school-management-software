import { query } from '../db/pool.js'

let settingsCache = null
let cacheExpiry = 0
const CACHE_TTL = 60 * 1000 // 60 seconds

export const loadSettings = async (forceRefresh = false) => {
  const now = Date.now()
  if (!forceRefresh && settingsCache && now < cacheExpiry) {
    return settingsCache
  }

  try {
    const result = await query('SELECT key, value FROM settings')
    settingsCache = {}
    for (const row of result.rows) {
      settingsCache[row.key] = row.value
    }
    cacheExpiry = now + CACHE_TTL
    return settingsCache
  } catch {
    return settingsCache || {}
  }
}

export const getSetting = async (key, defaultValue = '') => {
  const settings = await loadSettings()
  return settings[key] !== undefined ? settings[key] : defaultValue
}

export const clearSettingsCache = () => {
  settingsCache = null
  cacheExpiry = 0
}
