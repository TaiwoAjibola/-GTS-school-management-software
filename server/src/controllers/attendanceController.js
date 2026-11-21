import { query } from '../db/pool.js'
import { httpError } from '../utils/httpError.js'
import { closeExpiredAttendanceSessions, getActiveSessionByCourse } from '../services/attendanceService.js'
import { getEligibilityForStudentInCourse } from '../services/eligibilityService.js'
import { getJoinSignature } from '../services/zoomSdkSignatureService.js'

const isActiveLiveWindow = (startTime, endTime) => {
  const now = Date.now()
  const start = startTime ? new Date(startTime).getTime() : null
  const end = endTime ? new Date(endTime).getTime() : null
  if (start === null || start === undefined) return true
  if (end === null || end === undefined) return now >= start
  return now >= start && now <= end
}

const classLiveStatus = (session) => {
  if (!session) return null
  const inWindow = isActiveLiveWindow(session.start_time, session.end_time)
  return {
    sessionId: session.id,
    isLive: inWindow,
    class_mode: session.class_mode || null,
    classMode: session.class_mode || null,
    zoom_meeting_number: session.zoom_meeting_number || null,
    zoomMeetingNumber: session.zoom_meeting_number || null,
    zoom_passcode: session.zoom_passcode || null,
    zoomPasscode: session.zoom_passcode || null,
    start_time: session.start_time || null,
    end_time: session.end_time || null,
    is_active: session.is_active,
  }
}

const insertAttendanceRecord = async ({ sessionId, studentId }) => {
  const duplicate = await query(
    'SELECT id FROM attendance_records WHERE session_id = $1 AND student_id = $2',
    [sessionId, studentId]
  )

  if (duplicate.rows.length) {
    throw httpError(409, 'Attendance already marked')
  }

  await query(
    `INSERT INTO attendance_records (session_id, student_id)
     VALUES ($1, $2)`,
    [sessionId, studentId]
  )
}

