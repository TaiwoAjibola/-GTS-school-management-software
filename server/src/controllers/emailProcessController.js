import { query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'
import { createSendJob, getSendJobStatus } from '../services/emailQueue.js'
import { env } from '../config/env.js'
import { testSmtpConnection } from '../services/emailService.js'

const formatLongDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''

const buildExamLink = (exam) => {
  if (!exam) return ''
  if (exam.quiz_url) return exam.quiz_url
  if (exam.public_token) return `${env.clientUrl.replace(/\/$/, '')}/quiz/${exam.public_token}`
  return ''
}

// ── List all templates (no hard-coded, no filters) ─────────────────
export const listProcesses = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT ep.id, ep.name, ep.subject_template, ep.body_template, ep.rich_body,
              ep.channel, ep.archived, ep.created_by, ep.created_at, ep.updated_at,
              u.full_name AS creator_name
       FROM email_processes ep
       LEFT JOIN users u ON u.id = ep.created_by
       WHERE ep.archived = false
       ORDER BY ep.updated_at DESC`
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

// ── Get single template ────────────────────────────────────────────
export const getProcess = async (req, res, next) => {
  try {
    const { id } = req.params
    const result = await query(
      `SELECT ep.*, u.full_name AS creator_name
       FROM email_processes ep
       LEFT JOIN users u ON u.id = ep.created_by
       WHERE ep.id = $1`,
      [id]
    )
    if (!result.rows.length) throw httpError(404, 'Template not found')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// ── Create a new blank template ────────────────────────────────────
export const createProcess = async (req, res, next) => {
  try {
    const { name, subject_template, body_template, rich_body, channel } = req.body
    if (!name) throw httpError(400, 'Template name is required')

    const result = await query(
      `INSERT INTO email_processes (name, subject_template, body_template, rich_body, channel, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, subject_template || '', body_template || '', rich_body || null, channel || 'email', req.user.id]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// ── Update a template ──────────────────────────────────────────────
export const updateProcess = async (req, res, next) => {
  try {
    const { id } = req.params
    const { name, subject_template, body_template, rich_body, channel } = req.body

    const result = await query(
      `UPDATE email_processes
       SET name = COALESCE($1, name),
           subject_template = COALESCE($2, subject_template),
           body_template = COALESCE($3, body_template),
           rich_body = COALESCE($4, rich_body),
           channel = COALESCE($5, channel),
           updated_at = NOW()
       WHERE id = $6 AND archived = false
       RETURNING *`,
      [name, subject_template, body_template, rich_body, channel, id]
    )
    if (!result.rows.length) throw httpError(404, 'Template not found or archived')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// ── Delete a template ──────────────────────────────────────────────
export const deleteProcess = async (req, res, next) => {
  try {
    const { id } = req.params
    const result = await query(
      'DELETE FROM email_processes WHERE id = $1 RETURNING id',
      [id]
    )
    if (!result.rows.length) throw httpError(404, 'Template not found')
    res.json({ message: 'Template deleted' })
  } catch (error) {
    next(error)
  }
}

// ── Duplicate a template ───────────────────────────────────────────
export const duplicateProcess = async (req, res, next) => {
  try {
    const { id } = req.params
    const original = await query('SELECT * FROM email_processes WHERE id = $1', [id])
    if (!original.rows.length) throw httpError(404, 'Template not found')

    const o = original.rows[0]
    const result = await query(
      `INSERT INTO email_processes (name, subject_template, body_template, rich_body, channel, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [`${o.name} (Copy)`, o.subject_template, o.body_template, o.rich_body, o.channel, req.user.id]
    )
    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

// ── Preview template with sample or real data ──────────────────────
export const previewProcess = async (req, res, next) => {
  try {
    const { id } = req.params
    const courseId = req.query.courseId || req.query.variableCourseId || req.body?.courseId || req.body?.variableCourseId || null
    const assignmentId = req.query.assignmentId || req.query.variableAssignmentId || req.body?.assignmentId || req.body?.variableAssignmentId || null
    const examId = req.query.examId || req.query.variableExamId || req.body?.examId || req.body?.variableExamId || null

    const result = await query('SELECT * FROM email_processes WHERE id = $1', [id])
    if (!result.rows.length) throw httpError(404, 'Template not found')

    const process = result.rows[0]

    // Get all active global variables with sample values
    const tvResult = await query(
      'SELECT variable_key, display_label, example_value, category FROM template_variables WHERE is_active = true ORDER BY sort_order'
    )

    const sampleValues = {}
    for (const row of tvResult.rows) {
      sampleValues[row.variable_key] = row.example_value || `[${row.display_label}]`
    }

    // If courseId provided, fetch real course + instructor data and override sample values
    if (courseId) {
      try {
        const courseResult = await query(
          `SELECT c.id, c.course_code, c.title AS course_name, c.description AS course_description,
                  c.start_date AS course_start_date, c.end_date AS course_end_date,
                  c.lecturer_id, c.lecturer_name,
                  COALESCE(u.full_name, c.lecturer_name) AS instructor_name,
                  u.email AS instructor_email
           FROM courses c LEFT JOIN users u ON u.id = c.lecturer_id
           WHERE c.id = $1`,
          [courseId]
        )
        if (courseResult.rows.length) {
          const course = courseResult.rows[0]
          sampleValues.course_code = course.course_code || sampleValues.course_code || ''
          sampleValues.course_name = course.course_name || sampleValues.course_name || ''
          sampleValues.course_description = course.course_description || sampleValues.course_description || ''
          sampleValues.course_start_date = course.course_start_date ? formatLongDate(course.course_start_date) : sampleValues.course_start_date || ''
          sampleValues.course_end_date = course.course_end_date ? formatLongDate(course.course_end_date) : sampleValues.course_end_date || ''
          // Instructor derives from course's lecturer
          if (course.instructor_name) sampleValues.instructor_name = course.instructor_name
          if (course.instructor_email) sampleValues.instructor_email = course.instructor_email
          // Also keep course_title for exam fallback compatibility
          sampleValues.course_title = course.course_name || sampleValues.course_title || sampleValues.course_name || ''
        }
      } catch {}
    }

    // If assignmentId provided, fetch assignment and override assignment_* variables
    if (assignmentId) {
      try {
        const aRes = await query('SELECT id, title AS assignment_title, description AS assignment_description, due_date, instructions AS assignment_instructions, total_points FROM assignments WHERE id = $1', [assignmentId])
          .catch(async () => await query('SELECT id, title AS assignment_title, description AS assignment_description, due_date FROM assignments WHERE id = $1', [assignmentId]))
        if (aRes.rows.length) {
          const a = aRes.rows[0]
          sampleValues.assignment_title = a.assignment_title || sampleValues.assignment_title || ''
          sampleValues.assignment_description = a.assignment_description || sampleValues.assignment_description || ''
          sampleValues.assignment_instructions = a.assignment_instructions || a.assignment_description || sampleValues.assignment_instructions || ''
          if (a.due_date) sampleValues.due_date = formatLongDate(a.due_date)
          if (a.total_points != null) sampleValues.total_points = String(a.total_points)
          // Also support legacy due_date formatting for assignments
          if (a.due_date && !sampleValues.due_date) sampleValues.due_date = formatLongDate(a.due_date)
        }
      } catch {}
    }

    // If examId provided, fetch exam and override exam_* variables
    if (examId) {
      try {
        const eRes = await query('SELECT id, title AS exam_title, exam_type, due_date, quiz_url, public_token, description FROM exams WHERE id = $1', [examId])
        if (eRes.rows.length) {
          const ex = eRes.rows[0]
          sampleValues.exam_title = ex.exam_title || sampleValues.exam_title || ''
          // exam_link / quiz_url handling
          const link = buildExamLink(ex)
          if (link) {
            sampleValues.exam_link = link
            sampleValues.quiz_url = link
          }
          // due_date: exam overrides if not already set by assignment
          if (ex.due_date) {
            // Only override due_date if assignment didn't already set it, or always set exam due_date as fallback
            if (!assignmentId) sampleValues.due_date = formatLongDate(ex.due_date)
            // Also expose exam-specific due if needed (same key used)
          }
          sampleValues.course_title = sampleValues.course_title || sampleValues.course_name || ''
          // access_code stays as example for preview (no per-student code yet)
          // Keep example_value if exists
        }
      } catch {}
    }

    // Ensure current_date uses today, not stale example
    sampleValues.current_date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

    const render = (template) => {
      if (!template) return ''
      return (template || '').replace(/\{\{(\w+)\}\}/g, (_, key) => sampleValues[key] != null ? sampleValues[key] : `{{${key}}}`)
    }

    const toHtml = (text) => {
      const withBreaks = (text || '').replace(/\r\n/g, '\n').replace(/\n/g, '<br>')
      return `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.6">${withBreaks}</div>`
    }

    const subject = render(process.subject_template)
    let body
    if (process.rich_body) {
      body = render(process.rich_body)
    } else {
      const rendered = render(process.body_template)
      body = toHtml(rendered)
    }

    res.json({
      subject,
      body,
      richBody: process.rich_body ? render(process.rich_body) : null,
      variables: tvResult.rows,
    })
  } catch (error) {
    next(error)
  }
}

// ── Preview with real student data ─────────────────────────────────
export const previewWithStudent = async (req, res, next) => {
  try {
    const { id, studentId } = req.params
    const courseId = req.query.courseId || req.query.variableCourseId || req.body?.courseId || req.body?.variableCourseId || null
    const assignmentId = req.query.assignmentId || req.query.variableAssignmentId || req.body?.assignmentId || req.body?.variableAssignmentId || null
    const examId = req.query.examId || req.query.variableExamId || req.body?.examId || req.body?.variableExamId || null

    const [procResult, studentResult] = await Promise.all([
      query('SELECT * FROM email_processes WHERE id = $1', [id]),
      query(
        `SELECT s.*, u.full_name, u.email, co.name AS cohort_name
         FROM students s JOIN users u ON u.id = s.user_id
         LEFT JOIN cohorts co ON co.id = s.cohort_id
         WHERE s.id = $1`,
        [studentId]
      ),
    ])
    if (!procResult.rows.length) throw httpError(404, 'Template not found')
    if (!studentResult.rows.length) throw httpError(404, 'Student not found')

    const process = procResult.rows[0]
    const s = studentResult.rows[0]

    // Fetch fallback example values for school/instructor/course defaults
    const tvResult = await query('SELECT variable_key, example_value FROM template_variables WHERE is_active = true')
    const fallback = {}
    for (const row of tvResult.rows) fallback[row.variable_key] = row.example_value || ''

    // Fetch course if courseId provided (with instructor derivation)
    let course = null
    if (courseId) {
      try {
        const courseResult = await query(
          `SELECT c.id, c.course_code, c.title AS course_name, c.description AS course_description,
                  c.start_date AS course_start_date, c.end_date AS course_end_date,
                  c.lecturer_id, c.lecturer_name,
                  COALESCE(u.full_name, c.lecturer_name) AS instructor_name,
                  u.email AS instructor_email
           FROM courses c LEFT JOIN users u ON u.id = c.lecturer_id
           WHERE c.id = $1`,
          [courseId]
        )
        if (courseResult.rows.length) course = courseResult.rows[0]
      } catch {}
    }

    // Fetch assignment if assignmentId provided
    let assignment = null
    if (assignmentId) {
      try {
        const aRes = await query('SELECT id, title AS assignment_title, description AS assignment_description, due_date, instructions AS assignment_instructions, total_points FROM assignments WHERE id = $1', [assignmentId])
          .catch(async () => await query('SELECT id, title AS assignment_title, description AS assignment_description, due_date FROM assignments WHERE id = $1', [assignmentId]))
        if (aRes.rows.length) assignment = aRes.rows[0]
      } catch {}
    }

    // Fetch exam if examId provided
    let exam = null
    let examAccessCode = null
    if (examId) {
      try {
        const eRes = await query('SELECT id, title AS exam_title, exam_type, due_date, quiz_url, public_token, description FROM exams WHERE id = $1', [examId])
        if (eRes.rows.length) exam = eRes.rows[0]
        // Per-student access code for preview
        if (exam) {
          try {
            const dRes = await query('SELECT access_code FROM exam_deliveries WHERE exam_id = $1 AND student_id = $2', [examId, s.id])
            if (dRes.rows.length && dRes.rows[0].access_code) examAccessCode = dRes.rows[0].access_code
          } catch {}
        }
      } catch {}
    }

    // Build real values from student + course + fallback data
    const values = {
      student_name: s.full_name,
      student_email: s.email,
      student_phone: s.phone || '',
      student_id: s.id?.toString() || '',
      student_status: s.status || '',
      enrollment_date: s.created_at ? new Date(s.created_at).toLocaleDateString() : fallback.enrollment_date || '',
      matric_no: s.matric_no || '',
      cohort_name: s.cohort_name || fallback.cohort_name || '',
      course_code: course?.course_code || fallback.course_code || '',
      course_name: course?.course_name || fallback.course_name || '',
      course_description: course?.course_description || fallback.course_description || '',
      course_start_date: course?.course_start_date ? formatLongDate(course.course_start_date) : fallback.course_start_date || '',
      course_end_date: course?.course_end_date ? formatLongDate(course.course_end_date) : fallback.course_end_date || '',
      school_name: fallback.school_name || 'GTS Academy',
      school_email: fallback.school_email || '',
      school_address: fallback.school_address || '',
      school_phone: fallback.school_phone || '',
      current_date: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      instructor_name: course?.instructor_name || fallback.instructor_name || '',
      instructor_email: course?.instructor_email || fallback.instructor_email || '',
    }
    // Assignment overrides
    if (assignment) {
      values.assignment_title = assignment.assignment_title || fallback.assignment_title || ''
      values.assignment_description = assignment.assignment_description || fallback.assignment_description || ''
      values.assignment_instructions = assignment.assignment_instructions || assignment.assignment_description || fallback.assignment_instructions || ''
      if (assignment.due_date) values.due_date = formatLongDate(assignment.due_date)
      if (assignment.total_points != null) values.total_points = String(assignment.total_points)
      else if (fallback.total_points) values.total_points = fallback.total_points
    }
    // Exam overrides
    if (exam) {
      values.exam_title = exam.exam_title || fallback.exam_title || ''
      const link = buildExamLink(exam)
      if (link) {
        values.exam_link = link
        values.quiz_url = link
      } else {
        values.exam_link = fallback.exam_link || ''
        values.quiz_url = fallback.quiz_url || fallback.exam_link || ''
      }
      if (exam.due_date && !assignment) values.due_date = formatLongDate(exam.due_date)
      values.course_title = values.course_name || fallback.course_title || fallback.course_name || ''
      values.access_code = examAccessCode || fallback.access_code || fallback.exam_access_code || ''
    }
    // Ensure course_title compat
    if (!values.course_title) values.course_title = values.course_name || fallback.course_title || ''
    // Include any other fallback variables not explicitly set
    for (const [k, v] of Object.entries(fallback)) {
      if (!(k in values)) values[k] = v || ''
    }

    const render = (template) => {
      if (!template) return ''
      return (template || '').replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] != null ? values[key] : `{{${key}}}`)
    }

    const toHtml = (text) => {
      const withBreaks = (text || '').replace(/\r\n/g, '\n').replace(/\n/g, '<br>')
      return `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.6">${withBreaks}</div>`
    }

    const subject = render(process.subject_template)
    let body
    let richBody = null
    if (process.rich_body) {
      body = render(process.rich_body)
      richBody = body
    } else {
      body = toHtml(render(process.body_template))
    }

    res.json({
      subject,
      body,
      richBody,
      student: { id: s.id, full_name: s.full_name, email: s.email },
    })
  } catch (error) {
    next(error)
  }
}

// ── Send template to recipients (non-blocking) ─────────────────────
export const sendTemplate = async (req, res, next) => {
  try {
    const { id } = req.params
    const { recipientIds } = req.body
    const courseId = req.body.courseId || req.body.variableCourseId || req.query?.courseId || null
    const assignmentId = req.body.assignmentId || req.body.variableAssignmentId || req.query?.assignmentId || null
    const examId = req.body.examId || req.body.variableExamId || req.query?.examId || null

    if (!recipientIds || !Array.isArray(recipientIds) || !recipientIds.length) {
      throw httpError(400, 'recipientIds array is required')
    }

    const procResult = await query('SELECT * FROM email_processes WHERE id = $1 AND archived = false', [id])
    if (!procResult.rows.length) throw httpError(404, 'Template not found or archived')

    const process = procResult.rows[0]

    const students = await query(
      `SELECT s.id, u.full_name, u.email, s.phone, s.status, s.matric_no, s.created_at, co.name AS cohort_name
       FROM students s JOIN users u ON u.id = s.user_id
       LEFT JOIN cohorts co ON co.id = s.cohort_id
       WHERE s.id = ANY($1::int[])`,
      [recipientIds]
    )
    if (!students.rows.length) throw httpError(404, 'No recipients found')

    // Fetch course if courseId provided (with instructor)
    let course = null
    if (courseId) {
      try {
        const courseResult = await query(
          `SELECT c.id, c.course_code, c.title AS course_name, c.description AS course_description,
                  c.start_date AS course_start_date, c.end_date AS course_end_date,
                  c.lecturer_id, c.lecturer_name,
                  COALESCE(u.full_name, c.lecturer_name) AS instructor_name,
                  u.email AS instructor_email
           FROM courses c LEFT JOIN users u ON u.id = c.lecturer_id
           WHERE c.id = $1`,
          [courseId]
        )
        if (courseResult.rows.length) course = courseResult.rows[0]
      } catch {}
    }

    // Fetch assignment if provided
    let assignment = null
    if (assignmentId) {
      try {
        const aRes = await query('SELECT id, title AS assignment_title, description AS assignment_description, due_date, instructions AS assignment_instructions, total_points FROM assignments WHERE id = $1', [assignmentId])
          .catch(async () => await query('SELECT id, title AS assignment_title, description AS assignment_description, due_date FROM assignments WHERE id = $1', [assignmentId]))
        if (aRes.rows.length) assignment = aRes.rows[0]
      } catch {}
    }

    // Fetch exam if provided
    let exam = null
    let examAccessMap = new Map()
    if (examId) {
      try {
        const eRes = await query('SELECT id, title AS exam_title, exam_type, due_date, quiz_url, public_token, description FROM exams WHERE id = $1', [examId])
        if (eRes.rows.length) exam = eRes.rows[0]
        if (exam) {
          try {
            const dRes = await query('SELECT student_id, access_code FROM exam_deliveries WHERE exam_id = $1 AND student_id = ANY($2::int[])', [examId, recipientIds])
            for (const r of dRes.rows) if (r.access_code) examAccessMap.set(r.student_id, r.access_code)
          } catch {}
        }
      } catch {}
    }

    // Fetch fallback example values for school/instructor etc.
    const tvResult = await query('SELECT variable_key, example_value FROM template_variables WHERE is_active = true')
    const fallback = {}
    for (const row of tvResult.rows) fallback[row.variable_key] = row.example_value || ''

    const toHtml = (text) => {
      const withBreaks = (text || '').replace(/\r\n/g, '\n').replace(/\n/g, '<br>')
      return `<div style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.6">${withBreaks}</div>`
    }

    const recipients = students.rows.map((s) => {
      const values = {
        student_name: s.full_name,
        student_email: s.email,
        student_phone: s.phone || '',
        student_id: s.id.toString(),
        student_status: s.status || '',
        matric_no: s.matric_no || '',
        enrollment_date: s.created_at ? new Date(s.created_at).toLocaleDateString() : fallback.enrollment_date || '',
        cohort_name: s.cohort_name || fallback.cohort_name || '',
        course_code: course?.course_code || fallback.course_code || '',
        course_name: course?.course_name || fallback.course_name || '',
        course_description: course?.course_description || fallback.course_description || '',
        course_start_date: course?.course_start_date ? formatLongDate(course.course_start_date) : fallback.course_start_date || '',
        course_end_date: course?.course_end_date ? formatLongDate(course.course_end_date) : fallback.course_end_date || '',
        school_name: fallback.school_name || 'GTS Academy',
        school_email: fallback.school_email || '',
        school_address: fallback.school_address || '',
        school_phone: fallback.school_phone || '',
        current_date: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        instructor_name: course?.instructor_name || fallback.instructor_name || '',
        instructor_email: course?.instructor_email || fallback.instructor_email || '',
      }
      // Assignment variables
      if (assignment) {
        values.assignment_title = assignment.assignment_title || fallback.assignment_title || ''
        values.assignment_description = assignment.assignment_description || fallback.assignment_description || ''
        values.assignment_instructions = assignment.assignment_instructions || assignment.assignment_description || fallback.assignment_instructions || ''
        if (assignment.due_date) values.due_date = formatLongDate(assignment.due_date)
        if (assignment.total_points != null) values.total_points = String(assignment.total_points)
        else if (fallback.total_points) values.total_points = fallback.total_points
      }
      // Exam variables (per-recipient access_code)
      if (exam) {
        values.exam_title = exam.exam_title || fallback.exam_title || ''
        const link = buildExamLink(exam)
        if (link) {
          values.exam_link = link
          values.quiz_url = link
        } else {
          values.exam_link = fallback.exam_link || ''
          values.quiz_url = fallback.quiz_url || fallback.exam_link || ''
        }
        if (exam.due_date && !assignment) values.due_date = formatLongDate(exam.due_date)
        values.course_title = values.course_name || fallback.course_title || ''
        values.access_code = examAccessMap.get(s.id) || fallback.access_code || fallback.exam_access_code || ''
      }
      if (!values.course_title) values.course_title = values.course_name || fallback.course_title || ''
      for (const [k, v] of Object.entries(fallback)) {
        if (!(k in values)) values[k] = v || ''
      }
      const render = (tpl) => (tpl || '').replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] != null ? values[key] : `{{${key}}}`)
      const subject = render(process.subject_template)
      let body
      if (process.rich_body) {
        body = render(process.rich_body)
      } else {
        const rendered = render(process.body_template)
        body = toHtml(rendered)
      }
      return {
        email: s.email,
        subject,
        body,
      }
    })

    const jobId = createSendJob({
      recipients,
      processId: process.id,
      subjectTemplate: process.subject_template,
      bodyTemplate: process.body_template,
      channel: process.channel,
      senderId: req.user.id,
      courseId: courseId || null,
    })

    res.json({ jobId, message: 'Send queued' })
  } catch (error) {
    next(error)
  }
}

