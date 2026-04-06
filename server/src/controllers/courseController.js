import * as XLSX from 'xlsx'
import { query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'

export const createCourse = async (req, res, next) => {
  try {
    const {
      title,
      description,
      courseCode,
      durationWeeks,
      minAttendanceRequired,
      hasAssignment,
      hasExam,
      lecturerId,
      lecturerName,
      startDate,
      endDate,
      classDay,
      classTime,
    } = req.body

    if (!title || !durationWeeks || minAttendanceRequired === undefined) {
      throw httpError(400, 'title, durationWeeks and minAttendanceRequired are required')
    }

    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      throw httpError(400, 'endDate cannot be earlier than startDate')
    }

    // Prevent overlapping courses — only one course can run at a time
    if (startDate && endDate) {
      const overlap = await query(
        `SELECT id, title FROM courses WHERE start_date < $2 AND end_date > $1 LIMIT 1`,
        [startDate, endDate]
      )
      if (overlap.rows.length) {
        throw httpError(
          409,
          `Date range overlaps with "${overlap.rows[0].title}". Only one course can run at a time.`
        )
      }
    }

    const result = await query(
      `INSERT INTO courses (
         title,
         description,
         course_code,
         duration_weeks,
         min_attendance_required,
         has_assignment,
         has_exam,
         requires_score,
         start_date,
         end_date,
         class_day,
         class_time,
         lecturer_id,
         lecturer_name,
         created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        title,
        description || null,
        courseCode || null,
        Number(durationWeeks),
        Number(minAttendanceRequired),
        Boolean(hasAssignment),
        Boolean(hasExam),
        true,
        startDate || null,
        endDate || null,
        classDay || null,
        classTime || null,
        lecturerId || null,
        lecturerName || null,
        req.user.userId,
      ]
    )

    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export const listCourses = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT c.id, c.title, c.course_code, c.duration_weeks, c.min_attendance_required,
          c.description, c.has_assignment, c.has_exam, c.requires_score,
              c.start_date, c.end_date, c.class_day, c.class_time, c.lecturer_id, c.lecturer_name,
            c.created_by,
              c.is_current,
              u.full_name AS assigned_lecturer,
          COALESCE(COUNT(e.id) FILTER (WHERE e.status = 'active'), 0)::int AS enrolled_students,
              c.created_at
       FROM courses c
       LEFT JOIN users u ON u.id = c.lecturer_id
        LEFT JOIN enrollments e ON e.course_id = c.id
       GROUP BY c.id, u.full_name
       ORDER BY c.created_at DESC`
    )

    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const getStudentCourses = async (req, res, next) => {
  try {
    const studentResult = await query('SELECT id FROM students WHERE user_id = $1', [req.user.userId])
    const student = studentResult.rows[0]

    if (!student) {
      throw httpError(404, 'Student profile not found')
    }

    const coursesResult = await query(
      `SELECT c.*, b.id AS batch_id, b.start_date AS batch_start_date, b.end_date AS batch_end_date, b.status AS batch_status
       FROM enrollments e
       JOIN batches b ON b.id = e.batch_id
       JOIN courses c ON c.id = e.course_id
       WHERE e.student_id = $1 AND e.status = 'active'
       ORDER BY e.enrolled_at DESC`,
      [student.id]
    )

    res.json(coursesResult.rows)
  } catch (error) {
    next(error)
  }
}

export const getCourseStudents = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    const result = await query(
      `SELECT s.id AS student_id,
              s.matric_no,
              s.status,
              u.full_name,
              u.email
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN users u ON u.id = s.user_id
        WHERE e.course_id = $1 AND e.status = 'active'
       ORDER BY u.full_name ASC`,
      [courseId]
    )

    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const getCourse = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    if (!courseId) throw httpError(400, 'Invalid courseId')

    const result = await query(
      `SELECT c.*, u.full_name AS assigned_lecturer
       FROM courses c
       LEFT JOIN users u ON u.id = c.lecturer_id
       WHERE c.id = $1`,
      [courseId]
    )

    if (!result.rows.length) throw httpError(404, 'Course not found')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export const updateCourse = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    if (!courseId) throw httpError(400, 'Invalid courseId')

    const existing = await query('SELECT * FROM courses WHERE id = $1', [courseId])
    if (!existing.rows.length) throw httpError(404, 'Course not found')
    const c = existing.rows[0]

    const {
      title = c.title,
      description = c.description,
      courseCode = c.course_code,
      durationWeeks = c.duration_weeks,
      minAttendanceRequired = c.min_attendance_required,
      hasAssignment = c.has_assignment,
      hasExam = c.has_exam,
      lecturerName = c.lecturer_name,
      startDate = c.start_date,
      endDate = c.end_date,
      classDay = c.class_day,
      classTime = c.class_time,
      recurrenceYears = c.recurrence_years,
    } = req.body

    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      throw httpError(400, 'endDate cannot be earlier than startDate')
    }

    await query(
      `UPDATE courses SET
         title = $1,
         description = $2,
         course_code = $3,
         duration_weeks = $4,
         min_attendance_required = $5,
         has_assignment = $6,
         has_exam = $7,
         requires_score = $8,
         lecturer_name = $9,
         start_date = $10,
         end_date = $11,
         class_day = $12,
         class_time = $13,
         recurrence_years = $14
       WHERE id = $15`,
      [
        title,
        description || null,
        courseCode || null,
        Number(durationWeeks),
        Number(minAttendanceRequired),
        Boolean(hasAssignment),
        Boolean(hasExam),
        true,
        lecturerName || null,
        startDate || null,
        endDate || null,
        classDay || null,
        classTime || null,
        recurrenceYears ? Number(recurrenceYears) : null,
        courseId,
      ]
    )

    const updated = await query(
      `SELECT c.*, u.full_name AS assigned_lecturer
       FROM courses c
       LEFT JOIN users u ON u.id = c.lecturer_id
       WHERE c.id = $1`,
      [courseId]
    )
    res.json(updated.rows[0])
  } catch (error) {
    next(error)
  }
}

