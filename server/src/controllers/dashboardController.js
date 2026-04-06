import { query } from '../db/pool.js'

export const adminAnalytics = async (req, res, next) => {
  try {
    const [students, courses, sessions, attendanceRate] = await Promise.all([
      query('SELECT COUNT(*)::int AS total FROM students'),
      query('SELECT COUNT(*)::int AS total FROM courses'),
      query('SELECT COUNT(*)::int AS total FROM attendance_sessions'),
      query(
        `SELECT c.id, c.title,
                COALESCE(COUNT(ar.id), 0)::int AS total_attendance
         FROM courses c
         LEFT JOIN attendance_sessions s ON s.course_id = c.id
         LEFT JOIN attendance_records ar ON ar.session_id = s.id
         GROUP BY c.id
         ORDER BY c.created_at DESC`
      ),
    ])

    res.json({
      totalStudents: students.rows[0].total,
      totalCourses: courses.rows[0].total,
      totalSessions: sessions.rows[0].total,
      attendanceByCourse: attendanceRate.rows,
    })
  } catch (error) {
    next(error)
  }
}
