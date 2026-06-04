import { query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'

// ── List all email processes ───────────────────────────────────────
export const listProcesses = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT ep.id, ep.process_key, ep.display_name, ep.description, ep.category,
              ep.subject_template, ep.body_template, ep.rich_body,
              ep.available_variables, ep.enabled, ep.channel,
              ep.archived, ep.can_manual_send, ep.updated_at,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', tv.id, 'variable_key', tv.variable_key,
                    'display_label', tv.display_label, 'description', tv.description,
                    'example_value', tv.example_value, 'sort_order', tv.sort_order
                  )
                  ORDER BY tv.sort_order, tv.variable_key
                ) FILTER (WHERE tv.id IS NOT NULL),
                '[]'
              ) AS variables
       FROM email_processes ep
       LEFT JOIN template_variables tv ON tv.process_id = ep.id
       GROUP BY ep.id
       ORDER BY ep.category, ep.display_name`
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
    const result = await query(
      `SELECT ep.*,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', tv.id, 'variable_key', tv.variable_key,
                    'display_label', tv.display_label, 'description', tv.description,
                    'example_value', tv.example_value, 'sort_order', tv.sort_order
                  )
                  ORDER BY tv.sort_order, tv.variable_key
                ) FILTER (WHERE tv.id IS NOT NULL),
                '[]'
              ) AS variables
       FROM email_processes ep
       LEFT JOIN template_variables tv ON tv.process_id = ep.id
       WHERE ep.id = $1
       GROUP BY ep.id`,
      [id]
    )
    if (!result.rows.length) throw httpError(404, 'Email process not found')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// ── Update an email process (full template) ────────────────────────
export const updateProcess = async (req, res, next) => {
  try {
    const { id } = req.params
    const {
      displayName, description, category, subjectTemplate, bodyTemplate,
      richBody, channel, enabled, canManualSend
    } = req.body

    const result = await query(
      `UPDATE email_processes
       SET display_name = COALESCE($1, display_name),
           description = COALESCE($2, description),
           category = COALESCE($3, category),
           subject_template = COALESCE($4, subject_template),
           body_template = COALESCE($5, body_template),
           rich_body = COALESCE($6, rich_body),
           channel = COALESCE($7, channel),
           enabled = COALESCE($8, enabled),
           can_manual_send = COALESCE($9, can_manual_send),
           updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [displayName, description, category, subjectTemplate, bodyTemplate, richBody, channel, enabled, canManualSend, id]
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

