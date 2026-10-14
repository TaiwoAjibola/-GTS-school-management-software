import { query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'

// Resolve the students.id for the authenticated user (token subject).
const getStudentId = async (userId) => {
  const result = await query('SELECT id FROM students WHERE user_id = $1 LIMIT 1', [userId])
  if (!result.rows.length) throw httpError(404, 'Student profile not found')
  return result.rows[0].id
}

const requireEnrollment = async (studentId, courseId) => {
  const result = await query(
    'SELECT 1 FROM enrollments WHERE student_id = $1 AND course_id = $2 LIMIT 1',
    [studentId, courseId]
  )
  if (!result.rows.length) throw httpError(403, 'You are not enrolled in this course')
}

// Published annual study guide for the student's programme.
export const getStudyGuide = async (req, res, next) => {
  try {
    const plan = await query(
      'SELECT id, name, year FROM course_plans WHERE is_active = true ORDER BY id DESC LIMIT 1'
    )
    if (!plan.rows.length) return res.json({ plan: null, items: [] })

    const items = await query(
      `SELECT cpi.id, cpi.course_id, cpi.start_date, cpi.end_date, cpi.sort_order, cpi.notes,
              c.title, c.course_code, c.description, c.lecturer_name, c.secondary_lecturer_name,
              c.duration_weeks, c.min_attendance_required, c.meet_link
       FROM course_plan_items cpi
       JOIN courses c ON c.id = cpi.course_id
       WHERE cpi.plan_id = $1
       ORDER BY cpi.sort_order ASC`,
      [plan.rows[0].id]
    )
    res.json({ plan: plan.rows[0], items: items.rows })
  } catch (error) {
    next(error)
  }
}

// Full enrolment history for the student.
export const getEnrollments = async (req, res, next) => {
  try {
    const studentId = await getStudentId(req.user.userId)
    const result = await query(
      `SELECT e.id, e.course_id, e.batch_id, e.status, e.enrolled_at, e.completed_at,
              c.title, c.course_code, c.min_attendance_required
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       WHERE e.student_id = $1
       ORDER BY e.enrolled_at DESC`,
      [studentId]
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

// Available / upcoming / completed / outstanding course aggregator.
export const getCourseAvailability = async (req, res, next) => {
  try {
    const studentId = await getStudentId(req.user.userId)
    const plan = await query(
      'SELECT id FROM course_plans WHERE is_active = true ORDER BY id DESC LIMIT 1'
    )
    if (!plan.rows.length) return res.json({ items: [] })

    const items = await query(
      `SELECT cpi.course_id, cpi.start_date, cpi.end_date, cpi.sort_order, cpi.notes,
              c.title, c.course_code, c.description, c.meet_link
       FROM course_plan_items cpi
       JOIN courses c ON c.id = cpi.course_id
       WHERE cpi.plan_id = $1
       ORDER BY cpi.sort_order ASC`,
      [plan.rows[0].id]
    )

    const enrollments = await query(
      "SELECT course_id, status FROM enrollments WHERE student_id = $1 AND status IN ('active','completed','failed')",
      [studentId]
    )
    const byCourse = {}
    for (const e of enrollments.rows) byCourse[e.course_id] = e.status

    const mapped = items.rows.map((it) => ({
      ...it,
      state: byCourse[it.course_id] || 'available',
    }))
    res.json({ items: mapped })
  } catch (error) {
    next(error)
  }
}

// Course materials for an enrolled course.
export const getCourseMaterials = async (req, res, next) => {
  try {
    const studentId = await getStudentId(req.user.userId)
    const { courseId } = req.params
    await requireEnrollment(studentId, courseId)
    const result = await query(
      'SELECT id, course_id, title, description, section_number, material_url, created_at FROM course_materials WHERE course_id = $1 ORDER BY section_number ASC, created_at ASC',
      [courseId]
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

// Sessions (with Meet links) for an enrolled course.
export const getCourseSessions = async (req, res, next) => {
  try {
    const studentId = await getStudentId(req.user.userId)
    const { courseId } = req.params
    await requireEnrollment(studentId, courseId)
    const result = await query(
      `SELECT id, course_id, class_number, start_time, end_time, meet_link, lecturer_notes
       FROM attendance_sessions WHERE course_id = $1 ORDER BY start_time ASC`,
      [courseId]
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

// Graduation status for the student.
export const getGraduationStatus = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT s.status, s.matric_no, s.student_number,
              gs.id AS set_id, gs.name AS set_name, gs.graduation_date, gs.status AS set_status
       FROM students s
       LEFT JOIN graduating_set_members gsm ON gsm.student_id = s.id
       LEFT JOIN graduating_sets gs ON gs.id = gsm.set_id
       WHERE s.user_id = $1
       LIMIT 1`,
      [req.user.userId]
    )
    res.json(result.rows[0] || { status: null })
  } catch (error) {
    next(error)
  }
}

// Attendance eligibility summary for the student's active courses.
export const getMyReports = async (req, res, next) => {
  try {
    const studentId = await getStudentId(req.user.userId)
    const result = await query(
      `SELECT c.id, c.title, c.course_code, c.min_attendance_required,
              COUNT(DISTINCT s.id) AS total_sessions,
              COUNT(ar.id)::int AS present_count,
              (COUNT(DISTINCT s.id) - COUNT(ar.id))::int AS absent_count
       FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       LEFT JOIN attendance_sessions s ON s.course_id = c.id
       LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.student_id = e.student_id
       WHERE e.student_id = $1 AND e.status = 'active'
       GROUP BY c.id, c.title, c.course_code, c.min_attendance_required`,
      [studentId]
    )
    const rows = result.rows.map((r) => {
      const present = Number(r.present_count || 0)
      const total = Number(r.total_sessions || 0)
      const absent = Math.max(0, total - present)
      return {
        ...r,
        present_count: present,
        absent_count: absent,
        eligible: r.min_attendance_required != null && present >= Number(r.min_attendance_required),
      }
    })
    res.json(rows)
  } catch (error) {
    next(error)
  }
}
