import bcrypt from 'bcryptjs'
import { pool, query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'

const STUDENT_COLUMNS = ['full_name', 'email', 'phone', 'comments']

// ---------------------------------------------------------------------------
// Availability / booking helpers (Calendly-style)
// An availability field's options array may contain:
//   - manual discrete slots: { value, label, date, start, end, capacity }
//   - one recurring rule:     { value: '__recurring__', recurring: {
//       weekdays: [1..7] (1=Mon), startTime, endTime, slotMinutes, capacity, weeksAhead } }
// ---------------------------------------------------------------------------

const RECURRING_VALUE = '__recurring__'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const pad = (n) => String(n).padStart(2, '0')

const toDateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Expand a field's options into a flat list of concrete bookable slots.
export const expandAvailabilitySlots = (options = []) => {
  const recurring = options.find((o) => o?.recurring)
  const slots = []

  for (const opt of options) {
    if (opt?.recurring) continue
    slots.push({ ...opt, kind: 'manual' })
  }

  if (!recurring) return slots

  const r = recurring.recurring || {}
  const weekdays = Array.isArray(r.weekdays) ? r.weekdays.map(Number).filter((d) => d >= 1 && d <= 7) : []
  const startTime = String(r.startTime || '09:00')
  const endTime = String(r.endTime || '17:00')
  const slotMinutes = Math.max(15, Number(r.slotMinutes) || 60)
  const capacity = Math.max(1, Number(r.capacity) || 1)
  const weeksAhead = Math.min(12, Math.max(1, Number(r.weeksAhead) || 4))

  if (!weekdays.length) return slots

  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Align to the Monday of the current week (JS getDay(): 0=Sun)
  const monday = new Date(today)
  const dow = (today.getDay() + 6) % 7 // 0=Mon
  monday.setDate(today.getDate() - dow)

  // Generate concrete date+time slots for the next `weeksAhead` weeks
  for (let w = 0; w < weeksAhead; w++) {
    const weekStart = new Date(monday)
    weekStart.setDate(monday.getDate() + w * 7)
    for (const weekday of weekdays) {
      const dayDate = new Date(weekStart)
      dayDate.setDate(weekStart.getDate() + (weekday - 1)) // weekday 1=Mon
      if (dayDate < today) continue
      const dateKey = toDateKey(dayDate)
      for (let m = startMinutes; m + slotMinutes <= endMinutes; m += slotMinutes) {
        const startStr = `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
        const endStr = `${pad(Math.floor((m + slotMinutes) / 60))}:${pad((m + slotMinutes) % 60)}`
        const value = `${dateKey}T${startStr}`
        slots.push({
          value,
          label: recurring.label || '',
          date: dateKey,
          start: startStr,
          end: endStr,
          capacity,
          kind: 'recurring',
        })
      }
    }
  }

  return slots
}

export const timeToMinutes = (time) => {
  const [h, m] = String(time || '00:00').split(':').map(Number)
  return (Number(h) || 0) * 60 + (Number(m) || 0)
}

export const createForm = async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { title, description, slug, fields, mapsToStudent, cohortId, logoUrl, status } = req.body

    if (!title || !slug) {
      throw httpError(400, 'Title and slug are required')
    }

    const formStatus = ['draft', 'active', 'closed'].includes(status) ? status : 'draft'

    await client.query('BEGIN')

    const formResult = await client.query(
      `INSERT INTO forms (title, description, slug, status, created_by, maps_to_student, cohort_id, logo_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title, description || null, slug, formStatus, req.user.userId, mapsToStudent || false, cohortId || null, logoUrl || null]
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

    // Enforce capacity for availability (booking) fields
    for (const field of fieldsResult.rows) {
      if (field.field_type !== 'availability') continue
      const value = data[field.id]
      if (value === undefined || value === null || value === '') continue
      const slots = expandAvailabilitySlots(field.options || [])
      const slot = slots.find((s) => String(s.value) === String(value))
      if (!slot) {
        throw httpError(400, `${field.label}: unknown time slot selected`)
      }
      const capacity = Number(slot.capacity || 1)
      const bookedResult = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM form_submissions
         WHERE form_id = $1 AND status <> 'rejected' AND data ->> $2 = $3`,
        [resolvedFormId, String(field.id), value]
      )
      if (bookedResult.rows[0].count >= capacity) {
        throw httpError(400, `${field.label}: that time slot is fully booked. Please pick another time.`)
      }
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

export const getFormAvailability = async (req, res, next) => {
  try {
    const { slug } = req.params

    const formResult = await query('SELECT id FROM forms WHERE slug = $1', [slug])
    if (!formResult.rows.length) throw httpError(404, 'Form not found')
    const formId = formResult.rows[0].id

    const fieldsResult = await query(
      `SELECT id, options FROM form_fields WHERE form_id = $1 AND field_type = 'availability'`,
      [formId]
    )

    const result = {}
    for (const field of fieldsResult.rows) {
      const bookings = await query(
        `SELECT data ->> $2 AS slot_value, COUNT(*)::int AS count
         FROM form_submissions
         WHERE form_id = $1 AND status <> 'rejected' AND data ->> $2 IS NOT NULL
         GROUP BY data ->> $2`,
        [formId, String(field.id)]
      )
      const counts = {}
      for (const row of bookings.rows) {
        counts[String(row.slot_value)] = row.count
      }
      const expanded = expandAvailabilitySlots(field.options || [])
      const slots = expanded.map((s) => ({
        value: s.value,
        label: s.label || '',
        date: s.date || null,
        start: s.start || null,
        end: s.end || null,
        capacity: Number(s.capacity || 1),
        kind: s.kind || 'manual',
        booked: Number(counts[String(s.value)] || 0),
      }))
      result[field.id] = { fieldId: field.id, options: field.options || [], slots, booked: counts }
    }

    res.json(result)
  } catch (error) {
    next(error)
  }
}
