import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, User, X, Mail, Phone, GraduationCap, BookOpen, Award, Layers, Clock, Activity, History as HistoryIcon, Sparkles, Hash, Building2 } from 'lucide-react'
import AppShell from '../components/AppShell'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
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

const STATUS_TONE = {
  Applied: 'slate',
  'Under Review': 'amber',
  Accepted: 'sky',
  Prospective: 'amber',
  Active: 'emerald',
  'On Hold': 'amber',
  Suspended: 'rose',
  Withdrawn: 'slate',
  Transferred: 'sky',
  Graduating: 'sky',
  Graduated: 'gold',
  Alumni: 'slate',
  Completed: 'emerald',
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
        <p className="text-slate-500 text-sm font-mono">Loading…</p>
      </AppShell>
    )
  }

  if (!student) {
    return (
      <AppShell title="Student Not Found" groups={lecturerNavGroups}>
        <p className="text-slate-500 text-sm font-mono">{loadError || 'Student not found.'}</p>
        <Link to="/lecturer/students" className="btn btn-ghost btn-sm lift gap-2">
          Back to Students
        </Link>
      </AppShell>
    )
  }

  const currentCount = history.enrollments.filter((e) => e.status === 'active' && !e.result_status).length
  const completedCount = history.enrollments.filter((e) => e.result_status === 'Pass' || (e.status === 'completed' && !e.result_status)).length
  const retakeCount = history.enrollments.filter((e) => e.result_status === 'Fail' || e.status === 'failed').length

  return (
    <AppShell title={student.full_name} groups={lecturerNavGroups}>
      <div className="h-full flex flex-col gap-4 overflow-hidden">
      {loadError ? (
        <div className="shrink-0 rounded-[16px] bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2.5 text-sm flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          {loadError}
        </div>
      ) : null}

      {/* ————— BENTO HERO — profile + progress ————— */}
      <div className="grid grid-cols-12 gap-4 shrink-0">
        {/* Profile hero - 8 cols */}
        <Card className="col-span-12 lg:col-span-8 rounded-[24px] !bg-white card-hover overflow-hidden isolate !p-0 border-slate-200">
          <div className="h-1.5 w-full bg-gradient-to-r from-[#4F46E5] via-[#6366f1] to-[#8b5cf6]" />
          <div className="p-5">
            <div className="flex items-start gap-4">
              <div
                className="w-[84px] h-[84px] rounded-[22px] bg-[#EEF2FF] flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:opacity-90 transition-all duration-200 ring-4 ring-[#eef2ff] border border-[#c7d2fe] shadow-sm"
                onClick={() => student.profile_image_url && setLightboxOpen(true)}
                title={student.profile_image_url ? 'Click to enlarge' : undefined}
              >
                {student.profile_image_url ? (
                  <img src={student.profile_image_url} alt={student.full_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[28px] font-extrabold text-[#4F46E5] font-display">{(student.full_name || '?')[0].toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="font-display text-[22px] font-extrabold text-slate-900 leading-none tracking-[-0.03em]">{student.full_name}</h2>
                  {student.matric_no ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white border border-[#c7d2fe] px-3 py-1 text-xs font-semibold text-[#4338ca] font-mono tracking-[0.02em]">
                      <Hash size={11} className="text-[#6366f1]" />{student.matric_no}
                    </span>
                  ) : student.status === 'Prospective' ? (
                    <Badge tone="gold">Matric pending activation</Badge>
                  ) : null}
                  <div className="relative group">
                    <Badge tone={STATUS_TONE[student.status] || 'slate'} dot className="!bg-[#4F46E5] !text-white !border-[#4338ca] !px-3 !py-1">
                      {student.status} <span className="text-[10px] ml-0.5 opacity-70">▼</span>
                    </Badge>
                    <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-[16px] shadow-xl z-30 min-w-[180px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all py-1.5 max-h-60 overflow-y-auto">
                      {ALL_STATUSES.map((s) => {
                        const isCurrent = student.status === s
                        return (
                          <button
                            key={s}
                            type="button"
                            className={`w-full text-left px-3.5 py-1.5 text-xs transition-colors ${
                              isCurrent
                                ? 'bg-[#EEF2FF] text-[#4338ca] font-bold'
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

                <div className="mt-2.5 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">
                    <Mail size={12} className="text-[#6366f1]" /> {student.email}
                  </span>
                  {student.phone ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">
                      <Phone size={12} className="text-[#6366f1]" /> {student.phone}
                    </span>
                  ) : null}
                </div>

                {/* Cohort / Batch */}
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {editingCohort ? (
                    <>
                      <select
                        className="select !rounded-[12px] !border-[#c7d2fe] focus:!border-[#4F46E5] text-sm py-1.5"
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
                        className="btn btn-primary btn-sm lift gap-2 disabled:opacity-50"
                        style={{ background: '#4F46E5', borderRadius: '12px' }}
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
                        className="btn btn-ghost btn-sm lift gap-2"
                        style={{ borderRadius: '12px' }}
                        onClick={() => setEditingCohort(false)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF2FF] text-[#4338ca] border border-[#c7d2fe] text-xs font-bold px-3 py-1">
                        <Building2 size={12} /> {cohorts.find((c) => c.id === student.cohort_id)?.name ?? 'No cohort'}
                      </span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm lift gap-2"
                        style={{ borderRadius: '12px' }}
                        onClick={() => setEditingCohort(true)}
                      >
                        Change batch
                      </button>
                    </>
                  )}
                </div>
                {student.comments ? (
                  <p className="mt-3 text-[13px] leading-relaxed text-slate-500 bg-slate-50 border border-slate-100 rounded-[14px] px-3.5 py-2.5 max-w-2xl">{student.comments}</p>
                ) : null}
              </div>
            </div>
          </div>
        </Card>

        {/* Right stack - progress + quick stats */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <Card className="rounded-[24px] !bg-white card-hover !p-0 overflow-hidden isolate border-slate-200 flex-1">
            <div className="h-1 w-full bg-[#4F46E5]" />
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-[#4F46E5]">Graduation Progress</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF2FF] text-[#4338ca] border border-[#c7d2fe] px-2 py-0.5 text-[11px] font-bold"><Sparkles size={10} /> {completionPct}%</span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="font-display text-[34px] font-extrabold leading-none tracking-tight text-slate-900">
                  {passedCourses}<span className="text-[20px] font-semibold text-slate-400"> / {allCourses.length}</span>
                </p>
                <span className="text-xs font-medium text-slate-500">modules completed</span>
              </div>
              <div className="mt-3">
                <div className="w-full bg-[#EEF2FF] h-2.5 rounded-full overflow-hidden border border-[#e0e7ff]">
                  <div className="h-2.5 rounded-full transition-all duration-500" style={{ width: `${completionPct}%`, background: '#4F46E5' }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">{completionPct}% complete</span>
                  <span className="text-slate-400 font-mono text-[11px]">{passedCourses} passed • {allCourses.length - passedCourses} remaining</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="rounded-[24px] !bg-white card-hover !p-0 overflow-hidden isolate border-slate-200">
            <div className="p-5">
              <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-slate-500 mb-3">Enrollments Snapshot</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-[14px] bg-[#EEF2FF] border border-[#e0e7ff] p-3 text-center">
                  <p className="text-[11px] font-bold tracking-widest uppercase text-[#6366f1]">Active</p>
                  <p className="font-display text-xl font-extrabold text-[#4F46E5] mt-0.5">{currentCount}</p>
                </div>
                <div className="rounded-[14px] bg-emerald-50 border border-emerald-100 p-3 text-center">
                  <p className="text-[11px] font-bold tracking-widest uppercase text-emerald-600">Done</p>
                  <p className="font-display text-xl font-extrabold text-emerald-700 mt-0.5">{completedCount}</p>
                </div>
                <div className="rounded-[14px] bg-amber-50 border border-amber-100 p-3 text-center">
                  <p className="text-[11px] font-bold tracking-widest uppercase text-amber-600">Retake</p>
                  <p className="font-display text-xl font-extrabold text-amber-700 mt-0.5">{retakeCount}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                <GraduationCap size={13} className="text-[#6366f1]" />
                <span>{allCourses.length} total modules in catalogue</span>
              </div>
            </div>
          </Card>
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
              className="w-full h-auto rounded-[24px] shadow-2xl"
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
            className="card p-5 max-w-md w-full rounded-[24px] !bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-extrabold text-slate-900 mb-2">Change Status</h3>
            <p className="text-sm text-slate-600 mb-4">
              Move <strong>{student.full_name}</strong> from{' '}
              <strong>{student.status}</strong> → <strong>{pendingStatus}</strong>
            </p>
            <label className="field-label block mb-4">
              Reason for change
              <input
                className="input mt-1 !rounded-[12px]"
                placeholder="e.g. Completed orientation"
                value={statusTransitionReason}
                onChange={(e) => setStatusTransitionReason(e.target.value)}
              />
            </label>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="btn btn-ghost btn-sm lift gap-2"
                style={{ borderRadius: '12px' }}
                onClick={() => setStatusConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={statusSaving}
                className="btn btn-primary btn-sm lift gap-2 disabled:opacity-50"
                style={{ background: '#4F46E5', borderRadius: '12px' }}
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

      {/* Status Pipeline - indigo bento */}
      <Card title="Lifecycle Pipeline" subtitle="Tap status badge above to transition • indigo = current" className="shrink-0 rounded-[24px] !bg-white card-hover border-slate-200 isolate">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 custom-scrollbar -mx-1 px-1">
          {ALL_STATUSES.map((s, i, arr) => {
            const isCurrent = student.status === s
            const isPast = ALL_STATUSES.indexOf(student.status) > i
            const isValidNext = validNextStatuses.includes(s)
            return (
              <div key={s} className="flex items-center shrink-0">
                <div
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap border ${
                    isCurrent
                      ? 'bg-[#4F46E5] text-white border-[#4338ca] shadow-md shadow-indigo-200 scale-[1.02]'
                      : isPast
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : isValidNext
                      ? 'bg-[#EEF2FF] text-[#4338ca] border-[#c7d2fe]'
                      : 'bg-slate-50 text-slate-400 border-slate-200'
                  }`}
                  title={isCurrent ? 'Current status' : isPast ? 'Completed' : isValidNext ? 'Available next' : 'Not reachable'}
                >
                  {s}
                </div>
                {i < arr.length - 1 && (
                  <div className={`w-5 h-[2px] mx-0.5 rounded-full ${isPast ? 'bg-emerald-300' : isCurrent || isValidNext ? 'bg-[#a5b4fc]' : 'bg-slate-200'}`} />
                )}
              </div>
            )
          })}
        </div>
        {statusHistory.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[11px] font-bold tracking-[0.1em] uppercase text-slate-500 mb-2.5">Status History</p>
            <div className="flex flex-wrap gap-2">
              {statusHistory.slice(0, 5).map((h) => (
                <span key={h.id} className="inline-flex items-center gap-1.5 text-xs bg-white border border-slate-200 rounded-full px-3 py-1.5 shadow-sm">
                  <span className="text-slate-400">{h.from_status}</span>
                  <span className="text-[#4F46E5]">→</span>
                  <span className="font-bold text-slate-800">{h.to_status}</span>
                  <span className="text-slate-400 ml-1 font-mono text-[11px]">{new Date(h.changed_at).toLocaleDateString()}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Tabs - indigo pill */}
      <div className="flex gap-1.5 shrink-0 bg-white border border-slate-200 rounded-2xl p-1.5 w-fit shadow-sm">
        {[
          { key: 'path', label: 'Graduation Path', icon: <Layers size={14} /> },
          { key: 'history', label: 'Enrollment History', icon: <BookOpen size={14} /> },
          { key: 'timeline', label: 'Timeline', icon: <Clock size={14} /> },
          { key: 'activity', label: 'Activity Log', icon: <Activity size={14} /> },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === key ? 'bg-[#4F46E5] text-white shadow-md shadow-indigo-200' : 'text-slate-500 hover:text-slate-700 hover:bg-white'
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Content viewport - single scroll */}
      <div className="flex-1 min-h-0 overflow-auto flex flex-col gap-4 pr-1 [scrollbar-width:thin]">
      {activeTab === 'path' ? (
        <Card title="All Modules — Graduation Path" subtitle={`${passedCourses} of ${allCourses.length} modules completed • indigo bento grid`} className="rounded-[24px] !bg-white card-hover border-slate-200 isolate flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  className={`card-hover rounded-[16px] border p-4 transition-all flex flex-col gap-2 hover:border-[#a5b4fc] ${
                    isPassed
                      ? 'border-emerald-200 bg-emerald-50/70'
                      : isFailed
                      ? 'border-red-200 bg-red-50/70'
                      : isActive
                      ? 'border-[#c7d2fe] bg-[#EEF2FF]'
                      : isCompleted
                      ? 'border-amber-200 bg-amber-50/70'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display text-sm font-bold text-slate-900 leading-tight">{course.title}</p>
                      {course.course_code ? (
                        <p className="text-xs font-medium text-[#6366f1] mt-0.5 font-mono">{course.course_code}</p>
                      ) : null}
                    </div>
                    <span
                      className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${
                        isPassed ? 'bg-emerald-500 text-white border-emerald-600' : isFailed ? 'bg-red-500 text-white border-red-600' : isActive ? 'bg-[#4F46E5] text-white border-[#4338ca]' : isCompleted ? 'bg-amber-500 text-white border-amber-600' : 'bg-slate-100 text-slate-400 border-slate-200'
                      }`}
                    >
                      {isPassed ? '✓' : isFailed ? '✗' : isActive ? '◐' : isCompleted ? '…' : '○'}
                    </span>
                  </div>
                  {enrollment ? (
                    <div className="mt-1 text-xs">
                      {enrollment.result_status ? (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold border ${isPassed ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                          {enrollment.result_status}
                          {enrollment.score !== null && enrollment.score !== undefined
                            ? ` · ${enrollment.score}`
                            : ''}
                        </span>
                      ) : (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border ${isActive ? 'bg-[#EEF2FF] text-[#4338ca] border-[#c7d2fe]' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>{isActive ? 'Currently enrolled' : isCompleted ? 'Awaiting result' : '—'}</span>
                      )}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs font-medium text-slate-400">Not yet enrolled</p>
                  )}
                </Link>
              )
            })}
          </div>
          {!allCourses.length ? (
            <p className="text-sm text-slate-400 text-center py-10">No courses in the system yet.</p>
          ) : null}
          </div>
        </Card>
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
          <div className="flex items-center justify-between py-3.5 border-b border-slate-100 last:border-0 gap-4">
            <div className="min-w-0">
              <Link
                to={`/lecturer/courses/${e.course_id}`}
                className="font-display text-sm font-bold text-slate-900 hover:text-[#4F46E5] hover:underline"
              >
                {e.course_title}
              </Link>
              {e.course_code ? <span className="ml-1.5 text-xs font-medium text-[#6366f1] font-mono">{e.course_code}</span> : null}
              <p className="text-xs text-slate-400 mt-0.5">
                {e.cohort_name ? `${e.cohort_name} · ` : ''}
                Enrolled {fmtDate(e.enrolled_at)}
                {e.completed_at ? ` · Completed ${fmtDate(e.completed_at)}` : ''}
              </p>
            </div>
            <div className="text-right shrink-0 ml-4">
              {e.result_status === 'Pass' ? (
                <>
                  <Badge tone="emerald" dot>✓ Pass</Badge>
                  {e.score != null ? <p className="text-xs text-slate-400 mt-1 font-mono">{e.score} pts</p> : null}
                </>
              ) : e.result_status === 'Fail' ? (
                <>
                  <Badge tone="rose" dot>✗ Fail</Badge>
                  {e.score != null ? <p className="text-xs text-slate-400 mt-1 font-mono">{e.score} pts</p> : null}
                </>
              ) : e.status === 'completed' ? (
                <Badge tone="amber">Awaiting result</Badge>
              ) : (
                <Badge tone="sky" className="!bg-[#EEF2FF] !text-[#4338ca] !border-[#c7d2fe]">In Progress</Badge>
              )}
              {!e.result_status ? (
                <button
                  type="button"
                  onClick={() => setResultPanelCourseId((prev) => (prev === e.course_id ? null : e.course_id))}
                  className="btn btn-ghost btn-sm lift gap-2 mt-1.5"
                  style={{ borderRadius: '10px' }}
                >
                  {resultPanelCourseId === e.course_id ? 'Cancel' : '+ Add result'}
                </button>
              ) : null}
              {resultPanelCourseId === e.course_id ? (
                <div className="mt-2.5 flex flex-col gap-2 items-end bg-slate-50 border border-slate-200 rounded-[14px] p-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                    Score (0–100)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={resultFormScore}
                      onChange={(ev) => setResultFormScore(ev.target.value)}
                      className="input w-24 !rounded-[10px] !py-1.5"
                    />
                  </label>
                  <select
                    value={resultFormStatus}
                    onChange={(ev) => setResultFormStatus(ev.target.value)}
                    className="select text-xs !rounded-[10px] !py-1.5"
                  >
                    <option value="Pass">Pass</option>
                    <option value="Fail">Fail</option>
                  </select>
                  <button
                    type="button"
                    disabled={resultSaving}
                    onClick={() => saveStudentResult(e.course_id)}
                    className="btn btn-primary btn-sm lift gap-2 disabled:opacity-50"
                    style={{ background: '#4F46E5', borderRadius: '10px' }}
                  >
                    {resultSaving ? 'Saving…' : 'Save result'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )

        return (
          <div className="flex flex-col gap-4">
            {/* Currently enrolled */}
            <Card title="Currently Enrolled" subtitle="Courses this student is actively taking right now" className="rounded-[24px] !bg-white card-hover border-slate-200 isolate">
              {current.length > 0
                ? current.map((e) => <EnrollRow key={e.id} e={e} />)
                : <p className="text-sm text-slate-400 py-2">Not currently enrolled in any course.</p>
              }
            </Card>

            {/* Eligible to retake */}
            {retake.length > 0 ? (
              <Card title="Eligible to Retake" subtitle="Failed courses — eligible to enroll again in the next cycle" className="rounded-[24px] !bg-white card-hover border-slate-200 isolate">
                {retake.map((e) => <EnrollRow key={e.id} e={e} />)}
              </Card>
            ) : null}

            {/* Past completed */}
            <Card title="Completed Courses" subtitle="Passed or awaiting result" className="rounded-[24px] !bg-white card-hover border-slate-200 isolate">
              {past.length > 0
                ? past.map((e) => <EnrollRow key={e.id} e={e} />)
                : <p className="text-sm text-slate-400 py-2">No completed courses yet.</p>
              }
            </Card>

            {/* Not yet started */}
            {notStarted.length > 0 ? (
              <Card title="Not Yet Started" subtitle="Courses this student has never been enrolled in" className="rounded-[24px] !bg-white card-hover border-slate-200 isolate">
                {notStarted.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0 gap-4">
                    <div className="min-w-0">
                      <Link
                        to={`/lecturer/courses/${c.id}`}
                        className="font-display text-sm font-bold text-slate-900 hover:text-[#4F46E5] hover:underline"
                      >
                        {c.title}
                      </Link>
                      {c.course_code ? <span className="ml-1.5 text-xs font-medium text-[#6366f1] font-mono">{c.course_code}</span> : null}
                    </div>
                    <span className="text-xs rounded-full px-2.5 py-1 bg-slate-100 text-slate-500 border border-slate-200 font-semibold">Not started</span>
                  </div>
                ))}
              </Card>
            ) : null}
          </div>
        )
      })() : null}



      {/* Timeline */}
      {activeTab === 'timeline' ? (
        <Card title="Activity Timeline" subtitle="Status transitions & enrollments — indigo bento" className="rounded-[24px] !bg-white card-hover border-slate-200 isolate flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="space-y-2 flex-1 min-h-0 overflow-auto pr-1 [scrollbar-width:thin]">
            {timeline.map((event) => (
              <div key={event.id} className="flex items-start gap-3 rounded-[16px] bg-slate-50 border border-slate-100 px-4 py-3 hover:bg-[#EEF2FF] hover:border-[#e0e7ff] transition-colors">
                <div className="flex flex-col items-center shrink-0 pt-1">
                  <div className={`w-2.5 h-2.5 rounded-full ring-4 ${
                    event.type === 'status_transition' ? 'bg-[#4F46E5] ring-[#e0e7ff]' :
                    event.type === 'enrollment' ? 'bg-emerald-400 ring-emerald-100' : 'bg-slate-400 ring-slate-100'
                  }`} />
                </div>
                <div className="min-w-0 flex-1">
                  {event.type === 'status_transition' ? (
                    <p className="text-sm text-slate-700">
                      Status changed: <span className="text-slate-500">{event.from_status}</span>
                      <span className="mx-1.5 text-[#4F46E5] font-bold">→</span>
                      <span className="font-bold text-slate-900">{event.to_status}</span>
                      {event.reason ? <span className="text-slate-400 italic ml-1.5">({event.reason})</span> : null}
                    </p>
                  ) : event.type === 'enrollment' ? (
                    <p className="text-sm text-slate-700">
                      {event.auto_enrolled ? <span className="text-[#4F46E5] text-xs font-bold mr-1">⚡</span> : null}
                      {event.status === 'active' ? 'Enrolled in' : event.status === 'completed' ? 'Completed' : event.status === 'failed' ? 'Failed' : event.status === 'withdrawn' ? 'Withdrawn from' : 'Enrolled in'}{' '}
                      <span className="font-bold text-slate-900">{event.course_title}</span>
                      {event.course_code ? <span className="text-[#6366f1] font-medium font-mono text-xs"> ({event.course_code})</span> : null}
                      {event.result_status === 'Pass' ? <span className="ml-1.5 text-emerald-600 font-bold">✓ Pass</span> : null}
                      {event.result_status === 'Fail' ? <span className="ml-1.5 text-red-500 font-bold">✗ Fail</span> : null}
                      {event.score != null ? <span className="text-slate-400 ml-1 font-mono">({event.score})</span> : null}
                      {event.plan_start_date || event.plan_end_date ? (
                        <span className="text-slate-400 text-xs ml-1">
                          {event.plan_start_date ? new Date(event.plan_start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '?'} – {event.plan_end_date ? new Date(event.plan_end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '?'}
                        </span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-700">
                      <span className="font-bold capitalize">{event.action?.replace(/_/g, ' ')}</span>
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                    <Clock size={11} />
                    {new Date(event.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {event.actor ? <span> · by {event.actor}</span> : null}
                  </p>
                </div>
              </div>
            ))}
            {!timeline.length ? (
              <p className="text-sm text-slate-400 text-center py-10">No activity recorded yet.</p>
            ) : null}
          </div>
        </Card>
      ) : null}

      {/* Activity log */}
      {activeTab === 'activity' ? (
        <Card title="Activity Log" subtitle="Raw audit trail" className="rounded-[24px] !bg-white card-hover border-slate-200 isolate flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="space-y-2 flex-1 min-h-0 overflow-auto pr-1 [scrollbar-width:thin]">
            {history.activities.map((activity, index) => (
              <div
                key={`${activity.action}-${activity.created_at}-${index}`}
                className="flex items-start gap-3 rounded-[16px] bg-slate-50 border border-slate-100 px-4 py-3 hover:bg-[#EEF2FF] hover:border-[#e0e7ff] transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-[#4F46E5] mt-2 shrink-0 ring-4 ring-[#e0e7ff]" />
                <div>
                  <p className="text-sm font-bold text-slate-800 capitalize">{activity.action.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-slate-400 font-mono">{new Date(activity.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {!history.activities.length ? (
              <p className="text-sm text-slate-400 text-center py-10">No activity recorded yet.</p>
            ) : null}
          </div>
        </Card>
      ) : null}
      </div>
      </div>
    </AppShell>
  )
}
