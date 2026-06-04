import { query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'
import { clearTransporterCache } from '../services/emailService.js'

export const getAllSettings = async (req, res, next) => {
  try {
    const result = await query('SELECT key, value, description FROM settings ORDER BY key ASC')
    const settings = {}
    for (const row of result.rows) {
      settings[row.key] = { value: row.value, description: row.description }
    }
    res.json(settings)
  } catch (error) {
    next(error)
  }
}

export const updateSetting = async (req, res, next) => {
  try {
    const { key } = req.params
    const { value } = req.body

    if (!key) {
      throw httpError(400, 'Setting key is required')
    }

    const result = await query(
      `INSERT INTO settings (key, value, description, updated_at)
       VALUES ($1, $2, (SELECT description FROM settings WHERE key = $1), NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
       RETURNING key, value, description`,
      [key, value || '']
    )

    if (!result.rows.length) {
      throw httpError(404, 'Setting not found')
    }

    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export const updateSettingsBulk = async (req, res, next) => {
  const client = await query('SELECT 1').then(() => null).catch(() => null)
  try {
    const { settings } = req.body
    if (!settings || typeof settings !== 'object') {
      throw httpError(400, 'Settings object is required')
    }

    const results = []
    for (const [key, value] of Object.entries(settings)) {
      const result = await query(
        `INSERT INTO settings (key, value, description, updated_at)
         VALUES ($1, $2, (SELECT description FROM settings WHERE key = $1), NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
         RETURNING key, value, description`,
        [key, value || '']
      )
      if (result.rows.length) {
        results.push(result.rows[0])
      }
    }

    // Clear SMTP transporter cache if SMTP settings changed
    const smtpKeys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'email_from', 'email_enabled']
    const changedSmtp = Object.keys(settings).some((k) => smtpKeys.includes(k))
    if (changedSmtp) clearTransporterCache()

    res.json({ updated: results.length, settings: results })
  } catch (error) {
    next(error)
  }
}

export const getSetting = async (req, res, next) => {
  try {
    const { key } = req.params
    const result = await query('SELECT key, value, description FROM settings WHERE key = $1', [key])

    if (!result.rows.length) {
      throw httpError(404, 'Setting not found')
    }

    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}
