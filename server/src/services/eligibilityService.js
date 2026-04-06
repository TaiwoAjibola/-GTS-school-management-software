import { query } from '../db/pool.js'

export const getEligibilityForStudentInCourse = async (studentId, courseId) => {
  const result = await query(
    `SELECT c.min_attendance_required,
            COALESCE(
              COUNT(DISTINCT ar.id) FILTER (
                WHERE s.course_id = c.id AND s.end_time <= NOW()
              ), 0
            ) AS attendance_count
     FROM courses c
     LEFT JOIN attendance_sessions s ON s.course_id = c.id
     LEFT JOIN attendance_records ar
       ON ar.session_id = s.id AND ar.student_id = $1
     WHERE c.id = $2
     GROUP BY c.id`,
    [studentId, courseId]
  )

  if (!result.rows.length) {
    return null
  }

  const attendanceCount = Number(result.rows[0].attendance_count)
  const minRequired = Number(result.rows[0].min_attendance_required)

  return {
    attendanceCount,
    minRequired,
    eligible: attendanceCount >= minRequired,
  }
}

export const getEligibleStudentsForCourse = async (courseId) => {
  const result = await query(
    `SELECT s.id,
            s.matric_no,
            u.full_name,
            u.email,
            c.min_attendance_required,
            COALESCE(
              COUNT(ar.id) FILTER (WHERE ses.end_time <= NOW()),
              0
            ) AS attendance_count
     FROM enrollments e
     JOIN students s ON s.id = e.student_id
     JOIN users u ON u.id = s.user_id
     JOIN courses c ON c.id = e.course_id
     LEFT JOIN attendance_records ar ON ar.student_id = s.id
     LEFT JOIN attendance_sessions ses
       ON ses.id = ar.session_id AND ses.course_id = c.id
    WHERE e.course_id = $1 AND e.status = 'active'
     GROUP BY s.id, u.id, c.id
     HAVING COALESCE(
       COUNT(ar.id) FILTER (WHERE ses.end_time <= NOW()),
       0
     ) >= c.min_attendance_required`,
    [courseId]
  )

  return result.rows
}

export const getEligibilityForStudentInBatch = async (studentId, batchId) => {
  const result = await query(
    `SELECT c.min_attendance_required,
            COALESCE(
              COUNT(DISTINCT ar.id) FILTER (
                WHERE s.batch_id = $2 AND s.end_time <= NOW()
              ), 0
            ) AS attendance_count
     FROM batches b
     JOIN courses c ON c.id = b.course_id
     LEFT JOIN attendance_sessions s ON s.batch_id = b.id
     LEFT JOIN attendance_records ar
       ON ar.session_id = s.id AND ar.student_id = $1
     WHERE b.id = $2
     GROUP BY b.id, c.id`,
    [studentId, batchId]
  )

  if (!result.rows.length) return null

  const attendanceCount = Number(result.rows[0].attendance_count)
  const minRequired = Number(result.rows[0].min_attendance_required)
  return {
    attendanceCount,
    minRequired,
    eligible: attendanceCount >= minRequired,
  }
}

export const getEligibleStudentsForBatch = async (batchId) => {
  const result = await query(
    `SELECT s.id,
            s.matric_no,
            u.full_name,
            u.email,
            c.min_attendance_required,
            COALESCE(
              COUNT(ar.id) FILTER (WHERE ses.end_time <= NOW()),
              0
            ) AS attendance_count
     FROM enrollments e
     JOIN students s ON s.id = e.student_id
     JOIN users u ON u.id = s.user_id
     JOIN batches b ON b.id = e.batch_id
     JOIN courses c ON c.id = b.course_id
     LEFT JOIN attendance_records ar ON ar.student_id = s.id
     LEFT JOIN attendance_sessions ses
       ON ses.id = ar.session_id AND ses.batch_id = b.id
     WHERE e.batch_id = $1 AND e.status = 'active'
     GROUP BY s.id, u.id, c.id
     HAVING COALESCE(
       COUNT(ar.id) FILTER (WHERE ses.end_time <= NOW()),
       0
     ) >= c.min_attendance_required`,
    [batchId]
  )

  return result.rows
}
