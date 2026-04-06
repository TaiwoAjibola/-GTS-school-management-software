import { query } from '../db/pool.js'

export const closeExpiredAttendanceSessions = async () => {
  await query(
    `UPDATE attendance_sessions
     SET is_active = FALSE
     WHERE is_active = TRUE AND end_time < NOW()`
  )
}

export const getActiveSessionByCourse = async (courseId, classNumber = null) => {
  await closeExpiredAttendanceSessions()
  const result = classNumber
    ? await query(
        `SELECT *
         FROM attendance_sessions
         WHERE course_id = $1 AND class_number = $2 AND is_active = TRUE
         ORDER BY created_at DESC
         LIMIT 1`,
        [courseId, Number(classNumber)]
      )
    : await query(
        `SELECT *
         FROM attendance_sessions
         WHERE course_id = $1 AND is_active = TRUE
         ORDER BY created_at DESC
         LIMIT 1`,
        [courseId]
      )

  return result.rows[0] || null
}
