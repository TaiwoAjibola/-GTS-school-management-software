import { query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'
import { closeExpiredAttendanceSessions, getActiveSessionByCourse } from '../services/attendanceService.js'
import { getEligibilityForStudentInCourse } from '../services/eligibilityService.js'

const insertAttendanceRecord = async ({ sessionId, studentId }) => {
  const duplicate = await query(
    'SELECT id FROM attendance_records WHERE session_id = $1 AND student_id = $2',
    [sessionId, studentId]
  )

  if (duplicate.rows.length) {
    throw httpError(409, 'Attendance already marked')
  }

  await query(
    `INSERT INTO attendance_records (session_id, student_id)
     VALUES ($1, $2)`,
    [sessionId, studentId]
  )
}

export const startAttendanceSession = async (req, res, next) => {
  try {
    const { courseId, classNumber, startTime, endTime } = req.body
    if (!courseId || !classNumber || !startTime || !endTime) {
      throw httpError(400, 'courseId, classNumber, startTime, and endTime are required')
    }

    const start = new Date(startTime)
    const end = new Date(endTime)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw httpError(400, 'Invalid time format for startTime or endTime')
    }

    if (end <= start) {
      throw httpError(400, 'endTime must be after startTime')
    }

    const courseResult = await query('SELECT duration_weeks FROM courses WHERE id = $1', [courseId])
    const course = courseResult.rows[0]
    if (!course) {
      throw httpError(404, 'Course not found')
    }

    if (Number(classNumber) < 1 || Number(classNumber) > Number(course.duration_weeks)) {
      throw httpError(400, `classNumber must be between 1 and ${course.duration_weeks}`)
    }

    await closeExpiredAttendanceSessions()

    const existing = await getActiveSessionByCourse(courseId)
    if (existing) {
      throw httpError(409, 'An active attendance session already exists for this course')
    }

    const existingClassSession = await query(
      `SELECT id FROM attendance_sessions WHERE course_id = $1 AND class_number = $2 LIMIT 1`,
      [courseId, Number(classNumber)]
    )

    if (existingClassSession.rows.length) {
      throw httpError(409, `Class ${classNumber} attendance already exists`)
    }

    const result = await query(
      `INSERT INTO attendance_sessions (course_id, class_number, start_time, end_time, is_active, created_by)
       VALUES ($1, $2, $3, $4, TRUE, $5)
       RETURNING *`,
      [courseId, Number(classNumber), start.toISOString(), end.toISOString(), req.user.userId]
    )

    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export const getCourseAttendanceStatus = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    const classNumber = Number(req.query.classNumber || 0)
    await closeExpiredAttendanceSessions()

    const activeSession = classNumber
      ? await getActiveSessionByCourse(courseId, classNumber)
      : await getActiveSessionByCourse(courseId)

    const classSession = classNumber
      ? await query(
          `SELECT *
           FROM attendance_sessions
           WHERE course_id = $1 AND class_number = $2
           ORDER BY created_at DESC
           LIMIT 1`,
          [courseId, classNumber]
        )
      : { rows: [] }

    const existingClassSession = classSession.rows[0] || null

    if (!activeSession && !existingClassSession) {
      return res.json({
        activeSession: null,
        attendeeCount: 0,
        canMark: false,
        classCompleted: false,
      })
    }

    const targetSession = activeSession || existingClassSession

    const countResult = await query(
      `SELECT COUNT(*)::int AS attendees
       FROM attendance_records
       WHERE session_id = $1`,
      [targetSession.id]
    )

    res.json({
      activeSession,
      existingClassSession,
      attendeeCount: Number(countResult.rows[0].attendees),
      canMark: Boolean(activeSession),
      classCompleted: Boolean(existingClassSession && !existingClassSession.is_active),
    })
  } catch (error) {
    next(error)
  }
}

export const closeAttendanceSession = async (req, res, next) => {
  try {
    const { courseId, classNumber } = req.body

    if (!courseId) {
      throw httpError(400, 'courseId is required')
    }

    await closeExpiredAttendanceSessions()
    const activeSession = classNumber
      ? await getActiveSessionByCourse(courseId, classNumber)
      : await getActiveSessionByCourse(courseId)

    if (!activeSession) {
      throw httpError(400, 'No active attendance session')
    }

    await query(
      `UPDATE attendance_sessions
       SET is_active = FALSE, end_time = NOW()
       WHERE id = $1`,
      [activeSession.id]
    )

    res.json({ message: 'Attendance session closed' })
  } catch (error) {
    next(error)
  }
}

