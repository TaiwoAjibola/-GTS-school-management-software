import * as XLSX from 'xlsx'
import { pool, query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'
import { drawReportPdf } from '../utils/graduationPdf.js'

const SET_STATUSES = ['active', 'completed', 'archived']

const setListSelect = (where = '') => `
  SELECT gs.id, gs.name, gs.description, gs.graduation_date::text AS graduation_date,
         gs.status, gs.created_at,
         COUNT(DISTINCT gsm.id)::int AS member_count,
         COUNT(DISTINCT gsc.id)::int AS course_count
  FROM graduating_sets gs
  LEFT JOIN graduating_set_members gsm ON gsm.set_id = gs.id
  LEFT JOIN graduating_set_courses gsc ON gsc.set_id = gs.id
  ${where}
  GROUP BY gs.id
  ORDER BY gs.created_at DESC`

const parseId = (value, label) => {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw httpError(400, `Invalid ${label}`)
  return id
}

const toIdArray = (value, field, required = false) => {
  if (value === undefined || value === null) {
    if (required) throw httpError(400, `${field} array is required`)
    return []
  }
  if (!Array.isArray(value)) throw httpError(400, `${field} must be an array of ids`)
  const ids = value.map((v) => Number(v))
  if (ids.some((n) => !Number.isInteger(n) || n <= 0)) {
    throw httpError(400, `${field} must contain positive integer ids`)
  }
  return [...new Set(ids)]
}

const insertSetLinks = async (client, setId, table, column, ids, field) => {
  if (!ids.length) return
  try {
    await client.query(
      `INSERT INTO ${table} (set_id, ${column})
       SELECT $1::int, unnest($2::int[])
       ON CONFLICT DO NOTHING`,
      [setId, ids]
    )
  } catch (error) {
    if (error.code === '23503') {
      throw httpError(400, `One or more ${field} reference records that do not exist`)
    }
    throw error
  }
}

const ensureSet = async (setId) => {
  const result = await query('SELECT id FROM graduating_sets WHERE id = $1', [setId])
  if (!result.rows.length) throw httpError(404, 'Graduation set not found')
}

const countSetLinks = async (table, setId) => {
  const result = await query(`SELECT COUNT(*)::int AS count FROM ${table} WHERE set_id = $1`, [setId])
  return result.rows[0].count
}

const safeFileName = (name) => {
  const safe = String(name || '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  return safe || 'graduating-set'
}

const formatDate = (value) => (value ? String(value).slice(0, 10) : null)

const buildSetDetail = async (setId) => {
  const setResult = await query(
    `SELECT id, name, description, graduation_date::text AS graduation_date, status, created_at, updated_at
     FROM graduating_sets WHERE id = $1`,
    [setId]
  )
  if (!setResult.rows.length) throw httpError(404, 'Graduation set not found')
  const set = setResult.rows[0]

  const coursesResult = await query(
    `SELECT c.id, c.title, c.course_code
     FROM graduating_set_courses gsc
     JOIN courses c ON c.id = gsc.course_id
     WHERE gsc.set_id = $1
     ORDER BY c.created_at ASC`,
    [setId]
  )
  const courses = coursesResult.rows

  const membersResult = await query(
    `SELECT s.id, u.full_name, u.email, s.matric_no, s.status, co.name AS cohort_name
     FROM graduating_set_members gsm
     JOIN students s ON s.id = gsm.student_id
     JOIN users u ON u.id = s.user_id
     LEFT JOIN cohorts co ON co.id = s.cohort_id
     WHERE gsm.set_id = $1
     ORDER BY u.full_name ASC`,
    [setId]
  )

  const matrixResult = courses.length
    ? await query(
        `SELECT s.id AS student_id,
                c.id AS course_id,
                rr.status AS result_status,
                rr.score,
                e.status AS enrollment_status
         FROM graduating_set_members gsm
         JOIN students s ON s.id = gsm.student_id
         JOIN graduating_set_courses gsc ON gsc.set_id = gsm.set_id
         JOIN courses c ON c.id = gsc.course_id
         LEFT JOIN enrollments e ON e.student_id = s.id AND e.course_id = c.id
         LEFT JOIN LATERAL (
           SELECT r.status, r.score
           FROM results r
           WHERE r.student_id = s.id AND r.course_id = c.id
           ORDER BY r.uploaded_at DESC
           LIMIT 1
         ) rr ON TRUE
         WHERE gsm.set_id = $1`,
        [setId]
      )
    : { rows: [] }

  const infoByStudent = new Map()
  for (const row of matrixResult.rows) {
    if (!infoByStudent.has(row.student_id)) infoByStudent.set(row.student_id, {})
    infoByStudent.get(row.student_id)[row.course_id] = {
      result_status: row.result_status ?? null,
      score: row.score ?? null,
      enrollment_status: row.enrollment_status ?? null,
    }
  }

  const total = courses.length
  const members = membersResult.rows.map((member) => {
    const results = infoByStudent.get(member.id) || {}
    let passed = 0
    let failed = 0
    let active = 0
    for (const course of courses) {
      const info = results[course.id]
      if (info?.result_status === 'Pass') passed++
      else if (info?.result_status === 'Fail') failed++
      else if (info?.enrollment_status === 'active') active++
    }
    return {
      ...member,
      results,
      passed,
      failed,
      active,
      total,
      completion_pct: total > 0 ? Math.round((passed / total) * 100) : 0,
    }
  })

  return { set, courses, members }
}

const buildTakenRows = (courses, results) => {
  const rows = []
  for (const course of courses) {
    const info = results[course.id]
    if (!info || (!info.result_status && info.enrollment_status !== 'active')) continue
    rows.push([
      course.course_code || '',
      course.title || '',
      info.result_status || (info.enrollment_status === 'active' ? 'In Progress' : '—'),
      info.score ?? '',
    ])
  }
  return rows
}

export const listGraduationSets = async (req, res, next) => {
  try {
    const result = await query(setListSelect())
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const createGraduationSet = async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { name, description, graduation_date, courseIds, studentIds } = req.body || {}
    if (!name || !String(name).trim()) throw httpError(400, 'name is required')

    const courses = toIdArray(courseIds, 'courseIds')
    const students = toIdArray(studentIds, 'studentIds')

    await client.query('BEGIN')
    const inserted = await client.query(
      `INSERT INTO graduating_sets (name, description, graduation_date, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [String(name).trim(), description || null, graduation_date || null, req.user.userId]
    )
    const set = inserted.rows[0]

    await insertSetLinks(client, set.id, 'graduating_set_members', 'student_id', students, 'studentIds')
    await insertSetLinks(client, set.id, 'graduating_set_courses', 'course_id', courses, 'courseIds')
    await client.query('COMMIT')

    const result = await query(setListSelect('WHERE gs.id = $1'), [set.id])
    res.status(201).json(result.rows[0])
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
}

export const getGraduationSet = async (req, res, next) => {
  try {
    const setId = parseId(req.params.id, 'set id')
    const { set, courses, members } = await buildSetDetail(setId)
    res.json({
      id: set.id,
      name: set.name,
      description: set.description,
      graduation_date: set.graduation_date,
      status: set.status,
      created_at: set.created_at,
      courses,
      members,
    })
  } catch (error) {
    next(error)
  }
}

export const updateGraduationSet = async (req, res, next) => {
  try {
    const setId = parseId(req.params.id, 'set id')
    const { name, description, graduation_date, status } = req.body || {}

    if (status !== undefined && status !== null && !SET_STATUSES.includes(status)) {
      throw httpError(400, `status must be one of: ${SET_STATUSES.join(', ')}`)
    }

    const result = await query(
      `UPDATE graduating_sets
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           graduation_date = COALESCE($3, graduation_date),
           status = COALESCE($4, status),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [name || null, description || null, graduation_date || null, status || null, setId]
    )
    if (!result.rows.length) throw httpError(404, 'Graduation set not found')

    res.json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export const deleteGraduationSet = async (req, res, next) => {
  try {
    const setId = parseId(req.params.id, 'set id')
    await ensureSet(setId)
    await query('DELETE FROM graduating_sets WHERE id = $1', [setId])
    res.status(204).end()
  } catch (error) {
    next(error)
  }
}

export const addSetMembers = async (req, res, next) => {
  const client = await pool.connect()
  try {
    const setId = parseId(req.params.id, 'set id')
    const studentIds = toIdArray(req.body?.studentIds, 'studentIds', true)
    await ensureSet(setId)

    if (studentIds.length) {
      await client.query('BEGIN')
      await insertSetLinks(client, setId, 'graduating_set_members', 'student_id', studentIds, 'studentIds')
      await client.query('COMMIT')
    }

    res.json({ member_count: await countSetLinks('graduating_set_members', setId) })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
}

export const removeSetMember = async (req, res, next) => {
  try {
    const setId = parseId(req.params.id, 'set id')
    const studentId = parseId(req.params.studentId, 'studentId')
    await query('DELETE FROM graduating_set_members WHERE set_id = $1 AND student_id = $2', [setId, studentId])
    res.status(204).end()
  } catch (error) {
    next(error)
  }
}

export const addSetCourses = async (req, res, next) => {
  const client = await pool.connect()
  try {
    const setId = parseId(req.params.id, 'set id')
    const courseIds = toIdArray(req.body?.courseIds, 'courseIds', true)
    await ensureSet(setId)

    if (courseIds.length) {
      await client.query('BEGIN')
      await insertSetLinks(client, setId, 'graduating_set_courses', 'course_id', courseIds, 'courseIds')
      await client.query('COMMIT')
    }

    res.json({ course_count: await countSetLinks('graduating_set_courses', setId) })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
}

export const removeSetCourse = async (req, res, next) => {
  try {
    const setId = parseId(req.params.id, 'set id')
    const courseId = parseId(req.params.courseId, 'courseId')
    await query('DELETE FROM graduating_set_courses WHERE set_id = $1 AND course_id = $2', [setId, courseId])
    res.status(204).end()
  } catch (error) {
    next(error)
  }
}

export const completeGraduationSet = async (req, res, next) => {
  const client = await pool.connect()
  try {
    const setId = parseId(req.params.id, 'set id')
    const { courses, members } = await buildSetDetail(setId)

    if (!courses.length) throw httpError(400, 'Set has no courses')

    const graduated = []
    const remaining = []
    for (const member of members) {
      if (member.total > 0 && member.passed === member.total) graduated.push(member)
      else remaining.push(member)
    }

    await client.query('BEGIN')
    for (const member of graduated) {
      await client.query(`UPDATE students SET status = 'Graduated', updated_at = NOW() WHERE id = $1`, [member.id])
    }
    await client.query('UPDATE graduating_sets SET status = $1, updated_at = NOW() WHERE id = $2', ['completed', setId])
    await client.query('COMMIT')

    res.json({
      graduated: graduated.map(({ id, full_name, matric_no }) => ({ id, full_name, matric_no })),
      remaining: remaining.map(({ id, full_name, matric_no, passed, total }) => ({
        id,
        full_name,
        matric_no,
        passed,
        total,
      })),
    })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
}

export const exportSetReportXlsx = async (req, res, next) => {
  try {
    const setId = parseId(req.params.id, 'set id')
    const { set, courses, members } = await buildSetDetail(setId)
    const now = new Date()

    const graduatesRows = [
      ['Grace Theological Seminary', '', '', '', '', '', '', ''],
      [`Graduation Set Report — ${set.name}`, '', '', '', '', '', '', ''],
      [`Generated: ${now.toLocaleString()}`, '', '', '', '', '', '', ''],
      [`Graduation date: ${formatDate(set.graduation_date) || 'Not set'}`, '', '', '', '', '', '', ''],
      [],
      ['S/N', 'Matric No', 'Full Name', 'Email', 'Batch', 'Status', 'Courses Passed (x of y)', 'Progress %'],
      ...members.map((member, index) => [
        index + 1,
        member.matric_no || '',
        member.full_name,
        member.email || '',
        member.cohort_name || '',
        member.status,
        `${member.passed} of ${member.total}`,
        member.completion_pct,
      ]),
      [],
      [
        `Total: ${members.length} student(s)`,
        '',
        '',
        '',
        '',
        '',
        `Passed: ${members.reduce((sum, member) => sum + member.passed, 0)}`,
        '',
      ],
    ]

    const takenRows = [
      ['Courses Taken', '', '', '', '', '', ''],
      [`Generated: ${now.toLocaleString()}`, '', '', '', '', '', ''],
      [],
      ['S/N', 'Matric No', 'Full Name', 'Course Code', 'Course Title', 'Result', 'Score'],
    ]
    let sn = 0
    for (const member of members) {
      for (const row of buildTakenRows(courses, member.results)) {
        sn++
        takenRows.push([sn, member.matric_no || '', member.full_name, ...row])
      }
    }

    const wb = XLSX.utils.book_new()

    const ws1 = XLSX.utils.aoa_to_sheet(graduatesRows)
    ws1['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 7 } },
    ]
    ws1['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 28 }, { wch: 30 }, { wch: 18 }, { wch: 13 }, { wch: 22 }, { wch: 11 }]
    XLSX.utils.book_append_sheet(wb, ws1, 'Graduates')

    const ws2 = XLSX.utils.aoa_to_sheet(takenRows)
    ws2['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
    ]
    ws2['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 30 }, { wch: 13 }, { wch: 9 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Courses Taken')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName(set.name)}-graduation-report.xlsx"`)
    res.send(buffer)
  } catch (error) {
    next(error)
  }
}

export const exportSetReportPdf = async (req, res, next) => {
  try {
    const setId = parseId(req.params.id, 'set id')
    const { set, courses, members } = await buildSetDetail(setId)
    const now = new Date()

    const graduatesRows = {
      columns: [
        { key: 'sn', label: 'S/N', width: 30, align: 'right' },
        { key: 'matric', label: 'Matric No', width: 70 },
        { key: 'name', label: 'Full Name', width: 130 },
        { key: 'email', label: 'Email', width: 150 },
        { key: 'batch', label: 'Batch', width: 90 },
        { key: 'status', label: 'Status', width: 70 },
        { key: 'passed', label: 'Courses Passed', width: 85, align: 'center' },
        { key: 'progress', label: 'Progress %', width: 60, align: 'right' },
      ],
      rows: members.map((member, index) => [
        index + 1,
        member.matric_no || '',
        member.full_name,
        member.email || '',
        member.cohort_name || '',
        member.status,
        `${member.passed} of ${member.total}`,
        `${member.completion_pct}%`,
      ]),
    }

    const takenGroups = members
      .map((member) => ({
        name: member.full_name,
        matricNo: member.matric_no || '',
        batch: member.cohort_name || '',
        rows: buildTakenRows(courses, member.results),
      }))
      .filter((group) => group.rows.length)

    drawReportPdf(res, {
      title: `Graduation Set Report — ${set.name}`,
      filename: `${safeFileName(set.name)}-graduation-report.pdf`,
      subtitleLines: [
        `Generated: ${now.toLocaleString()}`,
        set.graduation_date ? `Graduation date: ${formatDate(set.graduation_date)}` : null,
        `Set status: ${set.status}`,
      ].filter(Boolean),
      stats: [
        `Graduates: ${members.length}`,
        `Courses: ${courses.length}`,
        `Passed: ${members.reduce((sum, member) => sum + member.passed, 0)}`,
      ],
      graduatesRows,
      takenGroups,
    })
  } catch (error) {
    next(error)
  }
}
