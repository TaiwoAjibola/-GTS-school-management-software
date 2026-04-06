import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'
import { getEligibleStudentsForBatch, getEligibleStudentsForCourse } from '../services/eligibilityService.js'
import { sendAssignmentEmail } from '../services/emailService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsRoot = path.join(__dirname, '../../uploads/assignments')

if (!fs.existsSync(uploadsRoot)) {
  fs.mkdirSync(uploadsRoot, { recursive: true })
}

export const createAssignment = async (req, res, next) => {
  try {
    const { courseId, batchId, title, description, dueDate } = req.body

    if ((!courseId && !batchId) || !title || !description) {
      throw httpError(400, 'courseId or batchId, title and description are required')
    }

    let resolvedCourseId = Number(courseId || 0)
    let resolvedBatchId = batchId ? Number(batchId) : null

    if (resolvedBatchId) {
      const batchResult = await query('SELECT course_id FROM batches WHERE id = $1', [resolvedBatchId])
      const batch = batchResult.rows[0]
      if (!batch) throw httpError(404, 'Batch not found')
      resolvedCourseId = Number(batch.course_id)
    }

    const courseConfigResult = await query(
      'SELECT title, has_assignment FROM courses WHERE id = $1',
      [resolvedCourseId]
    )
    const courseConfig = courseConfigResult.rows[0]
    if (!courseConfig) throw httpError(404, 'Course not found')
    if (!courseConfig.has_assignment) {
      throw httpError(400, 'Assignments are disabled for this course')
    }

    let attachmentUrl = null
    if (req.file) {
      const safeName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`
      const targetPath = path.join(uploadsRoot, safeName)
      fs.writeFileSync(targetPath, req.file.buffer)
      attachmentUrl = `/uploads/assignments/${safeName}`
    }

    const assignmentResult = await query(
      `INSERT INTO assignments (course_id, batch_id, title, description, due_date, attachment_url, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [resolvedCourseId, resolvedBatchId, title, description, dueDate || null, attachmentUrl, req.user.userId]
    )

    const assignment = assignmentResult.rows[0]
    const eligibleStudents = resolvedBatchId
      ? await getEligibleStudentsForBatch(resolvedBatchId)
      : await getEligibleStudentsForCourse(resolvedCourseId)

    const courseResult = await query('SELECT title FROM courses WHERE id = $1', [resolvedCourseId])
    const courseTitle = courseResult.rows[0]?.title || 'Course'

    for (const student of eligibleStudents) {
      const sent = await sendAssignmentEmail({
        to: student.email,
        studentName: student.full_name,
        courseTitle,
        assignmentTitle: assignment.title,
        dueDate: assignment.due_date,
      }).catch(() => false)

      await query(
        `INSERT INTO assignment_deliveries (assignment_id, student_id, email_sent)
         VALUES ($1, $2, $3)
         ON CONFLICT (assignment_id, student_id) DO NOTHING`,
        [assignment.id, student.id, Boolean(sent)]
      )
    }

    res.status(201).json({
      assignment,
      deliveredTo: eligibleStudents.length,
    })
  } catch (error) {
    next(error)
  }
}

export const getStudentAssignments = async (req, res, next) => {
  try {
    const studentResult = await query('SELECT id FROM students WHERE user_id = $1', [req.user.userId])
    const student = studentResult.rows[0]
    if (!student) {
      throw httpError(404, 'Student profile not found')
    }

    const result = await query(
      `SELECT a.id, a.title, a.description, a.due_date, a.attachment_url, c.title AS course_title
       FROM assignment_deliveries ad
       JOIN assignments a ON a.id = ad.assignment_id
       JOIN courses c ON c.id = a.course_id
       WHERE ad.student_id = $1
       ORDER BY a.created_at DESC`,
      [student.id]
    )

    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const getAssignmentEligibleStudents = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)

    if (!courseId) {
      throw httpError(400, 'Valid courseId is required')
    }

    const students = await getEligibleStudentsForCourse(courseId)
    res.json(students)
  } catch (error) {
    next(error)
  }
}

export const getAssignmentEligibleStudentsByBatch = async (req, res, next) => {
  try {
    const batchId = Number(req.params.batchId)

    if (!batchId) {
      throw httpError(400, 'Valid batchId is required')
    }

    const students = await getEligibleStudentsForBatch(batchId)
    res.json(students)
  } catch (error) {
    next(error)
  }
}

export const getCourseAssignments = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    if (!courseId) throw httpError(400, 'Valid courseId is required')

    const result = await query(
      `SELECT a.id,
              a.title,
              a.description,
              a.due_date,
              a.attachment_url,
              a.created_at,
              b.id AS batch_id,
              b.start_date AS batch_start,
              u.full_name AS created_by_name,
              COUNT(ad.id)::int AS delivery_count
       FROM assignments a
       LEFT JOIN batches b ON b.id = a.batch_id
       LEFT JOIN users u ON u.id = a.created_by
       LEFT JOIN assignment_deliveries ad ON ad.assignment_id = a.id
       WHERE a.course_id = $1
       GROUP BY a.id, b.id, u.full_name
       ORDER BY a.created_at DESC`,
      [courseId]
    )

    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}