export const getCourseAttendanceHistory = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)

    const result = await query(
      `SELECT s.id,
              s.class_number,
              s.start_time,
              s.end_time,
              s.is_active,
              COALESCE(COUNT(ar.id), 0)::int AS attendees
       FROM attendance_sessions s
       LEFT JOIN attendance_records ar ON ar.session_id = s.id
       WHERE s.course_id = $1
       GROUP BY s.id
       ORDER BY s.class_number ASC`,
      [courseId]
    )

    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const getCourseAttendanceStudentSummary = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    const classNumber = Number(req.query.classNumber || 0)

    if (classNumber) {
      const sessionResult = await query(
        `SELECT id, class_number
         FROM attendance_sessions
         WHERE course_id = $1 AND class_number = $2
         LIMIT 1`,
        [courseId, classNumber]
      )

      const session = sessionResult.rows[0]
      if (!session) {
        const emptyResult = await query(
          `SELECT s.id AS student_id,
                  s.matric_no,
                  u.full_name,
                  u.email
           FROM enrollments e
           JOIN students s ON s.id = e.student_id
           JOIN users u ON u.id = s.user_id
           WHERE e.course_id = $1
           ORDER BY u.full_name ASC`,
          [courseId]
        )

        return res.json(
          emptyResult.rows.map((row) => ({
            ...row,
            total_sessions: 0,
            present_count: 0,
            absent_count: 0,
            attendance_rate: 0,
            eligible: false,
          }))
        )
      }

      const classSummaryResult = await query(
        `SELECT s.id AS student_id,
                s.matric_no,
                u.full_name,
                u.email,
                CASE WHEN ar.id IS NOT NULL THEN 1 ELSE 0 END AS present_count,
                CASE WHEN ar.id IS NOT NULL THEN 0 ELSE 1 END AS absent_count
         FROM enrollments e
         JOIN students s ON s.id = e.student_id
         JOIN users u ON u.id = s.user_id
         LEFT JOIN attendance_records ar
           ON ar.student_id = s.id AND ar.session_id = $2
         WHERE e.course_id = $1
         ORDER BY u.full_name ASC`,
        [courseId, session.id]
      )

      return res.json(
        classSummaryResult.rows.map((row) => ({
          ...row,
          total_sessions: 1,
          attendance_rate: Number(row.present_count) ? 100 : 0,
          eligible: Boolean(Number(row.present_count)),
        }))
      )
    }

    const result = await query(
      `SELECT s.id AS student_id,
              s.matric_no,
              u.full_name,
              u.email,
              c.min_attendance_required,
              COUNT(DISTINCT ses.id) FILTER (WHERE ses.end_time <= NOW())::int AS total_sessions,
              COUNT(ar.id)::int AS present_count,
              ROUND(
                CASE
                  WHEN COUNT(DISTINCT ses.id) FILTER (WHERE ses.end_time <= NOW()) = 0 THEN 0
                  ELSE (COUNT(ar.id)::numeric / COUNT(DISTINCT ses.id) FILTER (WHERE ses.end_time <= NOW())) * 100
                END,
                2
              ) AS attendance_rate
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN users u ON u.id = s.user_id
       JOIN courses c ON c.id = e.course_id
       LEFT JOIN attendance_sessions ses ON ses.course_id = c.id
       LEFT JOIN attendance_records ar
         ON ar.session_id = ses.id AND ar.student_id = s.id
       WHERE e.course_id = $1
       GROUP BY s.id, u.id, c.id
       ORDER BY u.full_name ASC`,
      [courseId]
    )

    const formatted = result.rows.map((row) => ({
      ...row,
      eligible: Number(row.present_count) >= Number(row.min_attendance_required),
      absent_count: Math.max(0, Number(row.total_sessions) - Number(row.present_count)),
    }))

    res.json(formatted)
  } catch (error) {
    next(error)
  }
}

export const markAttendance = async (req, res, next) => {
  try {
    const { courseId, classNumber } = req.body
    if (!courseId) {
      throw httpError(400, 'courseId is required')
    }

    const studentResult = await query('SELECT id FROM students WHERE user_id = $1', [req.user.userId])
    const student = studentResult.rows[0]

    if (!student) {
      throw httpError(404, 'Student profile not found')
    }

    await closeExpiredAttendanceSessions()
    const activeSession = classNumber
      ? await getActiveSessionByCourse(courseId, classNumber)
      : await getActiveSessionByCourse(courseId)

    if (!activeSession) {
      throw httpError(400, 'No active attendance session')
    }

    await insertAttendanceRecord({ sessionId: activeSession.id, studentId: student.id })

    res.status(201).json({ message: 'Attendance marked successfully' })
  } catch (error) {
    next(error)
  }
}

