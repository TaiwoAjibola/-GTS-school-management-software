import bcrypt from 'bcryptjs'
import * as XLSX from 'xlsx'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool, query } from '../db/pool.js'
import { formatMatricNumber } from '../utils/matric.js'
import { httpError } from '../utils/httpError.js'
import { sendWelcomeEmail, sendGraduationEmail } from '../services/emailService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const studentUploadsRoot = path.join(__dirname, '../../uploads/students')

if (!fs.existsSync(studentUploadsRoot)) {
  fs.mkdirSync(studentUploadsRoot, { recursive: true })
}

export const createStudent = async (req, res, next) => {
  const client = await pool.connect()
  try {
    const {
      fullName,
      email,
      phone,
      status = 'Prospective',
      matricNo: providedMatricNo,
      comments,
      password = 'Student123!',
      cohortId,
    } = req.body

    const normalizedStatus = status || 'Prospective'
    const nextCohortId = cohortId || null

    if (!fullName || !email || !phone) {
      throw httpError(400, 'fullName, email, and phone are required')
    }

    await client.query('BEGIN')

    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email])
    if (existing.rows.length) {
      throw httpError(409, 'Email already exists')
    }

    let matricNo = null
    if (providedMatricNo) {
      const duplicateMatric = await client.query('SELECT id FROM students WHERE matric_no = $1', [
        providedMatricNo,
      ])
      if (duplicateMatric.rows.length) {
        throw httpError(409, 'Matric number already exists')
      }
      matricNo = providedMatricNo
    } else if (normalizedStatus !== 'Prospective') {
      // Auto-generate matric number only for Active (and above) students
      await client.query('LOCK TABLE students IN EXCLUSIVE MODE')
      const studentCountResult = await client.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(matric_no FROM 4) AS INT)), 0)::int AS count
         FROM students WHERE matric_no IS NOT NULL`
      )
      const nextSequence = Number(studentCountResult.rows[0].count) + 1
      matricNo = formatMatricNumber(nextSequence)
    }
    // Prospective without a provided matric_no → stays null

    const hashed = await bcrypt.hash(password, 10)

    const userResult = await client.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, 'student')
       RETURNING id, full_name, email, role`,
      [fullName, email, hashed]
    )

    const user = userResult.rows[0]

    let studentResult
    studentResult = await client.query(
      `INSERT INTO students (user_id, matric_no, phone, status, student_number, comments, cohort_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, matric_no, phone, status, student_number, comments, profile_image_url, cohort_id`,
      [user.id, matricNo, phone, normalizedStatus, null, comments || null, nextCohortId]
    )

    await client.query('COMMIT')

    const created = { ...user, ...studentResult.rows[0] }

    // Send welcome email if student is created directly as Active
    if (normalizedStatus === 'Active' && matricNo) {
      sendWelcomeEmail({ to: user.email, studentName: user.full_name, matricNo }).catch(() => {})
    }

    res.status(201).json(created)
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
}

