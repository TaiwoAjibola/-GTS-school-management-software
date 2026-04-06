import { query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'

const ensureCohortOrderingColumn = async () => {
  await query('ALTER TABLE cohorts ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0')
  await query(
    `UPDATE cohorts
     SET display_order = ranked.rn
     FROM (
       SELECT id, ROW_NUMBER() OVER (ORDER BY start_date ASC NULLS LAST, created_at ASC) AS rn
       FROM cohorts
     ) ranked
     WHERE cohorts.id = ranked.id AND cohorts.display_order = 0`
  )
}

export const listCohorts = async (req, res, next) => {
  try {
    await ensureCohortOrderingColumn()
    const result = await query(
      `SELECT c.*, COUNT(s.id)::int AS student_count
       FROM cohorts c
       LEFT JOIN students s ON s.cohort_id = c.id
       GROUP BY c.id
       ORDER BY c.display_order ASC, c.start_date DESC NULLS LAST, c.created_at DESC`
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const createCohort = async (req, res, next) => {
  try {
    await ensureCohortOrderingColumn()
    const { name, startDate, endDate, status = 'active' } = req.body
    if (!name) throw httpError(400, 'name is required')
    if (!['upcoming', 'active', 'completed'].includes(status)) {
      throw httpError(400, 'status must be upcoming, active, or completed')
    }
    const orderResult = await query('SELECT COALESCE(MAX(display_order), 0)::int AS max_order FROM cohorts')
    const nextOrder = Number(orderResult.rows[0]?.max_order || 0) + 1

    const result = await query(
      `INSERT INTO cohorts (name, start_date, end_date, status, display_order, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, startDate || null, endDate || null, status, nextOrder, req.user.userId]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export const updateCohort = async (req, res, next) => {
  try {
    const cohortId = Number(req.params.cohortId)
    if (!cohortId) throw httpError(400, 'Valid cohortId required')
    const { name, startDate, endDate, status } = req.body
    if (status && !['upcoming', 'active', 'completed'].includes(status)) {
      throw httpError(400, 'status must be upcoming, active, or completed')
    }
    const result = await query(
      `UPDATE cohorts
       SET name = COALESCE($1, name),
           start_date = COALESCE($2, start_date),
           end_date = COALESCE($3, end_date),
           status = COALESCE($4, status)
       WHERE id = $5
       RETURNING *`,
      [name || null, startDate || null, endDate || null, status || null, cohortId]
    )
    if (!result.rows.length) throw httpError(404, 'Cohort not found')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export const getCohortStudents = async (req, res, next) => {
  try {
    const cohortId = Number(req.params.cohortId)
    if (!cohortId) throw httpError(400, 'Valid cohortId required')
    const cohortResult = await query('SELECT * FROM cohorts WHERE id = $1', [cohortId])
    if (!cohortResult.rows.length) throw httpError(404, 'Cohort not found')
    const studentsResult = await query(
      `SELECT s.id, s.matric_no, s.phone, s.status, s.comments, u.full_name, u.email
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE s.cohort_id = $1
       ORDER BY u.full_name ASC`,
      [cohortId]
    )
    res.json({ cohort: cohortResult.rows[0], students: studentsResult.rows })
  } catch (error) {
    next(error)
  }
}

export const reorderCohorts = async (req, res, next) => {
  try {
    await ensureCohortOrderingColumn()
    const { orderedIds } = req.body
    if (!Array.isArray(orderedIds) || !orderedIds.length) {
      throw httpError(400, 'orderedIds array is required')
    }

    const ids = orderedIds.map((id) => Number(id)).filter(Boolean)
    if (!ids.length) {
      throw httpError(400, 'orderedIds must contain valid cohort ids')
    }

    const sqlParts = ids.map((id, index) => `WHEN ${id} THEN ${index + 1}`).join(' ')

    await query(
      `UPDATE cohorts
       SET display_order = CASE id ${sqlParts} ELSE display_order END
       WHERE id = ANY($1::int[])`,
      [ids]
    )

    res.json({ message: 'Cohort order updated' })
  } catch (error) {
    next(error)
  }
}

export const deleteCohort = async (req, res, next) => {
  try {
    await ensureCohortOrderingColumn()
    const cohortId = Number(req.params.cohortId)
    const force = Boolean(req.query.force === 'true' || req.body?.force === true)
    if (!cohortId) throw httpError(400, 'Valid cohortId required')

    const existing = await query('SELECT id FROM cohorts WHERE id = $1', [cohortId])
    if (!existing.rows.length) throw httpError(404, 'Cohort not found')

    const studentCountResult = await query(
      'SELECT COUNT(*)::int AS count FROM students WHERE cohort_id = $1',
      [cohortId]
    )
    const studentCount = Number(studentCountResult.rows[0]?.count || 0)

    if (studentCount > 0 && !force) {
      throw httpError(409, 'Batch has assigned students. Re-run delete with force=true to unassign and delete.')
    }

    if (studentCount > 0 && force) {
      await query('UPDATE students SET cohort_id = NULL WHERE cohort_id = $1', [cohortId])
    }

    await query('DELETE FROM cohorts WHERE id = $1', [cohortId])

    await query(
      `WITH ranked AS (
         SELECT id, ROW_NUMBER() OVER (ORDER BY display_order ASC, created_at ASC) AS rn
         FROM cohorts
       )
       UPDATE cohorts c
       SET display_order = ranked.rn
       FROM ranked
       WHERE c.id = ranked.id`
    )

    res.json({ message: 'Batch deleted successfully' })
  } catch (error) {
    next(error)
  }
}
