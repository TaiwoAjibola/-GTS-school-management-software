import { query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'

// ── List all templates (no hard-coded, no filters) ─────────────────
export const listProcesses = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT ep.id, ep.name, ep.subject_template, ep.body_template, ep.rich_body,
              ep.channel, ep.archived, ep.created_by, ep.created_at, ep.updated_at,
              u.full_name AS creator_name
       FROM email_processes ep
       LEFT JOIN users u ON u.id = ep.created_by
       WHERE ep.archived = false
       ORDER BY ep.updated_at DESC`
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

// ── Get single template ────────────────────────────────────────────
export const getProcess = async (req, res, next) => {
  try {
    const { id } = req.params
    const result = await query(
      `SELECT ep.*, u.full_name AS creator_name
       FROM email_processes ep
       LEFT JOIN users u ON u.id = ep.created_by
       WHERE ep.id = $1`,
      [id]
    )
    if (!result.rows.length) throw httpError(404, 'Template not found')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// ── Create a new blank template ────────────────────────────────────
export const createProcess = async (req, res, next) => {
  try {
    const { name, subject_template, body_template, rich_body, channel } = req.body
    if (!name) throw httpError(400, 'Template name is required')

    const result = await query(
      `INSERT INTO email_processes (name, subject_template, body_template, rich_body, channel, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, subject_template || '', body_template || '', rich_body || null, channel || 'email', req.user.id]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// ── Update a template ──────────────────────────────────────────────
export const updateProcess = async (req, res, next) => {
  try {
    const { id } = req.params
    const { name, subject_template, body_template, rich_body, channel } = req.body

    const result = await query(
      `UPDATE email_processes
       SET name = COALESCE($1, name),
           subject_template = COALESCE($2, subject_template),
           body_template = COALESCE($3, body_template),
           rich_body = COALESCE($4, rich_body),
           channel = COALESCE($5, channel),
           updated_at = NOW()
       WHERE id = $6 AND archived = false
       RETURNING *`,
      [name, subject_template, body_template, rich_body, channel, id]
    )
    if (!result.rows.length) throw httpError(404, 'Template not found or archived')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// ── Delete a template ──────────────────────────────────────────────
export const deleteProcess = async (req, res, next) => {
  try {
    const { id } = req.params
    const result = await query(
      'DELETE FROM email_processes WHERE id = $1 RETURNING id',
      [id]
    )
    if (!result.rows.length) throw httpError(404, 'Template not found')
    res.json({ message: 'Template deleted' })
  } catch (error) {
    next(error)
  }
}

// ── Duplicate a template ───────────────────────────────────────────
export const duplicateProcess = async (req, res, next) => {
  try {
    const { id } = req.params
    const original = await query('SELECT * FROM email_processes WHERE id = $1', [id])
    if (!original.rows.length) throw httpError(404, 'Template not found')

    const o = original.rows[0]
    const result = await query(
      `INSERT INTO email_processes (name, subject_template, body_template, rich_body, channel, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [`${o.name} (Copy)`, o.subject_template, o.body_template, o.rich_body, o.channel, req.user.id]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// ── Preview template with sample or real data ──────────────────────
export const previewProcess = async (req, res, next) => {
  try {
    const { id } = req.params

    const result = await query('SELECT * FROM email_processes WHERE id = $1', [id])
    if (!result.rows.length) throw httpError(404, 'Template not found')

    const process = result.rows[0]

    // Get all active global variables with sample values
    const tvResult = await query(
      'SELECT variable_key, display_label, example_value, category FROM template_variables WHERE is_active = true ORDER BY sort_order'
    )

    const sampleValues = {}
    for (const row of tvResult.rows) {
      sampleValues[row.variable_key] = row.example_value || `[${row.display_label}]`
    }

    const render = (template) => {
      if (!template) return ''
      return template.replace(/\{\{(\w+)\}\}/g, (_, key) => sampleValues[key] || `{{${key}}}`)
    }

    res.json({
      subject: render(process.subject_template),
      body: render(process.body_template),
      richBody: process.rich_body,
      variables: tvResult.rows,
    })
  } catch (error) {
    next(error)
  }
}

// ── Preview with real student data ─────────────────────────────────
export const previewWithStudent = async (req, res, next) => {
  try {
    const { id, studentId } = req.params

    const [procResult, studentResult] = await Promise.all([
      query('SELECT * FROM email_processes WHERE id = $1', [id]),
      query('SELECT * FROM students WHERE id = $1', [studentId]),
    ])
    if (!procResult.rows.length) throw httpError(404, 'Template not found')
    if (!studentResult.rows.length) throw httpError(404, 'Student not found')

    const process = procResult.rows[0]
    const s = studentResult.rows[0]

    // Build real values from student data
    const values = {
      student_name: s.full_name,
      student_email: s.email,
      student_phone: s.phone || '',
      student_id: s.id?.toString() || '',
      student_status: s.status || '',
      enrollment_date: s.created_at ? new Date(s.created_at).toLocaleDateString() : '',
      matric_no: s.matric_no || '',
      cohort_name: s.cohort_name || '',
    }

    const render = (template) => {
      if (!template) return ''
      return template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] || `{{${key}}}`)
    }

    res.json({
      subject: render(process.subject_template),
      body: render(process.body_template),
      richBody: process.rich_body,
      student: { id: s.id, full_name: s.full_name, email: s.email },
    })
  } catch (error) {
    next(error)
  }
}

// ── Send template to recipients ────────────────────────────────────
export const sendTemplate = async (req, res, next) => {
  try {
    const { id } = req.params
    const { recipientIds } = req.body

    if (!recipientIds || !Array.isArray(recipientIds) || !recipientIds.length) {
      throw httpError(400, 'recipientIds array is required')
    }

    const procResult = await query('SELECT * FROM email_processes WHERE id = $1 AND archived = false', [id])
    if (!procResult.rows.length) throw httpError(404, 'Template not found or archived')

    const process = procResult.rows[0]

    // Fetch recipients
    const students = await query(
      'SELECT id, full_name, email, phone, status, matric_no FROM students WHERE id = ANY($1::int[])',
      [recipientIds]
    )
    if (!students.rows.length) throw httpError(404, 'No recipients found')

    const { sendRawEmail } = await import('../services/emailService.js')
    let sentCount = 0
    const errors = []

    for (const s of students.rows) {
      const values = {
        student_name: s.full_name,
        student_email: s.email,
        student_phone: s.phone || '',
        student_id: s.id.toString(),
        student_status: s.status || '',
        matric_no: s.matric_no || '',
      }

      const render = (template) => {
        if (!template) return ''
        return template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] || `{{${key}}}`)
      }

      const subject = render(process.subject_template)
      const body = render(process.body_template)

      try {
        // Use sendRawEmail which takes direct subject/body
        // Importing emailService lazily
        const sent = await sendRawEmail({
          to: s.email,
          subject,
          html: body,
        })
        if (sent) sentCount++
        else errors.push(`${s.email}: sending failed`)
      } catch (err) {
        errors.push(`${s.email}: ${err.message}`)
      }
    }

    // Log the communication
    await query(
      `INSERT INTO communication_log
        (process_id, recipient_type, recipient_count, recipient_preview,
         sender_id, subject_text, body_text, channel, status, error_message, sent_at)
       VALUES ($1, 'student', $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        process.id,
        students.rows.length,
        students.rows.map((r) => r.email).join(', '),
        req.user.id,
        process.subject_template,
        process.body_template,
        process.channel,
        errors.length === 0 ? 'sent' : sentCount > 0 ? 'partial' : 'failed',
        errors.length ? errors.join('; ') : null,
      ]
    )

    res.json({
      message: `Sent to ${sentCount}/${students.rows.length} recipients`,
      sentCount,
      totalCount: students.rows.length,
      errors: errors.length ? errors : undefined,
    })
  } catch (error) {
    next(error)
  }
}

// ── Global Variable Library ────────────────────────────────────────
export const listGlobalVariables = async (req, res, next) => {
  try {
    const { category } = req.query
    let sql = 'SELECT * FROM template_variables WHERE is_active = true'
    const params = []
    if (category) {
      sql += ' AND category = $1'
      params.push(category)
    }
    sql += ' ORDER BY sort_order, display_label'
    const result = await query(sql, params)
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const listVariableCategories = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT category, COUNT(*)::int AS count FROM template_variables WHERE is_active = true GROUP BY category ORDER BY category'
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

// ── Communication Log ──────────────────────────────────────────────
export const listCommunicationLog = async (req, res, next) => {
  try {
    const { limit: limitParam } = req.query
    const rowLimit = Math.min(Number(limitParam) || 100, 500)
    const result = await query(
      `SELECT cl.*, u.full_name AS sender_name, ep.name AS template_name
       FROM communication_log cl
       LEFT JOIN users u ON u.id = cl.sender_id
       LEFT JOIN email_processes ep ON ep.id = cl.process_id
       ORDER BY cl.created_at DESC
       LIMIT $1`,
      [rowLimit]
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}
