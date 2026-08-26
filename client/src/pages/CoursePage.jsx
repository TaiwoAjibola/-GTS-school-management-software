import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Pencil,
  Users,
  X,
  XCircle,
  CalendarDays,
  Clock3,
  Award,
  GraduationCap,
  Sparkles,
  Search,
  Layers,
  Mail,
  Send,
  Copy,
  ShieldAlert,
} from 'lucide-react'
import AppShell from '../components/AppShell'
import apiClient from '../api/client'
import { lecturerNavGroups } from '../constants/lecturerNav'
import { fmtDate, fmtDateRange } from '../utils/formatDate'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const statusBadge = (label, active, tone = 'sky') => (
  active ? (
    <Badge key={label} tone={tone} dot>{label}</Badge>
  ) : (
    <Badge key={label} tone="slate" className="line-through opacity-60">{label}</Badge>
  )
)

const resultCell = (info) => {
  if (!info) return <span className="text-slate-300 text-sm">—</span>
  if (info.result_status === 'Pass')
    return <Badge tone="emerald" dot>✓ Pass</Badge>
  if (info.result_status === 'Fail')
    return <Badge tone="rose" dot>✗ Fail</Badge>
  if (info.enrollment_status === 'active')
    return <Badge tone="sky" dot>Enrolled</Badge>
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
  const [historyCohortFilter, setHistoryCohortFilter] = useState('')
  const [allStudents, setAllStudents] = useState([])
  const [enrollSearch, setEnrollSearch] = useState('')
  const [enrollCohortFilter, setEnrollCohortFilter] = useState('')
  const [selectedEnrollIds, setSelectedEnrollIds] = useState(new Set())
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState(null)
  const [editSecondaryLecturerId, setEditSecondaryLecturerId] = useState('')
  const [editLecturerNotes, setEditLecturerNotes] = useState('')
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [planDates, setPlanDates] = useState(null)
  const [allCourses, setAllCourses] = useState([])
  const [copySourceCourseId, setCopySourceCourseId] = useState('')
  const [copying, setCopying] = useState(false)
  const [withdrawTarget, setWithdrawTarget] = useState(null)
  const [withdrawReason, setWithdrawReason] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)

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

      const [batchesRes, enrollmentsRes, assignmentsRes, materialsRes, studentsRes, activePlanRes] = await Promise.allSettled([
        apiClient.get(`/batches?courseId=${courseId}`),
        apiClient.get(`/courses/${courseId}/enrollments`),
        apiClient.get(`/assignments/course/${courseId}`),
        apiClient.get(`/courses/${courseId}/materials`),
        apiClient.get('/students'),
        apiClient.get('/course-plans/active'),
      ])

      setCourse(courseRes.data)
      setEditForm({ ...courseRes.data })
      setEditSecondaryLecturerId(courseRes.data.secondary_lecturer_id || '')
      setEditLecturerNotes(courseRes.data.lecturer_notes || '')

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

      if (activePlanRes.status === 'fulfilled' && activePlanRes.value.data) {
        const activePlan = activePlanRes.value.data
        const planItem = (activePlan.items || []).find((item) => Number(item.course_id) === Number(courseId))
        if (planItem && (planItem.start_date || planItem.end_date)) {
          setPlanDates({ start_date: planItem.start_date, end_date: planItem.end_date, planName: activePlan.name })
        } else {
          setPlanDates(null)
        }
      } else {
        setPlanDates(null)
      }

      if (nextBatches.length) {
        setSelectedBatchId((prev) => {
          if (prev) {
            const exists = nextBatches.some((b) => String(b.id) === String(prev))
            if (exists) return prev
          }
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
    apiClient.get('/courses').then((r) => setAllCourses(r.data)).catch(() => {})
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
      secondaryLecturerId: editSecondaryLecturerId || null,
      lecturerNotes: editLecturerNotes || '',
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

  const otherCourses = useMemo(
    () => allCourses.filter((c) => Number(c.id) !== Number(courseId)),
    [allCourses, courseId]
  )

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
      <AppShell title="Course" groups={lecturerNavGroups}>
        <div className="h-full flex flex-col gap-4 overflow-hidden">
          <div className="shrink-0 space-y-4">
            <div className="h-8 w-36 skeleton rounded-full" />
            <div className="h-28 skeleton rounded-[1.5rem]" />
            <div className="grid lg:grid-cols-12 gap-4">
              <div className="lg:col-span-8 h-48 skeleton rounded-[1.5rem]" />
              <div className="lg:col-span-4 grid grid-cols-3 lg:grid-cols-1 gap-3">
                <div className="h-24 skeleton rounded-[1.5rem]" />
                <div className="h-24 skeleton rounded-[1.5rem]" />
                <div className="h-24 skeleton rounded-[1.5rem]" />
              </div>
            </div>
          </div>
          <p className="text-slate-500 text-sm font-mono">Loading course…</p>
        </div>
      </AppShell>
    )
  }

  if (!course) {
    return (
      <AppShell title="Course Not Found" groups={lecturerNavGroups}>
        <div className="card card-hover max-w-lg mx-auto mt-10 text-center">
          <div className="card-pad py-10">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4">
              <ShieldAlert size={22} />
            </div>
            <p className="text-slate-500 text-sm font-mono">{loadError || 'Course not found.'}</p>
            <Link to="/lecturer/courses" className="btn btn-sm lift gap-2 btn-primary mt-4">
              <ArrowLeft size={14} /> Back to Courses
            </Link>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title={course.title} groups={lecturerNavGroups}>
      <div className="h-full flex flex-col gap-4 overflow-hidden">
      {notice ? (
        <div className="shrink-0 flex items-center gap-3 rounded-2xl bg-indigo-600 text-white px-4 py-3 text-sm font-medium shadow-lg shadow-indigo-200">
          <span className="h-7 w-7 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <Sparkles size={14} className="text-white" />
          </span>
          <span className="flex-1 min-w-0 truncate">{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="h-7 w-7 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center shrink-0 transition-colors">
            <X size={14} />
          </button>
        </div>
      ) : null}

      {/* Header — dramatic indigo bento */}
      <div className="shrink-0 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/lecturer/courses')}
            className="btn btn-ghost btn-sm lift gap-2"
          >
            <ArrowLeft size={15} /> Back to Courses
          </button>
          <div className="hidden sm:flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
              <Layers size={12} /> {batches.length} batches
            </span>
            {course.course_code ? (
              <span className="font-mono text-[11px] font-bold tracking-widest uppercase rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600">{course.course_code}</span>
            ) : null}
          </div>
        </div>

        {/* Bento hero: meta + stats */}
        <div className="grid lg:grid-cols-12 gap-4">
          {/* Course meta — 8 col */}
          <section className="card card-hover lg:col-span-8 flex flex-col">
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-violet-500 to-indigo-600" />
            <div className="card-pad space-y-4 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {course.course_code ? <Badge tone="slate" className="font-mono tracking-widest text-[11px]">{course.course_code}</Badge> : null}
                {statusBadge('Assignment', course.has_assignment, 'sky')}
                {statusBadge('Exam', course.has_exam, 'gold')}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                  <CalendarDays size={12} /> {course.duration_weeks} weeks
                </span>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-indigo-50 bg-gradient-to-br from-indigo-50/70 to-white p-3.5 group hover:border-indigo-100 transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="h-7 w-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <Clock3 size={13} />
                    </span>
                    <p className="text-[11px] font-bold tracking-widest uppercase text-indigo-600">Duration</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 ml-9">{course.duration_weeks} weeks</p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 hover:border-slate-200 transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="h-7 w-7 rounded-xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                      <CalendarDays size={13} />
                    </span>
                    <p className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Schedule</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 ml-9 truncate">
                    {course.class_day || '—'} {course.class_time ? `· ${course.class_time}` : ''}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 hover:border-slate-200 transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="h-7 w-7 rounded-xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                      <CalendarDays size={13} />
                    </span>
                    <p className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Course Date Range</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 ml-9 font-mono text-xs">{fmtDateRange(course.start_date, course.end_date)}</p>
                </div>

                {planDates ? (
                  <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-3.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="h-7 w-7 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0">
                        <Sparkles size={13} />
                      </span>
                      <p className="text-[11px] font-bold tracking-widest uppercase text-violet-600">Year Plan Dates</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 ml-9 font-mono text-xs">
                      {fmtDateRange(planDates.start_date, planDates.end_date)}
                      <span className="ml-1.5 inline-flex items-center rounded-full bg-violet-600 px-2 py-0.5 text-[10px] leading-none font-bold text-white tracking-wide">{planDates.planName}</span>
                    </p>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 hover:border-slate-200 transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="h-7 w-7 rounded-xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                      <Award size={13} />
                    </span>
                    <p className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Min. Attendance</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 ml-9">{course.min_attendance_required} classes</p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 hover:border-slate-200 transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="h-7 w-7 rounded-xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                      <GraduationCap size={13} />
                    </span>
                    <p className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Lecturer</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 ml-9 truncate">{course.lecturer_name || course.assigned_lecturer || '—'}</p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 hover:border-slate-200 transition-colors sm:col-span-2 lg:col-span-3 xl:col-span-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="h-7 w-7 rounded-xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
                      <Users size={13} />
                    </span>
                    <p className="text-[11px] font-bold tracking-widest uppercase text-slate-500">Secondary Lecturer</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 ml-9 truncate">{course.secondary_lecturer_name || '—'}</p>
                </div>
              </div>

              {course.secondary_lecturer_name || course.lecturer_notes ? (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 px-4 py-3 flex items-start gap-3">
                  <span className="h-8 w-8 rounded-xl bg-white border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
                    <BookOpen size={14} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold tracking-widest uppercase text-indigo-600">Lecturer Notes</p>
                    <p className="text-sm text-slate-700 mt-1 leading-relaxed">{course.lecturer_notes || editLecturerNotes || 'No notes'}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          {/* Stats — 4 col bento stack */}
          <div className="lg:col-span-4 grid grid-cols-3 lg:grid-cols-1 gap-3">
            <Card value={enrolledCount} title="Currently Enrolled" icon={<Users size={20} />} accent="sky" className="stat-hover !p-0 !border-indigo-100 hover:!border-indigo-200 shadow-sm hover:shadow-md transition-all" />
            <Card value={passCount} title="Passed" icon={<CheckCircle2 size={20} />} accent="emerald" className="stat-hover shadow-sm hover:shadow-md transition-all" />
            <Card value={failCount} title="Failed" icon={<XCircle size={20} />} accent="rose" className="stat-hover shadow-sm hover:shadow-md transition-all" />
          </div>
        </div>
      </div>

      {/* Plan dates banner */}
      {planDates && !currentBatch ? (
        <div className="shrink-0 flex items-center gap-3 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white px-5 py-3.5 shadow-sm">
          <span className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-200">
            <Sparkles size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight text-indigo-900" style={{ fontFamily: 'var(--font-display)' }}>
              Scheduled in Year Plan: {fmtDateRange(planDates.start_date, planDates.end_date)}
            </p>
            <p className="text-xs font-medium text-indigo-600 mt-0.5">
              {planDates.planName}
            </p>
          </div>
          <Badge tone="slate" className="ml-auto hidden sm:inline-flex font-mono">PLAN</Badge>
        </div>
      ) : null}

      {/* Current session banner */}
      {currentBatch ? (
        <div className="shrink-0 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-5 py-3.5 shadow-sm">
          <span className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-200 relative">
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 border-2 border-white animate-pulse" />
            <Clock3 size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight text-emerald-900" style={{ fontFamily: 'var(--font-display)' }}>
              Currently in session: {currentBatch.name || `Batch #${currentBatch.id}`}
            </p>
            <p className="text-xs font-medium text-emerald-700 mt-0.5 font-mono">
              {fmtDateRange(currentBatch.start_date, currentBatch.end_date)} · {currentBatch.active_student_count ?? 0} active students
            </p>
          </div>
          <span className="ml-auto hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> LIVE
          </span>
        </div>
      ) : upcomingBatch ? (
        <div className="shrink-0 flex items-center gap-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-white px-5 py-3.5 shadow-sm">
          <span className="h-9 w-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-violet-200">
            <CalendarDays size={16} />
          </span>
          <div>
            <p className="text-sm font-bold tracking-tight text-violet-900" style={{ fontFamily: 'var(--font-display)' }}>
              Upcoming: {upcomingBatch.name || `Batch #${upcomingBatch.id}`}
            </p>
            <p className="text-xs font-medium text-violet-700 mt-0.5">
              Starts {fmtDate(upcomingBatch.start_date)}
            </p>
          </div>
          <Badge tone="amber" className="ml-auto hidden sm:inline-flex">UPCOMING</Badge>
        </div>
      ) : batches.length > 0 ? (
        <div className="shrink-0 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm">
          <span className="h-9 w-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
            <Clock3 size={16} />
          </span>
          <p className="text-sm font-medium text-slate-600">No session currently in progress.</p>
          <Badge tone="slate" className="ml-auto hidden sm:inline-flex">IDLE</Badge>
        </div>
      ) : null}

      {/* Tabs — indigo pill */}
      <div className="shrink-0 flex flex-wrap gap-1.5 bg-white border border-slate-200 rounded-2xl p-1.5 w-fit shadow-sm">
        {[
          { key: 'current', label: 'Active Students', icon: Users, count: enrolledStudentIds.size },
          { key: 'history', label: 'History', icon: ClipboardList, count: allEnrollments.length },
          { key: 'waiting', label: 'Awaiting Re-enrollment', icon: ShieldAlert, count: waitingReenrollmentStudents.length },
          { key: 'materials', label: 'Materials', icon: BookOpen, count: materials.length },
          { key: 'assignments', label: 'Assignments', icon: Layers, count: assignments.length },
        ].map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === key
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Icon size={14} />
            {label}
            <span className={`hidden sm:inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold min-w-5 h-5 leading-none ${activeTab === key ? 'bg-white text-indigo-600' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Current batch tab */}
      {activeTab === 'current' ? (
        <Card title="Active Students" action={<span className="inline-flex items-center gap-2 text-sm font-medium text-slate-500"><span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />{enrolledStudentIds.size} enrolled</span>} className="flex-1 min-h-0 overflow-auto !p-0 border-slate-200 shadow-sm">
          <div className="p-5 flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-auto rounded-2xl border border-slate-200">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th >Student</th>
                    <th>Matric</th>
                    <th>Batch</th>
                    <th>Result</th>
                    <th>Score</th>
                    <th>Notes</th>
                    <th className="w-20">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allEnrollments.filter((e) => e.enrollment_status === 'active').map((e) => (
                    <tr key={e.enrollment_id} className="border-t border-slate-200">
                      <td className="py-3">
                        <Link
                          to={`/lecturer/students/${e.student_id}`}
                          className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors"
                        >
                          {e.full_name}
                        </Link>
                      </td>
                      <td><span className="font-mono text-xs font-medium text-slate-700">{e.matric_no || <span className="italic text-slate-400">pending</span>}</span></td>
                      <td>{e.cohort_name ? <Badge tone="slate">{e.cohort_name}</Badge> : <span className="text-slate-300">—</span>}</td>
                      <td>{resultCell({ result_status: e.result_status, enrollment_status: e.enrollment_status })}</td>
                      <td><span className="font-mono text-sm font-semibold text-slate-900">{e.score ?? '—'}</span></td>
                      <td className="max-w-50 truncate text-slate-500">{e.notes || '—'}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => setWithdrawTarget(e)}
                          className="btn btn-danger btn-sm lift gap-2"
                        >
                          Withdraw
                        </button>
                      </td>
                    </tr>
                  ))}
                  {enrolledStudentIds.size === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span className="h-12 w-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                            <Users size={20} />
                          </span>
                          <p className="text-sm font-medium text-slate-400">No students currently enrolled in this course.</p>
                          <p className="text-xs text-slate-400">Use the enroll panel below to add students.</p>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {/* Enroll students — indigo bento block */}
          <div className="m-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-white to-violet-50/30 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
                <Sparkles size={16} />
              </span>
              <div>
                <h4 className="font-bold tracking-tight text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>Enroll Students</h4>
                <p className="text-xs text-slate-500">Add new students to this course</p>
              </div>
              <span className="ml-auto hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white border border-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm">
                {unenrolledStudents.length} available
              </span>
            </div>

            {/* Copy from another course */}
            {otherCourses.length > 0 ? (
              <div className="rounded-2xl border border-indigo-200 bg-white p-3.5 shadow-sm">
                <p className="text-[11px] font-bold tracking-widest uppercase text-indigo-600 mb-2 flex items-center gap-1.5">
                  <Copy size={12} /> Quick Copy — Use Students From Another Course
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm flex-1 min-w-40 bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                    value={copySourceCourseId}
                    onChange={(e) => setCopySourceCourseId(e.target.value)}
                  >
                    <option value="">Select a course…</option>
                    {otherCourses
                      .filter((c) => Number(c.total_enrolled_students) > 0)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} ({c.total_enrolled_students} students)
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    disabled={!copySourceCourseId || copying}
                    onClick={async () => {
                      setCopying(true)
                      try {
                        const res = await apiClient.post('/enrollments/copy-from-course', {
                          targetCourseId: Number(courseId),
                          sourceCourseId: Number(copySourceCourseId),
                        })
                        await loadAll()
                        setCopySourceCourseId('')
                        notify(`Copied ${res.data.copied} student${res.data.copied !== 1 ? 's' : ''}${res.data.skipped ? ` (${res.data.skipped} already enrolled)` : ''}`)
                      } catch (err) {
                        notify(err?.response?.data?.message || 'Copy failed')
                      } finally {
                        setCopying(false)
                      }
                    }}
                    className="btn btn-sm lift gap-2 btn-primary shrink-0 disabled:opacity-50"
                  >
                    {copying ? 'Copying…' : 'Copy Students'}
                  </button>
                </div>
              </div>
            ) : null}

            {/* Filters */}
            <div className="grid sm:grid-cols-2 gap-2">
              <div className="relative">
                <select
                  className="w-full appearance-none border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                  value={enrollCohortFilter}
                  onChange={(e) => { setEnrollCohortFilter(e.target.value); setSelectedEnrollIds(new Set()) }}
                >
                  <option value="">All Cohorts</option>
                  {enrollCohorts.map((c) => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
                <Layers size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              <div className="relative">
                <input
                  className="w-full border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm bg-white placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                  placeholder="Search by name or matric…"
                  value={enrollSearch}
                  onChange={(e) => { setEnrollSearch(e.target.value); setSelectedEnrollIds(new Set()) }}
                />
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Bulk action bar */}
            {selectedEnrollIds.size > 0 ? (
              <div className="flex items-center justify-between bg-indigo-600 text-white rounded-2xl px-4 py-3 text-sm shadow-lg shadow-indigo-200">
                <span className="font-semibold flex items-center gap-2">
                  <span className="h-7 w-7 rounded-xl bg-white text-indigo-600 flex items-center justify-center font-bold text-xs">{selectedEnrollIds.size}</span>
                  {selectedEnrollIds.size} student{selectedEnrollIds.size !== 1 ? 's' : ''} selected
                </span>
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
                    className="bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl px-4 py-1.5 text-xs font-bold shadow-sm transition-colors"
                  >
                    Enroll Selected ({selectedEnrollIds.size})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedEnrollIds(new Set())}
                    className="bg-white/15 hover:bg-white/25 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : null}

            {/* Student list with checkboxes */}
            {(enrollSearch.length > 0 || enrollCohortFilter !== '') ? (
              <div className="border border-indigo-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                {/* Select all header */}
                {unenrolledStudents.length > 0 ? (
                  <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50 border-b border-indigo-100 text-xs font-semibold text-indigo-700">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
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
                    <span className="ml-auto text-indigo-600 font-normal">Tap to select</span>
                  </div>
                ) : null}
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {unenrolledStudents.slice(0, 100).map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-4 py-3 hover:bg-indigo-50/50 transition-colors group">
                      <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 shrink-0"
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
                          <span className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">{s.full_name}</span>
                          {s.matric_no ? <span className="font-mono text-xs text-slate-500 ml-2 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-full">{s.matric_no}</span> : null}
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
                        className="btn lift gap-2 btn-primary btn-sm shrink-0 ml-2"
                      >
                        Enroll
                      </button>
                    </div>
                  ))}
                  {unenrolledStudents.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-sm font-medium text-slate-400">No matching students to enroll.</p>
                      <p className="text-xs text-slate-400 mt-1">Try another cohort or search term.</p>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/50 px-4 py-6 text-center">
                <div className="mx-auto h-10 w-10 rounded-xl bg-white border border-indigo-100 flex items-center justify-center text-indigo-500 mb-2">
                  <Search size={16} />
                </div>
                <p className="text-sm font-medium text-slate-600">Select a cohort or search to find students to enroll.</p>
                <p className="text-xs text-slate-400 mt-1">Use the filters above to discover available students.</p>
              </div>
            )}
          </div>
      </Card>
      ) : null}

      {/* Materials tab — bento */}
      {activeTab === 'materials' ? (
        <div className="grid lg:grid-cols-[380px_1fr] gap-4 flex-1 min-h-0 overflow-hidden">
          <form onSubmit={uploadMaterial} className="card card-hover flex flex-col overflow-hidden max-h-[65vh]">
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-violet-500 to-indigo-600 shrink-0" />
            <div className="shrink-0 px-5 py-4 border-b border-slate-100 bg-white flex items-start gap-3">
              <span className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-200">
                <Send size={16} />
              </span>
              <div>
                <h3 className="font-bold tracking-tight text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>Upload Course Material</h3>
                <p className="text-sm text-slate-500 mt-0.5">Upload general materials or assign a section number.</p>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
              <label className="block">
                <span className="field-label">Title</span>
                <input
                  className="input"
                  value={materialForm.title}
                  onChange={(e) => setMaterialForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Week 3 — Data Modelling"
                  required
                />
              </label>

              <label className="block">
                <span className="field-label">Description</span>
                <textarea
                  className="textarea"
                  rows={3}
                  value={materialForm.description}
                  onChange={(e) => setMaterialForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Brief description for students…"
                />
              </label>

              <label className="block">
                <span className="field-label">Section Number <span className="font-normal text-slate-400">(optional)</span></span>
                <input
                  type="number"
                  min="1"
                  className="input"
                  value={materialForm.sectionNumber}
                  onChange={(e) => setMaterialForm((p) => ({ ...p, sectionNumber: e.target.value }))}
                  placeholder="e.g. 1"
                />
              </label>

              <label className="block">
                <span className="field-label">PDF / File</span>
                <input
                  type="file"
                  className="input py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-indigo-700 hover:file:bg-indigo-100 file:transition-colors"
                  onChange={(e) => setMaterialForm((p) => ({ ...p, file: e.target.files?.[0] || null }))}
                  required
                />
              </label>

              </div>
            <div className="shrink-0 px-5 py-4 border-t border-slate-100 bg-white">
              <button className="btn btn-sm lift gap-2 btn-primary w-full justify-center py-3 text-sm">
                <Send size={14} /> Upload Material
              </button>
            </div>
          </form>

          <div className="card !p-0 flex flex-col min-h-0">
            <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-slate-100">
              <h3 className="card-title flex items-center gap-2">
                <span className="h-8 w-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <BookOpen size={14} />
                </span>
                Stored Materials
              </h3>
              <Badge tone="slate" className="font-mono">{materials.length} files</Badge>
            </div>
            <div className="overflow-auto flex-1">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th >Title</th>
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
                        <p className="font-semibold text-slate-900">{material.title}</p>
                        {material.description ? <p className="text-xs text-slate-500 mt-0.5 max-w-64 truncate">{material.description}</p> : null}
                      </td>
                      <td>{material.section_number ? <Badge tone="sky">Section {material.section_number}</Badge> : <Badge tone="slate">General</Badge>}</td>
                      <td className="whitespace-nowrap font-mono text-xs text-slate-600">{fmtDate(material.created_at)}</td>
                      <td>
                        <a
                          href={`${apiBase}${material.material_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-ghost btn-sm lift gap-2"
                        >
                          Open
                        </a>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => sendMaterial(material.id)}
                          className="btn btn-primary btn-sm lift gap-2"
                        >
                          <Mail size={12} /> Send Email
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!materials.length ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-400">
                            <BookOpen size={20} />
                          </span>
                          <p className="text-sm font-medium text-slate-400">No materials uploaded yet.</p>
                          <p className="text-xs text-slate-400">Upload your first file to share with active students.</p>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* Awaiting re-enrollment tab */}
      {activeTab === 'waiting' ? (
        <div className="card !p-0 flex flex-col flex-1 min-h-0">
          <div className="px-5 py-4 flex items-center justify-between gap-2 border-b border-slate-100 shrink-0">
            <h3 className="card-title flex items-center gap-2">
              <span className="h-8 w-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <ShieldAlert size={14} />
              </span>
              Students Awaiting Re-enrollment
            </h3>
            <Badge tone="amber">{waitingReenrollmentStudents.length} waiting</Badge>
          </div>
          <div className="overflow-auto flex-1">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th >Student</th>
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
                        className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors"
                      >
                        {entry.full_name}
                      </Link>
                    </td>
                    <td><span className="font-mono text-xs font-medium bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">{entry.matric_no}</span></td>
                    <td><Badge tone="slate">#{entry.batch_id || '—'}</Badge></td>
                    <td className="whitespace-nowrap font-mono text-xs text-slate-600">{fmtDateRange(entry.batch_start, entry.batch_end)}</td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-1 text-xs font-bold text-rose-700">
                        <XCircle size={12} /> Fail
                      </span>
                    </td>
                    <td><span className="font-mono font-semibold text-slate-900">{entry.score ?? '—'}</span></td>
                    <td className="max-w-55 truncate text-slate-500">{entry.notes || '—'}</td>
                  </tr>
                ))}
                {!waitingReenrollmentStudents.length ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                          <CheckCircle2 size={20} />
                        </span>
                        <p className="text-sm font-medium text-slate-500">No students are currently waiting for re-enrollment.</p>
                        <p className="text-xs text-slate-400">All failed students have been re-enrolled or are active.</p>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* All students history tab — course history by batch (batch filter) */}
      {activeTab === 'history' ? (
        <div className="space-y-4 flex-1 min-h-0 overflow-auto pr-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-bold tracking-tight text-slate-900" style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem' }}>All-Time Enrollment History</h3>
            <span className="h-px flex-1 bg-slate-200 hidden sm:block" />
            <select
              className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium bg-white"
              value={historyCohortFilter}
              onChange={(e) => setHistoryCohortFilter(e.target.value)}
            >
              <option value="">All Batches</option>
              {Array.from(
                new Map(
                  allEnrollments
                    .filter((e) => e.cohort_id != null)
                    .map((e) => [String(e.cohort_id), e.cohort_name || `Batch #${e.cohort_id}`])
                ).entries()
              ).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            <Badge tone="slate" className="font-mono">{historyCohortFilter ? allEnrollments.filter((e) => String(e.cohort_id || '') === historyCohortFilter).length : allEnrollments.length} records</Badge>
          </div>
          {(() => {
            const filtered = historyCohortFilter ? allEnrollments.filter((e) => String(e.cohort_id || '') === historyCohortFilter) : allEnrollments
            const grouped = {}
            const noCohortKey = '__none__'
            for (const e of filtered) {
              const key = e.cohort_id != null ? String(e.cohort_id) : noCohortKey
              if (!grouped[key]) grouped[key] = { cohortName: e.cohort_name || (e.cohort_id ? `Batch #${e.cohort_id}` : 'No Batch'), rows: [] }
              grouped[key].rows.push(e)
            }
            const sections = Object.values(grouped)
            if (!sections.length) {
              return (
                <div className="card text-center py-12">
                  <p className="text-sm text-slate-400">No enrollment history yet.</p>
                </div>
              )
            }
            return sections.map(({ cohortName, rows }) => (
              <div key={cohortName} className="card !p-0 overflow-hidden">
                <div className="px-5 py-4 flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-indigo-50/50 to-white">
                  <span className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
                    <Layers size={12} /> {cohortName}
                  </span>
                  <span className="text-xs font-medium text-slate-500">{rows.length} student{rows.length !== 1 ? 's' : ''}</span>
                  <span className="ml-auto h-2 w-2 rounded-full bg-indigo-400" />
                </div>
                <div className="overflow-auto">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th >Student</th>
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
                              className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors"
                            >
                              {e.full_name}
                            </Link>
                          </td>
                          <td><span className="font-mono text-xs font-medium text-slate-700">{e.matric_no || <span className="text-slate-400">—</span>}</span></td>
                          <td><Badge tone="slate">#{e.batch_id || '—'}</Badge></td>
                          <td className="whitespace-nowrap font-mono text-xs text-slate-600">{fmtDateRange(e.batch_start, e.batch_end)}</td>
                          <td><Badge tone={e.enrollment_status === 'active' ? 'sky' : 'slate'} dot={e.enrollment_status === 'active'}>{e.enrollment_status}</Badge></td>
                          <td>{resultCell({ result_status: e.result_status })}</td>
                          <td><span className="font-mono font-semibold">{e.score ?? '—'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          })()}
        </div>
      ) : null}

      {/* Assignments tab */}
      {activeTab === 'assignments' ? (
        <div className="card !p-0 flex flex-col flex-1 min-h-0">
          <div className="px-5 py-4 flex items-center justify-between gap-2 border-b border-slate-100 shrink-0">
            <h3 className="card-title flex items-center gap-2">
              <span className="h-8 w-8 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-600">
                <ClipboardList size={14} />
              </span>
              Assignment History
            </h3>
            {!course.has_assignment ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5">
                <ShieldAlert size={12} /> Assignments disabled for this course
              </span>
            ) : (
              <Badge tone="slate" className="font-mono">{assignments.length} assignments</Badge>
            )}
          </div>
          <div className="overflow-auto flex-1">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th >Title</th>
                  <th>Batch</th>
                  <th>Due Date</th>
                  <th>Created</th>
                  <th>Sent To</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-t border-slate-200">
                    <td className="py-3 font-semibold text-slate-900">{a.title}</td>
                    <td><Badge tone="slate">#{a.batch_id || '—'}</Badge></td>
                    <td className="font-mono text-xs text-slate-600">{fmtDate(a.due_date)}</td>
                    <td className="whitespace-nowrap font-mono text-xs text-slate-600">{fmtDate(a.created_at)}</td>
                    <td><span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700"><Users size={12} /> {a.delivery_count} students</span></td>
                  </tr>
                ))}
                {!assignments.length ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="h-12 w-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                          <ClipboardList size={20} />
                        </span>
                        <p className="text-sm font-medium text-slate-400">No assignments created yet.</p>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Edit panel */}
      {/* Withdraw modal */}
      {withdrawTarget ? (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setWithdrawTarget(null)}>
          <div className="bg-white rounded-[24px] shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden isolate" onClick={(e) => e.stopPropagation()}>
            <div className="shrink-0 px-6 py-4 border-b border-slate-100 bg-white">
              <div className="h-1 -mx-6 -mt-4 mb-4 bg-gradient-to-r from-rose-500 via-orange-500 to-rose-600" />
              <div className="flex items-start gap-3">
                <span className="h-10 w-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                  <XCircle size={18} />
                </span>
                <div>
                  <h3 className="font-bold tracking-tight text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>Withdraw Student</h3>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                    Remove <strong className="text-slate-900">{withdrawTarget.full_name}</strong> from this course? Their enrollment will be marked as withdrawn.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
              <label className="block">
                <span className="field-label">Reason <span className="font-normal text-slate-400">(optional)</span></span>
                <input
                  className="input"
                  placeholder="e.g. Student requested withdrawal, transferred, etc."
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                />
              </label>
            </div>
            <div className="shrink-0 px-6 py-4 border-t border-slate-100 bg-white flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setWithdrawTarget(null); setWithdrawReason('') }}
                className="btn btn-sm lift gap-2 btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={withdrawing}
                onClick={async () => {
                  setWithdrawing(true)
                  try {
                    await apiClient.post(`/enrollments/${withdrawTarget.enrollment_id}/withdraw`, { reason: withdrawReason || null })
                    await loadAll()
                    setWithdrawTarget(null)
                    setWithdrawReason('')
                    notify('Student withdrawn from course')
                  } catch (err) {
                    notify(err?.response?.data?.message || 'Withdrawal failed')
                  } finally {
                    setWithdrawing(false)
                  }
                }}
                className="btn btn-sm lift gap-2 bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 shadow-md shadow-rose-200"
              >
                {withdrawing ? 'Withdrawing...' : 'Confirm Withdrawal'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editing && editForm ? (
        <div className="fixed right-0 top-0 h-full w-[420px] max-w-[92vw] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col overflow-hidden isolate">
          <div className="shrink-0 bg-white/90 backdrop-blur-xl border-b border-slate-200 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                <Pencil size={14} />
              </span>
              <h3 className="font-bold tracking-tight text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>Edit Course</h3>
            </div>
            <button type="button" onClick={() => setEditing(false)} className="h-8 w-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={saveCourse} id="course-edit-form" className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
            <label className="block">
              <span className="field-label">Title</span>
              <input
                className="input"
                value={editForm.title || ''}
                onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                required
              />
            </label>

            <label className="block">
              <span className="field-label">Description</span>
              <textarea
                className="textarea"
                rows={3}
                value={editForm.description || ''}
                onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
              />
            </label>

            <label className="block">
              <span className="field-label">Lecturer Notes</span>
              <textarea
                className="textarea"
                rows={2}
                value={editLecturerNotes}
                onChange={(e) => setEditLecturerNotes(e.target.value)}
                placeholder="Optional session notes for secondary lecturer"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="field-label">Course Code</span>
                <input
                  className="input font-mono text-sm"
                  value={editForm.course_code || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, course_code: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="field-label">Lecturer</span>
                <select
                  className="select"
                  value={editForm.lecturer_name || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, lecturer_name: e.target.value }))}
                >
                  <option value="">— No lecturer —</option>
                  {lecturers.map((l) => (
                    <option key={l.id} value={l.name}>{l.name}</option>
                  ))}
                </select>
              </label>
              <label className="block col-span-2">
                <span className="field-label">Secondary Lecturer</span>
                <select
                  className="select"
                  value={editSecondaryLecturerId}
                  onChange={(e) => setEditSecondaryLecturerId(e.target.value)}
                >
                  <option value="">— No secondary lecturer —</option>
                  {lecturers.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="field-label">Duration (weeks)</span>
                <input
                  type="number"
                  min="1"
                  className="input"
                  value={editForm.duration_weeks || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, duration_weeks: e.target.value }))}
                  required
                />
              </label>
              <label className="block">
                <span className="field-label">Min. Attendance</span>
                <input
                  type="number"
                  min="0"
                  className="input"
                  value={editForm.min_attendance_required || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, min_attendance_required: e.target.value }))}
                  required
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="field-label">Class Day</span>
                <select
                  className="select"
                  value={editForm.class_day || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, class_day: e.target.value }))}
                >
                  <option value="">—</option>
                  {DAYS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="field-label">Class Time</span>
                <input
                  type="time"
                  className="input"
                  value={editForm.class_time || ''}
                  onChange={(e) => setEditForm((p) => ({ ...p, class_time: e.target.value }))}
                />
              </label>
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
              <p className="text-sm font-bold tracking-tight text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>Course Features</p>
              <label className="flex items-center gap-3 text-sm font-medium text-slate-700 cursor-pointer group">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                  checked={Boolean(editForm.has_assignment)}
                  onChange={(e) => setEditForm((p) => ({ ...p, has_assignment: e.target.checked }))}
                />
                <span className="flex items-center gap-2"><ClipboardList size={14} className="text-indigo-500" /> Has Assignments</span>
              </label>
              <label className="flex items-center gap-3 text-sm font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                  checked={Boolean(editForm.has_exam)}
                  onChange={(e) => setEditForm((p) => ({ ...p, has_exam: e.target.checked }))}
                />
                <span className="flex items-center gap-2"><Award size={14} className="text-violet-500" /> Has Exam</span>
              </label>
            </div>
            </div>
            <div className="shrink-0 px-6 py-4 border-t border-slate-100 bg-white grid grid-cols-2 gap-2">
              <button type="submit" form="course-edit-form" className="btn btn-sm lift gap-2 btn-primary py-3">
                Save Changes
              </button>
              <button
                type="button"
                className="btn btn-sm lift gap-2 btn-ghost py-3"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
      </div>
    </AppShell>
  )
}