export const listStudents = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT s.id, s.matric_no, s.student_number, s.phone, s.status, s.comments, s.profile_image_url,
              s.cohort_id, u.full_name, u.email,
              co.name AS cohort_name,
              COALESCE(json_agg(json_build_object('id', ss.id, 'statusName', ss.status_name)) FILTER (WHERE ss.id IS NOT NULL), '[]'::json) AS statuses
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN student_statuses ss ON ss.student_id = s.id
       LEFT JOIN cohorts co ON co.id = s.cohort_id
       GROUP BY s.id, s.matric_no, s.phone, s.status, s.profile_image_url, s.cohort_id, u.full_name, u.email, co.name
       ORDER BY s.id ASC`
    )
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const enrollStudent = async (req, res, next) => {
  try {
    const { courseId, studentId } = req.body
    if (!courseId || !studentId) {
      throw httpError(400, 'courseId and studentId are required')
    }

    const result = await query(
      `INSERT INTO enrollments (course_id, student_id)
       VALUES ($1, $2)
       ON CONFLICT (course_id, student_id) DO NOTHING
       RETURNING *`,
      [courseId, studentId]
    )

    res.status(201).json({ enrolled: result.rows.length > 0 })
  } catch (error) {
    next(error)
  }
}

export const updateStudent = async (req, res, next) => {
  try {
    const studentId = Number(req.params.studentId)
    const { fullName, email, phone, status, matricNo, studentNumber, comments, profileImageUrl, cohortId } = req.body

    if (!studentId) {
      throw httpError(400, 'Invalid studentId')
    }

    const currentResult = await query(
      `SELECT s.id, s.user_id, s.matric_no, s.phone, s.status, s.student_number, s.comments, s.profile_image_url, s.cohort_id, u.full_name, u.email
       FROM students s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [studentId]
    )

    if (!currentResult.rows.length) {
      throw httpError(404, 'Student not found')
    }

    const current = currentResult.rows[0]
    const nextStatus = status || current.status
    const nextCohortId = cohortId !== undefined ? (cohortId || null) : (current.cohort_id || null)
    const nextEmail = email || current.email
    const nextMatric = matricNo || current.matric_no

    const duplicateEmail = await query('SELECT id FROM users WHERE email = $1 AND id <> $2', [
      nextEmail,
      current.user_id,
    ])
    if (duplicateEmail.rows.length) {
      throw httpError(409, 'Email already exists')
    }

    const duplicateMatric = await query('SELECT id FROM students WHERE matric_no = $1 AND id <> $2', [
      nextMatric,
      studentId,
    ])
    if (duplicateMatric.rows.length) {
      throw httpError(409, 'Matric number already exists')
    }

    await query(
      `UPDATE users
       SET full_name = $1, email = $2
       WHERE id = $3`,
      [fullName || current.full_name, nextEmail, current.user_id]
    )

    await query(
      `UPDATE students
       SET phone = $1,
           status = $2,
           matric_no = $3,
           student_number = $4,
           comments = $5,
           profile_image_url = $6,
           cohort_id = $7
       WHERE id = $8`,
      [
        phone || current.phone,
        nextStatus,
        nextMatric,
        studentNumber || current.student_number,
        comments || current.comments,
        profileImageUrl || current.profile_image_url,
        nextCohortId,
        studentId,
      ]
    )

    res.json({ message: 'Student updated successfully' })
  } catch (error) {
    next(error)
  }
}

export const uploadStudentPhoto = async (req, res, next) => {
  try {
    const studentId = Number(req.params.studentId)
    if (!studentId || !req.file) {
      throw httpError(400, 'Valid studentId and image file are required')
    }

    const safeName = `${Date.now()}-${req.file.originalname.replace(/\s+/g, '_')}`
    const filePath = path.join(studentUploadsRoot, safeName)
    fs.writeFileSync(filePath, req.file.buffer)
    const photoUrl = `/uploads/students/${safeName}`

    await query('UPDATE students SET profile_image_url = $1 WHERE id = $2', [photoUrl, studentId])
    res.json({ profileImageUrl: photoUrl })
  } catch (error) {
    next(error)
  }
}

