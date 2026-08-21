import { useEffect, useMemo, useState } from 'react'
import { BookOpen, ClipboardCheck, GraduationCap, SquarePen } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/ui/Card'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import ProgressBar from '../components/ui/ProgressBar'
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
      <div className="h-full flex flex-col gap-5 overflow-hidden">
        <PageHeader
          title="Student Dashboard"
          subtitle="Track your courses, attendance, assignments, and results."
          icon={<GraduationCap size={22} />}
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          <Card title="Enrolled Courses" value={courses.length} icon={<BookOpen size={20} />} accent="gold" />
          <Card title="Assignments" value={assignments.length} icon={<SquarePen size={20} />} accent="sky" />
          <Card title="Exams" value={exams.length} icon={<ClipboardCheck size={20} />} accent="emerald" />
          <Card title="Results" value={results.length} icon={<GraduationCap size={20} />} accent="rose" />
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          {section === 'courses' ? (
            <div className="grid gap-4">
              {attendanceSummary.map(({ course, progressInfo, progressPct }) => (
                <div key={course.id} className="card card-hover p-5">
                  <h3 className="card-title">{course.title}</h3>
                  <p className="text-sm text-slate-500 mt-1">Duration: {course.duration_weeks} weeks</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {course.class_day || 'Class day not set'} {course.class_time || ''} • {course.start_date || '-'} to {course.end_date || '-'}
                  </p>
                  <div className="mt-4">
                    <ProgressBar value={progressPct} />
                    <p className="text-xs text-slate-500 mt-2">
                      {progressInfo?.attendanceCount || 0}/{progressInfo?.minRequired || course.min_attendance_required} classes
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {section === 'attendance' ? (
            <div className="grid gap-4">
              {attendanceSummary.map(({ course, status, progressInfo, progressPct }) => (
                <div key={course.id} className="card card-hover p-5">
                  <div className="flex flex-wrap gap-3 items-center justify-between">
                    <div>
                      <h3 className="card-title">{course.title}</h3>
                      <p className="text-sm text-slate-500">Attendance requirement: {course.min_attendance_required}</p>
                    </div>
                    {status?.activeSession ? (
                      <button
                        onClick={() => markAttendance(course.id)}
                        disabled={markedSessions[course.id]}
                        className="btn btn-primary lift"
                      >
                        {markedSessions[course.id] ? 'Attendance Marked' : 'Mark Attendance'}
                      </button>
                    ) : (
                      <span className="text-sm text-slate-500">No active session</span>
                    )}
                  </div>
                  <div className="mt-4">
                    <ProgressBar value={progressPct} />
                    <p className="text-xs text-slate-500 mt-2">
                      {progressInfo?.attendanceCount || 0}/{progressInfo?.minRequired || course.min_attendance_required} classes •
                      <Badge tone={progressInfo?.eligible ? 'emerald' : 'amber'} dot>
                        {progressInfo?.eligible ? 'Eligible' : 'Not Eligible'}
                      </Badge>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {section === 'assignments' ? (
            <div className="space-y-5">
              <Card title="Assignments">
                <ul className="space-y-2 text-sm">
                  {assignments.map((assignment) => (
                    <li key={assignment.id} className="card card-hover p-3">
                      <p className="font-medium">{assignment.title}</p>
                      <p className="text-slate-500">{assignment.course_title}</p>
                      <p className="text-slate-500 mt-1">{assignment.description}</p>
                      {assignment.attachment_url ? (
                        <a className="text-slate-900 underline mt-1 inline-block" href={`${apiBase}${assignment.attachment_url}`} target="_blank" rel="noreferrer">
                          View Attachment
                        </a>
                      ) : null}
                    </li>
                  ))}
                  {assignments.length === 0 ? <p className="text-slate-400">No assignments yet.</p> : null}
                </ul>
              </Card>

              <Card title="Exam Papers">
                <div className="space-y-3">
                  {exams.map((exam) => (
                    <div key={exam.exam_id} className="card card-hover p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {exam.title}
                            <Badge tone={exam.exam_type === 'mcq' ? 'sky' : 'gold'} className="ml-2 align-middle">
                              {exam.exam_type === 'mcq' ? 'MCQ' : 'Essay'}
                            </Badge>
                          </p>
                          <p className="text-slate-500">{exam.course_title}{exam.due_date ? ` • Due ${exam.due_date}` : ''}</p>
                        </div>
                      </div>
                      {exam.description ? <p className="text-slate-500 mt-1">{exam.description}</p> : null}
                      {exam.exam_type === 'mcq' ? (
                        <div className="mt-3 rounded-xl bg-sky-50 border border-sky-200 p-3 space-y-2">
                          {exam.submission_id ? (
                            <Badge tone="emerald" dot>
                              Submitted{exam.result_sent_at ? ` · result emailed` : ' · result pending release'}
                            </Badge>
                          ) : null}
                          {exam.quiz_url && !exam.submission_id ? (
                            <a
                              href={exam.quiz_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-primary lift"
                            >
                              Open Quiz
                            </a>
                          ) : !exam.submission_id ? (
                            <p className="text-xs text-slate-500">Check your email for the quiz link.</p>
                          ) : null}
                          {exam.access_code && !exam.submission_id ? (
                            <p className="text-xs text-slate-500">
                              Your access ID:{' '}
                              <span className="font-mono font-bold text-sky-800 tracking-widest">{exam.access_code}</span>
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <ol className="mt-3 space-y-2">
                          {exam.questions.map((q, i) => (
                            <li key={q.id} className="text-sm text-slate-700">
                              <strong>Q{i + 1}.</strong> {q.question_text}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  ))}
                  {exams.length === 0 ? <p className="text-slate-400">No exam papers sent to you yet.</p> : null}
                </div>
              </Card>
            </div>
          ) : null}

          {section === 'results' ? (
            <Card title="Results">
              <ul className="space-y-2 text-sm">
                {results.map((result) => (
                  <li key={result.id} className="border border-slate-200 rounded-lg p-3 flex justify-between gap-4">
                    <span>{result.course_title}</span>
                    <Badge tone={result.status === 'Pass' ? 'emerald' : 'rose'} dot>
                      {result.score} ({result.status})
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </AppShell>
  )
}

export default StudentDashboard