// ── Poll send status ───────────────────────────────────────────────
export const getSendStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params
    const status = getSendJobStatus(jobId)
    if (!status) throw httpError(404, 'Job not found or expired')
    res.json(status)
  } catch (error) {
    next(error)
  }
}

// ── Global Variable Library ────────────────────────────────────────
export const listGlobalVariables = async (req, res, next) => {
  try {
    const { category } = req.query
    let sql = 'SELECT * FROM template_variables WHERE is_active = true'
    const params = []
    if (category) {
      sql += ' AND category = $1'
      params.push(category)
    }
    sql += ' ORDER BY sort_order, display_label'
    const result = await query(sql, params)
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const listVariableCategories = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT category, COUNT(*)::int AS count FROM template_variables WHERE is_active = true GROUP BY category ORDER BY category'
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

// ── Communication Log ──────────────────────────────────────────────
export const listCommunicationLog = async (req, res, next) => {
  try {
    const { limit: limitParam } = req.query
    const rowLimit = Math.min(Number(limitParam) || 100, 500)
    const result = await query(
      `SELECT cl.*, u.full_name AS sender_name, ep.name AS template_name
       FROM communication_log cl
       LEFT JOIN users u ON u.id = cl.sender_id
       LEFT JOIN email_processes ep ON ep.id = cl.process_id
       ORDER BY cl.created_at DESC
       LIMIT $1`,
      [rowLimit]
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

// ── SMTP Diagnostics ────────────────────────────────────────────────
export const diagnoseSmtp = async (req, res, next) => {
  try {
    const config = {
      host: env.smtpHost || '(not set)',
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      user: env.smtpUser || '(not set)',
      passSet: !!env.smtpPass,
      from: env.emailFrom,
    }

    const result = await testSmtpConnection()

    res.json({ config, test: result })
  } catch (error) {
    res.json({
      config: {
        host: env.smtpHost || '(not set)',
        port: env.smtpPort,
        user: env.smtpUser || '(not set)',
        passSet: !!env.smtpPass,
        from: env.emailFrom,
      },
      test: { ok: false, error: error.message },
    })
  }
}