export const manualMarkAttendance = async (req, res, next) => {
  try {
    const { courseId, studentId, classNumber } = req.body

    if (!courseId || !studentId) {
      throw httpError(400, 'courseId and studentId are required')
    }

    await closeExpiredAttendanceSessions()
    const activeSession = classNumber
      ? await getActiveSessionByCourse(courseId, classNumber)
      : await getActiveSessionByCourse(courseId)

    if (!activeSession) {
      throw httpError(400, 'No active attendance session')
    }

    const enrollment = await query(
      'SELECT id FROM enrollments WHERE course_id = $1 AND student_id = $2',
      [courseId, studentId]
    )

    if (!enrollment.rows.length) {
      throw httpError(400, 'Student is not enrolled in this course')
    }

    await insertAttendanceRecord({ sessionId: activeSession.id, studentId: Number(studentId) })

    res.status(201).json({ message: 'Student marked present' })
  } catch (error) {
    next(error)
  }
}

export const getCourseAttendanceRoster = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    const classNumber = Number(req.query.classNumber || 0)
    await closeExpiredAttendanceSessions()

    const activeSession = classNumber
      ? await getActiveSessionByCourse(courseId, classNumber)
      : await getActiveSessionByCourse(courseId)

    const classSessionResult = classNumber
      ? await query(
          `SELECT *
           FROM attendance_sessions
           WHERE course_id = $1 AND class_number = $2
           ORDER BY created_at DESC
           LIMIT 1`,
          [courseId, classNumber]
        )
      : { rows: [] }

    const classSession = classSessionResult.rows[0] || activeSession
    const targetSessionId = activeSession?.id || classSession?.id || null

    const result = await query(
      `SELECT s.id AS student_id,
              s.matric_no,
              s.status,
              u.full_name,
              u.email,
              CASE
                WHEN $2::int IS NULL THEN FALSE
                WHEN ar.id IS NOT NULL THEN TRUE
                ELSE FALSE
              END AS present
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN attendance_records ar
         ON ar.student_id = s.id AND ar.session_id = $2
       WHERE e.course_id = $1
       ORDER BY u.full_name ASC`,
      [courseId, targetSessionId]
    )

    res.json({
      activeSession,
      classSession,
      canMark: Boolean(activeSession),
      roster: result.rows,
    })
  } catch (error) {
    next(error)
  }
}

export const getStudentAttendanceProgress = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    const studentResult = await query('SELECT id FROM students WHERE user_id = $1', [req.user.userId])

    const student = studentResult.rows[0]
    if (!student) {
      throw httpError(404, 'Student profile not found')
    }

    const eligibility = await getEligibilityForStudentInCourse(student.id, courseId)
    if (!eligibility) {
      throw httpError(404, 'Course not found')
    }

    res.json(eligibility)
  } catch (error) {
    next(error)
  }
}