export const updateStudentLifecycleStatus = async (req, res, next) => {
  try {
    const studentId = Number(req.params.studentId)
    const { status } = req.body

    if (!studentId || !status) {
      throw httpError(400, 'studentId and status are required')
    }

    const allowed = ['Prospective', 'Active', 'Graduating', 'Graduated', 'Alumni']
    if (!allowed.includes(status)) {
      throw httpError(400, `status must be one of: ${allowed.join(', ')}`)
    }

    const currentResult = await query(
      `SELECT s.status, s.matric_no, u.full_name, u.email
       FROM students s JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [studentId]
    )
    const current = currentResult.rows[0]
    if (!current) {
      throw httpError(404, 'Student not found')
    }

    let newMatricNo = current.matric_no

    // When activating a Prospective student, auto-generate a matric number if they don't have one
    if (status === 'Active' && !current.matric_no) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('LOCK TABLE students IN EXCLUSIVE MODE')
        const maxResult = await client.query(
          `SELECT COALESCE(MAX(CAST(SUBSTRING(matric_no FROM 4) AS INT)), 0)::int AS count
           FROM students WHERE matric_no IS NOT NULL`
        )
        newMatricNo = formatMatricNumber(Number(maxResult.rows[0].count) + 1)
        await client.query('UPDATE students SET status = $1, matric_no = $2 WHERE id = $3', [status, newMatricNo, studentId])
        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    } else {
      await query('UPDATE students SET status = $1 WHERE id = $2', [status, studentId])
    }

    await query(
      `INSERT INTO student_activity_logs (student_id, action, details, actor_user_id)
       VALUES ($1, 'student_lifecycle_status_updated', $2::jsonb, $3)`,
      [
        studentId,
        JSON.stringify({ from: current.status, to: status }),
        req.user.userId,
      ]
    )

    // Send emails on key lifecycle transitions
    if (status === 'Active' && current.status === 'Prospective') {
      sendWelcomeEmail({ to: current.email, studentName: current.full_name, matricNo: newMatricNo }).catch(() => {})
    }
    if (status === 'Graduated') {
      sendGraduationEmail({ to: current.email, studentName: current.full_name }).catch(() => {})
    }

    res.json({ message: 'Student lifecycle status updated', matricNo: newMatricNo })
  } catch (error) {
    next(error)
  }
}

export const addStudentStatus = async (req, res, next) => {
  try {
    const studentId = Number(req.params.studentId)
    const { statusName } = req.body

    if (!studentId || !statusName) {
      throw httpError(400, 'studentId and statusName are required')
    }

    const result = await query(
      `INSERT INTO student_statuses (student_id, status_name)
       VALUES ($1, $2)
       ON CONFLICT (student_id, status_name) DO NOTHING
       RETURNING *`,
      [studentId, statusName]
    )

    res.status(201).json({ added: result.rows.length > 0 })
  } catch (error) {
    next(error)
  }
}

export const deleteStudent = async (req, res, next) => {
  const client = await pool.connect()
  try {
    const studentId = Number(req.params.studentId)
    if (!studentId) throw httpError(400, 'Invalid studentId')

    const result = await client.query(
      `SELECT s.user_id FROM students s WHERE s.id = $1`,
      [studentId]
    )
    if (!result.rows.length) throw httpError(404, 'Student not found')
    const { user_id } = result.rows[0]

    await client.query('BEGIN')
    // Deleting the user cascades to students and all child records via FK constraints
    await client.query('DELETE FROM users WHERE id = $1', [user_id])
    await client.query('COMMIT')

    res.json({ message: 'Student deleted successfully' })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
}

export const removeStudentStatus = async (req, res, next) => {
  try {
    const { studentId, statusId } = req.params

    if (!studentId || !statusId) {
      throw httpError(400, 'studentId and statusId are required')
    }

    await query(
      `DELETE FROM student_statuses
       WHERE id = $1 AND student_id = $2`,
      [statusId, studentId]
    )

    res.json({ message: 'Status removed successfully' })
  } catch (error) {
    next(error)
  }
}

export const downloadStudentTemplate = async (req, res, next) => {
  try {
    const headers = [
      'Full Name', 'Email', 'Phone', 'Status', 'Matric Number', 'Batch Name', 'Comments', 'Send Welcome Email',
    ]
    const examples = [
      ['Jane Doe', 'jane@example.com', '08012345678', 'Active', '', 'February 2026', 'Referred by pastor', 'No'],
      ['John Smith', 'john@example.com', '08098765432', 'Prospective', '', 'February 2026', '', 'No'],
    ]
    const ws = XLSX.utils.aoa_to_sheet([headers, ...examples])
    ws['!cols'] = headers.map(() => ({ wch: 22 }))

    // Force "Batch Name" column (F) to text so Excel doesn't convert month names to dates
    for (let row = 1; row <= 100; row++) {
      const cellRef = `F${row}`
      if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' }
      ws[cellRef].t = 's'
    }
    ws['F1'] = { t: 's', v: 'Batch Name' }
    ws['F2'] = { t: 's', v: 'February 2026' }
    ws['F3'] = { t: 's', v: 'February 2026' }

    // Data validation: Status dropdown (column D) and Send Welcome Email dropdown (column H)
    if (!ws['!dataValidations']) ws['!dataValidations'] = []
    ws['!dataValidations'].push({
      sqref: 'D2:D10000',
      type: 'list',
      formula1: '"Prospective,Active,Graduating,Graduated,Alumni"',
      showDropDown: false,
      showErrorMessage: true,
      errorTitle: 'Invalid Status',
      error: 'Choose from: Prospective, Active, Graduating, Graduated, Alumni',
    })
    ws['!dataValidations'].push({
      sqref: 'H2:H10000',
      type: 'list',
      formula1: '"Yes,No"',
      showDropDown: false,
      showErrorMessage: true,
      errorTitle: 'Invalid value',
      error: 'Choose Yes or No',
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Students')
    // Embed data validations into the worksheet XML via SheetJS writeOptions
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    res.setHeader('Content-Disposition', 'attachment; filename="students_template.xlsx"')
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.send(buf)
  } catch (error) {
    next(error)
  }
}

export const uploadStudents = async (req, res, next) => {
  const client = await pool.connect()
  try {
    if (!req.file) {
      throw httpError(400, 'Upload file is required')
    }

    // Use cellDates:false so we get raw values; date cells will come as serial numbers
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: false })
    const firstSheet = workbook.SheetNames[0]
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' })

    if (!rows.length) {
      throw httpError(400, 'No student rows found in uploaded file')
    }

    // Convert Excel date serial number → "Month YYYY" string
    // Excel epoch: Jan 1 1900 = day 1 (with the spurious Feb 29 1900 bug, offset = 25569 from Unix epoch)
    const MONTH_NAMES = [
      'January','February','March','April','May','June',
      'July','August','September','October','November','December',
    ]
    const excelSerialToMonthYear = (serial) => {
      const ms = (serial - 25569) * 86400 * 1000
      const d = new Date(ms)
      return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`
    }

    const normaliseBatchName = (raw) => {
      if (raw === '' || raw === null || raw === undefined) return ''
      // If the value is a plain number, treat it as an Excel date serial
      if (typeof raw === 'number' && raw > 1000) {
        return excelSerialToMonthYear(raw)
      }
      const s = String(raw).trim()
      // String like "44958" — also convert
      if (/^\d{5}$/.test(s)) {
        return excelSerialToMonthYear(Number(s))
      }
      return s
    }

    let created = 0
    let updated = 0
    const welcomeQueue = []

    await client.query('BEGIN')

    // Cache cohort lookups to avoid repeated queries per-transaction
    const cohortCache = new Map()
    const resolveCohortId = async (rawBatchName) => {
      const name = normaliseBatchName(rawBatchName)
      if (!name) return null
      const key = name.toLowerCase()
      if (cohortCache.has(key)) return cohortCache.get(key)
      const existing = await client.query('SELECT id FROM cohorts WHERE LOWER(name) = LOWER($1) LIMIT 1', [name])
      if (existing.rows.length) {
        cohortCache.set(key, existing.rows[0].id)
        return existing.rows[0].id
      }
      const inserted = await client.query(
        `INSERT INTO cohorts (name, status) VALUES ($1, 'active') RETURNING id`,
        [name]
      )
      cohortCache.set(key, inserted.rows[0].id)
      return inserted.rows[0].id
    }

    for (const row of rows) {
      const fullName = String(row['Full Name'] || row.fullName || row.FullName || row.name || '').trim()
      const email = String(row.Email || row.email || '').trim().toLowerCase()
      const phone = String(row.Phone || row.phone || '').trim()
      const status = String(row.Status || row.status || 'Prospective').trim() || 'Prospective'
      const providedMatric = String(row['Matric Number'] || row.matricNo || row.matric_no || row.MatricNo || '').trim()
      const rawBatch = row['Batch Name'] ?? row.batchName ?? row.batch_name ?? ''
      const comments = String(row.Comments || row.comments || '').trim()
      // Default: do NOT send welcome email unless explicitly set to "Yes"
      const sendEmail = String(row['Send Welcome Email'] || row.sendWelcomeEmail || 'No').trim().toLowerCase() === 'yes'

      if (!fullName || !email || !phone) {
        continue
      }

      const needsMatric = !providedMatric && status !== 'Prospective'
      const cohortId = await resolveCohortId(rawBatch)

      // Pre-generate matric using the sequence (no table lock needed)
      let autoMatric = null
      if (needsMatric) {
        const seqResult = await client.query(`SELECT nextval('students_matric_seq') AS seq`)
        autoMatric = formatMatricNumber(Number(seqResult.rows[0].seq))
      }

      const matricNo = providedMatric || autoMatric || null

      const existingUser = await client.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email])

      if (existingUser.rows.length) {
        const userId = existingUser.rows[0].id
        await client.query('UPDATE users SET full_name = $1 WHERE id = $2', [fullName, userId])

        const existingStudent = await client.query('SELECT id, matric_no FROM students WHERE user_id = $1', [userId])

        if (existingStudent.rows.length) {
          // If the existing record has no matric and this student now needs one, use the generated one
          const finalMatric = providedMatric || existingStudent.rows[0].matric_no || autoMatric || null
          await client.query(
            `UPDATE students SET phone = $1, status = $2, matric_no = $3, comments = $4, cohort_id = $5 WHERE user_id = $6`,
            [phone, status, finalMatric, comments || null, cohortId, userId]
          )
          updated += 1
          if (sendEmail && finalMatric) {
            welcomeQueue.push({ email, fullName, matricNo: finalMatric })
          }
          continue
        }
      }

      const hashed = await bcrypt.hash('Student123!', 10)
      const userResult = await client.query(
        `INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, 'student') RETURNING id`,
        [fullName, email, hashed]
      )

      await client.query(
        `INSERT INTO students (user_id, matric_no, phone, status, comments, cohort_id) VALUES ($1, $2, $3, $4, $5, $6)`,
        [userResult.rows[0].id, matricNo, phone, status, comments || null, cohortId]
      )

      if (sendEmail && matricNo) {
        welcomeQueue.push({ email, fullName, matricNo })
      }

      created += 1
    }

    await client.query('COMMIT')

    // Fire welcome emails after commit (non-blocking)
    for (const { email: to, fullName: studentName, matricNo } of welcomeQueue) {
      sendWelcomeEmail({ to, studentName, matricNo }).catch(() => {})
    }

    res.status(201).json({ created, updated, processed: rows.length })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
}

