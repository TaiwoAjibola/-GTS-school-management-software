import { useEffect, useMemo, useState } from 'react'
import { BookOpen, ClipboardCheck, GraduationCap, SquarePen, Calendar, Clock, Award, FileText, Layers, Sparkles, ExternalLink, ArrowUpRight } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/ui/Card'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import apiClient from '../api/client'

const navItems = [
  { to: '/student/courses', label: 'Courses', icon: BookOpen },
  { to: '/student/attendance', label: 'Attendance', icon: ClipboardCheck },
  { to: '/student/assignments', label: 'Assignments', icon: SquarePen },
  { to: '/student/results', label: 'Results', icon: GraduationCap },
]

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5050'

const StudentDashboard = () => {
  const location = useLocation()
  const section = location.pathname.split('/')[2] || 'courses'

  const [courses, setCourses] = useState([])
  const [assignments, setAssignments] = useState([])
  const [exams, setExams] = useState([])
  const [results, setResults] = useState([])
  const [attendanceStates, setAttendanceStates] = useState({})
  const [progress, setProgress] = useState({})
  const [markedSessions, setMarkedSessions] = useState({})

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
        const [statusRes, progressRes] = await Promise.all([
          apiClient.get(`/attendance/course/${course.id}/status`),
          apiClient.get(`/attendance/course/${course.id}/progress`),
        ])
        return [course.id, { status: statusRes.data, progress: progressRes.data }]
      })
    )

    const nextStatuses = {}
    const nextProgress = {}
    for (const [courseId, values] of statusEntries) {
      nextStatuses[courseId] = values.status
      nextProgress[courseId] = values.progress
    }
    setAttendanceStates(nextStatuses)
    setProgress(nextProgress)
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

  const attendanceSummary = useMemo(
    () =>
      courses.map((course) => {
        const progressInfo = progress[course.id]
        const progressPct = progressInfo
          ? (progressInfo.attendanceCount / Math.max(progressInfo.minRequired, 1)) * 100
          : 0

        return {
          course,
          status: attendanceStates[course.id],
          progressInfo,
          progressPct,
        }
      }),
    [courses, progress, attendanceStates]
  )

  const title = {
    courses: 'My Courses',
    attendance: 'Attendance',
    assignments: 'Assignments',
    results: 'Results',
  }[section] || 'Student Dashboard'

  return (
    <AppShell title={title} navItems={navItems}>
      <div className="h-full flex flex-col gap-5 overflow-hidden bg-[#F8FAFC] text-slate-900" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=Inter:wght@500;600;700&family=JetBrains+Mono:wght@600&display=swap');`}</style>

        {/* Sora header override */}
        <div className="[&_.page-header]:!bg-white [&_.page-header]:!rounded-[24px] [&_.page-header]:!border [&_.page-header]:!border-[#E2E8F0] [&_.page-header]:!shadow-[0_2px_16px_rgba(15,23,42,0.06)] [&_.page-header]:!p-5 [&_.page-header_.ico]:!bg-[#EEF2FF] [&_.page-header_.ico]:!text-[#4F46E5] [&_.page-header_.ico]:!border [&_.page-header_.ico]:!border-[#E0E7FF] [&_.page-header_.page-title]:!font-[800] [&_.page-header_.page-title]:!tracking-tight">
          <PageHeader
            title="Student Dashboard"
            subtitle="Track your courses, attendance, assignments, and results — indigo system."
            icon={<GraduationCap size={22} />}
          />
        </div>

        {/* BENTO STATS 4 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          {/* Enrolled - indigo */}
          <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-5 shadow-[0_2px_16px_rgba(15,23,42,0.06)] card-hover relative overflow-hidden group">
            <div className="absolute top-0 inset-x-0 h-[3px] bg-[#4F46E5]" />
            <div className="flex items-start justify-between">
              <div className="h-11 w-11 rounded-xl bg-[#EEF2FF] border border-[#E0E7FF] flex items-center justify-center text-[#4F46E5] shadow-sm">
                <BookOpen size={18} />
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF2FF] border border-[#E0E7FF] px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] text-[#4F46E5]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                <Sparkles size={11} /> LIVE
              </span>
            </div>
            <p className="mt-4 text-[11px] font-bold tracking-[0.16em] uppercase text-slate-400">Enrolled</p>
            <p className="text-[32px] font-extrabold leading-none tracking-tight text-slate-900 mt-1" style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800 }}>{courses.length}</p>
            <p className="text-[13px] font-medium text-slate-500 mt-1 flex items-center gap-1.5"><Layers size={13} className="text-[#4F46E5]" /> Courses Active</p>
          </div>

          {/* Assignments - violet */}
          <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-5 shadow-[0_2px_16px_rgba(15,23,42,0.06)] card-hover relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[3px] bg-[#7C3AED]" />
            <div className="flex items-start justify-between">
              <div className="h-11 w-11 rounded-xl bg-[#F5F3FF] border border-[#EDE9FE] flex items-center justify-center text-[#7C3AED] shadow-sm">
                <SquarePen size={18} />
              </div>
              <span className="h-6 rounded-full bg-[#F5F3FF] border border-[#EDE9FE] px-2.5 inline-flex items-center text-[10px] font-bold tracking-[0.12em] text-[#7C3AED]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{assignments.length} TOTAL</span>
            </div>
            <p className="mt-4 text-[11px] font-bold tracking-[0.16em] uppercase text-slate-400">Assignments</p>
            <p className="text-[32px] font-extrabold leading-none tracking-tight text-slate-900 mt-1" style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800 }}>{assignments.length}</p>
            <p className="text-[13px] font-medium text-slate-500 mt-1 flex items-center gap-1.5"><FileText size={13} className="text-[#7C3AED]" /> Pending tasks</p>
          </div>

          {/* Exams - cyan */}
          <div className="bg-white rounded-[24px] border border-[#E2E8F0] p-5 shadow-[0_2px_16px_rgba(15,23,42,0.06)] card-hover relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[3px] bg-[#0891B2]" />
            <div className="flex items-start justify-between">
              <div className="h-11 w-11 rounded-xl bg-[#ECFEFF] border border-[#CFFAFE] flex items-center justify-center text-[#0891B2] shadow-sm">
                <ClipboardCheck size={18} />
              </div>
              <span className="h-6 rounded-full bg-[#ECFEFF] border border-[#CFFAFE] px-2.5 inline-flex items-center text-[10px] font-bold tracking-[0.12em] text-[#0891B2]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{exams.length} PAPERS</span>
            </div>
            <p className="mt-4 text-[11px] font-bold tracking-[0.16em] uppercase text-slate-400">Exams</p>
            <p className="text-[32px] font-extrabold leading-none tracking-tight text-slate-900 mt-1" style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800 }}>{exams.length}</p>
            <p className="text-[13px] font-medium text-slate-500 mt-1 flex items-center gap-1.5"><Award size={13} className="text-[#0891B2]" /> Papers assigned</p>
          </div>

          {/* Results - indigo deep */}
          <div className="bg-[#4F46E5] rounded-[24px] border border-[#4338CA] p-5 shadow-[0_8px_24px_rgba(79,70,229,0.25)] card-hover relative overflow-hidden">
            <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-white/10 blur-[1px]" />
            <div className="flex items-start justify-between relative">
              <div className="h-11 w-11 rounded-xl bg-white text-[#4F46E5] flex items-center justify-center shadow-sm">
                <GraduationCap size={18} />
              </div>
              <span className="h-6 rounded-full bg-white/15 border border-white/20 px-2.5 inline-flex items-center text-[10px] font-bold tracking-[0.12em] text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>GPA READY</span>
            </div>
            <p className="mt-4 text-[11px] font-bold tracking-[0.16em] uppercase text-indigo-200">Results</p>
            <p className="text-[32px] font-extrabold leading-none tracking-tight text-white mt-1" style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800 }}>{results.length}</p>
            <p className="text-[13px] font-medium text-indigo-100 mt-1 flex items-center gap-1.5"><TrendingUp size={13} className="text-white" /> Published scores</p>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto pr-1 pb-1 space-y-5" style={{ scrollbarWidth: 'thin' }}>
          {section === 'courses' ? (
            <div className="grid gap-4">
              {attendanceSummary.length === 0 ? (
                <div className="bg-white rounded-[24px] border border-dashed border-[#CBD5E1] p-10 text-center shadow-[0_2px_16px_rgba(15,23,42,0.04)]">
                  <div className="h-12 w-12 rounded-2xl bg-[#EEF2FF] border border-[#E0E7FF] flex items-center justify-center text-[#4F46E5] mx-auto"><BookOpen size={20} /></div>
                  <p className="mt-4 text-sm font-semibold text-slate-900" style={{ fontFamily: 'Sora, sans-serif' }}>No courses yet</p>
                  <p className="text-sm text-slate-500 mt-1">You are not enrolled in any course.</p>
                </div>
              ) : null}
              {attendanceSummary.map(({ course, progressInfo, progressPct }) => {
                const pct = Math.max(0, Math.min(100, progressPct))
                return (
                  <div key={course.id} className="card card-hover bg-white rounded-[24px] border border-[#E2E8F0] shadow-[0_2px_16px_rgba(15,23,42,0.06)] p-6 relative overflow-hidden">
                    <div className="absolute left-0 top-6 bottom-6 w-[3px] bg-[#4F46E5] rounded-full hidden sm:block" />
                    <div className="sm:pl-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-[17px] font-extrabold tracking-tight text-slate-900 leading-tight" style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800 }}>{course.title}</h3>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF2FF] border border-[#E0E7FF] px-2.5 py-1 text-xs font-semibold text-[#4338CA]"><Calendar size={12} /> Duration: {course.duration_weeks} weeks</span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#E2E8F0] px-2.5 py-1 text-xs font-medium text-slate-600"><Clock size={12} className="text-slate-400" /> {course.class_day || 'Class day not set'} {course.class_time || ''}</span>
                          </div>
                          <p className="text-xs font-medium text-slate-500 mt-2 inline-flex items-center gap-1.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                            {course.start_date || '-'} <span className="text-slate-300">→</span> {course.end_date || '-'}
                          </p>
                        </div>
                        <Badge tone="slate" className="!bg-white !border-[#E2E8F0] !text-slate-600 !rounded-full !px-3 !py-1 !text-xs !font-semibold">
                          {progressInfo?.attendanceCount || 0}/{progressInfo?.minRequired || course.min_attendance_required} classes
                        </Badge>
                      </div>
                      <div className="mt-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-slate-500">Progress</span>
                          <span className="text-xs font-bold text-[#4F46E5]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-2.5 w-full bg-[#EEF2FF] rounded-full overflow-hidden border border-[#E0E7FF] p-0.5">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#4F46E5 0%,#7C3AED 100%)' }} />
                        </div>
                        <p className="text-xs text-slate-500 mt-2 font-medium">
                          {progressInfo?.attendanceCount || 0}/{progressInfo?.minRequired || course.min_attendance_required} classes completed
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}

          {section === 'attendance' ? (
            <div className="grid gap-4">
              {attendanceSummary.map(({ course, status, progressInfo, progressPct }) => {
                const pct = Math.max(0, Math.min(100, progressPct))
                const eligible = progressInfo?.eligible
                return (
                  <div key={course.id} className="card card-hover bg-white rounded-[24px] border border-[#E2E8F0] p-6 shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
                    <div className="flex flex-wrap gap-3 items-center justify-between">
                      <div className="min-w-0">
                        <h3 className="text-[17px] font-extrabold tracking-tight text-slate-900" style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800 }}>{course.title}</h3>
                        <p className="text-sm text-slate-500 mt-1 font-medium">Attendance requirement: <span className="font-bold text-slate-700" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{course.min_attendance_required}</span> classes</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge tone="slate" dot className={eligible ? '!bg-[#EEF2FF] !text-[#4338CA] !border-[#C7D2FE] !rounded-full' : '!bg-[#FEF2F2] !text-[#9F1239] !border-[#FECDD3] !rounded-full'}>
                            {eligible ? 'Eligible' : 'Not Eligible'}
                          </Badge>
                          <span className="text-xs text-slate-400 hidden sm:inline">• {progressInfo?.attendanceCount || 0}/{progressInfo?.minRequired || course.min_attendance_required} classes</span>
                        </div>
                      </div>
                      {status?.activeSession ? (
                        <button
                          onClick={() => markAttendance(course.id)}
                          disabled={markedSessions[course.id]}
                          className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-[0_4px_14px_rgba(79,70,229,0.25)] transition ${markedSessions[course.id] ? 'bg-[#EEF2FF] text-[#4338CA] border border-[#C7D2FE] cursor-not-allowed' : 'bg-[#4F46E5] text-white hover:bg-[#4338CA] hover:shadow-[0_6px_20px_rgba(79,70,229,0.30)] active:scale-[0.98]'}`}
                        >
                          {markedSessions[course.id] ? <><ClipboardCheck size={16} /> Attendance Marked</> : <><Sparkles size={16} /> Mark Attendance</>}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-2 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] px-3.5 py-2 text-xs font-semibold text-slate-500"><Clock size={14} /> No active session</span>
                      )}
                    </div>
                    <div className="mt-5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-slate-500">Attendance</span>
                        <span className="text-xs font-bold text-[#4F46E5]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-2.5 w-full bg-[#EEF2FF] rounded-full overflow-hidden border border-[#E0E7FF] p-0.5">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: eligible ? 'linear-gradient(90deg,#4F46E5 0%,#06B6D4 100%)' : 'linear-gradient(90deg,#6366F1 0%,#A5B4FC 100%)' }} />
                      </div>
                      <p className="text-xs text-slate-500 mt-2 font-medium flex items-center gap-2">
                        {progressInfo?.attendanceCount || 0}/{progressInfo?.minRequired || course.min_attendance_required} classes •
                        <Badge tone="slate" dot className={eligible ? '!bg-[#EEF2FF] !text-[#4338CA] !border-[#C7D2FE] !rounded-full' : '!bg-amber-50 !text-amber-700 !border-amber-200 !rounded-full'}>
                          {eligible ? 'Eligible' : 'Not Eligible'}
                        </Badge>
                      </p>
                    </div>
                  </div>
                )
              })}
              {attendanceSummary.length === 0 ? (
                <div className="bg-white rounded-[24px] border border-dashed border-[#CBD5E1] p-10 text-center">
                  <p className="text-sm text-slate-500">No attendance records yet.</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {section === 'assignments' ? (
            <div className="space-y-5">
              <Card
                title="Assignments"
                subtitle={`${assignments.length} total • violet indigo system`}
                className="!bg-white !rounded-[24px] !border !border-[#E2E8F0] !shadow-[0_2px_16px_rgba(15,23,42,0.06)] !p-0 overflow-hidden"
                bodyClassName="!p-0"
              >
                <div className="px-5 pt-1 pb-5">
                  {assignments.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-8 text-center mt-3">
                      <div className="h-10 w-10 rounded-xl bg-white border border-[#E2E8F0] flex items-center justify-center text-slate-400 mx-auto"><FileText size={18} /></div>
                      <p className="text-sm font-semibold text-slate-600 mt-3">No assignments yet.</p>
                      <p className="text-xs text-slate-500 mt-1">New tasks from instructors will appear here.</p>
                    </div>
                  ) : (
                    <ul className="space-y-3 mt-3">
                      {assignments.map((assignment) => (
                        <li key={assignment.id} className="card card-hover bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-[0_1px_8px_rgba(15,23,42,0.04)] hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)] hover:border-[#C7D2FE] transition-all">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-extrabold text-[14px] tracking-tight text-slate-900" style={{ fontFamily: 'Sora, sans-serif' }}>{assignment.title}</p>
                              <p className="text-xs font-bold tracking-wide uppercase text-[#4F46E5] mt-0.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{assignment.course_title}</p>
                              <p className="text-[13px] leading-relaxed text-slate-600 mt-2">{assignment.description}</p>
                            </div>
                            <span className="shrink-0 h-8 w-8 rounded-xl bg-[#F5F3FF] border border-[#EDE9FE] flex items-center justify-center text-[#7C3AED]"><FileText size={14} /></span>
                          </div>
                          {assignment.attachment_url ? (
                            <a className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#4F46E5] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#4338CA] shadow-[0_2px_10px_rgba(79,70,229,0.25)] transition" href={`${apiBase}${assignment.attachment_url}`} target="_blank" rel="noreferrer">
                              <ExternalLink size={12} /> View Attachment <ArrowUpRight size={12} className="opacity-70" />
                            </a>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>

              <Card
                title="Exam Papers"
                subtitle={`${exams.length} papers • cyan / indigo badges`}
                className="!bg-white !rounded-[24px] !border !border-[#E2E8F0] !shadow-[0_2px_16px_rgba(15,23,42,0.06)] !p-0 overflow-hidden"
                bodyClassName="!p-0"
              >
                <div className="px-5 pb-5 pt-1">
                  {exams.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-8 text-center mt-3">
                      <div className="h-10 w-10 rounded-xl bg-white border border-[#E2E8F0] flex items-center justify-center text-slate-400 mx-auto"><ClipboardCheck size={18} /></div>
                      <p className="text-sm font-semibold text-slate-600 mt-3">No exam papers sent to you yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 mt-3">
                      {exams.map((exam) => (
                        <div key={exam.exam_id} className="card card-hover bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-[0_1px_8px_rgba(15,23,42,0.04)] hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)] transition">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-extrabold text-[14px] tracking-tight text-slate-900 flex flex-wrap items-center gap-2" style={{ fontFamily: 'Sora, sans-serif' }}>
                                {exam.title}
                                <Badge tone="slate" className={exam.exam_type === 'mcq' ? '!bg-[#ECFEFF] !text-[#0E7490] !border-[#A5F3FC] !rounded-full !text-[11px] !tracking-widest !font-bold' : '!bg-[#EEF2FF] !text-[#4338CA] !border-[#C7D2FE] !rounded-full !text-[11px] !tracking-widest !font-bold'}>
                                  {exam.exam_type === 'mcq' ? 'MCQ' : 'Essay'}
                                </Badge>
                              </p>
                              <p className="text-xs font-medium text-slate-500 mt-1">{exam.course_title}{exam.due_date ? <span className="inline-flex items-center gap-1 ml-2 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-700"><Calendar size={11} /> Due {exam.due_date}</span> : null}</p>
                            </div>
                          </div>
                          {exam.description ? <p className="text-[13px] leading-relaxed text-slate-600 mt-2 bg-[#F8FAFC] rounded-xl border border-[#F1F5F9] p-3">{exam.description}</p> : null}
                          {exam.exam_type === 'mcq' ? (
                            <div className="mt-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-3.5 space-y-2.5">
                              {exam.submission_id ? (
                                <Badge tone="slate" dot className="!bg-[#EEF2FF] !text-[#4338CA] !border-[#C7D2FE] !rounded-full !font-semibold">
                                  Submitted{exam.result_sent_at ? ` · result emailed` : ' · result pending release'}
                                </Badge>
                              ) : null}
                              {exam.quiz_url && !exam.submission_id ? (
                                <a
                                  href={exam.quiz_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#4338CA] shadow-[0_4px_14px_rgba(79,70,229,0.25)] transition"
                                >
                                  <ExternalLink size={14} /> Open Quiz
                                </a>
                              ) : !exam.submission_id ? (
                                <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5"><Sparkles size={12} className="text-[#4F46E5]" /> Check your email for the quiz link.</p>
                              ) : null}
                              {exam.access_code && !exam.submission_id ? (
                                <p className="text-xs font-medium text-slate-600">
                                  Your access ID:{' '}
                                  <span className="font-mono font-bold text-[#0E7490] tracking-[0.14em] bg-[#ECFEFF] border border-[#A5F3FC] rounded-lg px-2 py-1 text-[13px]">{exam.access_code}</span>
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <ol className="mt-3 space-y-2 rounded-2xl bg-[#EEF2FF]/60 border border-[#E0E7FF] p-3.5">
                              {exam.questions.map((q, i) => (
                                <li key={q.id} className="text-[13px] leading-relaxed text-slate-700 flex gap-2">
                                  <span className="shrink-0 h-6 w-6 rounded-lg bg-[#4F46E5] text-white flex items-center justify-center text-[11px] font-bold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{i + 1}</span>
                                  <span className="pt-0.5"><strong className="font-bold text-slate-900">Q{i + 1}.</strong> {q.question_text}</span>
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          ) : null}

          {section === 'results' ? (
            <Card
              title="Results"
              subtitle="Indigo data-table • Pass indigo, Fail muted"
              className="!bg-white !rounded-[24px] !border !border-[#E2E8F0] !shadow-[0_2px_16px_rgba(15,23,42,0.06)] !p-0 overflow-hidden"
              bodyClassName="!p-0"
            >
              <div className="px-5 pb-5">
                {results.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-8 text-center mt-3">
                    <div className="h-10 w-10 rounded-xl bg-white border border-[#E2E8F0] flex items-center justify-center text-slate-400 mx-auto"><Award size={18} /></div>
                    <p className="text-sm text-slate-500 mt-3">No results published yet.</p>
                  </div>
                ) : (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white data-table shadow-[0_1px_8px_rgba(15,23,42,0.04)]">
                    <div className="hidden sm:grid grid-cols-[1fr_140px_140px] gap-0 bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 py-3">
                      <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-slate-500">Course</span>
                      <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-slate-500 text-center">Score</span>
                      <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-slate-500 text-right">Status</span>
                    </div>
                    <ul className="divide-y divide-[#F1F5F9]">
                      {results.map((result) => (
                        <li key={result.id} className="grid sm:grid-cols-[1fr_140px_140px] gap-2 sm:gap-0 items-center px-4 py-3.5 hover:bg-[#F8FAFC]/70 transition">
                          <span className="text-sm font-semibold text-slate-900 truncate" style={{ fontFamily: 'Sora, sans-serif' }}>{result.course_title}</span>
                          <span className="flex sm:justify-center">
                            <span className="inline-flex items-center rounded-full bg-[#EEF2FF] border border-[#E0E7FF] px-3 py-1 text-xs font-bold text-[#4338CA]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{result.score}</span>
                          </span>
                          <span className="flex sm:justify-end">
                            <Badge tone="slate" dot className={result.status === 'Pass' ? '!bg-[#4F46E5] !text-white !border-[#4338CA] !rounded-full !font-bold !px-3' : '!bg-white !text-slate-600 !border-[#E2E8F0] !rounded-full !font-semibold !px-3'}>
                              {result.status}
                            </Badge>
                          </span>
                          {/* mobile fallback: original combined badge for reference */}
                          <span className="sm:hidden text-xs text-slate-500">
                            <Badge tone="slate" dot className={result.status === 'Pass' ? '!bg-[#EEF2FF] !text-[#4338CA] !border-[#C7D2FE] !rounded-full' : '!bg-[#FEF2F2] !text-[#9F1239] !border-[#FECDD3] !rounded-full'}>
                              {result.score} ({result.status})
                            </Badge>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* preserve original list semantics hidden for regression but styled above */}
                <ul className="sr-only">
                  {results.map((result) => (
                    <li key={`sr-${result.id}`}>{result.course_title} {result.score} ({result.status})</li>
                  ))}
                </ul>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </AppShell>
  )
}

export default StudentDashboard