export const startAttendanceSession = async (req, res, next) => {
  try {
    const { courseId, classNumber, startTime, endTime, classMode, secondaryLecturerId, secondaryLecturerName, lecturerNotes, meetLink, zoomMeetingNumber, zoomPasscode } = req.body
    if (!courseId || !classNumber || !startTime || !endTime) {
      throw httpError(400, 'courseId, classNumber, startTime, and endTime are required')
    }

    const start = new Date(startTime)
    const end = new Date(endTime)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw httpError(400, 'Invalid time format for startTime or endTime')
    }

    if (end <= start) {
      throw httpError(400, 'endTime must be after startTime')
    }

    const courseResult = await query('SELECT duration_weeks, meet_link, class_day, class_time FROM courses WHERE id = $1', [courseId])
    const course = courseResult.rows[0]
    if (!course) {
      throw httpError(404, 'Course not found')
    }

    if (Number(classNumber) < 1 || Number(classNumber) > Number(course.duration_weeks)) {
      throw httpError(400, `classNumber must be between 1 and ${course.duration_weeks}`)
    }

    const mode = classMode || 'physical'
    if (!['physical', 'online'].includes(mode)) throw httpError(400, 'classMode must be physical or online')
    if (mode === 'online' && !zoomMeetingNumber) throw httpError(400, 'zoomMeetingNumber is required for online classes')

    await closeExpiredAttendanceSessions()

    const existing = await getActiveSessionByCourse(courseId)
    if (existing) {
      throw httpError(409, 'An active attendance session already exists for this course')
    }

    const result = await query(
      `INSERT INTO attendance_sessions (course_id, class_number, start_time, end_time, is_active, created_by, secondary_lecturer_id, secondary_lecturer_name, lecturer_notes, meet_link, class_mode, zoom_meeting_number, zoom_passcode)
       VALUES ($1, $2, $3, $4, TRUE, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [courseId, Number(classNumber), start.toISOString(), end.toISOString(), req.user.userId, secondaryLecturerId || null, secondaryLecturerName || null, lecturerNotes || null, meetLink || course.meet_link || null, mode, mode === 'online' ? (zoomMeetingNumber || null) : null, mode === 'online' ? (zoomPasscode || null) : null]
    )

    const session = result.rows[0]
    if (mode === 'online') {
      await query('UPDATE attendance_sessions SET is_live = TRUE WHERE id = $1', [session.id])
    }

    res.status(201).json(session)
  } catch (error) {
    next(error)
  }
}

export const startLiveAttendance = async (req, res, next) => {
  try {
    const { courseId, classNumber, startTime, endTime, classMode, secondaryLecturerId, lecturerNotes, zoomMeetingNumber, zoomPasscode } = req.body
    if (!courseId || !classNumber || !startTime || !endTime) {
      throw httpError(400, 'courseId, classNumber, startTime, and endTime are required')
    }

    const start = new Date(startTime)
    const end = new Date(endTime)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw httpError(400, 'Invalid time format for startTime or endTime')
    }
    if (end <= start) throw httpError(400, 'endTime must be after startTime')

    const courseResult = await query('SELECT duration_weeks, meet_link, zoom_meeting_number, zoom_meeting_name FROM courses WHERE id = $1', [courseId])
    const course = courseResult.rows[0]
    if (!course) throw httpError(404, 'Course not found')

    if (Number(classNumber) < 1 || Number(classNumber) > Number(course.duration_weeks)) {
      throw httpError(400, `classNumber must be between 1 and ${course.duration_weeks}`)
    }

    const mode = classMode || 'physical'
    if (!['physical', 'online'].includes(mode)) throw httpError(400, 'classMode must be physical or online')
    if (mode === 'online' && !zoomMeetingNumber) throw httpError(400, 'zoomMeetingNumber is required for online classes')

    await closeExpiredAttendanceSessions()

    const existing = await getActiveSessionByCourse(courseId)
    if (existing) {
      throw httpError(409, 'An active attendance session already exists for this course')
    }

    const now = new Date()
    const session = await query(
      `INSERT INTO attendance_sessions (course_id, class_number, start_time, end_time, is_active, created_by, secondary_lecturer_id, lecturer_notes, class_mode, zoom_meeting_number, zoom_passcode)
       VALUES ($1, $2, $3, $4, TRUE, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, class_number, is_live`,
      [courseId, Number(classNumber), start.toISOString(), end.toISOString(), req.user.userId, secondaryLecturerId || null, lecturerNotes || null, mode, mode === 'online' ? (zoomMeetingNumber || course.zoom_meeting_number || null) : null, mode === 'online' ? (zoomPasscode || null) : null]
    )
    .then((res) => res.rows[0])

    const fullSession = (await query('SELECT * FROM attendance_sessions WHERE id = $1', [session.id])).rows[0]


    const liveStatus = classLiveStatus(fullSession)
    const lmsPresentCount = await query(
      `SELECT COUNT(DISTINCT student_id)::int AS count
       FROM attendance_records
       WHERE session_id = $1 AND marked_by = 'lms_join'`,
      [session.id]
    )
    liveStatus.lms_present_count = Number(lmsPresentCount.rows[0].count)

    res.status(201).json({
      ...fullSession,
      ...liveStatus,
      attendanceSessionId: fullSession.id,
      sessionId: fullSession.id,
      courseId: courseId,
      classNumber: fullSession.class_number,
    })
  } catch (error) {
    next(error)
  }
}

export const getActiveLiveClass = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    const session = await getActiveSessionByCourse(courseId)
    if (!session) return res.json({ session: null })
    res.json({ session: session })
  } catch (error) {
    next(error)
  }
}

export const getLiveClassJoinSignature = async (req, res, next) => {
  try {
    const sessionId = Number(req.params.sessionId)
    const courseId = Number(req.query.courseId || null)
    const session = sessionId
      ? (await query('SELECT * FROM attendance_sessions WHERE id = $1', [sessionId])).rows[0]
      : await getActiveSessionByCourse(courseId)

    if (!session) throw httpError(404, 'No active live class found')

    const enrolled = await query(
      `SELECT s.user_id
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       WHERE e.course_id = $1 AND s.user_id = $2 AND e.status = 'active'
       LIMIT 1`,
      [session.course_id, req.user.userId]
    )
    if (!enrolled.rows.length) throw httpError(404, 'Student is not enrolled in this course')

    const inWindow = isActiveLiveWindow(session.start_time, session.end_time)
    if (!session.is_active || session.class_mode !== 'online' || !inWindow) {
      throw httpError(400, 'Live class is not active or is physical')
    }

    const zoomUser = (await query('SELECT full_name FROM users WHERE id = $1', [req.user.userId])).rows[0]
    if (!zoomUser?.full_name) throw httpError(500, 'Student profile not found')

    const userName = zoomUser.full_name
    const meetingNumber = session.zoom_meeting_number
    const meetingRole = 'participant'
    const signature = await getJoinSignature({ meetingNumber, userName, meetingRole })

    // Long-lived typing file
    await query(
      `INSERT INTO attendance_records (session_id, student_id, marked_by)
       SELECT $1, s.id, 'lms_join'
       FROM students s WHERE s.user_id = $2 LIMIT 1
       ON CONFLICT (session_id, student_id)
       DO UPDATE SET marked_by = 'lms_join'`,
      [session.id, req.user.userId]
    )

    res.json({
      ...classLiveStatus(session),
      meetingNumber,
      meetingRole,
      password: session.zoom_passcode || null,
      userName,
      signature,
    })
  } catch (error) {
    next(error)
  }
}

export const markLmsJoin = async (req, res, next) => {
  try {
    const { courseId, classNumber } = req.body
    if (!courseId) throw httpError(400, 'courseId is required')

    const student = (await query('SELECT id FROM students WHERE user_id = $1', [req.user.userId])).rows[0]
    if (!student) throw httpError(404, 'Student profile not found')

    const session = await getActiveSessionByCourse(courseId, classNumber || null)
    if (!session) throw httpError(400, 'No active attendance session')

    const inWindow = isActiveLiveWindow(session.start_time, session.end_time)
    if (!session.is_active || !inWindow) throw httpError(400, 'Live class is not active')

    // Presence after 60 minutes: count from first recorded join.
    const first = await query(
      `SELECT MIN(marked_at) AS first_at FROM attendance_records
       WHERE session_id = $1 AND student_id = $2`,
      [session.id, student.id]
    )
    const firstAt = first.rows[0]?.first_at
    if (!firstAt) {
      // Long-lived typing file. New query through upsert? no record yet.
      await query(
        `INSERT INTO attendance_records (session_id, student_id, marked_by)
         VALUES ($1, $2, 'lms_join')
         ON CONFLICT (session_id, student_id) DO NOTHING`,
        [session.id, student.id]
      )
      res.json({ present: true, presence: 0 })
      return
    }

    const presenceMinutes = (Date.now() - new Date(firstAt).getTime()) / 60000
    if (presenceMinutes < 60) {
      res.json({ present: false, presence: presenceMinutes })
      return
    }

    await query(
      `INSERT INTO attendance_records (session_id, student_id, marked_by)
       VALUES ($1, $2, 'lms_join')
       ON CONFLICT (session_id, student_id)
       DO UPDATE SET marked_by = 'lms_join'`,
      [session.id, student.id]
    )

    res.json({ present: true, presence: presenceMinutes })
  } catch (error) {
    next(error)
  }
}

export const extendLiveAttendance = async (req, res, next) => {
  try {
    const { courseId, classNumber, endTime } = req.body
    const session = await getActiveSessionByCourse(courseId, classNumber || null)
    if (!session) throw httpError(400, 'No active attendance session')
    if (!endTime) throw httpError(400, 'endTime is required')

    const end = new Date(endTime)
    if (isNaN(end.getTime())) throw httpError(400, 'Invalid endTime')

    await query(
      `UPDATE attendance_sessions SET end_time = $2 WHERE id = $1`,
      [session.id, end.toISOString()]
    )

    res.json({ message: 'Live class extended', id: session.id, end_time: end.toISOString() })
  } catch (error) {
    next(error)
  }
}

export const getAttendanceSessionLiveStatus = async (req, res, next) => {
  try {
    const sessionId = Number(req.params.sessionId)
    if (!sessionId) throw httpError(400, 'Invalid sessionId')

    const session = (
      await query('SELECT id, course_id, class_number FROM attendance_sessions WHERE id = $1', [sessionId])
    ).rows[0]
    if (!session) throw httpError(404, 'Session not found')

    const liveStatus = classLiveStatus(session)
    if (liveStatus) {
      const lmsPresentCount = await query(
        `SELECT COUNT(DISTINCT student_id)::int AS count
         FROM attendance_records
         WHERE session_id = $1 AND marked_by = 'lms_join'
           AND marked_at >= (NOW() - INTERVAL '15 minutes')`,
        [sessionId]
      )
      liveStatus.lms_present_count = Number(lmsPresentCount.rows[0].count)
    }

    res.json(liveStatus)
  } catch (error) {
    next(error)
  }
}

export const getCourseAttendanceStatus = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    const classNumber = Number(req.query.classNumber || 0)
    await closeExpiredAttendanceSessions()

    const activeSession = classNumber
      ? await getActiveSessionByCourse(courseId, classNumber)
      : await getActiveSessionByCourse(courseId)

    const classSession = classNumber
      ? await query(
          `SELECT *
           FROM attendance_sessions
           WHERE course_id = $1 AND class_number = $2
           ORDER BY created_at DESC
           LIMIT 1`,
          [courseId, classNumber]
        )
      : { rows: [] }

    const existingClassSession = classSession.rows[0] || null

    if (!activeSession && !existingClassSession) {
      return res.json({
        activeSession: null,
        existingClassSession: null,
        attendeeCount: 0,
        canMark: false,
        canJoin: false,
        classCompleted: false,
        isLive: false,
        live: null,
        lms_present_count: 0,
        activeSessionId: null,
        sessionId: null,
        attendanceSessionId: null,
        attendanceSession: null,
        classNumber: classNumber || null,
        startTime: null,
        endTime: null,
        mode: null,
        meetLink: null,
        zoomMeetingNumber: null,
        zoomPasscode: null,
      })
    }

    const targetSession = activeSession || existingClassSession

    const countResult = await query(
      `SELECT COUNT(*)::int AS attendees
       FROM attendance_records
       WHERE session_id = $1`,
      [targetSession.id]
    )

    const liveStatus = classLiveStatus(activeSession || existingClassSession)

    let lmsPresentCount = 0
    if (liveStatus) {
      try {
        const lmsPresentResult = await query(
          `SELECT COUNT(DISTINCT student_id)::int AS count
           FROM attendance_records
           WHERE session_id = $1 AND marked_by = 'lms_join'
             AND marked_at >= (NOW() - INTERVAL '15 minutes')`,
          [liveStatus.sessionId]
        )
        lmsPresentCount = Number(lmsPresentResult.rows[0].count)
      } catch {
        try {
          const fallback = await query(
            `SELECT COUNT(DISTINCT student_id)::int AS count
             FROM attendance_records
             WHERE session_id = $1`,
            [liveStatus.sessionId]
          )
          lmsPresentCount = Number(fallback.rows[0].count)
        } catch {
          lmsPresentCount = 0
        }
      }
    }

    res.json({
      activeSession,
      existingClassSession,
      attendeeCount: Number(countResult.rows[0].attendees),
      canMark: Boolean(activeSession),
      canJoin: Boolean(
        activeSession?.is_active &&
          activeSession.class_mode === 'online' &&
          isActiveLiveWindow(activeSession.start_time, activeSession.end_time)
      ),
      classCompleted: Boolean(existingClassSession && !existingClassSession.is_active),
      isLive: Boolean(liveStatus?.isLive),
      live: liveStatus,
      lms_present_count: lmsPresentCount,
      activeSessionId: (activeSession || existingClassSession)?.id || null,
      sessionId: (activeSession || existingClassSession)?.id || null,
      attendanceSessionId: (activeSession || existingClassSession)?.id || null,
      attendanceSession: (activeSession || existingClassSession) || null,
      classNumber: activeSession?.class_number ?? existingClassSession?.class_number ?? classNumber,
      startTime: (activeSession || existingClassSession)?.start_time || null,
      endTime: (activeSession || existingClassSession)?.end_time || null,
      mode: (activeSession || existingClassSession)?.class_mode || null,
      meetLink: (activeSession || existingClassSession)?.meet_link || null,
      zoomMeetingNumber: (activeSession || existingClassSession)?.zoom_meeting_number || null,
      zoomPasscode: (activeSession || existingClassSession)?.zoom_passcode || null,
    })
  } catch (error) {
    next(error)
  }
}

export const closeAttendanceSession = async (req, res, next) => {
  try {
    const { courseId, classNumber } = req.body

    if (!courseId) {
      throw httpError(400, 'courseId is required')
    }

    await closeExpiredAttendanceSessions()
    const activeSession = classNumber
      ? await getActiveSessionByCourse(courseId, classNumber)
      : await getActiveSessionByCourse(courseId)

    if (!activeSession) {
      throw httpError(400, 'No active attendance session')
    }

    await query(
      `UPDATE attendance_sessions
       SET is_active = FALSE, end_time = NOW()
       WHERE id = $1`,
      [activeSession.id]
    )

    res.json({ message: 'Attendance session closed' })
  } catch (error) {
    next(error)
  }
}

export const getCourseLiveClasses = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    if (!Number.isFinite(courseId)) throw httpError(400, 'Invalid courseId')

    const result = await query(
      `SELECT id, course_id, class_number, date, start_time, end_time, start_at, end_at,
              class_mode, zoom_meeting_number, zoom_passcode, attendance_session_id, created_at
       FROM live_classes
       WHERE course_id = $1
       ORDER BY class_number ASC`,
      [courseId]
    )

    res.json(result.rows)
  } catch (error) {
    next(error)
  }
}

export const upsertCourseLiveClasses = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    if (!Number.isFinite(courseId)) throw httpError(400, 'Invalid courseId')

    const items = Array.isArray(req.body?.classes) ? req.body.classes : (Array.isArray(req.body) ? req.body : [])
    if (!items.length) throw httpError(400, 'classes array is required')

    const saved = []
    for (const item of items) {
      const classNumber = Number(item.class_number ?? item.classNumber)
      if (!Number.isInteger(classNumber) || classNumber < 1 || classNumber > 6) {
        throw httpError(400, 'classNumber must be between 1 and 6')
      }

      const classMode = item.class_mode ?? item.classMode ?? 'physical'
      if (!['physical', 'online'].includes(classMode)) {
        throw httpError(400, 'classMode must be physical or online')
      }

      const startAtRaw = item.start_at ?? item.startAt ?? null
      const endAtRaw = item.end_at ?? item.endAt ?? null
      const startAt = startAtRaw ? new Date(startAtRaw) : null
      const endAt = endAtRaw ? new Date(endAtRaw) : null
      if (startAtRaw && Number.isNaN(startAt.getTime())) throw httpError(400, 'Invalid start_at')
      if (endAtRaw && Number.isNaN(endAt.getTime())) throw httpError(400, 'Invalid end_at')
      if (startAt && endAt && endAt <= startAt) throw httpError(400, 'end_at must be after start_at')

      const zoomMeetingNumber = item.zoom_meeting_number ?? item.zoomMeetingNumber ?? null
      const zoomPasscode = item.zoom_passcode ?? item.zoomPasscode ?? null
      const hasScheduleWindow = Boolean(startAtRaw || endAtRaw)
      if (classMode === 'online' && hasScheduleWindow && !zoomMeetingNumber) {
        throw httpError(400, `Zoom meeting number is required for online class ${classNumber} when a time window is set`)
      }

      const result = await query(
        `INSERT INTO live_classes
          (course_id, class_number, start_at, end_at, class_mode, zoom_meeting_number, zoom_passcode)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (course_id, class_number)
         DO UPDATE SET
           start_at = EXCLUDED.start_at,
           end_at = EXCLUDED.end_at,
           class_mode = EXCLUDED.class_mode,
           zoom_meeting_number = EXCLUDED.zoom_meeting_number,
           zoom_passcode = EXCLUDED.zoom_passcode
         RETURNING id, course_id, class_number, start_at, end_at, class_mode, zoom_meeting_number, zoom_passcode, attendance_session_id`,
        [courseId, classNumber, startAt ? startAt.toISOString() : null, endAt ? endAt.toISOString() : null, classMode, classMode === 'online' ? zoomMeetingNumber : null, classMode === 'online' ? zoomPasscode : null]
      )
      saved.push(result.rows[0])
    }

    res.json({ classes: saved })
  } catch (error) {
    next(error)
  }
}

export const getCourseAttendanceHistory = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)

    try {
      const result = await query(
        `SELECT s.id,
                s.class_number,
                s.class_mode,
                s.zoom_meeting_number,
                s.zoom_passcode,
                s.is_live,
                s.start_time,
                s.end_time,
                s.is_active,
                COUNT(DISTINCT CASE WHEN ar.marked_by = 'lms_join' THEN ar.student_id END)::int AS lms_present_count,
                COALESCE(COUNT(ar.id), 0)::int AS attendees
         FROM attendance_sessions s
         LEFT JOIN attendance_records ar ON ar.session_id = s.id
         WHERE s.course_id = $1
         GROUP BY s.id
         ORDER BY s.class_number ASC`,
        [courseId]
      )
      return res.json(result.rows)
    } catch {
      const fallback = await query(
        `SELECT s.id,
                s.class_number,
                s.start_time,
                s.end_time,
                s.is_active,
                COALESCE(COUNT(ar.id), 0)::int AS attendees
         FROM attendance_sessions s
         LEFT JOIN attendance_records ar ON ar.session_id = s.id
         WHERE s.course_id = $1
         GROUP BY s.id
         ORDER BY s.class_number ASC`,
        [courseId]
      )
      return res.json(fallback.rows)
    }
  } catch (error) {
    next(error)
  }
}

export const getCourseAttendanceStudentSummary = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    const classNumber = Number(req.query.classNumber || 0)

    if (classNumber) {
      const sessionResult = await query(
        `SELECT id, class_number
         FROM attendance_sessions
         WHERE course_id = $1 AND class_number = $2
         LIMIT 1`,
        [courseId, classNumber]
      )

      const session = sessionResult.rows[0]
      if (!session) {
        const emptyResult = await query(
          `SELECT s.id AS student_id,
                  s.matric_no,
                  u.full_name,
                  u.email
           FROM enrollments e
           JOIN students s ON s.id = e.student_id
           JOIN users u ON u.id = s.user_id
           WHERE e.course_id = $1
           ORDER BY u.full_name ASC`,
          [courseId]
        )

        return res.json(
          emptyResult.rows.map((row) => ({
            ...row,
            total_sessions: 0,
            present_count: 0,
            absent_count: 0,
            attendance_rate: 0,
            eligible: false,
          }))
        )
      }

      const classSummaryResult = await query(
        `SELECT s.id AS student_id,
                s.matric_no,
                u.full_name,
                u.email,
                CASE WHEN ar.id IS NOT NULL THEN 1 ELSE 0 END AS present_count,
                CASE WHEN ar.id IS NOT NULL THEN 0 ELSE 1 END AS absent_count
         FROM enrollments e
         JOIN students s ON s.id = e.student_id
         JOIN users u ON u.id = s.user_id
         LEFT JOIN attendance_records ar
           ON ar.student_id = s.id AND ar.session_id = $2
         WHERE e.course_id = $1
         ORDER BY u.full_name ASC`,
        [courseId, session.id]
      )

      return res.json(
        classSummaryResult.rows.map((row) => ({
          ...row,
          total_sessions: 1,
          attendance_rate: Number(row.present_count) ? 100 : 0,
          eligible: Boolean(Number(row.present_count)),
        }))
      )
    }

    const result = await query(
      `SELECT s.id AS student_id,
              s.matric_no,
              u.full_name,
              u.email,
              c.min_attendance_required,
              COUNT(DISTINCT ses.id)::int AS total_sessions,
              COUNT(ar.id)::int AS present_count,
              (COUNT(DISTINCT ses.id) - COUNT(ar.id))::int AS absent_count,
              CASE
                WHEN COUNT(DISTINCT ses.id) > 0
                THEN ROUND((COUNT(ar.id)::float / COUNT(DISTINCT ses.id)::float) * 100)::int
                ELSE 0
              END AS attendance_rate,
              CASE
                WHEN COUNT(ar.id) >= c.min_attendance_required THEN true
                ELSE false
              END AS eligible
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN users u ON u.id = s.user_id
       JOIN courses c ON c.id = e.course_id
       LEFT JOIN attendance_sessions ses ON ses.course_id = c.id
       LEFT JOIN attendance_records ar
         ON ar.session_id = ses.id AND ar.student_id = s.id
       WHERE e.course_id = $1
       GROUP BY s.id, u.id, c.id
       ORDER BY u.full_name ASC`,
      [courseId]
    )

    const formatted = result.rows.map((row) => {
      const total = Number(row.total_sessions)
      const present = Number(row.present_count)
      const absent = Math.max(0, total - present)
      const rate = total > 0 ? Math.round((present / total) * 100) : 0
      return {
        ...row,
        total_sessions: total,
        present_count: present,
        absent_count: absent,
        attendance_rate: rate,
        eligible: present >= Number(row.min_attendance_required),
      }
    })

    res.json(formatted)
  } catch (error) {
    next(error)
  }
}

export const markAttendance = async (req, res, next) => {
  try {
    const { courseId, classNumber } = req.body
    if (!courseId) {
      throw httpError(400, 'courseId is required')
    }

    const studentResult = await query('SELECT id FROM students WHERE user_id = $1', [req.user.userId])
    const student = studentResult.rows[0]

    if (!student) {
      throw httpError(404, 'Student profile not found')
    }

    await closeExpiredAttendanceSessions()
    const activeSession = classNumber
      ? await getActiveSessionByCourse(courseId, classNumber)
      : await getActiveSessionByCourse(courseId)

    if (!activeSession) {
      throw httpError(400, 'No active attendance session')
    }

    await insertAttendanceRecord({ sessionId: activeSession.id, studentId: student.id })

    res.status(201).json({ message: 'Attendance marked successfully' })
  } catch (error) {
    next(error)
  }
}

export const manualMarkAttendance = async (req, res, next) => {
  try {
    const { courseId, studentId, classNumber } = req.body

    if (!courseId || !studentId) {
      throw httpError(400, 'courseId and studentId are required')
    }

    await closeExpiredAttendanceSessions()
    const activeSession = classNumber
      ? await getActiveSessionByCourse(courseId, classNumber)
      : await getActiveSessionByCourse(courseId)

    if (!activeSession) {
      throw httpError(400, 'No active attendance session')
    }

    const enrollment = await query(
      'SELECT id FROM enrollments WHERE course_id = $1 AND student_id = $2',
      [courseId, studentId]
    )

    if (!enrollment.rows.length) {
      throw httpError(400, 'Student is not enrolled in this course')
    }

    await insertAttendanceRecord({ sessionId: activeSession.id, studentId: Number(studentId) })

    res.status(201).json({ message: 'Student marked present' })
  } catch (error) {
    next(error)
  }
}

export const getCourseAttendanceRoster = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    const classNumber = Number(req.query.classNumber || 0)
    await closeExpiredAttendanceSessions()

    const activeSession = classNumber
      ? await getActiveSessionByCourse(courseId, classNumber)
      : await getActiveSessionByCourse(courseId)

    const classSessionResult = classNumber
      ? await query(
          `SELECT *
           FROM attendance_sessions
           WHERE course_id = $1 AND class_number = $2
           ORDER BY created_at DESC
           LIMIT 1`,
          [courseId, classNumber]
        )
      : { rows: [] }

    const classSession = classSessionResult.rows[0] || activeSession
    const targetSessionId = activeSession?.id || classSession?.id || null

    const result = await query(
      `SELECT s.id AS student_id,
              s.matric_no,
              s.status,
              u.full_name,
              u.email,
              CASE
                WHEN $2::int IS NULL THEN FALSE
                WHEN ar.id IS NOT NULL THEN TRUE
                ELSE FALSE
              END AS present
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN attendance_records ar
         ON ar.student_id = s.id AND ar.session_id = $2
       WHERE e.course_id = $1
       ORDER BY u.full_name ASC`,
      [courseId, targetSessionId]
    )

    res.json({
      activeSession,
      classSession,
      canMark: Boolean(activeSession),
      roster: result.rows,
    })
  } catch (error) {
    next(error)
  }
}

export const getStudentAttendanceProgress = async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId)
    const studentResult = await query('SELECT id FROM students WHERE user_id = $1', [req.user.userId])

    const student = studentResult.rows[0]
    if (!student) {
      throw httpError(404, 'Student profile not found')
    }

    const eligibility = await getEligibilityForStudentInCourse(student.id, courseId)
    if (!eligibility) {
      throw httpError(404, 'Course not found')
    }

    res.json(eligibility)
  } catch (error) {
    next(error)
  }
}

export const startBatchAttendanceSession = async (req, res, next) => {
  try {
    const { batchId, durationMinutes } = req.body

    if (!batchId || !durationMinutes) {
      throw httpError(400, 'batchId and durationMinutes are required')
    }

    const batchResult = await query(
      `SELECT b.id, b.course_id, b.status
       FROM batches b
       WHERE b.id = $1`,
      [batchId]
    )
    const batch = batchResult.rows[0]
    if (!batch) {
      throw httpError(404, 'Batch not found')
    }

    if (batch.status !== 'ongoing') {
      throw httpError(400, 'Attendance can only be started for ongoing batch')
    }

    await closeExpiredAttendanceSessions()

    const existing = await query(
      `SELECT id
       FROM attendance_sessions
       WHERE batch_id = $1 AND is_active = TRUE
       LIMIT 1`,
      [batchId]
    )
    if (existing.rows.length) {
      throw httpError(409, 'An active attendance session already exists for this batch')
    }

    const classCountResult = await query(
      `SELECT COALESCE(MAX(class_number), 0)::int AS max_class
       FROM attendance_sessions
       WHERE batch_id = $1`,
      [batchId]
    )
    const nextClass = Number(classCountResult.rows[0].max_class) + 1

    const result = await query(
      `INSERT INTO attendance_sessions (course_id, batch_id, class_number, start_time, end_time, is_active, created_by)
       VALUES ($1, $2, $3, NOW(), NOW() + ($4 || ' minutes')::interval, TRUE, $5)
       RETURNING *`,
      [batch.course_id, batchId, nextClass, Number(durationMinutes), req.user.userId]
    )

    res.status(201).json(result.rows[0])
  } catch (error) {
    next(error)
  }
}

export const getBatchAttendanceStatus = async (req, res, next) => {
  try {
    const batchId = Number(req.params.batchId)
    await closeExpiredAttendanceSessions()

    const activeResult = await query(
      `SELECT * FROM attendance_sessions
       WHERE batch_id = $1 AND is_active = TRUE
       ORDER BY created_at DESC
       LIMIT 1`,
      [batchId]
    )
    const activeSession = activeResult.rows[0] || null

    if (!activeSession) {
      return res.json({ activeSession: null, attendeeCount: 0 })
    }

    const countResult = await query(
      `SELECT COUNT(*)::int AS attendees
       FROM attendance_records
       WHERE session_id = $1`,
      [activeSession.id]
    )

    res.json({
      activeSession,
      attendeeCount: Number(countResult.rows[0].attendees),
    })
  } catch (error) {
    next(error)
  }
}

export const closeBatchAttendanceSession = async (req, res, next) => {
  try {
    const { batchId } = req.body

    if (!batchId) {
      throw httpError(400, 'batchId is required')
    }

    await closeExpiredAttendanceSessions()
    const activeResult = await query(
      `SELECT * FROM attendance_sessions
       WHERE batch_id = $1 AND is_active = TRUE
       ORDER BY created_at DESC
       LIMIT 1`,
      [batchId]
    )
    const activeSession = activeResult.rows[0]

    if (!activeSession) {
      throw httpError(400, 'No active attendance session for batch')
    }

    await query(
      `UPDATE attendance_sessions
       SET is_active = FALSE, end_time = NOW()
       WHERE id = $1`,
      [activeSession.id]
    )

    res.json({ message: 'Batch attendance session closed' })
  } catch (error) {
    next(error)
  }
}

export const manualMarkBatchAttendance = async (req, res, next) => {
  try {
    const { batchId, studentId } = req.body
    if (!batchId || !studentId) {
      throw httpError(400, 'batchId and studentId are required')
    }

    await closeExpiredAttendanceSessions()
    const activeResult = await query(
      `SELECT * FROM attendance_sessions
       WHERE batch_id = $1 AND is_active = TRUE
       ORDER BY created_at DESC
       LIMIT 1`,
      [batchId]
    )
    const activeSession = activeResult.rows[0]

    if (!activeSession) {
      throw httpError(400, 'No active attendance session')
    }

    const enrollment = await query(
      `SELECT id FROM enrollments WHERE batch_id = $1 AND student_id = $2 AND status = 'active'`,
      [batchId, studentId]
    )
    if (!enrollment.rows.length) {
      throw httpError(400, 'Student is not actively enrolled in this batch')
    }

    await insertAttendanceRecord({ sessionId: activeSession.id, studentId: Number(studentId) })
    res.status(201).json({ message: 'Student marked present in batch session' })
  } catch (error) {
    next(error)
  }
}

// ── Edit a past attendance session ──────────────────────────────────────────
// GET /attendance/session/:sessionId/roster
export const getSessionRoster = async (req, res, next) => {
  try {
    const sessionId = Number(req.params.sessionId)
    if (!sessionId) throw httpError(400, 'Invalid sessionId')

    const sessionResult = await query(
      `SELECT s.id, s.course_id, s.class_number, s.start_time, s.end_time, s.is_active
       FROM attendance_sessions s WHERE s.id = $1`,
      [sessionId]
    )
    const session = sessionResult.rows[0]
    if (!session) throw httpError(404, 'Session not found')

    const roster = await query(
      `SELECT s.id AS student_id,
              s.matric_no,
              s.status,
              u.full_name,
              CASE WHEN ar.id IS NOT NULL THEN TRUE ELSE FALSE END AS present,
              ar.id AS record_id
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN attendance_records ar
         ON ar.student_id = s.id AND ar.session_id = $1
       WHERE e.course_id = $2
       ORDER BY u.full_name ASC`,
      [sessionId, session.course_id]
    )

    res.json({ session, roster: roster.rows })
  } catch (error) {
    next(error)
  }
}

// PATCH /attendance/session/:sessionId/toggle
// body: { studentId }
// Toggles a student present/absent in a closed (or open) session.
export const editSessionAttendance = async (req, res, next) => {
  try {
    const sessionId = Number(req.params.sessionId)
    const studentId = Number(req.body.studentId)
    if (!sessionId || !studentId) throw httpError(400, 'sessionId and studentId are required')

    const sessionResult = await query(
      `SELECT id, course_id FROM attendance_sessions WHERE id = $1`, [sessionId]
    )
    const session = sessionResult.rows[0]
    if (!session) throw httpError(404, 'Session not found')

    // Verify student is enrolled in the course
    const enrollment = await query(
      `SELECT id FROM enrollments WHERE course_id = $1 AND student_id = $2`,
      [session.course_id, studentId]
    )
    if (!enrollment.rows.length) throw httpError(400, 'Student is not enrolled in this course')

    const existing = await query(
      `SELECT id FROM attendance_records WHERE session_id = $1 AND student_id = $2`,
      [sessionId, studentId]
    )

    if (existing.rows.length) {
      // Currently present → mark absent (delete record)
      await query(`DELETE FROM attendance_records WHERE id = $1`, [existing.rows[0].id])
      res.json({ present: false })
    } else {
      // Currently absent → mark present (insert record)
      await query(
        `INSERT INTO attendance_records (session_id, student_id) VALUES ($1, $2)`,
        [sessionId, studentId]
      )
      res.json({ present: true })
    }
  } catch (error) {
    next(error)
  }
}

// DELETE /attendance/session/:sessionId
// body: { reason } — required, logged for audit trail
// Deletes session and all its records (cascade).
export const deleteAttendanceSession = async (req, res, next) => {
  try {
    const sessionId = Number(req.params.sessionId)
    if (!sessionId) throw httpError(400, 'Invalid sessionId')

    const { reason } = req.body
    if (!reason || !String(reason).trim()) {
      throw httpError(400, 'A reason is required to delete an attendance session')
    }

    const sessionResult = await query(
      `SELECT id, course_id, class_number FROM attendance_sessions WHERE id = $1`, [sessionId]
    )
    const session = sessionResult.rows[0]
    if (!session) throw httpError(404, 'Session not found')

    console.log(
      `[Attendance] Session ${sessionId} (Class ${session.class_number}, Course ${session.course_id}) ` +
      `deleted by user ${req.user.userId}. Reason: ${String(reason).trim()}`
    )

    // ON DELETE CASCADE removes all attendance_records automatically
    await query(`DELETE FROM attendance_sessions WHERE id = $1`, [sessionId])

    res.json({ message: 'Attendance session deleted' })
  } catch (error) {
    next(error)
  }
}
