import { randomBytes } from 'node:crypto'
import { pool, query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'
import {
  getEligibleStudentsForCourse,
  getEligibleStudentsForBatch,
} from '../services/eligibilityService.js'
import { sendExamEmail, sendMcqResultEmail } from '../services/emailService.js'
import { env } from '../config/env.js'

const generateAccessCode = () =>
  randomBytes(5).toString('base64url').toUpperCase().slice(0, 8)

const generatePublicToken = () => randomBytes(18).toString('base64url')

const quizTakeUrl = (token) => `${env.clientUrl.replace(/\/$/, '')}/quiz/${token}`

const normalizeMcqOptions = (options) => {
  if (!Array.isArray(options)) return []
  return options
    .map((opt, i) => {
      if (typeof opt === 'string') {
        const label = opt.trim()
        if (!label) return null
        return { key: String.fromCharCode(65 + i), label }
      }
      const label = String(opt?.label || opt?.text || '').trim()
      if (!label) return null
      const key = String(opt?.key || String.fromCharCode(65 + i)).toUpperCase().slice(0, 8)
      return { key, label }
    })
    .filter(Boolean)
}

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
  const submissionResult = await query(
    `SELECT COUNT(*)::int AS count FROM exam_submissions WHERE exam_id = $1`,
    [exam.id]
  ).catch(() => ({ rows: [{ count: 0 }] }))

  const takeUrl = exam.exam_type === 'mcq' && exam.public_token
    ? quizTakeUrl(exam.public_token)
    : null

  return {
    ...exam,
    questions: questionsResult.rows,
    delivery_count: deliveryResult.rows[0].count,
    submission_count: submissionResult.rows[0]?.count || 0,
    take_url: takeUrl,
  }
}