export const getStudent = async (req, res, next) => {
  try {
    const studentId = Number(req.params.studentId)
    if (!studentId) throw httpError(400, 'Invalid studentId')

    const result = await query(
      `SELECT s.id, s.matric_no, s.student_number, s.phone, s.status, s.comments, s.profile_image_url,
              s.cohort_id, u.full_name, u.email,
              co.name AS cohort_name,
              COALESCE(json_agg(json_build_object('id', ss.id, 'statusName', ss.status_name)) FILTER (WHERE ss.id IS NOT NULL), '[]'::json) AS statuses
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN student_statuses ss ON ss.student_id = s.id
       LEFT JOIN cohorts co ON co.id = s.cohort_id
       WHERE s.id = $1
       GROUP BY s.id, u.full_name, u.email, co.name`,
      [studentId]
    )

    if (!result.rows.length) throw httpError(404, 'Student not found')
    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export const exportStudents = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT s.matric_no, u.full_name, u.email, s.phone, s.status, s.student_number, s.comments,
              co.name AS cohort_name
       FROM students s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN cohorts co ON co.id = s.cohort_id
       ORDER BY s.id ASC`
    )

    const worksheetData = [
      ['Matric No', 'Full Name', 'Email', 'Phone', 'Status', 'Student Number', 'Comments', 'Student Batch'],
      ...result.rows.map((s) => [
        s.matric_no,
        s.full_name,
        s.email,
        s.phone,
        s.status,
        s.student_number || '',
        s.comments || '',
        s.cohort_name || '',
      ]),
    ]

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students')

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="students.xlsx"')
    res.send(buffer)
  } catch (error) {
    next(error)
  }
}

export const getGraduationMatrix = async (req, res, next) => {
  try {
    const coursesResult = await query(
      `SELECT id, title, course_code, start_date, class_day, class_time
       FROM courses
       ORDER BY created_at ASC`
    )
    const courses = coursesResult.rows

    const matrixResult = await query(
      `SELECT
         s.id AS student_id,
         u.full_name,
         u.email,
         s.matric_no,
         s.status AS student_status,
         c.id AS course_id,
         rr.status AS result_status,
         rr.score,
         rr.result_type,
         e.status AS enrollment_status
       FROM students s
       JOIN users u ON u.id = s.user_id
       CROSS JOIN courses c
       LEFT JOIN enrollments e ON e.student_id = s.id AND e.course_id = c.id
       LEFT JOIN LATERAL (
         SELECT r.status, r.score, r.result_type
         FROM results r
         WHERE r.student_id = s.id AND r.course_id = c.id
         ORDER BY r.uploaded_at DESC
         LIMIT 1
       ) rr ON TRUE
       ORDER BY u.full_name ASC, c.created_at ASC`
    )

    const studentMap = {}
    for (const row of matrixResult.rows) {
      if (!studentMap[row.student_id]) {
        studentMap[row.student_id] = {
          id: row.student_id,
          full_name: row.full_name,
          email: row.email,
          matric_no: row.matric_no,
          status: row.student_status,
          courses: {},
        }
      }
      studentMap[row.student_id].courses[row.course_id] = {
        result_status: row.result_status,
        score: row.score,
        enrollment_status: row.enrollment_status,
      }
    }

    const students = Object.values(studentMap).map((student) => {
      let passed = 0
      let failed = 0
      let enrolled = 0
      for (const c of courses) {
        const info = student.courses[c.id]
        if (info?.result_status === 'Pass') passed++
        else if (info?.result_status === 'Fail') failed++
        else if (info?.enrollment_status === 'active') enrolled++
      }
      return {
        ...student,
        passed,
        failed,
        enrolled_active: enrolled,
        total: courses.length,
        remaining: courses.length - passed,
        completion_pct: courses.length > 0 ? Math.round((passed / courses.length) * 100) : 0,
      }
    })

    res.json({ courses, students })
  } catch (error) {
    next(error)
  }
}
