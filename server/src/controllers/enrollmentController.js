import { pool, query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'

export const enrollStudentToBatch = async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { studentId, batchId } = req.body

    if (!studentId || !batchId) {
      throw httpError(400, 'studentId and batchId are required')
    }

    await client.query('BEGIN')

    const batchResult = await client.query(
      `SELECT b.id, b.course_id, b.status
       FROM batches b
       WHERE b.id = $1 FOR UPDATE`,
      [batchId]
    )
    const batch = batchResult.rows[0]

    if (!batch) {
      throw httpError(404, 'Batch not found')
    }

    if (!['ongoing', 'upcoming'].includes(batch.status)) {
      throw httpError(400, 'Student can only be enrolled into an ongoing or upcoming batch')
    }

    const studentResult = await client.query(
      'SELECT id, status FROM students WHERE id = $1',
      [studentId]
    )
    const student = studentResult.rows[0]
    if (!student) {
      throw httpError(404, 'Student not found')
    }

    const existingActive = await client.query(
      `SELECT e.id
       FROM enrollments e
       JOIN batches b ON b.id = e.batch_id
       WHERE e.student_id = $1
         AND b.course_id = $2
         AND e.status = 'active'
         AND b.status IN ('ongoing', 'upcoming')
       LIMIT 1`,
      [studentId, batch.course_id]
    )

    if (existingActive.rows.length) {
      throw httpError(409, 'Student is already actively enrolled in a running batch of this course')
    }

    const existingInBatch = await client.query(
      `SELECT id FROM enrollments WHERE student_id = $1 AND batch_id = $2 LIMIT 1`,
      [studentId, batchId]
    )

    if (existingInBatch.rows.length) {
      throw httpError(409, 'Student already enrolled in this batch')
    }

    const result = await client.query(
      `INSERT INTO enrollments (course_id, batch_id, student_id, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING *`,
      [batch.course_id, batchId, studentId]
    )

    await client.query(
      `INSERT INTO student_activity_logs (student_id, action, details, actor_user_id)
       VALUES ($1, 'enrolled_to_batch', $2::jsonb, $3)`,
      [studentId, JSON.stringify({ batchId, courseId: batch.course_id }), req.user.userId]
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

export const listEnrollmentsByBatch = async (req, res, next) => {
  try {
    const batchId = Number(req.params.batchId)
    if (!batchId) {
      throw httpError(400, 'Valid batchId is required')
    }

    const result = await query(
      `SELECT e.id,
              e.student_id,
              e.status,
              e.notes,
              e.enrolled_at,
              e.completed_at,
              s.matric_no,
              s.status AS student_status,
              u.full_name,
              u.email,
              r.status AS result_status,
              r.score
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN results r ON r.batch_id = e.batch_id AND r.student_id = e.student_id
       WHERE e.batch_id = $1
       ORDER BY u.full_name ASC`,
      [batchId]
    )

    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const getStudentHistory = async (req, res, next) => {
  try {
    const studentId = Number(req.params.studentId)
    if (!studentId) {
      throw httpError(400, 'Valid studentId is required')
    }

    const enrollments = await query(
      `SELECT e.id,
              e.status,
              e.notes,
              e.enrolled_at,
              e.completed_at,
              e.course_id,
              c.title AS course_title,
              c.course_code,
              co.id AS cohort_id,
              co.name AS cohort_name,
              rr.status AS result_status,
              rr.score,
              rr.result_type
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       LEFT JOIN students st ON st.id = e.student_id
       LEFT JOIN cohorts co ON co.id = st.cohort_id
       LEFT JOIN LATERAL (
         SELECT r.status, r.score, r.result_type
         FROM results r
         WHERE r.course_id = e.course_id
           AND r.student_id = e.student_id
         ORDER BY r.uploaded_at DESC
         LIMIT 1
       ) rr ON TRUE
       WHERE e.student_id = $1
       ORDER BY e.enrolled_at DESC`,
      [studentId]
    )

    const activities = await query(
      `SELECT action, details, actor_user_id, created_at
       FROM student_activity_logs
       WHERE student_id = $1
       ORDER BY created_at DESC`,
      [studentId]
    )

    res.json({
      enrollments: enrollments.rows,
      activities: activities.rows,
    })
  } catch (error) {
    next(error)
  }
}

export const updateEnrollmentNotes = async (req, res, next) => {
  try {
    const enrollmentId = Number(req.params.enrollmentId)
    const { notes } = req.body

    if (!enrollmentId) {
      throw httpError(400, 'Valid enrollmentId is required')
    }

    const existing = await query('SELECT id, student_id FROM enrollments WHERE id = $1', [enrollmentId])
    const row = existing.rows[0]
    if (!row) {
      throw httpError(404, 'Enrollment not found')
    }

    await query('UPDATE enrollments SET notes = $1 WHERE id = $2', [notes || null, enrollmentId])
    await query(
      `INSERT INTO student_activity_logs (student_id, action, details, actor_user_id)
       VALUES ($1, 'enrollment_notes_updated', $2::jsonb, $3)`,
      [row.student_id, JSON.stringify({ enrollmentId }), req.user.userId]
    )

    res.json({ message: 'Enrollment notes updated' })
  } catch (error) {
    next(error)
  }
}

export const listEnrollmentCandidates = async (req, res, next) => {
  try {
    const courseId = Number(req.query.courseId || 0)
    const cohortId = Number(req.query.cohortId || 0)
    if (!courseId) {
      throw httpError(400, 'courseId is required')
    }

    const result = await query(
      `SELECT s.id,
              s.matric_no,
              s.status,
              s.cohort_id,
              u.full_name,
              u.email,
              COALESCE(latest.status, '') AS latest_enrollment_status,
              COALESCE(latest.result_status, '') AS latest_result_status,
              CASE
                WHEN latest.result_status = 'Fail' OR latest.status = 'failed' THEN 'retake_failed'
                WHEN latest.status = 'withdrawn' THEN 'rejoin_withdrawn'
                ELSE 'new_candidate'
              END AS enrollment_reason
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN LATERAL (
         SELECT e.status,
                rr.status AS result_status
         FROM enrollments e
         LEFT JOIN LATERAL (
           SELECT r.status
           FROM results r
           WHERE r.course_id = e.course_id AND r.student_id = e.student_id
           ORDER BY r.uploaded_at DESC
           LIMIT 1
         ) rr ON TRUE
         WHERE e.student_id = s.id
           AND e.course_id = $1
         ORDER BY e.enrolled_at DESC
         LIMIT 1
       ) latest ON TRUE
       WHERE s.status IN ('Active', 'Graduating')
         AND ($2 = 0 OR s.cohort_id = $2)
         AND NOT EXISTS (
           SELECT 1
           FROM enrollments ea
           WHERE ea.student_id = s.id
             AND ea.course_id = $1
             AND ea.status = 'active'
         )
         AND (
           latest.status IS NULL
           OR latest.result_status IS DISTINCT FROM 'Pass'
         )
       ORDER BY
         CASE
           WHEN latest.result_status = 'Fail' OR latest.status = 'failed' THEN 1
           WHEN latest.status = 'withdrawn' THEN 2
           ELSE 3
         END,
         u.full_name ASC`,
      [courseId, cohortId]
    )

    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const listEnrollmentsByCourse = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    if (!courseId) {
      throw httpError(400, 'Valid courseId is required')
    }

    const result = await query(
      `SELECT e.id,
              e.student_id,
              e.status,
              e.notes,
              e.enrolled_at,
              e.completed_at,
              s.matric_no,
              s.status AS student_status,
              s.cohort_id,
              u.full_name,
              u.email,
              r.status AS result_status,
              r.score
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN results r ON r.course_id = e.course_id AND r.student_id = e.student_id
       WHERE e.course_id = $1
       ORDER BY s.cohort_id ASC NULLS LAST, u.full_name ASC`,
      [courseId]
    )

    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const enrollStudentToCourse = async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { studentId, courseId } = req.body

    if (!studentId || !courseId) {
      throw httpError(400, 'studentId and courseId are required')
    }

    await client.query('BEGIN')

    const studentResult = await client.query(
      'SELECT id, status FROM students WHERE id = $1',
      [studentId]
    )
    const student = studentResult.rows[0]
    if (!student) throw httpError(404, 'Student not found')

    const courseResult = await client.query('SELECT id FROM courses WHERE id = $1', [courseId])
    if (!courseResult.rows.length) throw httpError(404, 'Course not found')

    const existing = await client.query(
      `SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status = 'active' LIMIT 1`,
      [studentId, courseId]
    )
    if (existing.rows.length) {
      throw httpError(409, 'Student is already actively enrolled in this course')
    }

    const result = await client.query(
      `INSERT INTO enrollments (course_id, batch_id, student_id, status)
       VALUES ($1, NULL, $2, 'active')
       RETURNING *`,
      [courseId, studentId]
    )

    await client.query(
      `INSERT INTO student_activity_logs (student_id, action, details, actor_user_id)
       VALUES ($1, 'enrolled_to_course', $2::jsonb, $3)`,
      [studentId, JSON.stringify({ courseId }), req.user.userId]
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