export const setCurrentCourse = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    if (!courseId) throw httpError(400, 'Invalid courseId')

    const existing = await query('SELECT id FROM courses WHERE id = $1', [courseId])
    if (!existing.rows.length) throw httpError(404, 'Course not found')

    await query('UPDATE courses SET is_current = FALSE')
    await query('UPDATE courses SET is_current = TRUE WHERE id = $1', [courseId])

    res.json({ message: 'Current course updated' })
  } catch (error) {
    next(error)
  }
}

export const getCourseAllEnrollments = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    if (!courseId) throw httpError(400, 'Invalid courseId')

    const result = await query(
      `SELECT e.id AS enrollment_id,
              e.status AS enrollment_status,
              e.enrolled_at,
              e.completed_at,
              e.notes,
              e.batch_id,
              b.start_date AS batch_start,
              b.end_date AS batch_end,
              b.status AS batch_status,
              s.id AS student_id,
              s.matric_no,
              s.cohort_id,
              co.name AS cohort_name,
              u.full_name,
              u.email,
              rr.status AS result_status,
              rr.score,
              rr.result_type
       FROM enrollments e
       LEFT JOIN batches b ON b.id = e.batch_id
       JOIN students s ON s.id = e.student_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN cohorts co ON co.id = s.cohort_id
       LEFT JOIN LATERAL (
         SELECT r.status, r.score, r.result_type
         FROM results r
         WHERE r.course_id = e.course_id
           AND r.student_id = e.student_id
         ORDER BY r.uploaded_at DESC
         LIMIT 1
       ) rr ON TRUE
       WHERE e.course_id = $1
       ORDER BY COALESCE(b.start_date::text, e.enrolled_at::text) DESC, u.full_name ASC`,
      [courseId]
    )

    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const downloadCourseTemplate = async (req, res, next) => {
  try {
    const headers = [
      'Title', 'Course Code', 'Duration Weeks', 'Min Attendance', 'Has Assignment (Y/N)',
      'Has Exam (Y/N)', 'Lecturer Name', 'Start Date (YYYY-MM-DD)', 'End Date (YYYY-MM-DD)',
      'Class Day', 'Class Time (HH:MM)', 'Recurrence Years',
    ]
    const example = [
      'Introduction to Theology', 'GTS101', 6, 4, 'Y', 'Y', 'Rev. Smith',
      '2026-02-01', '2026-03-15', 'Tuesday', '09:00', 2,
    ]
    const ws = XLSX.utils.aoa_to_sheet([headers, example])
    ws['!cols'] = headers.map(() => ({ wch: 22 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Courses')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    res.setHeader('Content-Disposition', 'attachment; filename="courses_template.xlsx"')
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.send(buf)
  } catch (error) {
    next(error)
  }
}

export const bulkUploadCourses = async (req, res, next) => {
  try {
    if (!req.file) throw httpError(400, 'Upload file is required')

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
    const firstSheet = workbook.SheetNames[0]
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' })

    if (!rows.length) throw httpError(400, 'No course rows found in uploaded file')

    const createdList = []
    const errors = []

    for (const row of rows) {
      const title = String(row.Title || row.title || '').trim()
      const courseCode = String(row['Course Code'] || row.courseCode || '').trim()
      const durationWeeks = Number(row['Duration Weeks'] || row.durationWeeks || 0)
      const minAttendanceReq = Number(row['Min Attendance'] || row.minAttendance || 0)
      const hasAssignment = String(row['Has Assignment (Y/N)'] || row.hasAssignment || '').toUpperCase() === 'Y'
      const hasExam = String(row['Has Exam (Y/N)'] || row.hasExam || '').toUpperCase() === 'Y'
      const lecturerName = String(row['Lecturer Name'] || row.lecturerName || '').trim()
      const startDate = String(row['Start Date (YYYY-MM-DD)'] || row.startDate || '').trim() || null
      const endDate = String(row['End Date (YYYY-MM-DD)'] || row.endDate || '').trim() || null
      const classDay = String(row['Class Day'] || row.classDay || '').trim() || null
      const classTime = String(row['Class Time (HH:MM)'] || row.classTime || '').trim() || null
      const recurrenceYears = Number(row['Recurrence Years'] || row.recurrenceYears || 0) || null

      if (!title || !durationWeeks) {
        errors.push({ title: title || '(unnamed)', reason: 'Title and Duration Weeks are required' })
        continue
      }

      if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
        errors.push({ title, reason: 'endDate cannot be earlier than startDate' })
        continue
      }

      if (startDate && endDate) {
        const overlap = await query(
          `SELECT title FROM courses WHERE start_date < $2 AND end_date > $1 LIMIT 1`,
          [startDate, endDate]
        )
        if (overlap.rows.length) {
          errors.push({ title, reason: `Date overlaps with "${overlap.rows[0].title}"` })
          continue
        }
      }

      const result = await query(
        `INSERT INTO courses (title, course_code, duration_weeks, min_attendance_required,
           has_assignment, has_exam, requires_score, lecturer_name, start_date, end_date,
           class_day, class_time, recurrence_years, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,$9,$10,$11,$12,$13) RETURNING id, title`,
        [title, courseCode || null, durationWeeks, minAttendanceReq,
         hasAssignment, hasExam, lecturerName || null, startDate, endDate,
         classDay, classTime, recurrenceYears, req.user.userId]
      )
      createdList.push(result.rows[0])
    }

    res.status(201).json({ created: createdList.length, errors, processed: rows.length })
  } catch (error) {
    next(error)
  }
}