export const createExam = async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { courseId, batchId, planId, title, description, dueDate, questions, examType } = req.body

    if (!courseId || !title) {
      throw httpError(400, 'courseId and title are required')
    }

    const type = examType === 'mcq' ? 'mcq' : 'essay'
    const qs = Array.isArray(questions) ? questions : []

    if (type === 'mcq') {
      const valid = qs.filter((q) => {
        const text = String(q?.text || q?.questionText || '').trim()
        const opts = normalizeMcqOptions(q?.options)
        const correct = String(q?.correctAnswer || q?.correct_answer || '').toUpperCase()
        return text && opts.length >= 2 && opts.some((o) => o.key === correct)
      })
      if (!valid.length) {
        throw httpError(400, 'MCQ exams need at least one question with 2+ options and a correct answer')
      }
    } else if (!qs.some((q) => String(q?.text || q?.questionText || '').trim())) {
      throw httpError(400, 'Add at least one exam question for essay exams')
    }

    const courseResult = await client.query('SELECT id FROM courses WHERE id = $1', [courseId])
    if (!courseResult.rows.length) throw httpError(404, 'Course not found')

    await client.query('BEGIN')

    const publicToken = type === 'mcq' ? generatePublicToken() : null

    const examResult = await client.query(
      `INSERT INTO exams (course_id, batch_id, plan_id, title, description, due_date, exam_type, quiz_url, public_token, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        courseId,
        batchId || null,
        planId || null,
        title,
        description || null,
        dueDate || null,
        type,
        null,
        publicToken,
        req.user.userId,
      ]
    )

    const exam = examResult.rows[0]

    for (let i = 0; i < qs.length; i++) {
      const q = qs[i]
      const text = String(q?.text || q?.questionText || '').trim()
      if (!text) continue

      if (type === 'mcq') {
        const opts = normalizeMcqOptions(q?.options)
        const correct = String(q?.correctAnswer || q?.correct_answer || '').toUpperCase()
        if (opts.length < 2 || !opts.some((o) => o.key === correct)) continue
        await client.query(
          `INSERT INTO exam_questions (exam_id, question_text, order_index, options, correct_answer)
           VALUES ($1, $2, $3, $4, $5)`,
          [exam.id, text, i, JSON.stringify(opts), correct]
        )
      } else {
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
              (SELECT COUNT(*)::int FROM exam_deliveries ed WHERE ed.exam_id = ex.id) AS delivery_count,
              (SELECT COUNT(*)::int FROM exam_submissions es WHERE es.exam_id = ex.id) AS submission_count
       FROM exams ex
       LEFT JOIN users u ON u.id = ex.created_by
       LEFT JOIN batches b ON b.id = ex.batch_id
       LEFT JOIN course_plans p ON p.id = ex.plan_id
       WHERE ex.course_id = $1
       ORDER BY ex.created_at DESC`,
      [courseId]
    )

    const rows = result.rows.map((ex) => ({
      ...ex,
      take_url: ex.exam_type === 'mcq' && ex.public_token ? quizTakeUrl(ex.public_token) : null,
    }))

    res.json(rows)
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

    // Ensure MCQ exams have a public take token
    if (exam.exam_type === 'mcq' && !exam.public_token) {
      const token = generatePublicToken()
      await client.query('UPDATE exams SET public_token = $1 WHERE id = $2', [token, examId])
      exam.public_token = token
    }

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
    const takeUrl = isMcq && exam.public_token ? quizTakeUrl(exam.public_token) : null

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
          quizUrl: takeUrl,
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

    res.json({ sent, failed, errors, total: students.length, takeUrl })
  } catch (error) {
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
              ex.public_token,
              c.title AS course_title,
              es.id AS submission_id,
              es.score AS submission_score,
              es.submitted_at,
              es.result_sent_at,
              COALESCE(
                json_agg(
                  json_build_object('id', eq.id, 'question_text', eq.question_text, 'order_index', eq.order_index)
                  ORDER BY eq.order_index ASC
                ) FILTER (WHERE eq.id IS NOT NULL AND ex.exam_type = 'essay'),
                '[]'::json
              ) AS questions
       FROM exam_deliveries d
       JOIN exams ex ON ex.id = d.exam_id
       JOIN courses c ON c.id = ex.course_id
       LEFT JOIN exam_questions eq ON eq.exam_id = ex.id
       LEFT JOIN exam_submissions es ON es.exam_id = ex.id AND es.student_id = d.student_id
       WHERE d.student_id = $1
       GROUP BY d.id, ex.id, c.title, es.id
       ORDER BY d.delivered_at DESC`,
      [student.id]
    )

    const rows = result.rows.map((row) => ({
      ...row,
      quiz_url: row.exam_type === 'mcq' && row.public_token ? quizTakeUrl(row.public_token) : null,
    }))

    res.json(rows)
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

// ── Public MCQ take flow (no auth; access code identifies the student) ──────

export const getPublicQuiz = async (req, res, next) => {
  try {
    const { token } = req.params
    if (!token) throw httpError(400, 'Quiz token is required')

    const examResult = await query(
      `SELECT ex.id, ex.title, ex.description, ex.due_date, ex.exam_type, ex.public_token,
              c.title AS course_title
       FROM exams ex
       JOIN courses c ON c.id = ex.course_id
       WHERE ex.public_token = $1 AND ex.exam_type = 'mcq'`,
      [token]
    )
    if (!examResult.rows.length) throw httpError(404, 'Quiz not found')
    const exam = examResult.rows[0]

    // Do NOT leak correct answers or options until unlocked with access code
    res.json({
      id: exam.id,
      title: exam.title,
      description: exam.description,
      due_date: exam.due_date,
      course_title: exam.course_title,
      locked: true,
    })
  } catch (error) {
    next(error)
  }
}

export const unlockPublicQuiz = async (req, res, next) => {
  try {
    const { token } = req.params
    const accessCode = String(req.body?.accessCode || req.body?.access_code || '').trim().toUpperCase()
    if (!token || !accessCode) throw httpError(400, 'Access code is required')

    const examResult = await query(
      `SELECT ex.id, ex.title, ex.description, ex.due_date, ex.exam_type, ex.public_token,
              c.title AS course_title
       FROM exams ex
       JOIN courses c ON c.id = ex.course_id
       WHERE ex.public_token = $1 AND ex.exam_type = 'mcq'`,
      [token]
    )
    if (!examResult.rows.length) throw httpError(404, 'Quiz not found')
    const exam = examResult.rows[0]

    const deliveryResult = await query(
      `SELECT d.id AS delivery_id, d.student_id, d.access_code,
              u.full_name AS student_name, u.email AS student_email
       FROM exam_deliveries d
       JOIN students s ON s.id = d.student_id
       JOIN users u ON u.id = s.user_id
       WHERE d.exam_id = $1 AND UPPER(d.access_code) = $2`,
      [exam.id, accessCode]
    )
    if (!deliveryResult.rows.length) throw httpError(403, 'Invalid access code')
    const delivery = deliveryResult.rows[0]

    const existing = await query(
      `SELECT id, score, total_questions, correct_count, submitted_at
       FROM exam_submissions WHERE exam_id = $1 AND student_id = $2`,
      [exam.id, delivery.student_id]
    )

    const questionsResult = await query(
      `SELECT id, question_text, order_index, options
       FROM exam_questions WHERE exam_id = $1 ORDER BY order_index ASC`,
      [exam.id]
    )

    // Strip correct_answer — never send to client
    const questions = questionsResult.rows.map((q) => ({
      id: q.id,
      question_text: q.question_text,
      order_index: q.order_index,
      options: q.options || [],
    }))

    res.json({
      id: exam.id,
      title: exam.title,
      description: exam.description,
      due_date: exam.due_date,
      course_title: exam.course_title,
      student_name: delivery.student_name,
      delivery_id: delivery.delivery_id,
      already_submitted: existing.rows.length > 0,
      submission: existing.rows[0] || null,
      questions,
    })
  } catch (error) {
    next(error)
  }
}

export const submitPublicQuiz = async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { token } = req.params
    const accessCode = String(req.body?.accessCode || req.body?.access_code || '').trim().toUpperCase()
    const answers = req.body?.answers || {}

    if (!token || !accessCode) throw httpError(400, 'Access code is required')
    if (!answers || typeof answers !== 'object') throw httpError(400, 'Answers are required')

    const examResult = await client.query(
      `SELECT ex.id, ex.title, ex.due_date, ex.exam_type
       FROM exams ex
       WHERE ex.public_token = $1 AND ex.exam_type = 'mcq'`,
      [token]
    )
    if (!examResult.rows.length) throw httpError(404, 'Quiz not found')
    const exam = examResult.rows[0]

    const deliveryResult = await client.query(
      `SELECT d.id AS delivery_id, d.student_id
       FROM exam_deliveries d
       WHERE d.exam_id = $1 AND UPPER(d.access_code) = $2`,
      [exam.id, accessCode]
    )
    if (!deliveryResult.rows.length) throw httpError(403, 'Invalid access code')
    const delivery = deliveryResult.rows[0]

    const existing = await client.query(
      `SELECT id FROM exam_submissions WHERE exam_id = $1 AND student_id = $2`,
      [exam.id, delivery.student_id]
    )
    if (existing.rows.length) {
      throw httpError(400, 'You have already submitted this quiz')
    }

    const questionsResult = await client.query(
      `SELECT id, correct_answer FROM exam_questions WHERE exam_id = $1 ORDER BY order_index ASC`,
      [exam.id]
    )
    const questions = questionsResult.rows
    if (!questions.length) throw httpError(400, 'This quiz has no questions')

    let correctCount = 0
    const normalizedAnswers = {}
    for (const q of questions) {
      const chosen = String(answers[q.id] ?? answers[String(q.id)] ?? '').toUpperCase().trim()
      normalizedAnswers[String(q.id)] = chosen
      if (chosen && chosen === String(q.correct_answer || '').toUpperCase()) {
        correctCount++
      }
    }

    const total = questions.length
    const score = Math.round((correctCount / total) * 10000) / 100

    await client.query('BEGIN')
    const insert = await client.query(
      `INSERT INTO exam_submissions
         (exam_id, student_id, delivery_id, answers, score, total_questions, correct_count, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id, score, total_questions, correct_count, submitted_at`,
      [exam.id, delivery.student_id, delivery.delivery_id, JSON.stringify(normalizedAnswers), score, total, correctCount]
    )
    await client.query('COMMIT')

    // Do not reveal score details beyond confirmation — results mailed later by lecturer
    res.status(201).json({
      message: 'Quiz submitted successfully. Your result will be sent when the lecturer releases it.',
      submission_id: insert.rows[0].id,
      submitted_at: insert.rows[0].submitted_at,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
}

export const listExamSubmissions = async (req, res, next) => {
  try {
    const examId = Number(req.params.examId)
    if (!examId) throw httpError(400, 'Valid examId is required')

    const examResult = await query('SELECT id, title, exam_type FROM exams WHERE id = $1', [examId])
    if (!examResult.rows.length) throw httpError(404, 'Exam not found')

    const result = await query(
      `SELECT es.*,
              u.full_name AS student_name,
              u.email AS student_email,
              s.matric_number
       FROM exam_submissions es
       JOIN students s ON s.id = es.student_id
       JOIN users u ON u.id = s.user_id
       WHERE es.exam_id = $1
       ORDER BY es.submitted_at DESC`,
      [examId]
    )

    res.json({ exam: examResult.rows[0], submissions: result.rows })
  } catch (error) {
    next(error)
  }
}

export const sendExamResults = async (req, res, next) => {
  try {
    const examId = Number(req.params.examId)
    if (!examId) throw httpError(400, 'Valid examId is required')

    const examResult = await query(
      `SELECT ex.*, c.title AS course_title
       FROM exams ex
       JOIN courses c ON c.id = ex.course_id
       WHERE ex.id = $1`,
      [examId]
    )
    if (!examResult.rows.length) throw httpError(404, 'Exam not found')
    const exam = examResult.rows[0]
    if (exam.exam_type !== 'mcq') throw httpError(400, 'Result mailing is only for MCQ exams')

    const { studentIds } = req.body || {}
    let submissions
    if (Array.isArray(studentIds) && studentIds.length) {
      const idList = studentIds.map(Number).filter(Boolean)
      const result = await query(
        `SELECT es.*, u.full_name AS student_name, u.email AS student_email
         FROM exam_submissions es
         JOIN students s ON s.id = es.student_id
         JOIN users u ON u.id = s.user_id
         WHERE es.exam_id = $1 AND es.student_id = ANY($2::int[])`,
        [examId, idList]
      )
      submissions = result.rows
    } else {
      const result = await query(
        `SELECT es.*, u.full_name AS student_name, u.email AS student_email
         FROM exam_submissions es
         JOIN students s ON s.id = es.student_id
         JOIN users u ON u.id = s.user_id
         WHERE es.exam_id = $1 AND es.result_sent_at IS NULL`,
        [examId]
      )
      submissions = result.rows
    }

    let sent = 0
    let failed = 0
    const errors = []

    for (const sub of submissions) {
      try {
        await sendMcqResultEmail({
          to: sub.student_email,
          studentName: sub.student_name,
          courseTitle: exam.course_title,
          examTitle: exam.title,
          score: sub.score,
          correctCount: sub.correct_count,
          totalQuestions: sub.total_questions,
        })
        await query(
          `UPDATE exam_submissions SET result_sent_at = NOW() WHERE id = $1`,
          [sub.id]
        )
        sent++
      } catch (err) {
        failed++
        errors.push({ student: sub.student_name, email: sub.student_email, error: err.message })
      }
    }

    res.json({ sent, failed, errors, total: submissions.length })
  } catch (error) {
    next(error)
  }
}