// ── Archive a process (soft-delete) ────────────────────────────────
export const archiveProcess = async (req, res, next) => {
  try {
    const { id } = req.params
    const result = await query(
      `UPDATE email_processes
       SET archived = true, enabled = false, updated_at = NOW()
       WHERE id = $1
       RETURNING id, process_key, archived`,
      [id]
    )
    if (!result.rows.length) throw httpError(404, 'Email process not found')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// ── Duplicate a process ────────────────────────────────────────────
export const duplicateProcess = async (req, res, next) => {
  try {
    const { id } = req.params
    const original = await query('SELECT * FROM email_processes WHERE id = $1', [id])
    if (!original.rows.length) throw httpError(404, 'Email process not found')

    const o = original.rows[0]
    const dupResult = await query(
      `INSERT INTO email_processes (process_key, display_name, description, category,
        subject_template, body_template, rich_body, channel, available_variables, enabled, can_manual_send)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10)
       RETURNING *`,
      [
        `${o.process_key}_copy_${Date.now()}`,
        `${o.display_name} (Copy)`,
        o.description,
        o.category,
        o.subject_template,
        o.body_template,
        o.rich_body,
        o.channel,
        o.available_variables,
        o.can_manual_send,
      ]
    )

    const newId = dupResult.rows[0].id

    // Duplicate variables
    const vars = await query(
      'SELECT variable_key, display_label, description, example_value, sort_order FROM template_variables WHERE process_id = $1',
      [id]
    )
    for (const v of vars.rows) {
      await query(
        `INSERT INTO template_variables (process_id, variable_key, display_label, description, example_value, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [newId, v.variable_key, v.display_label, v.description, v.example_value, v.sort_order]
      )
    }

    res.status(201).json(dupResult.rows[0])
  } catch (error) {
    next(error)
  }
}

// ── Preview rendered template with sample variables ────────────────
export const previewProcess = async (req, res, next) => {
  try {
    const { id } = req.params

    const result = await query('SELECT * FROM email_processes WHERE id = $1', [id])
    if (!result.rows.length) throw httpError(404, 'Email process not found')

    const process = result.rows[0]
    const vars = Array.isArray(process.available_variables) ? process.available_variables : []

    // Build sample values from template_variables or fallback
    const sampleValues = {}
    const tvResult = await query(
      'SELECT variable_key, example_value FROM template_variables WHERE process_id = $1',
      [id]
    )
    const tvMap = {}
    for (const row of tvResult.rows) {
      tvMap[row.variable_key] = row.example_value
    }
    for (const v of vars) {
      sampleValues[v] = tvMap[v] || `[${v}]`
    }

    const renderTemplate = (template) => {
      if (!template) return ''
      return template.replace(/\{\{(\w+)\}\}/g, (_, key) => sampleValues[key] || `{{${key}}}`)
    }

    res.json({
      subject: renderTemplate(process.subject_template),
      body: renderTemplate(process.body_template),
      richBody: process.rich_body,
      variables: tvResult.rows,
    })
  } catch (error) {
    next(error)
  }
}

// ── Manual send: send template to selected recipients ─────────────
export const manualSend = async (req, res, next) => {
  try {
    const { id } = req.params
    const { recipientIds, recipientType } = req.body

    if (!recipientIds || !Array.isArray(recipientIds) || !recipientIds.length) {
      throw httpError(400, 'recipientIds array is required')
    }

    const procResult = await query(
      'SELECT * FROM email_processes WHERE id = $1 AND can_manual_send = true',
      [id]
    )
    if (!procResult.rows.length) throw httpError(404, 'Manual send not allowed for this process')

    const process = procResult.rows[0]

    // Fetch recipients
    let recipients
    if (recipientType === 'student') {
      const r = await query(
        'SELECT id, full_name, email, phone FROM students WHERE id = ANY($1::int[])',
        [recipientIds]
      )
      recipients = r.rows
    } else {
      const r = await query(
        'SELECT id, full_name, email FROM users WHERE id = ANY($1::int[])',
        [recipientIds]
      )
      recipients = r.rows
    }

    if (!recipients.length) throw httpError(404, 'No recipients found')

    const { sendProcessEmail } = await import('../services/emailService.js')
    let sentCount = 0
    const errors = []

    for (const recipient of recipients) {
      const sampleVars = {
        student_full_name: recipient.full_name,
        student_email: recipient.email,
        student_phone: recipient.phone || '',
      }
      try {
        const sent = await sendProcessEmail(process.process_key, sampleVars, recipient.email)
        if (sent) sentCount++
        else errors.push(`${recipient.email}: sending failed`)
      } catch (err) {
        errors.push(`${recipient.email}: ${err.message}`)
      }
    }

    // Log the communication
    await query(
      `INSERT INTO communication_log
        (process_id, process_key, recipient_type, recipient_count, recipient_preview,
         sender_id, subject_text, body_text, channel, status, error_message, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
      [
        process.id,
        process.process_key,
        recipientType,
        recipients.length,
        recipients.map((r) => r.email).join(', '),
        req.user.id,
        process.subject_template,
        process.body_template,
        process.channel,
        errors.length === 0 ? 'sent' : sentCount > 0 ? 'partial' : 'failed',
        errors.length ? errors.join('; ') : null,
      ]
    )

    res.json({
      message: `Sent to ${sentCount}/${recipients.length} recipients`,
      sentCount,
      totalCount: recipients.length,
      errors: errors.length ? errors : undefined,
    })
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

// ── Template Variables CRUD ────────────────────────────────────────
export const listVariables = async (req, res, next) => {
  try {
    const { processId } = req.params
    const result = await query(
      `SELECT * FROM template_variables
       WHERE process_id = $1
       ORDER BY sort_order, variable_key`,
      [processId]
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const createVariable = async (req, res, next) => {
  try {
    const { processId } = req.params
    const { variableKey, displayLabel, description, exampleValue, sortOrder } = req.body

    if (!variableKey || !displayLabel) throw httpError(400, 'variableKey and displayLabel are required')

    const result = await query(
      `INSERT INTO template_variables (process_id, variable_key, display_label, description, example_value, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [processId, variableKey, displayLabel, description || null, exampleValue || null, sortOrder ?? 0]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export const updateVariable = async (req, res, next) => {
  try {
    const { variableId } = req.params
    const { variableKey, displayLabel, description, exampleValue, sortOrder } = req.body

    const result = await query(
      `UPDATE template_variables
       SET variable_key = COALESCE($1, variable_key),
           display_label = COALESCE($2, display_label),
           description = COALESCE($3, description),
           example_value = COALESCE($4, example_value),
           sort_order = COALESCE($5, sort_order),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [variableKey, displayLabel, description, exampleValue, sortOrder, variableId]
    )
    if (!result.rows.length) throw httpError(404, 'Variable not found')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export const deleteVariable = async (req, res, next) => {
  try {
    const { variableId } = req.params
    const result = await query('DELETE FROM template_variables WHERE id = $1 RETURNING id', [variableId])
    if (!result.rows.length) throw httpError(404, 'Variable not found')
    res.json({ message: 'Variable deleted' })
  } catch (error) {
    next(error)
  }
}

// ── Communication Log ──────────────────────────────────────────────
export const listCommunicationLog = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT cl.*, u.full_name AS sender_name
       FROM communication_log cl
       LEFT JOIN users u ON u.id = cl.sender_id
       ORDER BY cl.created_at DESC
       LIMIT 100`
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}
