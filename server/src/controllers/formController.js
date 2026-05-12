import { pool, query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'

// ── Forms CRUD ──────────────────────────────────────────────────────

export const createForm = async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { title, description, slug, fields } = req.body

    if (!title || !slug) {
      throw httpError(400, 'Title and slug are required')
    }

    await client.query('BEGIN')

    const formResult = await client.query(
      `INSERT INTO forms (title, description, slug, status, created_by)
       VALUES ($1, $2, $3, 'draft', $4)
       RETURNING *`,
      [title, description || null, slug, req.user.userId]
    )

    const form = formResult.rows[0]

    if (fields && Array.isArray(fields)) {
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i]
        await client.query(
          `INSERT INTO form_fields (form_id, field_type, label, placeholder, required, options, validation, order_index, section)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            form.id,
            f.fieldType || f.field_type,
            f.label,
            f.placeholder || null,
            f.required || false,
            f.options ? JSON.stringify(f.options) : null,
            f.validation ? JSON.stringify(f.validation) : null,
            i,
            f.section || null,
          ]
        )
      }
    }

    await client.query('COMMIT')

    const fullForm = await getFormById(form.id)
    res.status(201).json(fullForm)
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
}

export const listForms = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT f.*, u.full_name AS created_by_name,
              (SELECT COUNT(*) FROM form_submissions WHERE form_id = f.id) AS submission_count
       FROM forms f
       LEFT JOIN users u ON u.id = f.created_by
       ORDER BY f.created_at DESC`
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const getForm = async (req, res, next) => {
  try {
    const { id } = req.params
    const form = await getFormById(id)
    if (!form) throw httpError(404, 'Form not found')
    res.json(form)
  } catch (error) {
    next(error)
  }
}

export const getFormBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params
    const formResult = await query('SELECT * FROM forms WHERE slug = $1', [slug])
    if (!formResult.rows.length) throw httpError(404, 'Form not found')

    const form = formResult.rows[0]
    const fieldsResult = await query(
      'SELECT * FROM form_fields WHERE form_id = $1 ORDER BY order_index ASC',
      [form.id]
    )
    res.json({ ...form, fields: fieldsResult.rows })
  } catch (error) {
    next(error)
  }
}

export const updateForm = async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { id } = req.params
    const { title, description, status, fields } = req.body

    await client.query('BEGIN')

    const formResult = await client.query(
      `UPDATE forms SET title = COALESCE($1, title), description = COALESCE($2, description), status = COALESCE($3, status), updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [title, description, status, id]
    )

    if (!formResult.rows.length) {
      throw httpError(404, 'Form not found')
    }

    if (fields && Array.isArray(fields)) {
      await client.query('DELETE FROM form_fields WHERE form_id = $1', [id])
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i]
        await client.query(
          `INSERT INTO form_fields (form_id, field_type, label, placeholder, required, options, validation, order_index, section)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            id,
            f.fieldType || f.field_type,
            f.label,
            f.placeholder || null,
            f.required || false,
            f.options ? JSON.stringify(f.options) : null,
            f.validation ? JSON.stringify(f.validation) : null,
            i,
            f.section || null,
          ]
        )
      }
    }

    await client.query('COMMIT')

    const fullForm = await getFormById(id)
    res.json(fullForm)
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
}

export const deleteForm = async (req, res, next) => {
  try {
    const result = await query('DELETE FROM forms WHERE id = $1 RETURNING id', [req.params.id])
    if (!result.rows.length) throw httpError(404, 'Form not found')
    res.json({ message: 'Form deleted' })
  } catch (error) {
    next(error)
  }
}

// ── Submissions ─────────────────────────────────────────────────────

export const submitForm = async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { formId, data, submitterName, submitterEmail } = req.body

    if (!formId || !data) {
      throw httpError(400, 'formId and data are required')
    }

    const formResult = await client.query('SELECT id, status FROM forms WHERE id = $1', [formId])
    if (!formResult.rows.length) throw httpError(404, 'Form not found')
    if (formResult.rows[0].status !== 'active') throw httpError(400, 'Form is not accepting submissions')

    const fieldsResult = await client.query(
      'SELECT * FROM form_fields WHERE form_id = $1 ORDER BY order_index',
      [formId]
    )

    const errors = []
    for (const field of fieldsResult.rows) {
      const value = data[field.id]
      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field.label} is required`)
      }
    }

    if (errors.length) {
      throw httpError(400, errors.join(', '))
    }

    const submitterId = req.user?.userId || null

    const result = await client.query(
      `INSERT INTO form_submissions (form_id, submitter_id, submitter_name, submitter_email, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [formId, submitterId, submitterName || null, submitterEmail || null, JSON.stringify(data)]
    )

    await client.query('COMMIT')
    res.status(201).json(result.rows[0])
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
}

export const listSubmissions = async (req, res, next) => {
  try {
    const { formId } = req.params
    const result = await query(
      `SELECT fs.*, u.full_name AS reviewed_by_name
       FROM form_submissions fs
       LEFT JOIN users u ON u.id = fs.reviewed_by
       WHERE fs.form_id = $1
       ORDER BY fs.created_at DESC`,
      [formId]
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const getAllSubmissions = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT fs.*, f.title AS form_title, f.slug AS form_slug, u.full_name AS reviewed_by_name
       FROM form_submissions fs
       JOIN forms f ON f.id = fs.form_id
       LEFT JOIN users u ON u.id = fs.reviewed_by
       ORDER BY fs.created_at DESC`
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const reviewSubmission = async (req, res, next) => {
  try {
    const { submissionId } = req.params
    const { status, reviewNotes } = req.body

    if (!['submitted', 'reviewed', 'approved', 'rejected'].includes(status)) {
      throw httpError(400, 'Invalid status')
    }

    const result = await query(
      `UPDATE form_submissions
       SET status = $1, review_notes = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, reviewNotes || null, req.user.userId, submissionId]
    )

    if (!result.rows.length) throw httpError(404, 'Submission not found')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export const deleteSubmission = async (req, res, next) => {
  try {
    const result = await query('DELETE FROM form_submissions WHERE id = $1 RETURNING id', [req.params.submissionId])
    if (!result.rows.length) throw httpError(404, 'Submission not found')
    res.json({ message: 'Submission deleted' })
  } catch (error) {
    next(error)
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

const getFormById = async (id) => {
  const formResult = await query('SELECT * FROM forms WHERE id = $1', [id])
  if (!formResult.rows.length) return null

  const form = formResult.rows[0]
  const fieldsResult = await query(
    'SELECT * FROM form_fields WHERE form_id = $1 ORDER BY order_index ASC',
    [id]
  )

  return { ...form, fields: fieldsResult.rows }
}
