import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, ClipboardList, Pencil, Users, X } from 'lucide-react'
import AppShell from '../components/AppShell'
import apiClient from '../api/client'
import { lecturerNavItems } from '../constants/lecturerNav'
import { fmtDate, fmtDateRange } from '../utils/formatDate'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const statusBadge = (label, active, activeColor = 'bg-emerald-100 text-emerald-800') => (
  <span
    key={label}
    className={`rounded-full px-3 py-1 text-xs font-medium ${active ? activeColor : 'bg-slate-100 text-slate-400 line-through'}`}
  >
    {label}
  </span>
)

const resultCell = (info) => {
  if (!info) return <span className="text-slate-300 text-sm">—</span>
  if (info.result_status === 'Pass')
    return <span className="text-emerald-600 font-semibold text-sm">✓ Pass</span>
  if (info.result_status === 'Fail')
    return <span className="text-red-500 font-semibold text-sm">✗ Fail</span>
  if (info.enrollment_status === 'active')
    return <span className="text-sky-600 text-sm">Enrolled</span>
  return <span className="text-slate-300 text-sm">—</span>
}

export default function CoursePage() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000'

  const [course, setCourse] = useState(null)
  const [lecturers, setLecturers] = useState([])
  const [batches, setBatches] = useState([])
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [batchStudents, setBatchStudents] = useState([])
  const [allEnrollments, setAllEnrollments] = useState([])
  const [assignments, setAssignments] = useState([])
  const [materials, setMaterials] = useState([])
  const [materialForm, setMaterialForm] = useState({ title: '', description: '', sectionNumber: '', file: null })
  const [activeTab, setActiveTab] = useState('current')
  const [allStudents, setAllStudents] = useState([])
  const [enrollSearch, setEnrollSearch] = useState('')
  const [enrollCohortFilter, setEnrollCohortFilter] = useState('')
  const [selectedEnrollIds, setSelectedEnrollIds] = useState(new Set())
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  const notify = (msg) => {
    setNotice(msg)
    setTimeout(() => setNotice(''), 3500)
  }

  const loadAll = async () => {
    setLoading(true)
    setLoadError('')
    try {
      let courseRes = null
      try {
        courseRes = await apiClient.get(`/courses/${courseId}`)
      } catch (error) {
        if (error?.response?.status === 404) {
          setCourse(null)
          return
        }
        setLoadError('Failed to load course details. Please try again.')
        return
      }

      const [batchesRes, enrollmentsRes, assignmentsRes, materialsRes, studentsRes] = await Promise.allSettled([
        apiClient.get(`/batches?courseId=${courseId}`),
        apiClient.get(`/courses/${courseId}/enrollments`),
        apiClient.get(`/assignments/course/${courseId}`),
        apiClient.get(`/courses/${courseId}/materials`),
        apiClient.get('/students'),
      ])

      setCourse(courseRes.data)
      setEditForm({ ...courseRes.data })

      const nextBatches = batchesRes.status === 'fulfilled' ? batchesRes.value.data : []
      const nextEnrollments = enrollmentsRes.status === 'fulfilled' ? enrollmentsRes.value.data : []
      const nextAssignments = assignmentsRes.status === 'fulfilled' ? assignmentsRes.value.data : []
      const nextMaterials = materialsRes.status === 'fulfilled' ? materialsRes.value.data : []

      if (
        batchesRes.status === 'rejected' ||
        enrollmentsRes.status === 'rejected' ||
        assignmentsRes.status === 'rejected' ||
        materialsRes.status === 'rejected'
      ) {
        notify('Some course sections could not be loaded. You can still view core details.')
      }

      setBatches(nextBatches)
      setAllEnrollments(nextEnrollments)
      setAssignments(nextAssignments)
      setMaterials(nextMaterials)
      if (studentsRes.status === 'fulfilled') setAllStudents(studentsRes.value.data)

      if (nextBatches.length) {
        setSelectedBatchId((prev) => {
          if (prev) {
            const exists = nextBatches.some((b) => String(b.id) === String(prev))
            if (exists) return prev
          }
          // Prefer the ongoing batch as the default selection
          const ongoing = nextBatches.find((b) => b.status === 'ongoing')
          return String((ongoing ?? nextBatches[0]).id)
        })
      } else {
        setSelectedBatchId('')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    apiClient.get('/lecturers').then((r) => setLecturers(r.data)).catch(() => {})
  }, [courseId])

  useEffect(() => {
    if (!selectedBatchId) {
      setBatchStudents([])
      return
    }
    apiClient.get(`/enrollments/batch/${selectedBatchId}`).then((res) => setBatchStudents(res.data))
  }, [selectedBatchId])

  const saveCourse = async (event) => {
    event.preventDefault()
    await apiClient.patch(`/courses/${courseId}`, {
      title: editForm.title,
      description: editForm.description,
      courseCode: editForm.course_code,
      durationWeeks: editForm.duration_weeks,
      minAttendanceRequired: editForm.min_attendance_required,
      hasAssignment: editForm.has_assignment,
      hasExam: editForm.has_exam,
      lecturerName: editForm.lecturer_name,
      classDay: editForm.class_day,
      classTime: editForm.class_time,
    })
    await loadAll()
    setEditing(false)
    notify('Course updated')
  }

  const uploadMaterial = async (event) => {
    event.preventDefault()
    if (!materialForm.file || !materialForm.title.trim()) {
      notify('Material title and file are required')
      return
    }

    const formData = new FormData()
    formData.append('title', materialForm.title.trim())
    formData.append('description', materialForm.description)
    if (materialForm.sectionNumber) {
      formData.append('sectionNumber', materialForm.sectionNumber)
    }
    formData.append('file', materialForm.file)

    await apiClient.post(`/courses/${courseId}/materials`, formData)
    setMaterialForm({ title: '', description: '', sectionNumber: '', file: null })
    await loadAll()
    notify('Material uploaded')
  }

  const sendMaterial = async (materialId) => {
    const response = await apiClient.post(`/courses/${courseId}/materials/${materialId}/send`)
    notify(`Material sent: ${response.data.emailed}/${response.data.deliveredTo} emails delivered`)
  }

  const passCount = useMemo(
    () => allEnrollments.filter((e) => e.result_status === 'Pass').length,
    [allEnrollments]
  )
  const failCount = useMemo(
    () => allEnrollments.filter((e) => e.result_status === 'Fail').length,
    [allEnrollments]
  )
  const enrolledCount = useMemo(
    () => allEnrollments.filter((e) => e.enrollment_status === 'active').length,
    [allEnrollments]
  )

  const waitingReenrollmentStudents = useMemo(() => {
    const activeStudentIds = new Set(
      allEnrollments
        .filter((entry) => entry.enrollment_status === 'active')
        .map((entry) => Number(entry.student_id))
    )

    const latestByStudent = new Map()
    for (const entry of allEnrollments) {
      const studentId = Number(entry.student_id)
      const entryDate = new Date(entry.enrolled_at || entry.completed_at || 0).getTime()
      const existing = latestByStudent.get(studentId)
      const existingDate = existing ? new Date(existing.enrolled_at || existing.completed_at || 0).getTime() : 0
      if (!existing || entryDate >= existingDate) {
        latestByStudent.set(studentId, entry)
      }
    }

    return Array.from(latestByStudent.values()).filter(
      (entry) => entry.result_status === 'Fail' && !activeStudentIds.has(Number(entry.student_id))
    )
  }, [allEnrollments])

  const currentBatch = useMemo(() => batches.find((b) => b.status === 'ongoing'), [batches])

  const upcomingBatch = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return (
      batches
        .filter((b) => b.status === 'upcoming')
        .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))[0] || null
    )
  }, [batches])

  const enrolledStudentIds = useMemo(
    () => new Set(allEnrollments.filter((e) => e.enrollment_status === 'active').map((e) => Number(e.student_id))),
    [allEnrollments]
  )

  const unenrolledStudents = useMemo(() => {
    const search = enrollSearch.toLowerCase()
    return allStudents.filter(
      (s) =>
        !enrolledStudentIds.has(s.id) &&
        (enrollCohortFilter === '' || String(s.cohort_id) === enrollCohortFilter) &&
        (search === '' ||
          s.full_name.toLowerCase().includes(search) ||
          (s.matric_no || '').toLowerCase().includes(search))
    )
  }, [allStudents, enrolledStudentIds, enrollSearch, enrollCohortFilter])

  const enrollCohorts = useMemo(() => {
    const map = new Map()
    allStudents.forEach((s) => {
      if (s.cohort_id && !map.has(s.cohort_id)) {
        map.set(s.cohort_id, s.cohort_name || `Cohort #${s.cohort_id}`)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [allStudents])

  if (loading) {
    return (
      <AppShell title="Course" navItems={lecturerNavItems}>
        <p className="text-slate-500 text-sm">Loading...</p>
      </AppShell>
    )
  }

  if (!course) {
    return (
      <AppShell title="Course Not Found" navItems={lecturerNavItems}>
        <p className="text-slate-500 text-sm">{loadError || 'Course not found.'}</p>
        <Link to="/lecturer/courses" className="text-slate-900 underline text-sm">
          Back to Courses
        </Link>
      </AppShell>
    )
  }

  return (
    <AppShell title={course.title} navItems={lecturerNavItems}>
      {notice ? (
        <div className="mb-4 rounded-lg bg-emerald-100 text-emerald-800 px-4 py-2 text-sm">{notice}</div>
      ) : null}

      {/* Header */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => navigate('/lecturer/courses')}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4"
        >
          <ArrowLeft size={15} /> Back to Courses
        </button>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-900">{course.title}</h2>
                {course.course_code ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-mono text-slate-700">
                    {course.course_code}
                  </span>
                ) : null}
              </div>
              {course.description ? (
                <p className="text-slate-500 mt-2 max-w-2xl">{course.description}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {statusBadge('Assignment', course.has_assignment, 'bg-blue-100 text-blue-800')}
                {statusBadge('Exam', course.has_exam, 'bg-purple-100 text-purple-800')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setEditForm({ ...course }); setEditing(true) }}
              className="flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2 text-sm"
            >
              <Pencil size={14} /> Edit Course
            </button>
          </div>

          <div className="mt-5 grid sm:grid-cols-2 md:grid-cols-4 gap-4 border-t border-slate-100 pt-5">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Duration</p>
              <p className="text-sm font-medium text-slate-800 mt-1">{course.duration_weeks} weeks</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Schedule</p>
              <p className="text-sm font-medium text-slate-800 mt-1">
                {course.class_day || '—'} {course.class_time ? `at ${course.class_time}` : ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Date Range</p>
              <p className="text-sm font-medium text-slate-800 mt-1">
                {fmtDateRange(course.start_date, course.end_date)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Min. Attendance</p>
              <p className="text-sm font-medium text-slate-800 mt-1">{course.min_attendance_required} classes</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Lecturer</p>
              <p className="text-sm font-medium text-slate-800 mt-1">
                {course.lecturer_name || course.assigned_lecturer || '—'}
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-5 grid grid-cols-3 gap-4 border-t border-slate-100 pt-5">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{enrolledCount}</p>
              <p className="text-xs text-slate-400">Currently Enrolled</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600">{passCount}</p>
              <p className="text-xs text-slate-400">Passed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-500">{failCount}</p>
              <p className="text-xs text-slate-400">Failed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Current session banner */}
      {currentBatch ? (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              Currently in session: {currentBatch.name || `Batch #${currentBatch.id}`}
            </p>
            <p className="text-xs text-emerald-600 mt-0.5">
              {fmtDateRange(currentBatch.start_date, currentBatch.end_date)} &mdash; {currentBatch.active_student_count ?? 0} active students
            </p>
          </div>
        </div>
      ) : upcomingBatch ? (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-800">
              Upcoming: {upcomingBatch.name || `Batch #${upcomingBatch.id}`}
            </p>
            <p className="text-xs text-blue-600 mt-0.5">
              Starts {fmtDate(upcomingBatch.start_date)}
            </p>
          </div>
        </div>
      ) : batches.length > 0 ? (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-400 shrink-0" />
          <p className="text-sm text-slate-600">No session currently in progress.</p>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-5 bg-slate-100 rounded-xl p-1 w-fit">
        {[
          { key: 'current', label: 'Active Students', icon: Users },
          { key: 'history', label: 'History', icon: ClipboardList },
          { key: 'waiting', label: 'Awaiting Re-enrollment', icon: Users },
          { key: 'materials', label: 'Materials', icon: BookOpen },
          { key: 'assignments', label: 'Assignments', icon: BookOpen },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Current batch tab */}
      {activeTab === 'current' ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="font-semibold text-slate-900">Active Students</h3>
            <span className="text-sm text-slate-500">{enrolledStudentIds.size} enrolled</span>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="pb-2">Student</th>
                <th>Matric</th>
                <th>Batch</th>
                <th>Result</th>
                <th>Score</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {allEnrollments.filter((e) => e.enrollment_status === 'active').map((e) => (
                <tr key={e.enrollment_id} className="border-t border-slate-200">
                  <td className="py-3">
                    <Link
                      to={`/lecturer/students/${e.student_id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {e.full_name}
                    </Link>
                  </td>
                  <td>{e.matric_no || <span className="italic text-slate-400">pending</span>}</td>
                  <td>{e.cohort_name || <span className="text-slate-300">—</span>}</td>
                  <td>{resultCell({ result_status: e.result_status, enrollment_status: e.enrollment_status })}</td>
                  <td>{e.score ?? '—'}</td>
                  <td className="max-w-50 truncate text-slate-500">{e.notes || '—'}</td>
                </tr>
              ))}
              {enrolledStudentIds.size === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No students currently enrolled in this course.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          {/* Enroll students */}
          <div className="border-t border-slate-100 mt-5 pt-5">
            <h4 className="font-semibold text-slate-900 text-sm mb-3">Enroll Students</h4>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-3">
              <select
                className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]"
                value={enrollCohortFilter}
                onChange={(e) => { setEnrollCohortFilter(e.target.value); setSelectedEnrollIds(new Set()) }}
              >
                <option value="">All Cohorts</option>
                {enrollCohorts.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
              <input
                className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px]"
                placeholder="Search by name or matric…"
                value={enrollSearch}
                onChange={(e) => { setEnrollSearch(e.target.value); setSelectedEnrollIds(new Set()) }}
              />
            </div>

            {/* Bulk action bar */}
            {selectedEnrollIds.size > 0 ? (
              <div className="flex items-center justify-between bg-slate-900 text-white rounded-xl px-4 py-2 mb-3 text-sm">
                <span>{selectedEnrollIds.size} student{selectedEnrollIds.size !== 1 ? 's' : ''} selected</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await apiClient.post('/enrollments/enroll-bulk', {
                          courseId: Number(courseId),
                          studentIds: Array.from(selectedEnrollIds),
                        })
                        await loadAll()
                        setSelectedEnrollIds(new Set())
                        notify(`Enrolled ${res.data.enrolled} student${res.data.enrolled !== 1 ? 's' : ''}${res.data.skipped ? ` (${res.data.skipped} already enrolled)` : ''}`)
                      } catch (err) {
                        notify(err?.response?.data?.message || 'Bulk enroll failed')
                      }
                    }}
                    className="bg-emerald-500 hover:bg-emerald-600 rounded-lg px-3 py-1 text-xs font-medium"
                  >
                    Enroll Selected ({selectedEnrollIds.size})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedEnrollIds(new Set())}
                    className="bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1 text-xs"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : null}

            {/* Student list with checkboxes */}
            {(enrollSearch.length > 0 || enrollCohortFilter !== '') ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {/* Select all header */}
                {unenrolledStudents.length > 0 ? (
                  <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded"
                      checked={unenrolledStudents.every((s) => selectedEnrollIds.has(s.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEnrollIds(new Set(unenrolledStudents.map((s) => s.id)))
                        } else {
                          setSelectedEnrollIds(new Set())
                        }
                      }}
                    />
                    Select all {unenrolledStudents.length > 50 ? `(showing ${Math.min(unenrolledStudents.length, 100)})` : `(${unenrolledStudents.length})`}
                  </div>
                ) : null}
                <div className="max-h-72 overflow-y-auto">
                  {unenrolledStudents.slice(0, 100).map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                      <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded shrink-0"
                          checked={selectedEnrollIds.has(s.id)}
                          onChange={(e) => {
                            setSelectedEnrollIds((prev) => {
                              const next = new Set(prev)
                              if (e.target.checked) next.add(s.id); else next.delete(s.id)
                              return next
                            })
                          }}
                        />
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-slate-900">{s.full_name}</span>
                          {s.matric_no ? <span className="text-xs text-slate-500 ml-2">{s.matric_no}</span> : null}
                          {s.cohort_name ? <span className="text-xs text-slate-400 ml-2">· {s.cohort_name}</span> : null}
                        </div>
                      </label>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await apiClient.post('/enrollments/enroll', { studentId: s.id, courseId: Number(courseId) })
                            await loadAll()
                            notify('Student enrolled successfully')
                          } catch (err) {
                            notify(err?.response?.data?.message || 'Enrollment failed')
                          }
                        }}
                        className="text-xs bg-slate-900 text-white rounded-lg px-3 py-1 shrink-0 ml-2"
                      >
                        Enroll
                      </button>
                    </div>
                  ))}
                  {unenrolledStudents.length === 0 ? (
                    <p className="text-sm text-slate-400 p-3">No matching students to enroll.</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Select a cohort or search to find students to enroll.</p>
            )}
          </div>
        </div>
      ) : null}

      {/* Materials tab */}
      {activeTab === 'materials' ? (
        <div className="grid lg:grid-cols-[360px_1fr] gap-6">
          <form onSubmit={uploadMaterial} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-slate-900">Upload Course Material</h3>
            <p className="text-sm text-slate-500">Upload general materials or assign a section number.</p>

            <label className="text-sm text-slate-600 block">
              Title
              <input
                className="mt-1 w-full border rounded-lg px-3 py-2"
                value={materialForm.title}
                onChange={(e) => setMaterialForm((p) => ({ ...p, title: e.target.value }))}
                required
              />
            </label>

            <label className="text-sm text-slate-600 block">
              Description
              <textarea
                className="mt-1 w-full border rounded-lg px-3 py-2"
                rows={3}
                value={materialForm.description}
                onChange={(e) => setMaterialForm((p) => ({ ...p, description: e.target.value }))}
              />
            </label>

            <label className="text-sm text-slate-600 block">
              Section Number (optional)
              <input
                type="number"
                min="1"
                className="mt-1 w-full border rounded-lg px-3 py-2"
                value={materialForm.sectionNumber}
                onChange={(e) => setMaterialForm((p) => ({ ...p, sectionNumber: e.target.value }))}
                placeholder="e.g. 1"
              />
            </label>

            <label className="text-sm text-slate-600 block">
              PDF/File
              <input
                type="file"
                className="mt-1 w-full border rounded-lg px-3 py-2"
                onChange={(e) => setMaterialForm((p) => ({ ...p, file: e.target.files?.[0] || null }))}
                required
              />
            </label>

            <button className="w-full bg-slate-900 text-white rounded-xl py-2">Upload Material</button>
          </form>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
            <h3 className="font-semibold text-slate-900 mb-4">Stored Materials</h3>
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="pb-2">Title</th>
                  <th>Scope</th>
                  <th>Uploaded</th>
                  <th>File</th>
                  <th>Notify Active Students</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((material) => (
                  <tr key={material.id} className="border-t border-slate-200">
                    <td className="py-3">
                      <p className="font-medium text-slate-900">{material.title}</p>
                      {material.description ? <p className="text-xs text-slate-500 mt-0.5">{material.description}</p> : null}
                    </td>
                    <td>{material.section_number ? `Section ${material.section_number}` : 'General'}</td>
                    <td className="whitespace-nowrap">{fmtDate(material.created_at)}</td>
                    <td>
                      <a
                        href={`${apiBase}${material.material_url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-900 underline"
                      >
                        Open
                      </a>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => sendMaterial(material.id)}
                        className="rounded-lg bg-slate-900 text-white px-3 py-2"
                      >
                        Send Email
                      </button>
                    </td>
                  </tr>
                ))}
                {!materials.length ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">No materials uploaded yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Awaiting re-enrollment tab */}
      {activeTab === 'waiting' ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
          <h3 className="font-semibold text-slate-900 mb-4">Students Awaiting Re-enrollment</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="pb-2">Student</th>
                <th>Matric</th>
                <th>Last Batch</th>
                <th>Last Dates</th>
                <th>Last Result</th>
                <th>Score</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {waitingReenrollmentStudents.map((entry) => (
                <tr key={`waiting-${entry.enrollment_id}`} className="border-t border-slate-200">
                  <td className="py-3">
                    <Link
                      to={`/lecturer/students/${entry.student_id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {entry.full_name}
                    </Link>
                  </td>
                  <td>{entry.matric_no}</td>
                  <td>{entry.batch_id ? `#${entry.batch_id}` : '—'}</td>
                  <td className="whitespace-nowrap">{fmtDateRange(entry.batch_start, entry.batch_end)}</td>
                  <td>
                    <span className="text-red-500 font-semibold">Fail</span>
                  </td>
                  <td>{entry.score ?? '—'}</td>
                  <td className="max-w-55 truncate text-slate-500">{entry.notes || '—'}</td>
                </tr>
              ))}
              {!waitingReenrollmentStudents.length ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No students are currently waiting for re-enrollment.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* All students history tab */}
      {activeTab === 'history' ? (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900">All-Time Enrollment History</h3>
          {(() => {
            // Group enrollments by cohort
            const grouped = {}
            const noCohortKey = '__none__'
            for (const e of allEnrollments) {
              const key = e.cohort_id != null ? String(e.cohort_id) : noCohortKey
              if (!grouped[key]) grouped[key] = { cohortName: e.cohort_name || (e.cohort_id ? `Batch #${e.cohort_id}` : 'No Batch'), rows: [] }
              grouped[key].rows.push(e)
            }
            const sections = Object.values(grouped)
            if (!sections.length) {
              return (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <p className="py-8 text-center text-slate-400">No enrollment history yet.</p>
                </div>
              )
            }
            return sections.map(({ cohortName, rows }) => (
              <div key={cohortName} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
                <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <span className="rounded-full bg-indigo-100 text-indigo-700 px-3 py-0.5 text-xs">{cohortName}</span>
                  <span className="text-slate-400 text-xs font-normal">{rows.length} student{rows.length !== 1 ? 's' : ''}</span>
                </h4>
                <table className="w-full text-sm">
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="pb-2">Student</th>
                      <th>Matric</th>
                      <th>Batch</th>
                      <th>Dates</th>
                      <th>Enrolment</th>
                      <th>Result</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e) => (
                      <tr key={e.enrollment_id} className="border-t border-slate-200">
                        <td className="py-3">
                          <Link
                            to={`/lecturer/students/${e.student_id}`}
                            className="font-medium text-slate-900 hover:underline"
                          >
                            {e.full_name}
                          </Link>
                        </td>
                        <td>{e.matric_no || <span className="text-slate-400">—</span>}</td>
                        <td>{e.batch_id ? `#${e.batch_id}` : '—'}</td>
                        <td className="whitespace-nowrap">{fmtDateRange(e.batch_start, e.batch_end)}</td>
                        <td>{e.enrollment_status}</td>
                        <td>{resultCell({ result_status: e.result_status })}</td>
                        <td>{e.score ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          })()}
        </div>
      ) : null}

      {/* Assignments tab */}
      {activeTab === 'assignments' ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Assignment History</h3>
            {!course.has_assignment ? (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1">
                Assignments disabled for this course
              </span>
            ) : null}
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="pb-2">Title</th>
                <th>Batch</th>
                <th>Due Date</th>
                <th>Created</th>
                <th>Sent To</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-t border-slate-200">
                  <td className="py-3 font-medium">{a.title}</td>
                  <td>{a.batch_id ? `#${a.batch_id}` : '—'}</td>
                  <td>{fmtDate(a.due_date)}</td>
                  <td className="whitespace-nowrap">{fmtDate(a.created_at)}</td>
                  <td>{a.delivery_count} students</td>
                </tr>
              ))}
              {!assignments.length ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No assignments created yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Edit panel */}
      {editing && editForm ? (
        <div className="fixed right-0 top-0 h-full w-105 bg-white border-l border-slate-200 shadow-2xl z-50 overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Edit Course</h3>
            <button type="button" onClick={() => setEditing(false)} className="rounded-lg p-1 hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={saveCourse} className="p-5 space-y-4">
            <label className="text-sm text-slate-600 block">
              Title
              <input
                className="mt-1 w-full border rounded-lg px-3 py-2"
                value={editForm.title || ''}
                onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                required
              />
            </label>

            <label className="text-sm text-slate-600 block">
              Description
              <textarea
                className="mt-1 w-full border rounded-lg px-3 py-2"
                rows={3}
                value={editForm.description || ''}
                onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-slate-600 block">
                Course Code
                <input
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={editForm.course_code || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, course_code: e.target.value }))}
                />
              </label>
              <label className="text-sm text-slate-600 block">
                Lecturer
                <select
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={editForm.lecturer_name || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, lecturer_name: e.target.value }))}
                >
                  <option value="">— No lecturer —</option>
                  {lecturers.map((l) => (
                    <option key={l.id} value={l.name}>{l.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-slate-600 block">
                Duration (weeks)
                <input
                  type="number"
                  min="1"
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={editForm.duration_weeks || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, duration_weeks: e.target.value }))}
                  required
                />
              </label>
              <label className="text-sm text-slate-600 block">
                Min. Attendance
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={editForm.min_attendance_required || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, min_attendance_required: e.target.value }))}
                  required
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-slate-600 block">
                Class Day
                <select
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={editForm.class_day || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, class_day: e.target.value }))}
                >
                  <option value="">—</option>
                  {DAYS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </label>
              <label className="text-sm text-slate-600 block">
                Class Time
                <input
                  type="time"
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={editForm.class_time || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, class_time: e.target.value }))}
                />
              </label>
            </div>

            <div className="border rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-slate-700">Course Features</p>
              <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded"
                  checked={Boolean(editForm.has_assignment)}
                  onChange={(e) => setEditForm((p) => ({ ...p, has_assignment: e.target.checked }))}
                />
                Has Assignments
              </label>
              <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded"
                  checked={Boolean(editForm.has_exam)}
                  onChange={(e) => setEditForm((p) => ({ ...p, has_exam: e.target.checked }))}
                />
                Has Exam
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button type="submit" className="bg-slate-900 text-white rounded-xl py-2">
                Save Changes
              </button>
              <button
                type="button"
                className="bg-slate-100 text-slate-700 rounded-xl py-2"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </AppShell>
  )
}
