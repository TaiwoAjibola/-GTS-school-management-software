import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, X } from 'lucide-react'
import AppShell from '../components/AppShell'
import ProgressBar from '../components/ui/ProgressBar'
import apiClient from '../api/client'
import { lecturerNavGroups } from '../constants/lecturerNav'
import { fmtDate, fmtDateRange } from '../utils/formatDate'

const STATUS_COLORS = {
  Applied: 'bg-slate-100 text-slate-700',
  'Under Review': 'bg-amber-100 text-amber-800',
  Accepted: 'bg-sky-100 text-sky-800',
  Prospective: 'bg-yellow-100 text-yellow-800',
  Active: 'bg-emerald-100 text-emerald-800',
  'On Hold': 'bg-orange-100 text-orange-800',
  Suspended: 'bg-red-100 text-red-800',
  Withdrawn: 'bg-gray-200 text-gray-700',
Transferred: 'bg-sky-100 text-sky-800',
  Graduating: 'bg-sky-200 text-sky-800',
  Graduated: 'bg-gold-200 text-gold-800',
  Alumni: 'bg-slate-200 text-slate-700',
}

const ALL_STATUSES = ['Applied', 'Under Review', 'Accepted', 'Prospective', 'Active', 'On Hold', 'Suspended', 'Withdrawn', 'Transferred', 'Graduating', 'Completed', 'Graduated', 'Alumni']

const CourseStatusCell = ({ enrollment }) => {
  if (!enrollment) {
    return <span className="inline-block rounded-full bg-slate-100 text-slate-400 text-xs px-2 py-0.5">—</span>
  }
  if (enrollment.result_status === 'Pass') {
    return (
      <span className="inline-block rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-0.5">
        ✓ Pass
      </span>
    )
  }
  if (enrollment.result_status === 'Fail') {
    return (
      <span className="inline-block rounded-full bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5">
        ✗ Fail
      </span>
    )
  }
  if (enrollment.status === 'active') {
    return (
      <span className="inline-block rounded-full bg-sky-100 text-sky-700 text-xs px-2 py-0.5">
        In Progress
      </span>
    )
  }
  return <span className="inline-block rounded-full bg-slate-100 text-slate-400 text-xs px-2 py-0.5">—</span>
}

