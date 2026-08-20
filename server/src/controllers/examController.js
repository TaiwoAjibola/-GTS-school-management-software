import { randomBytes } from 'node:crypto'
import { pool, query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'
import {
  getEligibleStudentsForCourse,
  getEligibleStudentsForBatch,
} from '../services/eligibilityService.js'
import { sendExamEmail } from '../services/emailService.js'

const generateAccessCode = () =>
  randomBytes(5).toString('base64url').toUpperCase().slice(0, 8)

const getExamById = async (id) => {
  const examResult = await query('SELECT * FROM exams WHERE id = $1', [id])
  if (!examResult.rows.length) return null

  const exam = examResult.rows[0]
  const questionsResult = await query(
    'SELECT * FROM exam_questions WHERE exam_id = $1 ORDER BY order_index ASC',
    [exam.id]
  )
  const deliveryResult = await query(
    `SELECT COUNT(*)::int AS count FROM exam_deliveries WHERE exam_id = $1`,
    [exam.id]
  )

  return {
    ...exam,
    questions: questionsResult.rows,
    delivery_count: deliveryResult.rows[0].count,
  }
}

export const createExam = async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { courseId, batchId, planId, title, description, dueDate, questions, examType, quizUrl } = req.body

    if (!courseId || !title) {
      throw httpError(400, 'courseId and title are required')
    }

    const type = examType === 'mcq' ? 'mcq' : 'essay'
    if (type === 'mcq' && !quizUrl) {
      throw httpError(400, 'quizUrl is required for MCQ exams')
    }
    if (type === 'essay' && !(Array.isArray(questions) && questions.some((q) => String(q?.text || q?.questionText || '').trim()))) {
      throw httpError(400, 'Add at least one exam question for essay exams')
    }

    const courseResult = await client.query('SELECT id FROM courses WHERE id = $1', [courseId])
    if (!courseResult.rows.length) throw httpError(404, 'Course not found')

    await client.query('BEGIN')

    const examResult = await client.query(
      `INSERT INTO exams (course_id, batch_id, plan_id, title, description, due_date, exam_type, quiz_url, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [courseId, batchId || null, planId || null, title, description || null, dueDate || null, type, quizUrl || null, req.user.userId]
    )

    const exam = examResult.rows[0]

    if (Array.isArray(questions) && questions.length) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        const text = String(q?.text || q?.questionText || '').trim()
        if (!text) continue
        await client.query(
          `INSERT INTO exam_questions (exam_id, question_text, order_index)
           VALUES ($1, $2, $3)`,
          [exam.id, text, i]
        )
      }
    }

    await client.query('COMMIT')

    const created = await getExamById(exam.id)
    res.status(201).json(created)
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
}

export const listExamsByCourse = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    if (!courseId) throw httpError(400, 'Valid courseId is required')

    const result = await query(
      `SELECT ex.*,
              u.full_name AS created_by_name,
              b.name AS batch_name,
              p.name AS plan_name,
              p.year AS plan_year,
              (SELECT COUNT(*)::int FROM exam_questions eq WHERE eq.exam_id = ex.id) AS question_count,
              (SELECT COUNT(*)::int FROM exam_deliveries ed WHERE ed.exam_id = ex.id) AS delivery_count
       FROM exams ex
       LEFT JOIN users u ON u.id = ex.created_by
       LEFT JOIN batches b ON b.id = ex.batch_id
       LEFT JOIN course_plans p ON p.id = ex.plan_id
       WHERE ex.course_id = $1
       ORDER BY ex.created_at DESC`,
      [courseId]
    )

    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const getExamEligibleStudents = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    if (!courseId) throw httpError(400, 'Valid courseId is required')

    const students = await getEligibleStudentsForCourse(courseId)
    res.json(students)
  } catch (error) {
    next(error)
  }
}

export const getExamEligibleStudentsByBatch = async (req, res, next) => {
  try {
    const batchId = Number(req.params.batchId)
    if (!batchId) throw httpError(400, 'Valid batchId is required')

    const students = await getEligibleStudentsForBatch(batchId)
    res.json(students)
  } catch (error) {
    next(error)
  }
}

export const sendExam = async (req, res, next) => {
  const client = await pool.connect()
  try {
    const examId = Number(req.params.examId)
    if (!examId) throw httpError(400, 'Valid examId is required')

    const { studentIds } = req.body

    const examResult = await client.query(
      `SELECT ex.*, c.title AS course_title
       FROM exams ex
       JOIN courses c ON c.id = ex.course_id
       WHERE ex.id = $1`,
      [examId]
    )
    if (!examResult.rows.length) throw httpError(404, 'Exam not found')
    const exam = examResult.rows[0]

    const questionsResult = await client.query(
      'SELECT question_text FROM exam_questions WHERE exam_id = $1 ORDER BY order_index ASC',
      [examId]
    )
    const questions = questionsResult.rows

    let students
    if (Array.isArray(studentIds) && studentIds.length) {
      const idList = studentIds.map(Number).filter(Boolean)
      if (!idList.length) throw httpError(400, 'No valid studentIds provided')
      const studentResult = await client.query(
        `SELECT s.id, u.full_name, u.email
         FROM students s
         JOIN users u ON u.id = s.user_id
         WHERE s.id = ANY($1::int[])`,
        [idList]
      )
      students = studentResult.rows
    } else {
      students = exam.batch_id
        ? await getEligibleStudentsForBatch(exam.batch_id)
        : await getEligibleStudentsForCourse(exam.course_id)
    }

    let sent = 0
    let failed = 0
    const errors = []
    const isMcq = exam.exam_type === 'mcq'

    for (const student of students) {
      try {
        const accessCode = isMcq ? generateAccessCode() : null
        await sendExamEmail({
          to: student.email,
          studentName: student.full_name,
          courseTitle: exam.course_title,
          examTitle: exam.title,
          dueDate: exam.due_date,
          questions,
          examType: exam.exam_type,
          quizUrl: exam.quiz_url,
          accessCode,
        })
        await client.query(
          `INSERT INTO exam_deliveries (exam_id, student_id, delivered_at, email_sent, access_code)
           VALUES ($1, $2, NOW(), TRUE, $3)
           ON CONFLICT (exam_id, student_id)
           DO UPDATE SET delivered_at = NOW(), email_sent = TRUE, access_code = EXCLUDED.access_code`,
          [examId, student.id, accessCode]
        )
        sent++
      } catch (err) {
        failed++
        errors.push({ student: student.full_name, email: student.email, error: err.message })
      }
    }

    res.json({ sent, failed, errors, total: students.length })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
}

export const getStudentExams = async (req, res, next) => {
  try {
    const studentResult = await query('SELECT id FROM students WHERE user_id = $1', [req.user.userId])
    const student = studentResult.rows[0]
    if (!student) throw httpError(404, 'Student profile not found')

    const result = await query(
      `SELECT d.id AS delivery_id,
              d.delivered_at,
              d.access_code,
              ex.id AS exam_id,
              ex.title,
              ex.description,
              ex.due_date,
              ex.exam_type,
              ex.quiz_url,
              c.title AS course_title,
              COALESCE(
                json_agg(
                  json_build_object('id', eq.id, 'question_text', eq.question_text, 'order_index', eq.order_index)
                  ORDER BY eq.order_index ASC
                ) FILTER (WHERE eq.id IS NOT NULL),
                '[]'::json
              ) AS questions
       FROM exam_deliveries d
       JOIN exams ex ON ex.id = d.exam_id
       JOIN courses c ON c.id = ex.course_id
       LEFT JOIN exam_questions eq ON eq.exam_id = ex.id
       WHERE d.student_id = $1
       GROUP BY d.id, ex.id, c.title
       ORDER BY d.delivered_at DESC`,
      [student.id]
    )

    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const deleteExam = async (req, res, next) => {
  try {
    const examId = Number(req.params.examId)
    if (!examId) throw httpError(400, 'Valid examId is required')

    const result = await query('DELETE FROM exams WHERE id = $1 RETURNING id', [examId])
    if (!result.rows.length) throw httpError(404, 'Exam not found')
    res.json({ message: 'Exam deleted' })
  } catch (error) {
    next(error)
  }
}