export const startBatchAttendanceSession = async (req, res, next) => {
  try {
    const { batchId, durationMinutes } = req.body

    if (!batchId || !durationMinutes) {
      throw httpError(400, 'batchId and durationMinutes are required')
    }

    const batchResult = await query(
      `SELECT b.id, b.course_id, b.status
       FROM batches b
       WHERE b.id = $1`,
      [batchId]
    )
    const batch = batchResult.rows[0]
    if (!batch) {
      throw httpError(404, 'Batch not found')
    }

    if (batch.status !== 'ongoing') {
      throw httpError(400, 'Attendance can only be started for ongoing batch')
    }

    await closeExpiredAttendanceSessions()

    const existing = await query(
      `SELECT id
       FROM attendance_sessions
       WHERE batch_id = $1 AND is_active = TRUE
       LIMIT 1`,
      [batchId]
    )
    if (existing.rows.length) {
      throw httpError(409, 'An active attendance session already exists for this batch')
    }

    const classCountResult = await query(
      `SELECT COALESCE(MAX(class_number), 0)::int AS max_class
       FROM attendance_sessions
       WHERE batch_id = $1`,
      [batchId]
    )
    const nextClass = Number(classCountResult.rows[0].max_class) + 1

    const result = await query(
      `INSERT INTO attendance_sessions (course_id, batch_id, class_number, start_time, end_time, is_active, created_by)
       VALUES ($1, $2, $3, NOW(), NOW() + ($4 || ' minutes')::interval, TRUE, $5)
       RETURNING *`,
      [batch.course_id, batchId, nextClass, Number(durationMinutes), req.user.userId]
    )

    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export const getBatchAttendanceStatus = async (req, res, next) => {
  try {
    const batchId = Number(req.params.batchId)
    await closeExpiredAttendanceSessions()

    const activeResult = await query(
      `SELECT * FROM attendance_sessions
       WHERE batch_id = $1 AND is_active = TRUE
       ORDER BY created_at DESC
       LIMIT 1`,
      [batchId]
    )
    const activeSession = activeResult.rows[0] || null

    if (!activeSession) {
      return res.json({ activeSession: null, attendeeCount: 0 })
    }

    const countResult = await query(
      `SELECT COUNT(*)::int AS attendees
       FROM attendance_records
       WHERE session_id = $1`,
      [activeSession.id]
    )

    res.json({
      activeSession,
      attendeeCount: Number(countResult.rows[0].attendees),
    })
  } catch (error) {
    next(error)
  }
}

export const closeBatchAttendanceSession = async (req, res, next) => {
  try {
    const { batchId } = req.body

    if (!batchId) {
      throw httpError(400, 'batchId is required')
    }

    await closeExpiredAttendanceSessions()
    const activeResult = await query(
      `SELECT * FROM attendance_sessions
       WHERE batch_id = $1 AND is_active = TRUE
       ORDER BY created_at DESC
       LIMIT 1`,
      [batchId]
    )
    const activeSession = activeResult.rows[0]

    if (!activeSession) {
      throw httpError(400, 'No active attendance session for batch')
    }

    await query(
      `UPDATE attendance_sessions
       SET is_active = FALSE, end_time = NOW()
       WHERE id = $1`,
      [activeSession.id]
    )

    res.json({ message: 'Batch attendance session closed' })
  } catch (error) {
    next(error)
  }
}

export const manualMarkBatchAttendance = async (req, res, next) => {
  try {
    const { batchId, studentId } = req.body
    if (!batchId || !studentId) {
      throw httpError(400, 'batchId and studentId are required')
    }

    await closeExpiredAttendanceSessions()
    const activeResult = await query(
      `SELECT * FROM attendance_sessions
       WHERE batch_id = $1 AND is_active = TRUE
       ORDER BY created_at DESC
       LIMIT 1`,
      [batchId]
    )
    const activeSession = activeResult.rows[0]

    if (!activeSession) {
      throw httpError(400, 'No active attendance session')
    }

    const enrollment = await query(
      `SELECT id FROM enrollments WHERE batch_id = $1 AND student_id = $2 AND status = 'active'`,
      [batchId, studentId]
    )
    if (!enrollment.rows.length) {
      throw httpError(400, 'Student is not actively enrolled in this batch')
    }

    await insertAttendanceRecord({ sessionId: activeSession.id, studentId: Number(studentId) })
    res.status(201).json({ message: 'Student marked present in batch session' })
  } catch (error) {
    next(error)
  }
}

// ── Edit a past attendance session ──────────────────────────────────────────
// GET /attendance/session/:sessionId/roster
export const getSessionRoster = async (req, res, next) => {
  try {
    const sessionId = Number(req.params.sessionId)
    if (!sessionId) throw httpError(400, 'Invalid sessionId')

    const sessionResult = await query(
      `SELECT s.id, s.course_id, s.class_number, s.start_time, s.end_time, s.is_active
       FROM attendance_sessions s WHERE s.id = $1`,
      [sessionId]
    )
    const session = sessionResult.rows[0]
    if (!session) throw httpError(404, 'Session not found')

    const roster = await query(
      `SELECT s.id AS student_id,
              s.matric_no,
              s.status,
              u.full_name,
              CASE WHEN ar.id IS NOT NULL THEN TRUE ELSE FALSE END AS present,
              ar.id AS record_id
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN attendance_records ar
         ON ar.student_id = s.id AND ar.session_id = $1
       WHERE e.course_id = $2
       ORDER BY u.full_name ASC`,
      [sessionId, session.course_id]
    )

    res.json({ session, roster: roster.rows })
  } catch (error) {
    next(error)
  }
}

// PATCH /attendance/session/:sessionId/toggle
// body: { studentId }
// Toggles a student present/absent in a closed (or open) session.
export const editSessionAttendance = async (req, res, next) => {
  try {
    const sessionId = Number(req.params.sessionId)
    const studentId = Number(req.body.studentId)
    if (!sessionId || !studentId) throw httpError(400, 'sessionId and studentId are required')

    const sessionResult = await query(
      `SELECT id, course_id FROM attendance_sessions WHERE id = $1`, [sessionId]
    )
    const session = sessionResult.rows[0]
    if (!session) throw httpError(404, 'Session not found')

    // Verify student is enrolled in the course
    const enrollment = await query(
      `SELECT id FROM enrollments WHERE course_id = $1 AND student_id = $2`,
      [session.course_id, studentId]
    )
    if (!enrollment.rows.length) throw httpError(400, 'Student is not enrolled in this course')

    const existing = await query(
      `SELECT id FROM attendance_records WHERE session_id = $1 AND student_id = $2`,
      [sessionId, studentId]
    )

    if (existing.rows.length) {
      // Currently present → mark absent (delete record)
      await query(`DELETE FROM attendance_records WHERE id = $1`, [existing.rows[0].id])
      res.json({ present: false })
    } else {
      // Currently absent → mark present (insert record)
      await query(
        `INSERT INTO attendance_records (session_id, student_id) VALUES ($1, $2)`,
        [sessionId, studentId]
      )
      res.json({ present: true })
    }
  } catch (error) {
    next(error)
  }
}
