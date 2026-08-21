import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, UserPlus } from 'lucide-react'
import AppShell from '../components/AppShell'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import apiClient from '../api/client'
import { lecturerNavGroups } from '../constants/lecturerNav'
import { fmtDate, fmtDateRange } from '../utils/formatDate'

const COHORT_STATUS_META = {
  active: { label: 'Active', tone: 'emerald' },
  upcoming: { label: 'Upcoming', tone: 'sky' },
  completed: { label: 'Completed', tone: 'slate' },
}

const CANDIDATE_REASON_META = {
  retake_failed: { label: 'Retake (Failed)', tone: 'rose' },
  rejoin_withdrawn: { label: 'Rejoin (Withdrawn)', tone: 'amber' },
  new_candidate: { label: 'New Candidate', tone: 'sky' },
}

const CANDIDATE_REASON_ORDER = ['retake_failed', 'rejoin_withdrawn', 'new_candidate']

const STUDENT_STATUS_TONE = {
  active: 'emerald',
  completed: 'sky',
  failed: 'rose',
}

export default function EnrollmentPage() {
  const [courses, setCourses] = useState([])
  const [selectedCourseId, setSelectedCourseId] = useState(null)
  const [currentCourseId, setCurrentCourseId] = useState(null)
  const [cohorts, setCohorts] = useState([])
  const [selectedCohortId, setSelectedCohortId] = useState(null)
  const [courseEnrollments, setCourseEnrollments] = useState([])
  const [candidateStudents, setCandidateStudents] = useState([])
  const [candidateCountsByCohort, setCandidateCountsByCohort] = useState({})
  const [collapsedCandidateGroups, setCollapsedCandidateGroups] = useState({})

  const [enrollSearch, setEnrollSearch] = useState('')
  const [notice, setNotice] = useState('')

  const notify = (msg) => {
    setNotice(msg)
    setTimeout(() => setNotice(''), 3000)
  }

  const getReasonCounts = (list) => {
    const counts = { retake_failed: 0, rejoin_withdrawn: 0, new_candidate: 0, total: 0 }
    for (const student of list || []) {
      const key = counts[student.enrollment_reason] !== undefined ? student.enrollment_reason : 'new_candidate'
      counts[key] += 1
      counts.total += 1
    }
    return counts
  }

  const toggleCandidateGroup = (cohortId, reasonKey) => {
    const key = `${cohortId}:${reasonKey}`
    setCollapsedCandidateGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const loadCourses = async () => {
    const res = await apiClient.get('/courses')
    setCourses(res.data)
    const current = res.data.find((c) => c.is_current)
    if (current) {
      setCurrentCourseId(current.id)
      setSelectedCourseId((prev) => prev ?? current.id)
    } else if (res.data.length) {
      setSelectedCourseId((prev) => prev ?? res.data[0].id)
    }
  }

  const loadCohorts = async () => {
    const res = await apiClient.get('/cohorts')
    setCohorts(res.data)
    if (res.data.length) {
      setSelectedCohortId((prev) => {
        const exists = res.data.some((c) => Number(c.id) === Number(prev))
        if (exists) return prev
        const active = res.data.find((c) => c.status === 'active')
        return (active ?? res.data[0]).id
      })
    }
  }

  const loadCourseEnrollments = async (courseId) => {
    if (!courseId) { setCourseEnrollments([]); return }
    try {
      const res = await apiClient.get(`/enrollments/course/${courseId}`)
      setCourseEnrollments(res.data)
    } catch {
      setCourseEnrollments([])
    }
  }

  const loadCandidateStudents = async (courseId, cohortId) => {
    if (!courseId || !cohortId) { setCandidateStudents([]); return }
    try {
      const res = await apiClient.get(`/enrollments/candidates?courseId=${courseId}&cohortId=${cohortId}`)
      setCandidateStudents(res.data)
      setCandidateCountsByCohort((prev) => ({ ...prev, [cohortId]: getReasonCounts(res.data) }))
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to load eligible students')
      setCandidateStudents([])
    }
  }

  useEffect(() => { loadCourses() }, [])
  useEffect(() => { loadCohorts() }, [])

  useEffect(() => {
    if (selectedCourseId) loadCourseEnrollments(selectedCourseId)
  }, [selectedCourseId])

  useEffect(() => {
    if (selectedCourseId && selectedCohortId) {
      loadCandidateStudents(selectedCourseId, selectedCohortId)
    }
  }, [selectedCourseId, selectedCohortId])

  // Pre-load candidate counts for all cohorts
  useEffect(() => {
    if (!selectedCourseId || !cohorts.length) return
    let cancelled = false
    const loadAll = async () => {
      const results = await Promise.allSettled(
        cohorts.map((cohort) =>
          apiClient
            .get(`/enrollments/candidates?courseId=${selectedCourseId}&cohortId=${cohort.id}`)
            .then((res) => ({ cohortId: cohort.id, rows: res.data }))
        )
      )
      if (cancelled) return
      const nextCounts = {}
      for (const item of results) {
        if (item.status === 'fulfilled') {
          nextCounts[item.value.cohortId] = getReasonCounts(item.value.rows)
        }
      }
      setCandidateCountsByCohort(nextCounts)
    }
    loadAll()
    return () => { cancelled = true }
  }, [selectedCourseId, cohorts])

  const filteredCandidates = useMemo(() => {
    const search = enrollSearch.toLowerCase()
    return candidateStudents.filter(
      (s) =>
        s.full_name.toLowerCase().includes(search) ||
        s.matric_no.toLowerCase().includes(search) ||
        s.email.toLowerCase().includes(search)
    )
  }, [candidateStudents, enrollSearch])

  const groupedCandidates = useMemo(() => {
    const groups = { retake_failed: [], rejoin_withdrawn: [], new_candidate: [] }
    for (const c of filteredCandidates) {
      const key = groups[c.enrollment_reason] !== undefined ? c.enrollment_reason : 'new_candidate'
      groups[key].push(c)
    }
    return groups
  }, [filteredCandidates])

  const enrollStudent = async (studentId) => {
    try {
      await apiClient.post('/enrollments/enroll', { studentId, courseId: Number(selectedCourseId) })
      await loadCourseEnrollments(selectedCourseId)
      await loadCandidateStudents(selectedCourseId, selectedCohortId)
      notify('Student enrolled successfully')
    } catch (err) {
      notify(err?.response?.data?.message || 'Enrollment failed')
    }
  }

  const selectedCourse = courses.find((c) => c.id === selectedCourseId)

  return (
    <AppShell groups={lecturerNavGroups}>
      {notice ? (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white rounded-xl px-4 py-3 shadow-lg text-sm">
          {notice}
        </div>
      ) : null}

      <div className="h-full flex flex-col gap-5 overflow-hidden">
        <PageHeader
          title="Enrollment Management"
          subtitle="Enroll students from each batch into courses"
          icon={<UserPlus size={22} />}
          actions={
            <div className="flex items-center gap-2">
              <label className="field-label mb-0">Course</label>
              <select
                className="select min-w-64"
                value={selectedCourseId ?? ''}
                onChange={(e) => setSelectedCourseId(Number(e.target.value))}
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.is_current ? '★ ' : ''}{course.course_code ? `${course.course_code} — ` : ''}{course.title}
                  </option>
                ))}
              </select>
            </div>
          }
        />

        <div className="flex-1 min-h-0 overflow-auto space-y-5">
          {selectedCourse ? (
            <>
              <Card title="Enrollment Overview" subtitle="Select any course (past or current) to view and manage its enrollments.">
                <div className="flex flex-wrap items-center gap-2">
                  {selectedCourse.is_current ? (
                    <Badge tone="emerald" dot>Current course</Badge>
                  ) : (
                    <Badge tone="slate" dot>Past / completed</Badge>
                  )}
                  {selectedCourse.class_day ? <span className="text-sm text-slate-500">{selectedCourse.class_day}</span> : null}
                  <span className="text-sm text-slate-500">• {selectedCourse.duration_weeks} weeks</span>
                  {selectedCourse.start_date ? <span className="text-sm text-slate-500">• Starts {fmtDate(selectedCourse.start_date)}</span> : null}
                  {!currentCourseId ? (
                    <span className="text-xs text-amber-600">No course is marked as current yet.</span>
                  ) : null}
                </div>
              </Card>

              <div className="card card-pad text-sm text-slate-600">
                Shows eligible students per batch: never took this course, failed before, or withdrawn before.
                Students who passed are not shown.
              </div>

              {cohorts.length === 0 ? (
                <div className="card card-pad text-center text-slate-400">
                  No batches found. Add batches from the Batches section.
                </div>
              ) : null}

              {cohorts.map((cohort) => {
                const isExpanded = Number(selectedCohortId) === Number(cohort.id)
                const enrolledInCohort = courseEnrollments.filter(
                  (e) => Number(e.cohort_id) === Number(cohort.id)
                )
                const candidateCounts = candidateCountsByCohort[cohort.id] || null
                const statusMeta = COHORT_STATUS_META[cohort.status] || { label: cohort.status, tone: 'slate' }

                return (
                  <div key={cohort.id} className="card card-hover overflow-hidden">
                    {/* Cohort header */}
                    <button
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
                      onClick={() => setSelectedCohortId(isExpanded ? null : cohort.id)}
                    >
                      <div className="flex items-center gap-3 text-left">
                        {isExpanded
                          ? <ChevronDown size={16} className="text-slate-500 shrink-0" />
                          : <ChevronRight size={16} className="text-slate-500 shrink-0" />}
                        <div>
                          <p className="font-semibold text-slate-900">{cohort.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {fmtDateRange(cohort.start_date, cohort.end_date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">
                          {cohort.student_count ?? 0} students in batch
                        </span>
                        <Badge tone={statusMeta.tone} dot>{statusMeta.label}</Badge>
                      </div>
                    </button>

                    {/* Candidate count summary chips */}
                    <div className="px-5 pb-4 -mt-1 flex flex-wrap gap-2 border-b border-slate-100">
                      <Badge tone="emerald">Enrolled in course: {enrolledInCohort.length}</Badge>
                      <Badge tone="slate">Eligible to enroll: {candidateCounts?.total ?? '…'}</Badge>
                      <Badge tone="rose">Retake: {candidateCounts?.retake_failed ?? '…'}</Badge>
                      <Badge tone="amber">Rejoin: {candidateCounts?.rejoin_withdrawn ?? '…'}</Badge>
                      <Badge tone="sky">New: {candidateCounts?.new_candidate ?? '…'}</Badge>
                    </div>

                    {/* Expanded content */}
                    {isExpanded ? (
                      <div className="p-5 space-y-5">
                        {/* Enrolled students */}
                        <div>
                          <h4 className="section-title mb-3">
                            Enrolled in {selectedCourse.title} ({enrolledInCohort.length})
                          </h4>
                          {enrolledInCohort.length > 0 ? (
                            <div className="overflow-auto">
                              <table className="data-table w-full text-sm">
                                <thead className="text-left text-slate-500">
                                  <tr>
                                    <th className="pb-2 font-medium">Name</th>
                                    <th className="font-medium">Matric</th>
                                    <th className="font-medium">Status</th>
                                    <th className="font-medium">Result</th>
                                    <th className="font-medium">Score</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {enrolledInCohort.map((s) => (
                                    <tr key={s.id} className="border-t border-slate-100">
                                      <td className="py-2">
                                        <Link
                                          to={`/lecturer/students/${s.student_id}`}
                                          className="font-medium text-slate-900 hover:underline"
                                        >
                                          {s.full_name}
                                        </Link>
                                      </td>
                                      <td className="text-slate-600">{s.matric_no}</td>
                                      <td>
                                        <Badge tone={STUDENT_STATUS_TONE[s.status] || 'slate'} dot>{s.status}</Badge>
                                      </td>
                                      <td>{s.result_status || '—'}</td>
                                      <td>{s.score ?? '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="text-sm text-slate-400">No students from this batch enrolled in this course yet.</p>
                          )}
                        </div>

                        {/* Enroll eligible students */}
                        <div className="border-t border-slate-100 pt-4">
                          <h4 className="section-title mb-3">
                            Eligible Students from this Batch
                          </h4>
                          <input
                            className="input w-full mb-3"
                            placeholder="Search by name, matric, or email…"
                            value={enrollSearch}
                            onChange={(e) => setEnrollSearch(e.target.value)}
                          />
                          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                            {CANDIDATE_REASON_ORDER.map((reasonKey) => {
                              const group = groupedCandidates[reasonKey]
                              if (!group?.length) return null
                              const meta = CANDIDATE_REASON_META[reasonKey]
                              const isCollapsed = Boolean(collapsedCandidateGroups[`${cohort.id}:${reasonKey}`])

                              return (
                                <div key={reasonKey} className="border-b border-slate-100 last:border-0">
                                  <button
                                    type="button"
                                    className="w-full sticky top-0 z-10 bg-slate-50 border-b border-slate-100 px-3 py-2 flex items-center justify-between"
                                    onClick={() => toggleCandidateGroup(cohort.id, reasonKey)}
                                  >
                                    <span className="text-xs font-semibold text-slate-600">
                                      {meta.label} ({group.length})
                                    </span>
                                    {isCollapsed
                                      ? <ChevronRight size={14} className="text-slate-500" />
                                      : <ChevronDown size={14} className="text-slate-500" />}
                                  </button>
                                  {!isCollapsed ? group.slice(0, 40).map((s) => (
                                    <div key={s.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                                      <div>
                                        <span className="text-sm font-medium text-slate-900">{s.full_name}</span>
                                        <span className="text-xs text-slate-500 ml-2">{s.matric_no}</span>
                                        <Badge tone={meta.tone} className="ml-2">{meta.label}</Badge>
                                      </div>
                                      <button
                                        onClick={() => enrollStudent(s.id)}
                                        className="btn btn-primary btn-sm lift"
                                      >
                                        Enroll
                                      </button>
                                    </div>
                                  )) : null}
                                </div>
                              )
                            })}
                            {filteredCandidates.length === 0 ? (
                              <p className="text-sm text-slate-400 p-4">
                                {candidateStudents.length === 0
                                  ? 'All students in this batch are already enrolled or have passed this course.'
                                  : 'No students match your search.'}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </>
          ) : (
            <div className="card card-pad text-center text-slate-400">
              No courses available. Create a course in the Courses section first.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
