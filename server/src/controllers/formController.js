import bcrypt from 'bcryptjs'
import { pool, query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'

const STUDENT_COLUMNS = ['full_name', 'email', 'phone', 'comments']

export const createForm = async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { title, description, slug, fields, mapsToStudent, cohortId, logoUrl } = req.body

    if (!title || !slug) {
      throw httpError(400, 'Title and slug are required')
    }

    await client.query('BEGIN')

    const formResult = await client.query(
      `INSERT INTO forms (title, description, slug, status, created_by, maps_to_student, cohort_id, logo_url)
       VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7)
       RETURNING *`,
      [title, description || null, slug, req.user.userId, mapsToStudent || false, cohortId || null, logoUrl || null]
    )

    const form = formResult.rows[0]

    if (fields && Array.isArray(fields)) {
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i]
        await client.query(
          `INSERT INTO form_fields (form_id, field_type, label, placeholder, required, options, validation, order_index, section, width, field_conditions, maps_to_column)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
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
            f.width || 'full',
            f.fieldConditions ? JSON.stringify(f.fieldConditions) : null,
            f.mapsToColumn || null,
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
              co.name AS cohort_name,
              (SELECT COUNT(*) FROM form_submissions WHERE form_id = f.id) AS submission_count
       FROM forms f
       LEFT JOIN users u ON u.id = f.created_by
       LEFT JOIN cohorts co ON co.id = f.cohort_id
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
    const { title, description, status, fields, mapsToStudent, cohortId, logoUrl } = req.body

    await client.query('BEGIN')

    const formResult = await client.query(
      `UPDATE forms SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        status = COALESCE($3, status),
        maps_to_student = COALESCE($4, maps_to_student),
        cohort_id = COALESCE($5, cohort_id),
        logo_url = COALESCE($6, logo_url),
        updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [title, description, status, mapsToStudent, cohortId || null, logoUrl || null, id]
    )

    if (!formResult.rows.length) {
      throw httpError(404, 'Form not found')
    }

    if (fields && Array.isArray(fields)) {
      await client.query('DELETE FROM form_fields WHERE form_id = $1', [id])
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i]
        await client.query(
          `INSERT INTO form_fields (form_id, field_type, label, placeholder, required, options, validation, order_index, section, width, field_conditions, maps_to_column)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
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
            f.width || 'full',
            f.fieldConditions ? JSON.stringify(f.fieldConditions) : null,
            f.mapsToColumn || null,
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

export const submitForm = async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { formId, slug, data, submitterName, submitterEmail } = req.body

    let resolvedFormId = formId
    if (!resolvedFormId && slug) {
      const lookup = await client.query('SELECT id FROM forms WHERE slug = $1', [slug])
      if (!lookup.rows.length) throw httpError(404, 'Form not found')
      resolvedFormId = lookup.rows[0].id
    }

    if (!resolvedFormId || !data) {
      throw httpError(400, 'formId (or slug) and data are required')
    }

    const formResult = await client.query('SELECT id, status FROM forms WHERE id = $1', [resolvedFormId])
    if (!formResult.rows.length) throw httpError(404, 'Form not found')
    if (formResult.rows[0].status !== 'active') throw httpError(400, 'Form is not accepting submissions')

    const fieldsResult = await client.query(
      'SELECT * FROM form_fields WHERE form_id = $1 ORDER BY order_index',
      [resolvedFormId]
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
      [resolvedFormId, submitterId, submitterName || null, submitterEmail || null, JSON.stringify(data)]
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
      `SELECT fs.*, u.full_name AS reviewed_by_name,
              s.id AS linked_student_id, s.status AS student_status,
              usr.full_name AS student_name, usr.email AS student_email
       FROM form_submissions fs
       LEFT JOIN users u ON u.id = fs.reviewed_by
       LEFT JOIN students s ON s.id = fs.student_id
       LEFT JOIN users usr ON usr.id = s.user_id
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
      `SELECT fs.*, f.title AS form_title, f.slug AS form_slug, u.full_name AS reviewed_by_name,
              s.id AS linked_student_id, s.status AS student_status,
              usr.full_name AS student_name, usr.email AS student_email
       FROM form_submissions fs
       JOIN forms f ON f.id = fs.form_id
       LEFT JOIN users u ON u.id = fs.reviewed_by
       LEFT JOIN students s ON s.id = fs.student_id
       LEFT JOIN users usr ON usr.id = s.user_id
       ORDER BY fs.created_at DESC`
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const reviewSubmission = async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { submissionId } = req.params
    const { status, reviewNotes } = req.body

    if (!['submitted', 'reviewed', 'approved', 'rejected'].includes(status)) {
      throw httpError(400, 'Invalid status')
    }

    await client.query('BEGIN')

    const subResult = await client.query(
      `     SELECT fs.*, f.maps_to_student, f.cohort_id
       FROM form_submissions fs
       JOIN forms f ON f.id = fs.form_id
       WHERE fs.id = $1 FOR UPDATE`,
      [submissionId]
    )

    if (!subResult.rows.length) throw httpError(404, 'Submission not found')

    const submission = subResult.rows[0]

    const result = await client.query(
      `UPDATE form_submissions
       SET status = $1, review_notes = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, reviewNotes || null, req.user.userId, submissionId]
    )

    let createdStudent = null

    if (status === 'approved' && submission.maps_to_student) {
      createdStudent = await createStudentFromSubmission(client, submission, req.user.userId)

      if (createdStudent) {
        await client.query(
          'UPDATE form_submissions SET student_id = $1 WHERE id = $2',
          [createdStudent.id, submissionId]
        )
      }
    }

    await client.query('COMMIT')

    res.json({
      ...result.rows[0],
      student: createdStudent,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
}

const createStudentFromSubmission = async (client, submission, actorUserId) => {
  try {
    const fieldsResult = await client.query(
      `SELECT id, label, maps_to_column FROM form_fields
       WHERE form_id = $1 AND maps_to_column IS NOT NULL`,
      [submission.form_id]
    )

    const mapped = { cohortId: submission.cohort_id }
    for (const field of fieldsResult.rows) {
      const value = submission.data[field.id]
      if (value !== undefined && value !== null && value !== '') {
        mapped[field.maps_to_column] = value
      }
    }

    if (!mapped.full_name || !mapped.email) {
      return null
    }

    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [mapped.email]
    )

    if (existingUser.rows.length) {
      const existingStudent = await client.query(
        'SELECT id FROM students WHERE user_id = $1',
        [existingUser.rows[0].id]
      )
      if (existingStudent.rows.length) {
        await client.query(
          `UPDATE students SET phone = COALESCE($1, phone), comments = COALESCE($2, comments)
           WHERE id = $3`,
          [mapped.phone || null, mapped.comments || null, existingStudent.rows[0].id]
        )
        return { id: existingStudent.rows[0].id }
      }
    } else {
      const hashed = await bcrypt.hash('Student123!', 10)
      const userResult = await client.query(
        `INSERT INTO users (full_name, email, password_hash, role)
         VALUES ($1, $2, $3, 'student')
         RETURNING id, full_name, email`,
        [mapped.full_name, mapped.email, hashed]
      )

      const studentResult = await client.query(
        `INSERT INTO students (user_id, phone, status, comments, cohort_id)
         VALUES ($1, $2, 'Prospective', $3, $4)
         RETURNING id`,
        [userResult.rows[0].id, mapped.phone || null, mapped.comments || null, mapped.cohortId || null]
      )

      return { id: studentResult.rows[0].id }
    }

    return null
  } catch (err) {
    return null
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

export const getProspectiveStudents = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
        s.id AS student_id, s.status, s.created_at AS student_created_at,
        u.full_name, u.email, s.phone,
        fs.id AS submission_id, fs.data AS submission_data, fs.created_at AS submitted_at,
        f.id AS form_id, f.title AS form_title, f.slug AS form_slug,
        co.id AS cohort_id, co.name AS cohort_name
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN form_submissions fs ON fs.student_id = s.id
       LEFT JOIN forms f ON f.id = fs.form_id
       LEFT JOIN cohorts co ON co.id = f.cohort_id
       WHERE s.status = 'Prospective'
       ORDER BY fs.created_at DESC NULLS LAST, s.created_at DESC`
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

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
