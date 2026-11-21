import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, ClipboardCheck, GraduationCap, SquarePen, Calendar, Clock, Award, FileText, Layers, Sparkles, ExternalLink, ArrowUpRight, TrendingUp, Play, PlayCircle, Video, FolderOpen, Radio, Monitor } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import apiClient from '../api/client'
import { ZoomMtg } from '@zoom/meetingsdk'

const navItems = [
  { to: '/student/course', label: 'Course', icon: BookOpen },
  { to: '/student/assessments', label: 'Assessments', icon: SquarePen },
  { to: '/student/materials', label: 'Course Materials', icon: FolderOpen },
  { to: '/student/results', label: 'Results', icon: GraduationCap },
]

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5050'

const StudentDashboard = () => {
  const location = useLocation()
  const rawSection = location.pathname.split('/')[2] || 'course'
  const section = ({
    courses: 'course',
    course: 'course',
    assignments: 'assessments',
    assessments: 'assessments',
    materials: 'materials',
    results: 'results',
    attendance: 'course',
  })[rawSection] || 'course'

  const [courses, setCourses] = useState([])
  const [assignments, setAssignments] = useState([])
  const [exams, setExams] = useState([])
  const [results, setResults] = useState([])
  const [attendanceStates, setAttendanceStates] = useState({})
  const [progress, setProgress] = useState({})
  const [markedSessions, setMarkedSessions] = useState({})
  const [joinStates, setJoinStates] = useState({})
  const [joinLoading, setJoinLoading] = useState(false)
  const [joiningSession, setJoiningSession] = useState(null)
  const [zoomJoin, setZoomJoin] = useState(null)
  const [zoomJoinError, setZoomJoinError] = useState(null)
  const [courseMaterials, setCourseMaterials] = useState({})
  const [courseSessions, setCourseSessions] = useState({})

  const load = async () => {
    const [courseRes, assignmentRes, examRes, resultRes] = await Promise.all([
      apiClient.get('/courses/my-courses'),
      apiClient.get('/assignments/my'),
      apiClient.get('/exams/my').catch(() => ({ data: [] })),
      apiClient.get('/results/my'),
    ])

    setCourses(courseRes.data)
    setAssignments(assignmentRes.data)
    setExams(examRes.data)
    setResults(resultRes.data)

    const statusEntries = await Promise.all(
      courseRes.data.map(async (course) => {
        const [statusRes, progressRes, materialsRes, sessionsRes] = await Promise.all([
          apiClient.get(`/attendance/course/${course.id}/status`),
          apiClient.get(`/attendance/course/${course.id}/progress`),
          apiClient.get(`/student/courses/${course.id}/materials`).catch(() => ({ data: [] })),
          apiClient.get(`/student/courses/${course.id}/sessions`).catch(() => ({ data: [] })),
        ])
        return [course.id, { status: statusRes.data, progress: progressRes.data, materials: materialsRes.data, sessions: sessionsRes.data }]
      })
    )

    const nextStatuses = {}
    const nextProgress = {}
    const nextMaterials = {}
    const nextSessions = {}
    for (const [courseId, values] of statusEntries) {
      nextStatuses[courseId] = values.status
      nextProgress[courseId] = values.progress
      nextMaterials[courseId] = values.materials
      nextSessions[courseId] = values.sessions
    }
    setAttendanceStates(nextStatuses)
    setProgress(nextProgress)
    setCourseMaterials(nextMaterials)
    setCourseSessions(nextSessions)
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [])

  const markAttendance = async (courseId) => {
    await apiClient.post('/attendance/mark', { courseId })
    setMarkedSessions((prev) => ({ ...prev, [courseId]: true }))
    await load()
  }

  const isLiveClassActive = (status) => {
    const live = status?.live
    return Boolean(
      live && live.isLive && live.classMode === 'online' && live.zoomMeetingNumber
    )
  }

  const startZoomMeeting = async (joinData) => {
    const { signature, meetingNumber, password, userName } = joinData || {}
    if (!signature || !meetingNumber) {
      setZoomJoinError('Zoom join credentials unavailable')
      return
    }

    try {
      if (ZoomMtg?.setZoomJSLib) {
        ZoomMtg.setZoomJSLib('https://source.zoom.us/6.10.0/lib', '/av')
      }
      if (ZoomMtg?.preLoadWasm) {
        ZoomMtg.preLoadWasm()
      }
      if (ZoomMtg?.prepareWebSDK) {
        ZoomMtg.prepareWebSDK()
      }

      await ZoomMtg.init({
        leaveUrl: window.location.origin,
        success: () => setZoomJoin((prev) => ({ ...prev, status: 'inited' })),
        error: (error) => setZoomJoinError(error),
      })

      await ZoomMtg.join({
        meetingNumber,
        userName,
        passWord: password || '',
        signature,
        success: () => setZoomJoin((prev) => ({ ...prev, status: 'joined' })),
        error: (error) => setZoomJoinError(error),
      })
    } catch (error) {
      setZoomJoinError(error)
    }
  }

  const joinLiveClass = async (courseId, sessionId) => {
    setJoinLoading(true)
    setJoiningSession({ courseId, sessionId })
    setZoomJoinError(null)
    try {
      const signatureRes = await apiClient.get(`/attendance/live-class/${sessionId}/join-signature`, {
        params: { courseId },
      })
      const joinData = signatureRes.data
      setJoinStates((prev) => ({ ...prev, [`${courseId}:${sessionId}`]: joinData }))

      // Start presence after join; silent. If Zoom unavailable for now, still track presence.
      const markRes = await apiClient.post('/attendance/mark-lms-join', { courseId })
      setJoinStates((prev) => ({
        ...prev,
        [`${courseId}:${sessionId}`]: { ...joinData, present: markRes.data?.present, presence: markRes.data?.presence },
      }))
      await load()

      // Init + join via Zoom Meeting SDK using the LMS identity (full name).
      setZoomJoin({ ...joinData, courseId, sessionId })
      await startZoomMeeting(joinData)
    } catch (error) {
      console.error('[LiveClass] join failed', error)
      setZoomJoinError(error)
    } finally {
      setJoinLoading(false)
      setJoiningSession(null)
    }
  }

  const LiveJoinButton = ({ courseId, session }) => {
    const state = joinStates[`${courseId}:${session.sessionId}`]
    const present = Boolean(state?.present)
    const joining = joiningSession?.courseId === courseId && joiningSession?.sessionId === session.sessionId
    const zoomJoining = zoomJoin?.courseId === courseId && zoomJoin?.sessionId === session.sessionId && zoomJoin?.status !== 'joined'
    const zoomJoined = zoomJoin?.courseId === courseId && zoomJoin?.sessionId === session.sessionId && zoomJoin?.status === 'joined'

    return (
      <button
        onClick={() => joinLiveClass(courseId, session.sessionId)}
        disabled={joining || zoomJoining}
        className={`btn btn-sm lift inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition shadow-sm ${present ? 'bg-[#E0E7FF] !text-[#4F46E5] cursor-default' : 'btn btn-primary hover:bg-[#4338CA]'} ${joining || zoomJoining ? 'opacity-70' : ''}`}
        title={present ? 'Joined live class (attendance pending)' : `Join live class ${session.classMode}`}
      >
        {joining || zoomJoining ? (
          <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
        ) : present ? (
          <PlayCircle size={16} />
        ) : (
          <Play size={16} />
        )}
        {present ? 'In Class' : zoomJoining ? 'Joining…' : zoomJoined ? 'In Zoom' : 'Join'}
      </button>
    )
  }

  const attendanceSummary = useMemo(
    () =>
      courses.map((course) => {
        const status = attendanceStates[course.id] || {}
        const progressInfo = progress[course.id]
        const progressPct = progressInfo
          ? (progressInfo.attendanceCount / Math.max(progressInfo.minRequired, 1)) * 100
          : 0

        const session = status.live?.sessionId
          ? status.live
          : status.sessionId
            ? status.live
            : null

        const isLiveClass = status?.canJoin || (status?.isLive && status?.live?.classMode === 'online')

        return {
          course,
          status,
          progressInfo,
          progressPct,
          session: session || null,
          isLiveClass,
          materials: courseMaterials[course.id] || [],
          sessions: courseSessions[course.id] || [],
        }
      }),
    [courses, progress, attendanceStates, courseMaterials, courseSessions]
  )

  const activeCourse = useMemo(() => {
    if (!attendanceSummary.length) return null
    return attendanceSummary.find((item) => item.isLiveClass)
      || attendanceSummary.find((item) => item.status?.activeSession)
      || attendanceSummary[0]
  }, [attendanceSummary])

  const allMaterials = useMemo(
    () => attendanceSummary.flatMap((item) => (item.materials || []).map((m) => ({ ...m, course_title: item.course.title, course_id: item.course.id }))),
    [attendanceSummary]
  )

  const allAssessments = useMemo(() => {
    const a = (assignments || []).map((item) => ({ ...item, kind: 'assignment', kindLabel: 'Assignment', sortDate: item.due_date || item.created_at }))
    const e = (exams || []).map((item) => ({
      ...item,
      kind: item.exam_type || 'exam',
      kindLabel: item.exam_type === 'mcq' ? 'MCQ' : item.exam_type === 'paper' ? 'Paper' : item.exam_type === 'essay' ? 'Essay' : 'Exam',
      sortDate: item.due_date || item.created_at,
    }))
    return [...a, ...e].sort((x, y) => new Date(y.sortDate || 0).getTime() - new Date(x.sortDate || 0).getTime())
  }, [assignments, exams])

  const title = {
    course: 'My Course',
    assessments: 'Assessments',
    materials: 'Course Materials',
    results: 'Results',
  }[section] || 'Student Dashboard'

  return (
    <AppShell title={title} navItems={navItems}>
      <div className="h-full flex flex-col gap-4 overflow-hidden bg-[#F8FAFC] text-slate-900" style={{ fontFamily: 'var(--font-sans)' }}>

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-5 shadow-[0_2px_16px_rgba(15,23,42,0.06)] card-hover relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[3px] bg-[#4F46E5]" />
            <div className="flex items-start justify-between gap-2">
              <div className="h-11 w-11 rounded-xl bg-[#EEF2FF] border border-[#E0E7FF] flex items-center justify-center text-[#4F46E5]"><BookOpen size={18} /></div>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF2FF] border border-[#E0E7FF] px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] text-[#4F46E5]" style={{ fontFamily: 'var(--font-mono)' }}>ACTIVE</span>
            </div>
            <p className="mt-4 text-[11px] font-bold tracking-[0.16em] uppercase text-slate-400">Current Course</p>
            <p className="text-[18px] font-extrabold leading-tight tracking-tight text-slate-900 mt-1 line-clamp-2" style={{ fontFamily: 'var(--font-display)' }}>{activeCourse?.course?.title || 'No active course'}</p>
          </div>

          <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-5 shadow-[0_2px_16px_rgba(15,23,42,0.06)] card-hover relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[3px] bg-[#7C3AED]" />
            <div className="flex items-start justify-between gap-2">
              <div className="h-11 w-11 rounded-xl bg-[#F5F3FF] border border-[#EDE9FE] flex items-center justify-center text-[#7C3AED]"><SquarePen size={18} /></div>
              <span className="h-6 rounded-full bg-[#F5F3FF] border border-[#EDE9FE] px-2.5 inline-flex items-center text-[10px] font-bold tracking-[0.12em] text-[#7C3AED]" style={{ fontFamily: 'var(--font-mono)' }}>{allAssessments.length} TOTAL</span>
            </div>
            <p className="mt-4 text-[11px] font-bold tracking-[0.16em] uppercase text-slate-400">Assessments</p>
            <p className="text-[32px] font-extrabold leading-none tracking-tight text-slate-900 mt-1" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>{allAssessments.length}</p>
          </div>

          <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-5 shadow-[0_2px_16px_rgba(15,23,42,0.06)] card-hover relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[3px] bg-[#0891B2]" />
            <div className="flex items-start justify-between gap-2">
              <div className="h-11 w-11 rounded-xl bg-[#ECFEFF] border border-[#CFFAFE] flex items-center justify-center text-[#0891B2]"><FolderOpen size={18} /></div>
              <span className="h-6 rounded-full bg-[#ECFEFF] border border-[#CFFAFE] px-2.5 inline-flex items-center text-[10px] font-bold tracking-[0.12em] text-[#0891B2]" style={{ fontFamily: 'var(--font-mono)' }}>{allMaterials.length} ITEMS</span>
            </div>
            <p className="mt-4 text-[11px] font-bold tracking-[0.16em] uppercase text-slate-400">Course Materials</p>
            <p className="text-[32px] font-extrabold leading-none tracking-tight text-slate-900 mt-1" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>{allMaterials.length}</p>
          </div>

          <div className="bg-[#4F46E5] rounded-[24px] border border-[#4338CA] p-5 shadow-[0_8px_24px_rgba(79,70,229,0.25)] card-hover relative overflow-hidden">
            <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-white/10" />
            <div className="flex items-start justify-between gap-2 relative">
              <div className="h-11 w-11 rounded-xl bg-white text-[#4F46E5] flex items-center justify-center shadow-sm"><Award size={18} /></div>
              <span className="h-6 rounded-full bg-white/20 px-2.5 inline-flex items-center text-[10px] font-bold tracking-[0.12em] text-white" style={{ fontFamily: 'var(--font-mono)' }}>{results.length} PUBLISHED</span>
            </div>
            <p className="mt-4 text-[11px] font-bold tracking-[0.16em] uppercase text-indigo-200 relative">Results</p>
            <p className="text-[32px] font-extrabold leading-none tracking-tight text-white mt-1 relative" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>{results.length}</p>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto pr-1 pb-1 flex flex-col gap-4" style={{ scrollbarWidth: 'thin' }}>
          {section === 'course' ? (
            <div className="grid gap-4">
              {!activeCourse ? (
                <div className="bg-white rounded-[24px] border border-dashed border-[#CBD5E1] p-10 text-center shadow-[0_2px_16px_rgba(15,23,42,0.04)]">
                  <div className="h-12 w-12 rounded-2xl bg-[#EEF2FF] border border-[#E0E7FF] flex items-center justify-center text-[#4F46E5] mx-auto"><BookOpen size={20} /></div>
                  <p className="mt-4 text-sm font-semibold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>No active course</p>
                  <p className="text-sm text-slate-500 mt-1">You are not enrolled in any course yet.</p>
                </div>
              ) : (
                <>
                  <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-6 shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF2FF] border border-[#E0E7FF] px-3 py-1 text-[11px] font-bold tracking-wide text-[#4338CA]">
                            {activeCourse.isLiveClass || activeCourse.status?.live?.classMode === 'online' ? <><Radio size={12} /> Online Class</> : <><Monitor size={12} /> {activeCourse.status?.live?.classMode === 'physical' ? 'Physical Class' : 'Course'}</>}
                          </span>
                          {activeCourse.status?.live?.classMode ? (
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide border ${activeCourse.status.live.classMode === 'online' ? 'bg-[#ECFEFF] border-[#CFFAFE] text-[#0E7490]' : 'bg-[#F8FAFC] border-[#E2E8F0] text-slate-600'}`}>
                              {activeCourse.status.live.classMode === 'online' ? 'Online' : 'Physical'}
                            </span>
                          ) : null}
                          {activeCourse.progressInfo ? (
                            <span className="inline-flex items-center rounded-full bg-[#F8FAFC] border border-[#E2E8F0] px-3 py-1 text-[11px] font-bold text-slate-600" style={{ fontFamily: 'var(--font-mono)' }}>
                              {activeCourse.progressInfo.attendanceCount}/{activeCourse.progressInfo.totalClasses} attendance
                            </span>
                          ) : null}
                        </div>
                        <h2 className="text-[24px] font-extrabold tracking-tight text-slate-900" style={{ fontFamily: 'var(--font-display)', fontWeight: 800 }}>{activeCourse.course.title}</h2>
                        <p className="text-sm text-slate-500 mt-1">{activeCourse.course.course_code || 'Course'}{activeCourse.course.lecturer_name ? ` • ${activeCourse.course.lecturer_name}` : ''}</p>
                        {activeCourse.course.description ? <p className="text-sm text-slate-600 mt-3 leading-relaxed max-w-3xl">{activeCourse.course.description}</p> : null}
                      </div>
                      <div className="flex flex-col items-stretch gap-2 shrink-0">
                        {activeCourse.isLiveClass && activeCourse.session ? (
                          <LiveJoinButton courseId={activeCourse.course.id} session={{ ...activeCourse.session, sessionId: activeCourse.session.sessionId }} />
                        ) : activeCourse.status?.activeSession ? (
                          <button
                            onClick={() => markAttendance(activeCourse.course.id)}
                            disabled={markedSessions[activeCourse.course.id]}
                            className={`btn btn-sm lift gap-2 rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition ${markedSessions[activeCourse.course.id] ? 'bg-[#EEF2FF] text-[#4338CA] border border-[#C7D2FE] cursor-not-allowed' : 'bg-[#4F46E5] text-white hover:bg-[#4338CA]'}`}
                          >
                            {markedSessions[activeCourse.course.id] ? <><ClipboardCheck size={16} /> Attendance Marked</> : <><Sparkles size={16} /> Mark Attendance</>}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-2 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] px-3.5 py-2 text-xs font-semibold text-slate-500"><Clock size={14} /> No active session</span>
                        )}
                      </div>
                    </div>

                    {activeCourse.status?.live?.isLive && activeCourse.status.live.classMode === 'online' ? (
                      <div className="mt-4 rounded-2xl border border-[#C7D2FE] bg-[#EEF2FF]/50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-[#4338CA] flex items-center gap-2"><Video size={15} /> Online class is live</p>
                            <p className="text-xs text-slate-600 mt-1">
                              {activeCourse.status.live.zoomMeetingNumber ? `Meeting: ${activeCourse.status.live.zoomMeetingNumber}` : 'Zoom meeting available'}
                              {activeCourse.status.live.zoomPasscode ? ` • Passcode: ${activeCourse.status.live.zoomPasscode}` : ''}
                            </p>
                          </div>
                          {activeCourse.session ? <LiveJoinButton courseId={activeCourse.course.id} session={{ ...activeCourse.session, sessionId: activeCourse.session.sessionId }} /> : null}
                        </div>
                        {zoomJoinError && zoomJoin?.courseId === activeCourse.course.id ? (
                          <p className="mt-2 text-xs font-medium text-red-600">Zoom join failed: {String(zoomJoinError?.message || zoomJoinError)}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid lg:grid-cols-2 gap-4">
                    <Card title="Course Materials" subtitle="Text and document materials for this course" className="!bg-white !rounded-[24px] !border !border-[#E2E8F0] !shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
                      {activeCourse.materials.length === 0 ? (
                        <p className="text-sm text-slate-500">No materials uploaded for this course yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {activeCourse.materials.map((m) => (
                            <div key={m.id} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-bold text-sm text-slate-900">{m.title}</p>
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide border ${m.material_type === 'text' ? 'bg-[#EEF2FF] border-[#C7D2FE] text-[#4338CA]' : 'bg-[#ECFEFF] border-[#CFFAFE] text-[#0E7490]'}`}>
                                      {m.material_type === 'text' ? 'TEXT' : 'DOCUMENT'}
                                    </span>
                                    {m.section_number ? <span className="text-[11px] text-slate-500">Section {m.section_number}</span> : null}
                                  </div>
                                  {m.description ? <p className="text-xs text-slate-500 mt-1">{m.description}</p> : null}
                                </div>
                                {m.material_type !== 'text' && m.material_url ? (
                                  <a href={`${apiBase}${m.material_url}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm lift gap-1 shrink-0"><ExternalLink size={12} /> Open</a>
                                ) : null}
                              </div>
                              {m.material_type === 'text' && m.content ? (
                                <div className="mt-3 rounded-xl bg-white border border-[#E2E8F0] p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-auto">{m.content}</div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>

                    <Card title="Class Summaries" subtitle="Readable notes and summaries from your classes" className="!bg-white !rounded-[24px] !border !border-[#E2E8F0] !shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
                      {activeCourse.sessions.filter((s) => s.lecturer_notes).length === 0 ? (
                        <p className="text-sm text-slate-500">No class summaries available yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {activeCourse.sessions.filter((s) => s.lecturer_notes).map((s) => (
                            <div key={s.id} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className="inline-flex rounded-full bg-[#EEF2FF] border border-[#E0E7FF] px-2.5 py-1 text-[10px] font-bold text-[#4338CA]">Class {s.class_number || '—'}</span>
                                <span className="text-xs text-slate-500">{s.start_time ? new Date(s.start_time).toLocaleDateString() : ''}</span>
                              </div>
                              <div className="rounded-xl bg-white border border-[#E2E8F0] p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{s.lecturer_notes}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {section === 'assessments' ? (
            <div className="flex flex-col gap-4">
              {(() => {
                const courseId = activeCourse?.course?.id
                const items = (allAssessments || []).filter((a) => !courseId || String(a.course_id) === String(courseId))
                const groups = [
                  { key: 'assignment', label: 'Assignments', icon: FileText, color: '#7C3AED', bg: '#F5F3FF', border: '#EDE9FE' },
                  { key: 'mcq', label: 'MCQ Assessments', icon: ClipboardCheck, color: '#0891B2', bg: '#ECFEFF', border: '#CFFAFE' },
                  { key: 'essay', label: 'Essay Assessments', icon: SquarePen, color: '#4F46E5', bg: '#EEF2FF', border: '#E0E7FF' },
                  { key: 'paper', label: 'Paper Assessments', icon: FileText, color: '#0F766E', bg: '#F0FDFA', border: '#CCFBF1' },
                ]
                const known = new Set(groups.map(g => g.key))
                const other = items.filter(i => !known.has(i.kind))
                const renderItem = (item) => (
                  <div key={`${item.kind}-${item.id || item.exam_id}`} className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_8px_rgba(15,23,42,0.04)]">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-extrabold text-[14px] tracking-tight text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>{item.title}</p>
                        <p className="text-xs font-medium text-slate-500 mt-1">{item.course_title}{item.due_date ? ` • Due ${new Date(item.due_date).toLocaleDateString()}` : ''}</p>
                      </div>
                      <span className="inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide border bg-[#F8FAFC] border-[#E2E8F0] text-slate-600">{item.kindLabel || item.kind}</span>
                    </div>
                    {item.description ? <p className="text-[13px] leading-relaxed text-slate-600 mt-2">{item.description}</p> : null}
                    {item.kind === 'assignment' && item.attachment_url ? (
                      <a className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#4338CA]" href={`${apiBase}${item.attachment_url}`} target="_blank" rel="noreferrer"><ExternalLink size={12} /> View Attachment</a>
                    ) : null}
                    {item.kind === 'mcq' ? (
                      <div className="mt-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-4 space-y-2">
                        {item.submission_id ? (
                          <span className="inline-flex rounded-full bg-[#EEF2FF] border border-[#C7D2FE] px-3 py-1 text-xs font-semibold text-[#4338CA]">Submitted{item.result_sent_at ? ' · result emailed' : ' · result pending release'}</span>
                        ) : item.quiz_url ? (
                          <a href={item.quiz_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm lift gap-2 inline-flex items-center rounded-xl px-4 py-2 text-sm font-bold"><ExternalLink size={14} /> Open Quiz</a>
                        ) : <p className="text-xs text-slate-500">Check your email for the quiz link.</p>}
                        {item.access_code && !item.submission_id ? <p className="text-xs text-slate-600">Access ID: <span className="font-mono font-bold text-[#0E7490] bg-[#ECFEFF] border border-[#A5F3FC] rounded px-2 py-0.5">{item.access_code}</span></p> : null}
                      </div>
                    ) : null}
                    {(item.kind === 'essay' || item.kind === 'exam') && Array.isArray(item.questions) && item.questions.length ? (
                      <ol className="mt-3 space-y-2 rounded-2xl bg-[#EEF2FF]/60 border border-[#E0E7FF] p-4">
                        {item.questions.map((q, i) => (
                          <li key={q.id || i} className="text-[13px] leading-relaxed text-slate-700 flex gap-2">
                            <span className="shrink-0 h-6 w-6 rounded-lg bg-[#4F46E5] text-white flex items-center justify-center text-[11px] font-bold">{i + 1}</span>
                            <span className="pt-0.5">{q.question_text}</span>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </div>
                )
                return (
                  <>
                    <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-5 shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
                      <h3 className="text-lg font-extrabold text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>Assessments</h3>
                      <p className="text-sm text-slate-500 mt-1">{courseId ? `Showing assessments created for ${activeCourse?.course?.title || 'this course'}.` : 'Showing assessments for your courses.'}</p>
                    </div>
                    {items.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-8 text-center text-sm text-slate-500">No assessments found for this course.</div>
                    ) : null}
                    {groups.map((g) => {
                      const gItems = items.filter(i => i.kind === g.key)
                      if (!gItems.length) return null
                      const Icon = g.icon
                      return (
                        <Card key={g.key} title={g.label} subtitle={`${gItems.length} item${gItems.length > 1 ? 's' : ''}`} className="!bg-white !rounded-[24px] !border !border-[#E2E8F0] !shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
                          <div className="space-y-3">
                            {gItems.map(renderItem)}
                          </div>
                        </Card>
                      )
                    })}
                    {other.length ? (
                      <Card title="Other Assessments" subtitle={`${other.length} item${other.length > 1 ? 's' : ''}`} className="!bg-white !rounded-[24px] !border !border-[#E2E8F0] !shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
                        <div className="space-y-3">{other.map(renderItem)}</div>
                      </Card>
                    ) : null}
                  </>
                )
              })()}
            </div>
          ) : null}

          {section === 'materials' ? (
            <Card title="Course Materials" subtitle="All materials for courses you have taken" className="!bg-white !rounded-[24px] !border !border-[#E2E8F0] !shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
              {allMaterials.length === 0 ? (
                <p className="text-sm text-slate-500">No course materials available yet.</p>
              ) : (
                <div className="space-y-3">
                  {allMaterials.map((m) => (
                    <div key={`${m.course_id}-${m.id}`} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-sm text-slate-900">{m.title}</p>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide border ${m.material_type === 'text' ? 'bg-[#EEF2FF] border-[#C7D2FE] text-[#4338CA]' : 'bg-[#ECFEFF] border-[#CFFAFE] text-[#0E7490]'}`}>{m.material_type === 'text' ? 'TEXT' : 'DOCUMENT'}</span>
                          </div>
                          <p className="text-xs font-semibold text-[#4F46E5] mt-1">{m.course_title}</p>
                          {m.description ? <p className="text-xs text-slate-500 mt-1">{m.description}</p> : null}
                        </div>
                        {m.material_type !== 'text' && m.material_url ? (
                          <a href={`${apiBase}${m.material_url}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm lift gap-1 shrink-0"><ExternalLink size={12} /> Open</a>
                        ) : null}
                      </div>
                      {m.material_type === 'text' && m.content ? (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs font-bold text-[#4338CA]">Read text material</summary>
                          <div className="mt-2 rounded-xl bg-white border border-[#E2E8F0] p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-auto">{m.content}</div>
                        </details>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : null}

          {section === 'results' ? (
            <div className="flex flex-col gap-4">
              {(() => {
                const current = results.filter((r) => r.is_current_course)
                const previous = results.filter((r) => !r.is_current_course)
                const renderTable = (rows, emptyMsg) => rows.length === 0 ? (
                  <p className="text-sm text-slate-500">{emptyMsg}</p>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white">
                    <div className="overflow-auto">
                      <table className="data-table w-full">
                        <thead><tr><th>Course</th><th>Type</th><th className="text-center">Score</th><th className="text-right">Status</th></tr></thead>
                        <tbody>
                          {rows.map((r) => (
                            <tr key={r.id} className="hover:bg-[#EEF2FF]">
                              <td className="text-sm font-semibold text-slate-900">{r.course_title}</td>
                              <td className="text-xs text-slate-500">{r.result_type || '—'}</td>
                              <td className="text-center"><span className="inline-flex items-center rounded-full bg-[#EEF2FF] border border-[#E0E7FF] px-3 py-1 text-xs font-bold text-[#4338CA]" style={{ fontFamily: 'var(--font-mono)' }}>{r.score ?? '—'}</span></td>
                              <td className="text-right"><Badge tone="slate" dot className={r.status === 'Pass' ? '!bg-[#4F46E5] !text-white !border-[#4338CA] !rounded-full !font-bold !px-3' : '!bg-white !text-slate-600 !border-[#E2E8F0] !rounded-full !font-semibold !px-3'}>{r.status}</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
                return (
                  <>
                    <Card title="Current Course Results" subtitle="Results available for your active course" className="!bg-white !rounded-[24px] !border !border-[#E2E8F0] !shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
                      {renderTable(current, 'No results available for your current course yet.')}
                    </Card>
                    <Card title="Previous Course Results" subtitle="Results from courses you have taken before" className="!bg-white !rounded-[24px] !border !border-[#E2E8F0] !shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
                      {renderTable(previous, 'No previous course results available yet.')}
                    </Card>
                  </>
                )
              })()}
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  )
}

export default StudentDashboard