export default function StudentProfilePage() {
  const { studentId } = useParams()
  const navigate = useNavigate()

  const [student, setStudent] = useState(null)
  const [history, setHistory] = useState({ enrollments: [], activities: [] })
  const [allCourses, setAllCourses] = useState([])
  const [cohorts, setCohorts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [activeTab, setActiveTab] = useState('path')
  const [editingCohort, setEditingCohort] = useState(false)
  const [cohortSaving, setCohortSaving] = useState(false)
  const [validNextStatuses, setValidNextStatuses] = useState([])
  const [statusHistory, setStatusHistory] = useState([])
  const [timeline, setTimeline] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false)
  const [pendingStatus, setPendingStatus] = useState(null)
  const [statusTransitionReason, setStatusTransitionReason] = useState('')
  const [statusSaving, setStatusSaving] = useState(false)
  const [resultPanelCourseId, setResultPanelCourseId] = useState(null)
  const [resultFormScore, setResultFormScore] = useState('')
  const [resultFormStatus, setResultFormStatus] = useState('Pass')
  const [resultSaving, setResultSaving] = useState(false)


  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setLoadError('')
      try {
        let studentRes = null
        try {
          studentRes = await apiClient.get(`/students/${studentId}`)
        } catch (error) {
          if (error?.response?.status === 404) {
            setStudent(null)
            return
          }
          setLoadError('Failed to load student profile. Please try again.')
          return
        }

        const [historyRes, coursesRes, cohortRes, nextStatusesRes, statusHistoryRes, timelineRes] = await Promise.allSettled([
          apiClient.get(`/enrollments/student/${studentId}/history`),
          apiClient.get('/courses'),
          apiClient.get('/cohorts'),
          apiClient.get(`/students/${studentId}/next-statuses`),
          apiClient.get(`/students/${studentId}/status-history`),
          apiClient.get(`/enrollments/student/${studentId}/timeline`),
        ])

        setStudent(studentRes.data)

        if (historyRes.status === 'fulfilled') {
          setHistory(historyRes.value.data)
        } else {
          setHistory({ enrollments: [], activities: [] })
        }

        if (coursesRes.status === 'fulfilled') {
          setAllCourses(coursesRes.value.data)
        } else {
          setAllCourses([])
        }

        if (cohortRes.status === 'fulfilled') {
          setCohorts(cohortRes.value.data)
        }

        if (nextStatusesRes.status === 'fulfilled') {
          setValidNextStatuses(nextStatusesRes.value.data.nextStatuses || [])
        }

        if (statusHistoryRes.status === 'fulfilled') {
          setStatusHistory(statusHistoryRes.value.data || [])
        }

        if (timelineRes.status === 'fulfilled') {
          setTimeline(timelineRes.value.data.timeline || [])
        } else {
          setTimeline([])
        }

        if (historyRes.status === 'rejected' || coursesRes.status === 'rejected') {
          setLoadError('Some student sections could not be loaded. Core profile is available.')
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [studentId])

  // Build a map of courseId → enrollment+result
  const courseMap = useMemo(() => {
    const map = {}
    for (const enrollment of history.enrollments) {
      const cid = enrollment.course_id
      // Keep the most recent/best result if multiple enrollments exist
      if (!map[cid] || enrollment.result_status === 'Pass') {
        map[cid] = enrollment
      }
    }
    return map
  }, [history.enrollments])

  const saveStudentResult = async (courseId) => {
    setResultSaving(true)
    try {
      const score = resultFormScore.trim()
      let status = resultFormStatus
      if (score !== '' && !Number.isNaN(Number(score))) {
        status = Number(score) >= 50 ? 'Pass' : 'Fail'
      }
      await apiClient.post('/results', {
        courseId: Number(courseId),
        studentId: Number(studentId),
        score: score !== '' ? Number(score) : null,
        status,
        resultType: 'Final',
      })
      const res = await apiClient.get(`/enrollments/student/${studentId}/history`)
      setHistory(res.data)
      setResultPanelCourseId(null)
      setResultFormScore('')
      setResultFormStatus('Pass')
    } finally {
      setResultSaving(false)
    }
  }

  const passedCourses = useMemo(
    () => allCourses.filter((c) => courseMap[c.id]?.result_status === 'Pass').length,
    [allCourses, courseMap]
  )

  const completionPct = allCourses.length > 0 ? Math.round((passedCourses / allCourses.length) * 100) : 0

  if (loading) {
    return (
      <AppShell title="Student Profile" groups={lecturerNavGroups}>
        <p className="text-slate-500 text-sm">Loading...</p>
      </AppShell>
    )
  }

  if (!student) {
    return (
      <AppShell title="Student Not Found" groups={lecturerNavGroups}>
        <p className="text-slate-500 text-sm">{loadError || 'Student not found.'}</p>
        <Link to="/lecturer/students" className="text-slate-900 underline text-sm">
          Back to Students
        </Link>
      </AppShell>
    )
  }

  return (
    <AppShell title={student.full_name} groups={lecturerNavGroups}>
      {loadError ? (
        <div className="mb-4 rounded-lg bg-amber-100 text-amber-800 px-4 py-2 text-sm">{loadError}</div>
      ) : null}

      {/* Back */}
      <button
        type="button"
        onClick={() => navigate('/lecturer/students')}
        className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-5"
      >
        <ArrowLeft size={15} /> Back to Students
      </button>

      {/* Student header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div
              className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => student.profile_image_url && setLightboxOpen(true)}
            >
              {student.profile_image_url ? (
                <img src={student.profile_image_url} alt={student.full_name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-slate-500">{(student.full_name || '?')[0].toUpperCase()}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-2xl font-bold text-slate-900">{student.full_name}</h2>
              {student.matric_no ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-mono text-slate-700">
                  {student.matric_no}
                </span>
              ) : student.status === 'Prospective' ? (
                <span className="rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-xs">Matric pending activation</span>
              ) : null}
              <div className="relative group">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium cursor-pointer transition-all hover:ring-2 hover:ring-slate-300 ${
                    STATUS_COLORS[student.status] || 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {student.status} <span className="text-[10px] ml-0.5 opacity-50">▼</span>
                </span>
                <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 min-w-[170px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all py-1 max-h-60 overflow-y-auto">
                  {ALL_STATUSES.map((s) => {
                    const isCurrent = student.status === s
                    return (
                      <button
                        key={s}
                        type="button"
                        className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                          isCurrent
                            ? 'bg-slate-100 text-slate-900 font-semibold'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                        onClick={() => {
                          if (!isCurrent) {
                            setPendingStatus(s)
                            setStatusTransitionReason('')
                            setStatusConfirmOpen(true)
                          }
                        }}
                        disabled={isCurrent}
                      >
                        {isCurrent ? '✓ ' : ''}{s}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-500">
              <span>{student.email}</span>
              {student.phone ? <span>{student.phone}</span> : null}
            </div>
            {/* Cohort / Batch selector */}
            <div className="mt-3 flex items-center gap-2">
              {editingCohort ? (
                <>
                  <select
                    className="border rounded-lg px-2 py-1 text-sm"
                    defaultValue={student.cohort_id ?? ''}
                    id="cohort-select"
                  >
                    <option value="">No cohort</option>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={cohortSaving}
                    className="text-xs bg-slate-900 text-white rounded-lg px-3 py-1 disabled:opacity-50"
                    onClick={async () => {
                      const sel = document.getElementById('cohort-select')
                      const newCohortId = sel.value ? Number(sel.value) : null
                      setCohortSaving(true)
                      try {
                        await apiClient.patch(`/students/${studentId}`, { cohortId: newCohortId })
                        setStudent((prev) => ({ ...prev, cohort_id: newCohortId }))
                        setEditingCohort(false)
                      } finally {
                        setCohortSaving(false)
                      }
                    }}
                  >
                    {cohortSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    className="text-xs text-slate-500 hover:text-slate-900"
                    onClick={() => setEditingCohort(false)}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 text-sky-700 text-xs px-2.5 py-1">
                    {cohorts.find((c) => c.id === student.cohort_id)?.name ?? 'No cohort'}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-slate-400 hover:text-slate-700 underline"
                    onClick={() => setEditingCohort(true)}
                  >
                    Change batch
                  </button>
                </>
              )}
            </div>
            {student.comments ? (
              <p className="mt-2 text-sm text-slate-500 max-w-lg">{student.comments}</p>
            ) : null}
            </div>
          </div>

          {/* Progress summary */}
          <div className="bg-slate-50 rounded-xl p-4 min-w-50">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Graduation Progress</p>
            <p className="text-2xl font-bold text-slate-900">
              {passedCourses}
              <span className="text-base font-normal text-slate-400"> / {allCourses.length}</span>
            </p>
            <p className="text-xs text-slate-400 mb-2">modules completed</p>
            <ProgressBar value={completionPct} />
            <p className="text-xs text-slate-500 mt-1">{completionPct}% complete</p>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && student.profile_image_url && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute -top-3 -right-3 bg-white rounded-full p-1 shadow-lg z-10 hover:bg-slate-100"
            >
              <X size={20} />
            </button>
            <img
              src={student.profile_image_url}
              alt={student.full_name}
              className="w-full h-auto rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Status Confirm Modal */}
      {statusConfirmOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setStatusConfirmOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-slate-900 mb-2">Change Status</h3>
            <p className="text-sm text-slate-600 mb-4">
              Move <strong>{student.full_name}</strong> from{' '}
              <strong>{student.status}</strong> → <strong>{pendingStatus}</strong>
            </p>
            <label className="text-sm text-slate-600 block mb-4">
              Reason for change
              <input
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Completed orientation"
                value={statusTransitionReason}
                onChange={(e) => setStatusTransitionReason(e.target.value)}
              />
            </label>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="px-4 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200"
                onClick={() => setStatusConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={statusSaving}
                className="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white disabled:opacity-50"
                onClick={async () => {
                  setStatusSaving(true)
                  try {
                    await apiClient.patch(`/students/${studentId}/lifecycle-status`, {
                      status: pendingStatus,
                      reason: statusTransitionReason,
                    })
                    setStudent((prev) => ({ ...prev, status: pendingStatus }))
                    // Refresh status history
                    const hRes = await apiClient.get(`/students/${studentId}/status-history`)
                    setStatusHistory(hRes.data || [])
                    const nRes = await apiClient.get(`/students/${studentId}/next-statuses`)
                    setValidNextStatuses(nRes.data.nextStatuses || [])
                    setStatusConfirmOpen(false)
                  } finally {
                    setStatusSaving(false)
                  }
                }}
              >
                {statusSaving ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Pipeline */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mb-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Student Lifecycle Pipeline</h3>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {ALL_STATUSES.map((s, i, arr) => {
            const isCurrent = student.status === s
            const isPast = ALL_STATUSES.indexOf(student.status) > i
            const isValidNext = validNextStatuses.includes(s)
            return (
              <div key={s} className="flex items-center shrink-0">
                <div
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    isCurrent
                      ? 'bg-slate-900 text-white ring-2 ring-slate-300'
                      : isPast
                      ? 'bg-emerald-100 text-emerald-700'
                      : isValidNext
                      ? 'bg-sky-100 text-sky-700'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                  title={isCurrent ? 'Current status' : isPast ? 'Completed' : isValidNext ? 'Available next' : 'Not reachable'}
                >
                  {s}
                </div>
                {i < arr.length - 1 && (
                  <div className={`w-4 h-0.5 mx-0.5 ${isPast || isValidNext || isCurrent ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                )}
              </div>
            )
          })}
        </div>
        {statusHistory.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-2">Status History</p>
            <div className="flex flex-wrap gap-2">
              {statusHistory.slice(0, 5).map((h) => (
                <span key={h.id} className="inline-flex items-center gap-1 text-xs bg-slate-50 rounded-full px-2.5 py-1">
                  <span className="text-slate-400">{h.from_status}</span>
                  <span className="text-slate-300">→</span>
                  <span className="font-medium text-slate-700">{h.to_status}</span>
                  <span className="text-slate-400 ml-1">{new Date(h.changed_at).toLocaleDateString()}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-slate-100 rounded-xl p-1 w-fit">
        {[
          { key: 'path', label: 'Graduation Path' },
          { key: 'history', label: 'Enrollment History' },
          { key: 'timeline', label: 'Timeline' },
          { key: 'activity', label: 'Activity Log' },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Graduation path */}
      {activeTab === 'path' ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">All Modules — Graduation Path</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {allCourses.map((course) => {
              const enrollment = courseMap[course.id]
              const isPassed = enrollment?.result_status === 'Pass'
              const isFailed = enrollment?.result_status === 'Fail'
              const isActive = enrollment?.status === 'active' && !enrollment?.result_status
              const isCompleted = enrollment?.status === 'completed' && !enrollment?.result_status
              return (
                <Link
                  key={course.id}
                  to={`/lecturer/courses/${course.id}`}
                  className={`rounded-xl border p-4 transition-colors hover:border-slate-400 ${
                    isPassed
                      ? 'border-emerald-200 bg-emerald-50'
                      : isFailed
                      ? 'border-red-200 bg-red-50'
                      : isActive
                      ? 'border-sky-200 bg-sky-50'
                      : isCompleted
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 leading-tight">{course.title}</p>
                      {course.course_code ? (
                        <p className="text-xs text-slate-400 mt-0.5">{course.course_code}</p>
                      ) : null}
                    </div>
                    <span
                      className={`shrink-0 text-lg ${
                        isPassed ? 'text-emerald-600' : isFailed ? 'text-red-500' : isActive ? 'text-sky-500' : isCompleted ? 'text-amber-500' : 'text-slate-300'
                      }`}
                    >
                      {isPassed ? '✓' : isFailed ? '✗' : isActive ? '⏳' : isCompleted ? '⏳' : '○'}
                    </span>
                  </div>
                  {enrollment ? (
                    <div className="mt-2 text-xs text-slate-500">
                      {enrollment.result_status ? (
                        <span>
                          {enrollment.result_status}
                          {enrollment.score !== null && enrollment.score !== undefined
                            ? ` (${enrollment.score})`
                            : ''}
                        </span>
                      ) : (
                        <span>{isActive ? 'Currently enrolled' : isCompleted ? 'Awaiting result' : '—'}</span>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">Not yet enrolled</p>
                  )}
                </Link>
              )
            })}
          </div>
          {!allCourses.length ? (
            <p className="text-sm text-slate-400 text-center py-8">No courses in the system yet.</p>
          ) : null}
        </div>
      ) : null}

      {/* Enrollment history */}
      {activeTab === 'history' ? (() => {
        const current = history.enrollments.filter(
          (e) => e.status === 'active' && !e.result_status
        )
        const past = history.enrollments.filter(
          (e) => e.result_status === 'Pass' || (e.status === 'completed' && !e.result_status)
        )
        const retake = history.enrollments.filter(
          (e) => e.result_status === 'Fail' || e.status === 'failed'
        )
        const notStarted = allCourses.filter((c) => !courseMap[c.id])

        const EnrollRow = ({ e }) => (
          <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
            <div>
              <Link
                to={`/lecturer/courses/${e.course_id}`}
                className="text-sm font-medium text-slate-900 hover:underline"
              >
                {e.course_title}
              </Link>
              {e.course_code ? <span className="ml-1.5 text-xs text-slate-400">{e.course_code}</span> : null}
              <p className="text-xs text-slate-400 mt-0.5">
                {e.cohort_name ? `${e.cohort_name} · ` : ''}
                Enrolled {fmtDate(e.enrolled_at)}
                {e.completed_at ? ` · Completed ${fmtDate(e.completed_at)}` : ''}
              </p>
            </div>
            <div className="text-right shrink-0 ml-4">
              {e.result_status === 'Pass' ? (
                <>
                  <span className="text-xs font-semibold rounded-full px-2.5 py-1 bg-emerald-100 text-emerald-700">✓ Pass</span>
                  {e.score != null ? <p className="text-xs text-slate-400 mt-1">{e.score} pts</p> : null}
                </>
              ) : e.result_status === 'Fail' ? (
                <>
                  <span className="text-xs font-semibold rounded-full px-2.5 py-1 bg-red-100 text-red-700">✗ Fail</span>
                  {e.score != null ? <p className="text-xs text-slate-400 mt-1">{e.score} pts</p> : null}
                </>
              ) : e.status === 'completed' ? (
                <span className="text-xs rounded-full px-2.5 py-1 bg-amber-100 text-amber-700">Awaiting result</span>
              ) : (
                <span className="text-xs rounded-full px-2.5 py-1 bg-sky-100 text-sky-700">In Progress</span>
              )}
              {!e.result_status ? (
                <button
                  type="button"
                  onClick={() => setResultPanelCourseId((prev) => (prev === e.course_id ? null : e.course_id))}
                  className="mt-1.5 text-xs font-medium text-sky-600 hover:text-sky-800"
                >
                  {resultPanelCourseId === e.course_id ? 'Cancel' : '+ Add result'}
                </button>
              ) : null}
              {resultPanelCourseId === e.course_id ? (
                <div className="mt-2 flex flex-col gap-2 items-end">
                  <label className="flex items-center gap-2 text-xs text-slate-500">
                    Score (0–100)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={resultFormScore}
                      onChange={(ev) => setResultFormScore(ev.target.value)}
                      className="w-24 border rounded-lg px-2 py-1 text-sm"
                    />
                  </label>
                  <select
                    value={resultFormStatus}
                    onChange={(ev) => setResultFormStatus(ev.target.value)}
                    className="border rounded-lg px-2 py-1 text-xs"
                  >
                    <option value="Pass">Pass</option>
                    <option value="Fail">Fail</option>
                  </select>
                  <button
                    type="button"
                    disabled={resultSaving}
                    onClick={() => saveStudentResult(e.course_id)}
                    className="text-xs font-semibold rounded-lg bg-sky-600 text-white px-3 py-1.5 disabled:opacity-50"
                  >
                    {resultSaving ? 'Saving…' : 'Save result'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )

        return (
          <div className="space-y-4">
            {/* Currently enrolled */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900 mb-1 text-sm">Currently Enrolled</h3>
              <p className="text-xs text-slate-400 mb-3">Courses this student is actively taking right now</p>
              {current.length > 0
                ? current.map((e) => <EnrollRow key={e.id} e={e} />)
                : <p className="text-sm text-slate-400 py-2">Not currently enrolled in any course.</p>
              }
            </div>

            {/* Eligible to retake */}
            {retake.length > 0 ? (
              <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-1 text-sm">Eligible to Retake</h3>
                <p className="text-xs text-slate-400 mb-3">Failed courses — eligible to enroll again in the next cycle</p>
                {retake.map((e) => <EnrollRow key={e.id} e={e} />)}
              </div>
            ) : null}

            {/* Past completed */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900 mb-1 text-sm">Completed Courses</h3>
              <p className="text-xs text-slate-400 mb-3">Passed or awaiting result</p>
              {past.length > 0
                ? past.map((e) => <EnrollRow key={e.id} e={e} />)
                : <p className="text-sm text-slate-400 py-2">No completed courses yet.</p>
              }
            </div>

            {/* Not yet started */}
            {notStarted.length > 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-1 text-sm">Not Yet Started</h3>
                <p className="text-xs text-slate-400 mb-3">Courses this student has never been enrolled in</p>
                {notStarted.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                    <div>
                      <Link
                        to={`/lecturer/courses/${c.id}`}
                        className="text-sm font-medium text-slate-900 hover:underline"
                      >
                        {c.title}
                      </Link>
                      {c.course_code ? <span className="ml-1.5 text-xs text-slate-400">{c.course_code}</span> : null}
                    </div>
                    <span className="text-xs rounded-full px-2.5 py-1 bg-slate-100 text-slate-500">Not started</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )
      })() : null}



      {/* Timeline */}
      {activeTab === 'timeline' ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">Activity Timeline</h3>
          <div className="space-y-2 max-h-150 overflow-auto">
            {timeline.map((event) => (
              <div key={event.id} className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3">
                <div className="flex flex-col items-center shrink-0">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    event.type === 'status_transition' ? 'bg-gold-500' :
                    event.type === 'enrollment' ? 'bg-emerald-400' : 'bg-slate-400'
                  }`} />
                </div>
                <div className="min-w-0 flex-1">
                  {event.type === 'status_transition' ? (
                    <p className="text-sm text-slate-700">
                      Status changed: <span className="text-slate-500">{event.from_status}</span>
                      <span className="mx-1 text-slate-300">→</span>
                      <span className="font-medium text-slate-800">{event.to_status}</span>
                      {event.reason ? <span className="text-slate-400 italic ml-1">({event.reason})</span> : null}
                    </p>
                  ) : event.type === 'enrollment' ? (
                    <p className="text-sm text-slate-700">
                      {event.auto_enrolled ? <span className="text-sky-500 text-xs font-medium mr-1">⚡</span> : null}
                      {event.status === 'active' ? 'Enrolled in' : event.status === 'completed' ? 'Completed' : event.status === 'failed' ? 'Failed' : event.status === 'withdrawn' ? 'Withdrawn from' : 'Enrolled in'}{' '}
                      <span className="font-medium text-slate-800">{event.course_title}</span>
                      {event.course_code ? <span className="text-slate-400"> ({event.course_code})</span> : null}
                      {event.result_status === 'Pass' ? <span className="ml-1 text-emerald-600 font-medium">✓ Pass</span> : null}
                      {event.result_status === 'Fail' ? <span className="ml-1 text-red-500 font-medium">✗ Fail</span> : null}
                      {event.score != null ? <span className="text-slate-400 ml-1">({event.score})</span> : null}
                      {event.plan_start_date || event.plan_end_date ? (
                        <span className="text-slate-400 text-xs ml-1">
                          {event.plan_start_date ? new Date(event.plan_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '?'} – {event.plan_end_date ? new Date(event.plan_end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '?'}
                        </span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-700">
                      <span className="font-medium capitalize">{event.action?.replace(/_/g, ' ')}</span>
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(event.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {event.actor ? <span> · by {event.actor}</span> : null}
                  </p>
                </div>
              </div>
            ))}
            {!timeline.length ? (
              <p className="text-sm text-slate-400 text-center py-8">No activity recorded yet.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Activity log */}
      {activeTab === 'activity' ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">Activity Log</h3>
          <div className="space-y-2 max-h-125 overflow-auto">
            {history.activities.map((activity, index) => (
              <div
                key={`${activity.action}-${activity.created_at}-${index}`}
                className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3"
              >
                <div className="w-2 h-2 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-slate-800">{activity.action.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-slate-400">{new Date(activity.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {!history.activities.length ? (
              <p className="text-sm text-slate-400 text-center py-8">No activity recorded yet.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}
