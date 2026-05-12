import { query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'

/**
 * Get high-level summaries across the application.
 * Supports filtering by year (via cohort), batch, and course.
 */
export const getGeneralReports = async (req, res, next) => {
  try {
    const { year, batchId, courseId } = req.query

    // Build common filter fragments
    let studentFilter = '1=1'
    let courseFilter = '1=1'
    let params = []

    if (year) {
      params.push(year)
      studentFilter += ` AND EXISTS (SELECT 1 FROM cohorts co WHERE co.id = s.cohort_id AND EXTRACT(YEAR FROM co.start_date) = $${params.length})`
    }

    if (batchId) {
      params.push(batchId)
      studentFilter += ` AND EXISTS (SELECT 1 FROM enrollments e WHERE e.student_id = s.id AND e.batch_id = $${params.length})`
    }

    if (courseId) {
      params.push(courseId)
      studentFilter += ` AND EXISTS (SELECT 1 FROM enrollments e WHERE e.student_id = s.id AND e.course_id = $${params.length})`
      courseFilter += ` AND c.id = $${params.length}`
    }

    const [studentStats, courseStats, lecturerStats, emailStats] = await Promise.all([
      // 1. Student Stats
      query(
        `SELECT
          COUNT(*)::int AS total_students,
          COUNT(*) FILTER (WHERE status = 'Active')::int AS active_students,
          COUNT(*) FILTER (WHERE status = 'Prospective')::int AS prospective_students,
          COUNT(*) FILTER (WHERE status IN ('Graduating', 'Graduated'))::int AS graduating_students,
          (SELECT COUNT(*)::int FROM enrollments e WHERE e.status = 'active') AS total_enrollments
         FROM students s
         WHERE ${studentFilter}`,
        params
      ),

      // 2. Course Stats
      query(
        `SELECT
          COUNT(*)::int AS total_courses,
          COUNT(*) FILTER (WHERE is_current = true)::int AS active_courses,
          (SELECT COUNT(*)::int FROM batches b WHERE b.status = 'completed') AS completed_batches,
          (SELECT AVG(enroll_count)::float
           FROM (SELECT COUNT(e.id) AS enroll_count FROM courses c LEFT JOIN enrollments e ON e.course_id = c.id GROUP BY c.id) sub) AS avg_enrollment
         FROM courses c
         WHERE ${courseFilter}`,
        courseId ? [courseId] : []
      ),

      // 3. Lecturer Stats
      query(
        `SELECT
          COUNT(*)::int AS total_lecturers,
          COUNT(DISTINCT c.lecturer_id)::int AS assigned_lecturers,
          (SELECT COUNT(*)::int FROM users WHERE role = 'lecturer' AND is_active = true) AS active_lecturers
         FROM users u
         LEFT JOIN courses c ON c.lecturer_id = u.id
         WHERE u.role = 'lecturer'`
      ),

      // 4. Email Stats (from email_activity_logs if it exists, otherwise just counts)
      // For now, let's just count from a placeholder if table exists, or return 0
      query(
        `SELECT
          (SELECT COUNT(*)::int FROM student_activity_logs WHERE action = 'student_lifecycle_status_updated') AS workflow_triggers
         FROM (SELECT 1) AS dummy`
      )
    ])

    res.json({
      students: studentStats.rows[0],
      courses: courseStats.rows[0],
      lecturers: lecturerStats.rows[0],
      emails: emailStats.rows[0],
      filters: { year, batchId, courseId }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get detailed attendance and eligibility reports.
 */
export const getAttendanceReports = async (req, res, next) => {
  try {
    const { courseId, batchId } = req.query

    let whereClause = '1=1'
    let params = []

    if (courseId) {
      params.push(courseId)
      whereClause += ` AND e.course_id = $${params.length}`
    }
    if (batchId) {
      params.push(batchId)
      whereClause += ` AND e.batch_id = $${params.length}`
    }

    const result = await query(
      `SELECT
        s.id AS student_id,
        u.full_name,
        c.title AS course_title,
        c.min_attendance_required,
        COUNT(DISTINCT ses.id)::int AS total_sessions,
        COUNT(ar.id)::int AS present_count,
        CASE
          WHEN COUNT(ar.id) >= c.min_attendance_required THEN 'Eligible'
          ELSE 'Not Eligible'
        END AS eligibility_status
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN users u ON u.id = s.user_id
       JOIN courses c ON c.id = e.course_id
       LEFT JOIN attendance_sessions ses ON ses.course_id = c.id
       LEFT JOIN attendance_records ar
         ON ar.session_id = ses.id AND ar.student_id = s.id
       WHERE ${whereClause}
       GROUP BY s.id, u.id, c.id
       ORDER BY eligibility_status DESC, u.full_name ASC`,
      params
    )

    // Summary metrics
    const eligibleCount = result.rows.filter(r => r.eligibility_status === 'Eligible').length
    const totalCount = result.rows.length
    const attendanceRate = totalCount > 0
      ? (result.rows.reduce((acc, curr) => acc + (curr.present_count / (curr.total_sessions || 1)), 0) / totalCount) * 100
      : 0

    res.json({
      data: result.rows,
      summary: {
        total_students: totalCount,
        eligible_students: eligibleCount,
        ineligible_students: totalCount - eligibleCount,
        avg_attendance_rate: Math.round(attendanceRate)
      }
    })
  } catch (error) {
    next(error)
  }
}
