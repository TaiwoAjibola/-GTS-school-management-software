import { pool, query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'

const ensureBatchCurrentColumn = async () => {
  await query('ALTER TABLE batches ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT FALSE')
}

const deriveBatchStatus = (startDate, endDate) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (end < today) return 'completed'
  if (start > today) return 'upcoming'
  return 'ongoing'
}

export const createBatch = async (req, res, next) => {
  try {
    await ensureBatchCurrentColumn()
    const { courseId, startDate, endDate, name } = req.body

    if (!courseId || !startDate || !endDate) {
      throw httpError(400, 'courseId, startDate and endDate are required')
    }

    if (new Date(endDate) < new Date(startDate)) {
      throw httpError(400, 'endDate cannot be before startDate')
    }

    const status = deriveBatchStatus(startDate, endDate)

    const courseResult = await query('SELECT id FROM courses WHERE id = $1', [courseId])
    if (!courseResult.rows.length) {
      throw httpError(404, 'Course not found')
    }

    const hasCurrentResult = await query(
      'SELECT id FROM batches WHERE course_id = $1 AND is_current = TRUE LIMIT 1',
      [courseId]
    )
    const shouldBeCurrent = hasCurrentResult.rows.length ? false : true

    const result = await query(
      `INSERT INTO batches (course_id, name, start_date, end_date, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [courseId, name || null, startDate, endDate, status, req.user.userId]
    )

    if (shouldBeCurrent) {
      await query('UPDATE batches SET is_current = TRUE WHERE id = $1', [result.rows[0].id])
      result.rows[0].is_current = true
    }

    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export const listBatches = async (req, res, next) => {
  try {
    await ensureBatchCurrentColumn()
    const courseId = Number(req.query.courseId || 0)

    const result = courseId
      ? await query(
          `SELECT b.*, c.title AS course_title, c.course_code,
                  COUNT(e.id) FILTER (WHERE e.status = 'active')::int AS active_student_count,
                  COUNT(e.id)::int AS total_student_count
           FROM batches b
           JOIN courses c ON c.id = b.course_id
           LEFT JOIN enrollments e ON e.batch_id = b.id
           WHERE b.course_id = $1
           GROUP BY b.id, c.title, c.course_code
           ORDER BY b.is_current DESC, b.start_date DESC`,
          [courseId]
        )
      : await query(
          `SELECT b.*, c.title AS course_title, c.course_code,
                  COUNT(e.id) FILTER (WHERE e.status = 'active')::int AS active_student_count,
                  COUNT(e.id)::int AS total_student_count
           FROM batches b
           JOIN courses c ON c.id = b.course_id
           LEFT JOIN enrollments e ON e.batch_id = b.id
           GROUP BY b.id, c.title, c.course_code
            ORDER BY b.is_current DESC, b.start_date DESC`
        )

    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const getBatchDetails = async (req, res, next) => {
  try {
    await ensureBatchCurrentColumn()
    const batchId = Number(req.params.batchId)
    if (!batchId) {
      throw httpError(400, 'Valid batchId is required')
    }

    const batchResult = await query(
      `SELECT b.*, c.title AS course_title, c.course_code
       FROM batches b
       JOIN courses c ON c.id = b.course_id
       WHERE b.id = $1`,
      [batchId]
    )

    if (!batchResult.rows.length) {
      throw httpError(404, 'Batch not found')
    }

    const enrollmentResult = await query(
      `SELECT e.id,
              e.student_id,
              e.status,
              e.enrolled_at,
              e.completed_at,
              s.matric_no,
              u.full_name,
              u.email,
              rr.status AS result_status,
              rr.score,
              rr.result_type
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN LATERAL (
         SELECT r.status, r.score, r.result_type
         FROM results r
         WHERE r.course_id = e.course_id
           AND r.student_id = e.student_id
         ORDER BY r.uploaded_at DESC
         LIMIT 1
       ) rr ON TRUE
       WHERE e.batch_id = $1
       ORDER BY u.full_name ASC`,
      [batchId]
    )

    res.json({
      batch: batchResult.rows[0],
      students: enrollmentResult.rows,
    })
  } catch (error) {
    next(error)
  }
}

export const suspendBatch = async (req, res, next) => {
  const client = await pool.connect()
  try {
    const batchId = Number(req.params.batchId)
    const { reason } = req.body

    if (!batchId) {
      throw httpError(400, 'Valid batchId is required')
    }

    await client.query('BEGIN')

    const batchResult = await client.query('SELECT * FROM batches WHERE id = $1 FOR UPDATE', [batchId])
    const batch = batchResult.rows[0]
    if (!batch) {
      throw httpError(404, 'Batch not found')
    }

    await client.query(
      `UPDATE batches
       SET status = 'suspended', suspension_reason = $1
       WHERE id = $2`,
      [reason || null, batchId]
    )

    const activeEnrollments = await client.query(
      `UPDATE enrollments
       SET status = 'withdrawn', completed_at = NOW()
       WHERE batch_id = $1 AND status = 'active'
       RETURNING student_id`,
      [batchId]
    )

    for (const row of activeEnrollments.rows) {
      await client.query(
        `INSERT INTO student_activity_logs (student_id, action, details, actor_user_id)
         VALUES ($1, 'batch_suspended_withdrawal', $2::jsonb, $3)`,
        [
          row.student_id,
          JSON.stringify({ batchId, reason: reason || null }),
          req.user.userId,
        ]
      )
    }

    await client.query('COMMIT')

    res.json({
      message: 'Batch suspended successfully',
      withdrawnCount: activeEnrollments.rows.length,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
}

export const completeBatch = async (req, res, next) => {
  try {
    const batchId = Number(req.params.batchId)
    if (!batchId) {
      throw httpError(400, 'Valid batchId is required')
    }

    await query(
      `UPDATE batches
       SET status = 'completed'
       WHERE id = $1`,
      [batchId]
    )

    res.json({ message: 'Batch marked as completed' })
  } catch (error) {
    next(error)
  }
}

export const updateBatch = async (req, res, next) => {
  try {
    await ensureBatchCurrentColumn()
    const batchId = Number(req.params.batchId)
    if (!batchId) throw httpError(400, 'Valid batchId is required')
    const { name, startDate, endDate, status } = req.body
    if (status && !['upcoming', 'ongoing', 'completed', 'suspended'].includes(status)) {
      throw httpError(400, 'Invalid status')
    }
    const result = await query(
      `UPDATE batches
       SET name = COALESCE($1, name),
           start_date = COALESCE($2, start_date),
           end_date = COALESCE($3, end_date),
           status = COALESCE($4, status)
       WHERE id = $5
       RETURNING *`,
      [name || null, startDate || null, endDate || null, status || null, batchId]
    )
    if (!result.rows.length) throw httpError(404, 'Batch not found')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export const setCurrentBatch = async (req, res, next) => {
  try {
    await ensureBatchCurrentColumn()
    const batchId = Number(req.params.batchId)
    if (!batchId) throw httpError(400, 'Valid batchId is required')

    const existing = await query('SELECT id, course_id FROM batches WHERE id = $1', [batchId])
    const batch = existing.rows[0]
    if (!batch) throw httpError(404, 'Batch not found')

    await query('UPDATE batches SET is_current = FALSE WHERE course_id = $1', [batch.course_id])
    await query('UPDATE batches SET is_current = TRUE WHERE id = $1', [batchId])

    res.json({ message: 'Current batch updated' })
  } catch (error) {
    next(error)
  }
}
