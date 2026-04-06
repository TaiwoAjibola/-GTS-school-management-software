import { useEffect, useMemo, useState } from 'react'
import { BookOpen, ClipboardCheck, GraduationCap, SquarePen } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/ui/Card'
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
  const [results, setResults] = useState([])
  const [attendanceStates, setAttendanceStates] = useState({})
  const [progress, setProgress] = useState({})
  const [markedSessions, setMarkedSessions] = useState({})

  const load = async () => {
    const [courseRes, assignmentRes, resultRes] = await Promise.all([
      apiClient.get('/courses/my-courses'),
      apiClient.get('/assignments/my'),
      apiClient.get('/results/my'),
    ])

    setCourses(courseRes.data)
    setAssignments(assignmentRes.data)
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
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <Card title="Enrolled Courses" value={courses.length} />
        <Card title="Assignments" value={assignments.length} />
        <Card title="Results" value={results.length} />
      </div>

      {section === 'courses' ? (
        <div className="grid gap-4">
          {attendanceSummary.map(({ course, progressInfo, progressPct }) => (
            <div key={course.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900">{course.title}</h3>
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
            <div key={course.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">{course.title}</h3>
                  <p className="text-sm text-slate-500">Attendance requirement: {course.min_attendance_required}</p>
                </div>
                {status?.activeSession ? (
                  <button
                    onClick={() => markAttendance(course.id)}
                    disabled={markedSessions[course.id]}
                    className="bg-slate-900 text-white rounded-lg px-4 py-2 disabled:opacity-50"
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
                  <span className={progressInfo?.eligible ? 'text-emerald-600 ml-1' : 'text-amber-600 ml-1'}>
                    {progressInfo?.eligible ? 'Eligible' : 'Not Eligible'}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {section === 'assignments' ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold mb-3">Assignments</h3>
          <ul className="space-y-2 text-sm">
            {assignments.map((assignment) => (
              <li key={assignment.id} className="border border-slate-200 rounded-lg p-3">
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
          </ul>
        </div>
      ) : null}

      {section === 'results' ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold mb-3">Results</h3>
          <ul className="space-y-2 text-sm">
            {results.map((result) => (
              <li key={result.id} className="border border-slate-200 rounded-lg p-3 flex justify-between gap-4">
                <span>{result.course_title}</span>
                <span className={result.status === 'Pass' ? 'text-emerald-600' : 'text-red-600'}>
                  {result.score} ({result.status})
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </AppShell>
  )
}

export default StudentDashboard
