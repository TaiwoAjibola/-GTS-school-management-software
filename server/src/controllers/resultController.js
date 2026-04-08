import { query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'
import * as XLSX from 'xlsx'

export const uploadResult = async (req, res, next) => {
  try {
    const { courseId, batchId, studentId, score, status: requestedStatus, resultType = 'Final' } = req.body

    const resolvedCourseId = Number(courseId || 0)
    const resolvedBatchId = batchId ? Number(batchId) : null
    const normalizedResultType = String(resultType || 'Final').trim()

    if (!resolvedCourseId || !studentId) {
      throw httpError(400, 'courseId and studentId are required')
    }

    if (!['Assignment', 'Exam', 'Final'].includes(normalizedResultType)) {
      throw httpError(400, 'resultType must be Assignment, Exam, or Final')
    }

    const enrollmentCheck = await query(
      `SELECT id FROM enrollments
       WHERE course_id = $1 AND student_id = $2 AND status IN ('active', 'completed', 'failed')
       LIMIT 1`,
      [resolvedCourseId, Number(studentId)]
    )
    if (!enrollmentCheck.rows.length) {
      throw httpError(400, 'Student is not actively enrolled in the selected course')
    }

    const courseConfigResult = await query(
      'SELECT id, has_assignment, has_exam FROM courses WHERE id = $1',
      [resolvedCourseId]
    )
    const courseConfig = courseConfigResult.rows[0]
    if (!courseConfig) throw httpError(404, 'Course not found')

    if (normalizedResultType === 'Assignment' && !courseConfig.has_assignment) {
      throw httpError(400, 'This course is not configured for assignment results')
    }
    if (normalizedResultType === 'Exam' && !courseConfig.has_exam) {
      throw httpError(400, 'This course is not configured for exam results')
    }

    let numericScore = null
    let status = requestedStatus

    if (score !== undefined && score !== null && score !== '') {
      numericScore = Number(score)
      if (Number.isNaN(numericScore) || numericScore < 0 || numericScore > 100) {
        throw httpError(400, 'score must be between 0 and 100')
      }
      status = numericScore >= 50 ? 'Pass' : 'Fail'
    }

    if (!['Pass', 'Fail'].includes(status)) {
      throw httpError(400, 'status must be Pass or Fail')
    }

    const result = await query(
      `INSERT INTO results (course_id, batch_id, student_id, result_type, score, status, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (course_id, student_id, result_type)
       DO UPDATE SET score = EXCLUDED.score, status = EXCLUDED.status, uploaded_at = NOW(), uploaded_by = EXCLUDED.uploaded_by
       RETURNING *`,
      [resolvedCourseId, resolvedBatchId, studentId, normalizedResultType, numericScore, status, req.user.userId]
    )

    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export const getBatchResults = async (req, res, next) => {
  try {
    const batchId = Number(req.params.batchId)
    if (!batchId) {
      throw httpError(400, 'Valid batchId is required')
    }

    const result = await query(
      `SELECT r.id,
              r.score,
              r.status,
              r.uploaded_at,
              s.id AS student_id,
              s.matric_no,
              u.full_name,
              u.email,
              c.title AS course_title,
              b.id AS batch_id
       FROM results r
       JOIN students s ON s.id = r.student_id
       JOIN users u ON u.id = s.user_id
       JOIN courses c ON c.id = r.course_id
       LEFT JOIN batches b ON b.id = r.batch_id
       WHERE r.batch_id = $1
       ORDER BY u.full_name ASC`,
      [batchId]
    )

    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const getStudentResults = async (req, res, next) => {
  try {
    const studentResult = await query('SELECT id FROM students WHERE user_id = $1', [req.user.userId])
    const student = studentResult.rows[0]

    if (!student) {
      throw httpError(404, 'Student profile not found')
    }

    const result = await query(
      `SELECT r.id, r.score, r.status, c.title AS course_title
       FROM results r
       JOIN courses c ON c.id = r.course_id
       WHERE r.student_id = $1
       ORDER BY r.uploaded_at DESC`,
      [student.id]
    )

    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const getCourseResults = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    if (!courseId) {
      throw httpError(400, 'Valid courseId is required')
    }

    const batchId = Number(req.query.batchId || 0)

    const result = await query(
      `SELECT r.id,
              r.score,
              r.status,
              r.result_type,
              r.uploaded_at,
              s.id AS student_id,
              s.matric_no,
              u.full_name,
              u.email,
              c.title AS course_title,
              r.batch_id
       FROM results r
       JOIN students s ON s.id = r.student_id
       JOIN users u ON u.id = s.user_id
       JOIN courses c ON c.id = r.course_id
       WHERE r.course_id = $1
         AND ($2 = 0 OR r.batch_id = $2)
       ORDER BY u.full_name ASC`,
      [courseId, batchId]
    )

    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const exportCourseResultsCsv = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    if (!courseId) {
      throw httpError(400, 'Valid courseId is required')
    }

    const result = await query(
      `SELECT u.full_name,
              s.matric_no,
              u.email,
              r.result_type,
              r.score,
              r.status,
              c.title AS course_title
       FROM results r
       JOIN students s ON s.id = r.student_id
       JOIN users u ON u.id = s.user_id
       JOIN courses c ON c.id = r.course_id
       WHERE r.course_id = $1
       ORDER BY u.full_name ASC`,
      [courseId]
    )

    const header = 'Full Name,Matric No,Email,Result Type,Score,Status,Course\n'
    const rows = result.rows
      .map((row) =>
        [
          row.full_name,
          row.matric_no,
          row.email,
          row.result_type,
          row.score,
          row.status,
          row.course_title,
        ]
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n')

    const csv = `${header}${rows}\n`
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="course-${courseId}-results.csv"`)
    res.send(csv)
  } catch (error) {
    next(error)
  }
}

export const bulkUploadResults = async (req, res, next) => {
  try {
    const { courseId, batchId, results } = req.body

    if (!courseId || !Array.isArray(results) || !results.length) {
      throw httpError(400, 'courseId and non-empty results array are required')
    }

    const courseResult = await query('SELECT id FROM courses WHERE id = $1', [courseId])
    if (!courseResult.rows.length) throw httpError(404, 'Course not found')
    const courseConfig = courseResult.rows[0]

    const imported = []
    const errors = []

    for (const r of results) {
      try {
        if (!r.matricNo) {
          errors.push({ row: r, error: 'matricNo is required' })
          continue
        }

        const studentResult = await query(
          'SELECT s.id FROM students s WHERE s.matric_no = $1',
          [r.matricNo.trim()]
        )
        if (!studentResult.rows.length) {
          errors.push({ row: r, error: `Student not found: ${r.matricNo}` })
          continue
        }
        const studentId = studentResult.rows[0].id

        const normalizedResultType = String(r.resultType || r.result_type || 'Final').trim()
        if (!['Assignment', 'Exam', 'Final'].includes(normalizedResultType)) {
          errors.push({ row: r, error: 'resultType must be Assignment, Exam, or Final' })
          continue
        }

        let numericScore = null
        let status = r.status

        if (r.score !== null && r.score !== undefined && r.score !== '') {
          numericScore = Number(r.score)
          if (Number.isNaN(numericScore) || numericScore < 0 || numericScore > 100) {
            errors.push({ row: r, error: 'Score must be 0-100' })
            continue
          }
          status = numericScore >= 50 ? 'Pass' : 'Fail'
        }

        if (!['Pass', 'Fail'].includes(status)) {
          errors.push({ row: r, error: 'status must be Pass or Fail' })
          continue
        }

        const enrollmentCheck = await query(
          `SELECT id FROM enrollments
           WHERE course_id = $1 AND student_id = $2 AND status = 'active'
           LIMIT 1`,
          [Number(courseId), studentId]
        )
        if (!enrollmentCheck.rows.length) {
          errors.push({ row: r, error: `Student ${r.matricNo} not actively enrolled in selected course` })
          continue
        }

        await query(
          `INSERT INTO results (course_id, batch_id, student_id, result_type, score, status, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (course_id, student_id, result_type)
           DO UPDATE SET score = EXCLUDED.score, status = EXCLUDED.status,
                         uploaded_at = NOW(), uploaded_by = EXCLUDED.uploaded_by
           RETURNING id`,
          [courseId, batchId || null, studentId, normalizedResultType, numericScore, status, req.user.userId]
        )
        imported.push(r.matricNo)
      } catch (err) {
        errors.push({ row: r, error: err.message })
      }
    }

    res.json({ imported: imported.length, importedMatrics: imported, errors })
  } catch (error) {
    next(error)
  }
}

export const exportBatchCourseResultsTemplate = async (req, res, next) => {
  try {
    const courseId = Number(req.query.courseId || 0)
    const batchId = Number(req.query.batchId || 0)
    if (!courseId || !batchId) throw httpError(400, 'courseId and batchId are required')

    const batchResult = await query('SELECT id, course_id FROM batches WHERE id = $1', [batchId])
    const batch = batchResult.rows[0]
    if (!batch) throw httpError(404, 'Batch not found')
    if (Number(batch.course_id) !== courseId) {
      throw httpError(400, 'Selected batch does not belong to selected course')
    }

    const studentsResult = await query(
      `SELECT s.matric_no,
              u.full_name,
              COALESCE(r.status, '') AS status,
              COALESCE(r.score::text, '') AS score
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN results r ON r.course_id = e.course_id AND r.batch_id = e.batch_id AND r.student_id = e.student_id
       WHERE e.course_id = $1 AND e.batch_id = $2
       ORDER BY u.full_name ASC`,
      [courseId, batchId]
    )

    const header = 'matric_no,full_name,status,score\n'
    const body = studentsResult.rows
      .map((row) => [row.matric_no, row.full_name, row.status, row.score].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const csv = `${header}${body}\n`

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="results-template-course-${courseId}-batch-${batchId}.csv"`)
    res.send(csv)
  } catch (error) {
    next(error)
  }
}

export const bulkUploadResultsFromFile = async (req, res, next) => {
  try {
    const courseId = Number(req.body.courseId || 0)
    const batchId = Number(req.body.batchId || 0)
    if (!courseId) throw httpError(400, 'courseId is required')
    if (!req.file || !req.file.buffer) throw httpError(400, 'File is required')

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
    const firstSheet = workbook.SheetNames[0]
    if (!firstSheet) throw httpError(400, 'No worksheet found in uploaded file')

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' })
    if (!rows.length) throw httpError(400, 'Uploaded file has no rows')

    const normalized = rows.map((row) => ({
      matricNo: String(row.matric_no || row.matricNo || row.MatricNo || '').trim(),
      status: String(row.status || row.Status || '').trim(),
      resultType: String(row.result_type || row.resultType || row.ResultType || 'Final').trim(),
      score: row.score ?? row.Score ?? '',
    }))

    const transformedReq = {
      ...req,
      body: { courseId, batchId, results: normalized },
    }

    return bulkUploadResults(transformedReq, res, next)
  } catch (error) {
    next(error)
  }
}

// GET /results/plan-grid?planId=X&cohortId=Y
// Returns the plan courses x cohort students grid with existing results
export const getPlanGrid = async (req, res, next) => {
  try {
    const planId = Number(req.query.planId || 0)
    const cohortId = Number(req.query.cohortId || 0)
    if (!planId || !cohortId) throw httpError(400, 'planId and cohortId are required')

    const [planRes, cohortRes] = await Promise.all([
      query(`SELECT id, name, year FROM course_plans WHERE id = $1`, [planId]),
      query(`SELECT id, name FROM cohorts WHERE id = $1`, [cohortId]),
    ])
    if (!planRes.rows.length) throw httpError(404, 'Plan not found')
    if (!cohortRes.rows.length) throw httpError(404, 'Cohort not found')

    const coursesRes = await query(
      `SELECT cpi.course_id AS id, c.title, c.course_code, c.has_assignment, c.has_exam
       FROM course_plan_items cpi
       JOIN courses c ON c.id = cpi.course_id
       WHERE cpi.plan_id = $1
       ORDER BY cpi.sort_order ASC NULLS LAST, cpi.start_date ASC NULLS LAST`,
      [planId]
    )
    const courses = coursesRes.rows

    const studentsRes = await query(
      `SELECT s.id AS student_id, u.full_name, s.matric_no
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE s.cohort_id = $1
       ORDER BY u.full_name ASC`,
      [cohortId]
    )
    const students = studentsRes.rows

    if (!courses.length || !students.length) {
      return res.json({
        plan: planRes.rows[0],
        cohort: cohortRes.rows[0],
        courses,
        students,
      })
    }

    const courseIds = courses.map((c) => c.id)
    const studentIds = students.map((s) => s.student_id)

    const resultsRes = await query(
      `SELECT r.student_id, r.course_id, r.id, r.result_type, r.score, r.status, r.uploaded_at
       FROM results r
       WHERE r.course_id = ANY($1) AND r.student_id = ANY($2)`,
      [courseIds, studentIds]
    )

    // Build a lookup: studentId -> courseId -> result
    const resultMap = {}
    for (const r of resultsRes.rows) {
      if (!resultMap[r.student_id]) resultMap[r.student_id] = {}
      resultMap[r.student_id][r.course_id] = {
        id: r.id,
        result_type: r.result_type,
        score: r.score,
        status: r.status,
        uploaded_at: r.uploaded_at,
      }
    }

    const studentsWithResults = students.map((s) => ({
      ...s,
      results: resultMap[s.student_id] || {},
    }))

    res.json({
      plan: planRes.rows[0],
      cohort: cohortRes.rows[0],
      courses,
      students: studentsWithResults,
    })
  } catch (error) {
    next(error)
  }
}

// POST /results/bulk-plan
// Saves multiple results for a plan+cohort grid in one request
export const bulkSavePlanResults = async (req, res, next) => {
  try {
    const { entries } = req.body
    if (!Array.isArray(entries) || !entries.length) {
      throw httpError(400, 'entries array is required')
    }

    const saved = []
    const errors = []

    for (const entry of entries) {
      try {
        const { studentId, courseId, resultType = 'Final', score, status: requestedStatus } = entry
        if (!studentId || !courseId) {
          errors.push({ entry, error: 'studentId and courseId are required' })
          continue
        }

        const normalizedResultType = String(resultType).trim()
        if (!['Assignment', 'Exam', 'Final'].includes(normalizedResultType)) {
          errors.push({ entry, error: 'resultType must be Assignment, Exam, or Final' })
          continue
        }

        let numericScore = null
        let resolvedStatus = requestedStatus

        if (score !== undefined && score !== null && score !== '') {
          numericScore = Number(score)
          if (Number.isNaN(numericScore) || numericScore < 0 || numericScore > 100) {
            errors.push({ entry, error: 'score must be between 0 and 100' })
            continue
          }
          resolvedStatus = numericScore >= 50 ? 'Pass' : 'Fail'
        }

        if (!['Pass', 'Fail'].includes(resolvedStatus)) {
          errors.push({ entry, error: 'status must be Pass or Fail' })
          continue
        }

        const result = await query(
          `INSERT INTO results (course_id, student_id, result_type, score, status, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (course_id, student_id, result_type)
           DO UPDATE SET score = EXCLUDED.score, status = EXCLUDED.status,
                         uploaded_at = NOW(), uploaded_by = EXCLUDED.uploaded_by
           RETURNING id`,
          [Number(courseId), Number(studentId), normalizedResultType, numericScore, resolvedStatus, req.user.userId]
        )
        saved.push(result.rows[0].id)
      } catch (err) {
        errors.push({ entry, error: err.message })
      }
    }

    res.json({ saved: saved.length, errors })
  } catch (error) {
    next(error)
  }
}

// GET /results/history
// Returns results grouped by cohort -> course -> students
export const getResultsHistory = async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT
         co.id         AS cohort_id,
         co.name       AS cohort_name,
         c.id          AS course_id,
         c.title       AS course_title,
         c.course_code,
         s.id          AS student_id,
         u.full_name,
         s.matric_no,
         r.id          AS result_id,
         r.status      AS result_status,
         r.score,
         r.result_type,
         r.uploaded_at
       FROM cohorts co
       JOIN students s   ON s.cohort_id = co.id
       JOIN users u      ON u.id = s.user_id
       JOIN enrollments e ON e.student_id = s.id
       JOIN courses c    ON c.id = e.course_id
       LEFT JOIN LATERAL (
         SELECT r2.id, r2.status, r2.score, r2.result_type, r2.uploaded_at
         FROM results r2
         WHERE r2.student_id = s.id
           AND r2.course_id  = c.id
         ORDER BY r2.uploaded_at DESC
         LIMIT 1
       ) r ON TRUE
       ORDER BY co.name ASC, c.title ASC, u.full_name ASC`
    )

    // Build nested structure: cohortId -> courseId -> students[]
    const cohortMap = new Map()
    for (const row of rows.rows) {
      if (!cohortMap.has(row.cohort_id)) {
        cohortMap.set(row.cohort_id, {
          cohort_id: row.cohort_id,
          cohort_name: row.cohort_name,
          courses: new Map(),
        })
      }
      const cohort = cohortMap.get(row.cohort_id)
      if (!cohort.courses.has(row.course_id)) {
        cohort.courses.set(row.course_id, {
          course_id: row.course_id,
          course_title: row.course_title,
          course_code: row.course_code,
          students: [],
        })
      }
      cohort.courses.get(row.course_id).students.push({
        student_id: row.student_id,
        full_name: row.full_name,
        matric_no: row.matric_no,
        result_id: row.result_id,
        result_status: row.result_status,
        score: row.score,
        result_type: row.result_type,
        uploaded_at: row.uploaded_at,
      })
    }

    const result = Array.from(cohortMap.values()).map((co) => ({
      cohort_id: co.cohort_id,
      cohort_name: co.cohort_name,
      courses: Array.from(co.courses.values()),
    }))

    res.json(result)
  } catch (error) {
    next(error)
  }
}
