import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, UserPlus, Layers, Users, GraduationCap, Search, Info, Sparkles, BookOpen, Filter } from 'lucide-react'
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

  // bento stats
  const totalEnrolledAll = courseEnrollments.length
  const totalEligibleAll = useMemo(() => Object.values(candidateCountsByCohort).reduce((sum, c) => sum + (c?.total || 0), 0), [candidateCountsByCohort])
  const totalRetakeAll = useMemo(() => Object.values(candidateCountsByCohort).reduce((sum, c) => sum + (c?.retake_failed || 0), 0), [candidateCountsByCohort])
  const totalNewAll = useMemo(() => Object.values(candidateCountsByCohort).reduce((sum, c) => sum + (c?.new_candidate || 0), 0), [candidateCountsByCohort])

  return (
    <AppShell groups={lecturerNavGroups}>
      {notice ? (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white rounded-xl px-4 py-3 shadow-lg text-sm border border-white/10">
          {notice}
        </div>
      ) : null}

      <div className="h-full flex flex-col gap-5 overflow-hidden">
        <PageHeader
          title="Enrollment Management"
          subtitle="Enroll students from each batch into any course — current or past"
          icon={<UserPlus size={22} />}
          actions={
            <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase text-slate-500">
                <BookOpen size={12} className="text-indigo-500" /> Course
              </span>
              <select
                className="select min-w-[268px] !w-auto border-0 !bg-transparent !p-0 !pr-7 text-sm font-semibold text-slate-900 focus:ring-0 focus:border-0 shadow-none"
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

        <div className="flex-1 min-h-0 overflow-auto space-y-5 pr-1 pb-2">
          {selectedCourse ? (
            <>
              {/* BENTO OVERVIEW GRID */}
              <div className="grid lg:grid-cols-[1.45fr_0.85fr] gap-4">
                <Card
                  title="Enrollment Overview"
                  subtitle="Select any course (past or current) to view and manage its enrollments."
                  className="card-hover !rounded-[24px]"
                  action={
                    selectedCourse.is_current ? (
                      <Badge tone="emerald" dot>Current course</Badge>
                    ) : (
                      <Badge tone="slate" dot>Past / completed</Badge>
                    )
                  }
                >
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {selectedCourse.class_day ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> {selectedCourse.class_day}
                      </span>
                    ) : null}
                    <span className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1.5 text-xs font-bold text-indigo-700">
                      {selectedCourse.duration_weeks} weeks
                    </span>
                    {selectedCourse.start_date ? (
                      <span className="text-xs font-medium text-slate-500">• Starts {fmtDate(selectedCourse.start_date)}</span>
                    ) : null}
                    {!currentCourseId ? (
                      <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">No course is marked as current yet.</span>
                    ) : null}
                  </div>
                  {/* indigo divider */}
                  <div className="mt-4 flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase text-indigo-500">
                    <span className="h-px flex-1 bg-gradient-to-r from-indigo-200 to-transparent" />
                    <span className="inline-flex items-center gap-1"><Sparkles size={10} /> Indigo bento</span>
                    <span className="h-px flex-1 bg-gradient-to-l from-indigo-200 to-transparent" />
                  </div>
                </Card>

                <Card className="!rounded-[24px] !p-0 overflow-hidden card-hover border-indigo-100">
                  <div className="bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500 px-5 py-4 text-white">
                    <p className="text-[11px] font-bold tracking-widest uppercase opacity-90 flex items-center gap-1.5"><GraduationCap size={12} /> Eligibility logic</p>
                    <p className="mt-1 text-sm font-semibold leading-snug">Shows eligible students per batch: never took this course, failed before, or withdrawn before.</p>
                    <p className="mt-1 text-xs opacity-80">Students who passed are not shown.</p>
                  </div>
                  <div className="px-5 py-4 bg-white">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5">
                        <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Retake</p>
                        <p className="font-mono text-sm font-bold text-rose-600">{totalRetakeAll}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5">
                        <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Eligible</p>
                        <p className="font-mono text-sm font-bold text-slate-900">{totalEligibleAll}</p>
                      </div>
                      <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-2.5">
                        <p className="text-[10px] font-bold tracking-widest uppercase text-indigo-600">Enrolled</p>
                        <p className="font-mono text-sm font-bold text-indigo-700">{totalEnrolledAll}</p>
                      </div>
                    </div>
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><Info size={12} className="text-indigo-400" /> Batch-aware — counts refresh per cohort automatically.</p>
                  </div>
                </Card>
              </div>

              {/* BENTO STATS STRIP */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card value={cohorts.length} title="Batches" icon={<Layers size={18} />} accent="gold" className="card-hover !rounded-[24px]" hint={`${cohorts.filter(c=>c.status==='active').length} active`} />
                <Card value={totalEnrolledAll} title="Enrolled in course" icon={<Users size={18} />} accent="gold" className="card-hover !rounded-[24px]" hint={selectedCourse.title} />
                <Card value={totalEligibleAll} title="Eligible now" icon={<UserPlus size={18} />} accent="gold" className="card-hover !rounded-[24px]" hint="Across all batches" />
                <Card value={totalNewAll} title="New candidates" icon={<Sparkles size={18} />} accent="gold" className="card-hover !rounded-[24px]" hint="Never took course" />
              </div>

              {cohorts.length === 0 ? (
                <Card className="!rounded-[24px] text-center py-10">
                  <p className="text-sm text-slate-400">No batches found. Add batches from the Batches section.</p>
                </Card>
              ) : null}

              {/* COHORT BENTO ACCORDIONS */}
              <div className="space-y-4">
                {cohorts.map((cohort) => {
                  const isExpanded = Number(selectedCohortId) === Number(cohort.id)
                  const enrolledInCohort = courseEnrollments.filter(
                    (e) => Number(e.cohort_id) === Number(cohort.id)
                  )
                  const candidateCounts = candidateCountsByCohort[cohort.id] || null
                  const statusMeta = COHORT_STATUS_META[cohort.status] || { label: cohort.status, tone: 'slate' }

                  return (
                    <div key={cohort.id} className={`card card-hover overflow-hidden !rounded-[24px] transition-all ${isExpanded ? 'ring-1 ring-indigo-200 shadow-md' : ''}`}>
                      {/* Cohort header — indigo bento */}
                      <button
                        type="button"
                        className={`w-full flex items-center justify-between gap-3 px-5 py-4 text-left transition-colors ${isExpanded ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}
                        onClick={() => setSelectedCohortId(isExpanded ? null : cohort.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${isExpanded ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-500 border-slate-200'}`}>
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </span>
                          <div className="min-w-0">
                            <p className="font-display text-[15px] font-bold tracking-tight text-slate-900 truncate" style={{ fontFamily: 'Sora, sans-serif' }}>{cohort.name}</p>
                            <p className="text-xs font-medium text-slate-500 mt-0.5 font-mono">
                              {fmtDateRange(cohort.start_date, cohort.end_date)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">
                            <Users size={12} className="text-indigo-500" /> {cohort.student_count ?? 0} in batch
                          </span>
                          <Badge tone={statusMeta.tone} dot>{statusMeta.label}</Badge>
                        </div>
                      </button>

                      {/* Candidate count chips — indigo bento pills */}
                      <div className="px-5 pb-3.5 flex flex-wrap gap-2 border-b border-slate-100 bg-white">
                        <Badge tone="gold" className="!bg-indigo-600 !text-white !border-indigo-600">Enrolled: {enrolledInCohort.length}</Badge>
                        <Badge tone="slate">Eligible: {candidateCounts?.total ?? '…'}</Badge>
                        <Badge tone="rose">Retake: {candidateCounts?.retake_failed ?? '…'}</Badge>
                        <Badge tone="amber">Rejoin: {candidateCounts?.rejoin_withdrawn ?? '…'}</Badge>
                        <Badge tone="sky">New: {candidateCounts?.new_candidate ?? '…'}</Badge>
                      </div>

                      {/* Expanded content — bento split */}
                      {isExpanded ? (
                        <div className="p-5 bg-[#F8FAFC]">
                          <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-5 items-start">
                            {/* Enrolled students — data-table indigo */}
                            <div className="card !rounded-[16px] overflow-hidden border-slate-200">
                              <div className="px-4 py-3 flex items-center justify-between bg-white border-b border-slate-200">
                                <h4 className="font-display text-sm font-bold tracking-tight text-slate-900 flex items-center gap-2" style={{ fontFamily: 'Sora, sans-serif' }}>
                                  <span className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center"><GraduationCap size={14} /></span>
                                  Enrolled in {selectedCourse.title}
                                </h4>
                                <Badge tone="emerald">{enrolledInCohort.length}</Badge>
                              </div>
                              {enrolledInCohort.length > 0 ? (
                                <div className="overflow-auto max-h-[320px]">
                                  <table className="data-table w-full text-sm">
                                    <thead>
                                      <tr>
                                        <th>Name</th>
                                        <th>Matric</th>
                                        <th>Status</th>
                                        <th>Result</th>
                                        <th>Score</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {enrolledInCohort.map((s) => (
                                        <tr key={s.id}>
                                          <td className="py-2">
                                            <Link
                                              to={`/lecturer/students/${s.student_id}`}
                                              className="font-semibold text-slate-900 hover:text-indigo-600 hover:underline"
                                            >
                                              {s.full_name}
                                            </Link>
                                          </td>
                                          <td className="font-mono text-xs text-slate-600">{s.matric_no}</td>
                                          <td>
                                            <Badge tone={STUDENT_STATUS_TONE[s.status] || 'slate'} dot>{s.status}</Badge>
                                          </td>
                                          <td className="text-xs font-medium">{s.result_status || '—'}</td>
                                          <td className="font-mono text-xs">{s.score ?? '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-sm text-slate-400 px-4 py-8 text-center">No students from this batch enrolled in this course yet.</p>
                              )}
                            </div>

                            {/* Eligible — search + grouped */}
                            <div className="card !rounded-[16px] overflow-hidden border-slate-200">
                              <div className="px-4 py-3 bg-white border-b border-slate-200 space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="font-display text-sm font-bold tracking-tight text-slate-900 flex items-center gap-2" style={{ fontFamily: 'Sora, sans-serif' }}>
                                    <span className="h-7 w-7 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center"><Filter size={14} /></span>
                                    Eligible from this Batch
                                  </h4>
                                  <Badge tone="gold">{candidateStudents.length}</Badge>
                                </div>
                                <div className="relative">
                                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                  <input
                                    className="input w-full !rounded-xl !bg-slate-50 !border-slate-200 pl-9 pr-3 py-2.5 text-sm focus:!bg-white"
                                    placeholder="Search by name, matric, or email…"
                                    value={enrollSearch}
                                    onChange={(e) => setEnrollSearch(e.target.value)}
                                  />
                                </div>
                              </div>

                              <div className="border-t border-slate-200 max-h-[320px] overflow-y-auto bg-white">
                                {CANDIDATE_REASON_ORDER.map((reasonKey) => {
                                  const group = groupedCandidates[reasonKey]
                                  if (!group?.length) return null
                                  const meta = CANDIDATE_REASON_META[reasonKey]
                                  const isCollapsed = Boolean(collapsedCandidateGroups[`${cohort.id}:${reasonKey}`])

                                  return (
                                    <div key={reasonKey} className="border-b border-slate-100 last:border-0">
                                      <button
                                        type="button"
                                        className="w-full sticky top-0 z-10 bg-slate-50/95 backdrop-blur border-b border-slate-100 px-3 py-2 flex items-center justify-between hover:bg-indigo-50/70 transition-colors"
                                        onClick={() => toggleCandidateGroup(cohort.id, reasonKey)}
                                      >
                                        <span className="text-xs font-bold tracking-wide uppercase text-slate-600 flex items-center gap-2">
                                          <span className={`h-1.5 w-1.5 rounded-full ${meta.tone === 'rose' ? 'bg-rose-500' : meta.tone === 'amber' ? 'bg-amber-500' : 'bg-sky-500'}`} />
                                          {meta.label} ({group.length})
                                        </span>
                                        {isCollapsed
                                          ? <ChevronRight size={14} className="text-slate-400" />
                                          : <ChevronDown size={14} className="text-indigo-500" />}
                                      </button>
                                      {!isCollapsed ? group.slice(0, 40).map((s) => (
                                        <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-indigo-50/60 border-b border-slate-50 last:border-0 transition-colors">
                                          <div className="min-w-0 flex-1">
                                            <span className="text-sm font-semibold text-slate-900 truncate">{s.full_name}</span>
                                            <span className="text-xs font-mono text-slate-500 ml-2">{s.matric_no}</span>
                                            <Badge tone={meta.tone} className="ml-2 !text-[10px] hidden sm:inline-flex">{meta.label}</Badge>
                                          </div>
                                          <button
                                            onClick={() => enrollStudent(s.id)}
                                            className="btn btn-primary btn-sm lift shrink-0 !rounded-full !px-3.5"
                                          >
                                            Enroll
                                          </button>
                                        </div>
                                      )) : null}
                                    </div>
                                  )
                                })}
                                {filteredCandidates.length === 0 ? (
                                  <p className="text-sm text-slate-400 p-4 text-center">
                                    {candidateStudents.length === 0
                                      ? 'All students in this batch are already enrolled or have passed this course.'
                                      : 'No students match your search.'}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <Card className="!rounded-[24px] text-center py-12 card-hover">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3">
                <BookOpen size={20} />
              </div>
              <p className="text-sm font-semibold text-slate-900">No courses available</p>
              <p className="text-sm text-slate-500 mt-1">Create a course in the Courses section first.</p>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  )
}
