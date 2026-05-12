import { query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'

// ── List all email processes ───────────────────────────────────────
export const listProcesses = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, process_key, display_name, description, category, subject_template, body_template, available_variables, enabled, updated_at
       FROM email_processes
       ORDER BY category, display_name`
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

// ── Get single email process ───────────────────────────────────────
export const getProcess = async (req, res, next) => {
  try {
    const { id } = req.params
    const result = await query('SELECT * FROM email_processes WHERE id = $1', [id])
    if (!result.rows.length) throw httpError(404, 'Email process not found')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// ── Update an email process ────────────────────────────────────────
export const updateProcess = async (req, res, next) => {
  try {
    const { id } = req.params
    const { subjectTemplate, bodyTemplate, enabled } = req.body

    const result = await query(
      `UPDATE email_processes
       SET subject_template = COALESCE($1, subject_template),
           body_template = COALESCE($2, body_template),
           enabled = COALESCE($3, enabled),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [subjectTemplate, bodyTemplate, enabled, id]
    )

    if (!result.rows.length) throw httpError(404, 'Email process not found')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// ── Toggle process enabled/disabled ────────────────────────────────
export const toggleProcess = async (req, res, next) => {
  try {
    const { id } = req.params
    const result = await query(
      `UPDATE email_processes
       SET enabled = NOT enabled, updated_at = NOW()
       WHERE id = $1
       RETURNING id, process_key, enabled`,
      [id]
    )
    if (!result.rows.length) throw httpError(404, 'Email process not found')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// ── Send test email for a process ──────────────────────────────────
export const sendTestEmail = async (req, res, next) => {
  try {
    const { id } = req.params
    const { recipientEmail } = req.body

    if (!recipientEmail) throw httpError(400, 'recipientEmail is required')

    const result = await query('SELECT * FROM email_processes WHERE id = $1', [id])
    if (!result.rows.length) throw httpError(404, 'Email process not found')

    const process = result.rows[0]

    // Build sample variables for testing
    const sampleVars = {}
    const vars = Array.isArray(process.available_variables) ? process.available_variables : []
    for (const v of vars) {
      sampleVars[v] = `[Sample ${v}]`
    }

    // Import sendProcessEmail lazily to avoid circular deps
    const { sendProcessEmail } = await import('../services/emailService.js')
    const sent = await sendProcessEmail(process.process_key, sampleVars, recipientEmail)

    if (sent) {
      res.json({ message: 'Test email sent successfully' })
    } else {
      throw httpError(500, 'Email sending failed. Check SMTP configuration.')
    }
  } catch (error) {
    next(error)
  }
}
