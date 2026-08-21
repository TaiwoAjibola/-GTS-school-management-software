import { useEffect, useMemo, useState } from 'react'
import { Download, MoreVertical, Upload, X, Users, BookOpen, ClipboardCheck, GraduationCap, BarChart3, FileText, UserCog, Settings, Layers, UserPlus, SquarePen, Search, Plus } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/ui/Card'
import DataTable from '../components/ui/DataTable'
import apiClient from '../api/client'
import { useAuth } from '../context/AuthContext'
import { lecturerNavGroups } from '../constants/lecturerNav'
import { fmtDateRange } from '../utils/formatDate'
import EmailProcesses from '../components/EmailProcesses'

const CLASS_DAY_INDEX = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
}

const suggestCourseEndDate = (startDate, durationWeeks, classDay) => {
  if (!startDate || !durationWeeks || !classDay) return ''
  const start = new Date(`${startDate}T00:00:00`)
  if (Number.isNaN(start.getTime())) return ''

  const targetDay = CLASS_DAY_INDEX[classDay]
  if (targetDay === undefined) return ''

  const diffToFirstClass = (targetDay - start.getDay() + 7) % 7
  const firstClassDate = new Date(start)
  firstClassDate.setDate(firstClassDate.getDate() + diffToFirstClass)

  const weeks = Math.max(1, Number(durationWeeks))
  const lastClassDate = new Date(firstClassDate)
  lastClassDate.setDate(lastClassDate.getDate() + (weeks - 1) * 7)

  return lastClassDate.toISOString().slice(0, 10)
}

const ALL_STATUSES = ['Applied', 'Under Review', 'Accepted', 'Prospective', 'Active', 'On Hold', 'Suspended', 'Withdrawn', 'Transferred', 'Graduating', 'Completed', 'Graduated', 'Alumni']

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
  Completed: 'bg-sky-100 text-sky-700',
  Graduated: 'bg-gold-200 text-gold-800',
  Alumni: 'bg-slate-200 text-slate-700',
}

const LecturerDashboard = () => {
  const { user } = useAuth()
  const location = useLocation()
  const section = location.pathname.split('/')[2] || 'courses'

  const [courses, setCourses] = useState([])
  const [batches, setBatches] = useState([])
  const [selectedBatchId, setSelectedBatchId] = useState('')
  const [batchStudents, setBatchStudents] = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [selectedCourseId, setSelectedCourseId] = useState('')

  const [attendanceStatus, setAttendanceStatus] = useState({ activeSession: null, attendeeCount: 0 })
  const [attendanceHistory, setAttendanceHistory] = useState([])
  const [attendanceRoster, setAttendanceRoster] = useState([])
  const [attendanceSummary, setAttendanceSummary] = useState([])
  const [selectedClassNumber, setSelectedClassNumber] = useState('1')

  const [courseForm, setCourseForm] = useState({
    title: '',
    courseCode: '',
    lecturerName: '',
    durationWeeks: 6,
    minAttendanceRequired: 4,
    hasAssignment: false,
    hasExam: false,
  })
  const [studentForm, setStudentForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    matricNo: '',
    comments: '',
    status: 'Prospective',
    cohortId: '',
  })
  const [studentUploadFile, setStudentUploadFile] = useState(null)
  const [courseUploadFile, setCourseUploadFile] = useState(null)
  const [courseSearch, setCourseSearch] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [studentEditForm, setStudentEditForm] = useState(null)
  const [studentHistory, setStudentHistory] = useState({ enrollments: [], activities: [] })
  const [studentTimeline, setStudentTimeline] = useState([])
  const [enrollmentNotesEdits, setEnrollmentNotesEdits] = useState({})
  const [loadingStudentHistory, setLoadingStudentHistory] = useState(false)
  const [newStatusInput, setNewStatusInput] = useState('')
  const [profileImageFile, setProfileImageFile] = useState(null)
  const [profileImageUploading, setProfileImageUploading] = useState(false)

  const [assignmentForm, setAssignmentForm] = useState({ title: '', description: '', dueDate: '', file: null })

  const [examsTab, setExamsTab] = useState('assignments')
  const [exams, setExams] = useState([])
  const [examsLoading, setExamsLoading] = useState(false)
  const [examForm, setExamForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    examType: 'essay',
    planId: '',
    questions: [{ text: '', options: [{ key: 'A', label: '' }, { key: 'B', label: '' }], correctAnswer: 'A' }],
  })
  const [examEligible, setExamEligible] = useState([])
  const [examSelected, setExamSelected] = useState({})
  const [examSendTarget, setExamSendTarget] = useState(null)
  const [examSending, setExamSending] = useState(false)
  const [examSendResult, setExamSendResult] = useState(null)
  const [examSubmissionsView, setExamSubmissionsView] = useState(null)
  const [examSubmissions, setExamSubmissions] = useState([])
  const [examSubmissionsLoading, setExamSubmissionsLoading] = useState(false)
  const [examResultsSending, setExamResultsSending] = useState(false)
  const [examSavedListOpen, setExamSavedListOpen] = useState(false)

  const [attendanceForm, setAttendanceForm] = useState({ date: '', startTime: '', endTime: '', secondaryLecturerId: '', lecturerNotes: '' })
  const [editingSession, setEditingSession] = useState(null) // { session, roster }
  const [editSessionLoading, setEditSessionLoading] = useState(false)
  const [deleteSessionReason, setDeleteSessionReason] = useState('')
  const [showDeleteSessionConfirm, setShowDeleteSessionConfirm] = useState(false)

  const [courseResults, setCourseResults] = useState([])
  const [resultSortBy, setResultSortBy] = useState('name')
  const [selectedResultType, setSelectedResultType] = useState('Final')
  const [resultCohortFilter, setResultCohortFilter] = useState('')
  const [courseAllEnrollments, setCourseAllEnrollments] = useState([])
  const [resultRowEdits, setResultRowEdits] = useState({})
  const [editingResultRowId, setEditingResultRowId] = useState(null)
  const [resultUploadFile, setResultUploadFile] = useState(null)
  const [resultUploadSummary, setResultUploadSummary] = useState(null)
  const [resultsTab, setResultsTab] = useState('input')
  const [resultsHistory, setResultsHistory] = useState([])
  const [resultsHistoryLoading, setResultsHistoryLoading] = useState(false)
  const [historyOpenCohort, setHistoryOpenCohort] = useState(null)
  const [resultPlanId, setResultPlanId] = useState('')
  const [resultCourseId, setResultCourseId] = useState('')
  const [planCourses, setPlanCourses] = useState([])
  const [planGrid, setPlanGrid] = useState(null)
  const [planGridLoading, setPlanGridLoading] = useState(false)
  const [planGridEdits, setPlanGridEdits] = useState({})
  const [planGridResultType, setPlanGridResultType] = useState('Final')
  const [includeAllStudents, setIncludeAllStudents] = useState(false)
  const [historySearch, setHistorySearch] = useState('')

  const [reportStats, setReportStats] = useState(null)
  const [attendanceReport, setAttendanceReport] = useState(null)
  const [reportFilters, setReportFilters] = useState({ year: '', batchId: '', courseId: '' })
  const [reportLoading, setReportLoading] = useState(false)
  const [openGraduationActionFor, setOpenGraduationActionFor] = useState(null)

  const [courseStudents, setCourseStudents] = useState([])
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
  const [coursesTab, setCoursesTab] = useState('courses') // 'courses' | 'plans' | 'timeline'
  const [plans, setPlans] = useState([])
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [planForm, setPlanForm] = useState({ name: '', year: new Date().getFullYear() })
  const [planItemForm, setPlanItemForm] = useState({ courseId: '', startDate: '', endDate: '' })
  const [planLoading, setPlanLoading] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null) // { id, name, year }
  const [eligibleStudents, setEligibleStudents] = useState([])
  const [cohorts, setCohorts] = useState([])
  const [cohortForm, setCohortForm] = useState({ name: '', startDate: '', endDate: '' })
  const [editingCohortId, setEditingCohortId] = useState(null)
  const [cohortEditForm, setCohortEditForm] = useState({ name: '', startDate: '', endDate: '', status: 'active' })
  const [draggingCohortId, setDraggingCohortId] = useState(null)
  const [showBatchDrawer, setShowBatchDrawer] = useState(false)
  const [batchViewFilter, setBatchViewFilter] = useState('active')
  const [expandedCohortIds, setExpandedCohortIds] = useState(new Set())
  const [studentCohortFilter, setStudentCohortFilter] = useState('')
  const [studentStatusFilter, setStudentStatusFilter] = useState('current')
  const [graduationSearch, setGraduationSearch] = useState('')
  const [graduationMatrix, setGraduationMatrix] = useState({ courses: [], students: [] })
  const [graduationSortBy, setGraduationSortBy] = useState('progress')
  const [graduationStatusFilter, setGraduationStatusFilter] = useState('all')
  const [graduationCohortFilter, setGraduationCohortFilter] = useState('')
  const [lecturers, setLecturers] = useState([])
  const [lecturerForm, setLecturerForm] = useState({ name: '', email: '', phone: '' })
  const [editingLecturerId, setEditingLecturerId] = useState(null)
  const [lecturerEditForm, setLecturerEditForm] = useState({ name: '', email: '', phone: '' })
  const [timelinePlanItems, setTimelinePlanItems] = useState([])
  const [timelinePlanLoading, setTimelinePlanLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [settingsTab, setSettingsTab] = useState('processes')
  const [forms, setForms] = useState([])
  const [formsLoading, setFormsLoading] = useState(false)
  const [editingForm, setEditingForm] = useState(null)
  const [formBuilderOpen, setFormBuilderOpen] = useState(false)
  const [formSubmissions, setFormSubmissions] = useState([])
  const [submissionsLoading, setSubmissionsLoading] = useState(false)
  const [selectedFormForSubmissions, setSelectedFormForSubmissions] = useState(null)
  const [validNextStatuses, setValidNextStatuses] = useState([])
  const [statusHistory, setStatusHistory] = useState([])
  const [statusTransitionReason, setStatusTransitionReason] = useState('')
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false)
  const [pendingStatus, setPendingStatus] = useState(null)
  const [statusSaving, setStatusSaving] = useState(false)
  const [copiedFormId, setCopiedFormId] = useState(null)
  const [quickStatusStudent, setQuickStatusStudent] = useState(null)
  const [quickStatusOptions, setQuickStatusOptions] = useState([])
  const [quickSelectedStatus, setQuickSelectedStatus] = useState(null)
  const [quickStatusReason, setQuickStatusReason] = useState('')
  const [quickStatusSaving, setQuickStatusSaving] = useState(false)
  const [showQuickStatus, setShowQuickStatus] = useState(false)
  const [panelStatusOpen, setPanelStatusOpen] = useState(false)
  const [gradVetting, setGradVetting] = useState(null) // { student, targetStatus }
  const [gradVettingConfirm, setGradVettingConfirm] = useState({})
  const [gradVettingReason, setGradVettingReason] = useState('')
  const [gradVettingSaving, setGradVettingSaving] = useState(false)

  const [credentials, setCredentials] = useState([])
  const [credentialsLoading, setCredentialsLoading] = useState(false)
  const [credentialFormOpen, setCredentialFormOpen] = useState(false)
  const [credentialAllStudents, setCredentialAllStudents] = useState([])
  const [credentialStudentSearch, setCredentialStudentSearch] = useState('')
  const [credentialStudentId, setCredentialStudentId] = useState(null)
  const [credentialUsername, setCredentialUsername] = useState('')
  const [credentialPassword, setCredentialPassword] = useState('')
  const [credentialPasswordConfirm, setCredentialPasswordConfirm] = useState('')
  const [credentialSaving, setCredentialSaving] = useState(false)
  const [prospectiveStudents, setProspectiveStudents] = useState([])
  const [prospectiveStudentsLoading, setProspectiveStudentsLoading] = useState(false)
  const [studentsTab, setStudentsTab] = useState('students')

  const notify = (message) => {
    setNotice(message)
    setTimeout(() => setNotice(''), 3500)
  }

  const loadForms = async () => {
    setFormsLoading(true)
    try {
      const res = await apiClient.get('/forms')
      setForms(res.data)
    } catch {
      notify('Failed to load forms')
    } finally {
      setFormsLoading(false)
    }
  }

  const loadFormSubmissions = async (formId) => {
    setSubmissionsLoading(true)
    try {
      const res = await apiClient.get(`/forms/${formId}/submissions`)
      setFormSubmissions(res.data)
    } catch {
      notify('Failed to load submissions')
    } finally {
      setSubmissionsLoading(false)
    }
  }

  const loadProspectiveStudents = async () => {
    setProspectiveStudentsLoading(true)
    try {
      const res = await apiClient.get('/forms/prospective-students')
      setProspectiveStudents(res.data)
    } catch {
      notify('Failed to load prospective students')
    } finally {
      setProspectiveStudentsLoading(false)
    }
  }

  const saveForm = async (formData) => {
    try {
      // Only PATCH when editing an existing form with a real id (templates use id: null)
      if (editingForm?.id) {
        await apiClient.patch(`/forms/${editingForm.id}`, formData)
        notify('Form updated')
      } else {
        await apiClient.post('/forms', formData)
        notify('Form created')
      }
      setEditingForm(null)
      setFormBuilderOpen(false)
      await loadForms()
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to save form')
    }
  }

  const openGraduationCalendarTemplate = () => {
    setEditingForm({
      ...GRADUATION_CALENDAR_TEMPLATE,
      id: null,
      fields: GRADUATION_CALENDAR_TEMPLATE.fields.map((f) => ({
        ...f,
        field_type: f.fieldType,
        maps_to_column: f.mapsToColumn,
        field_conditions: f.fieldConditions,
      })),
      maps_to_student: false,
      status: 'draft',
      title: GRADUATION_CALENDAR_TEMPLATE.title,
      slug: GRADUATION_CALENDAR_TEMPLATE.slug,
      description: GRADUATION_CALENDAR_TEMPLATE.description,
      _template: 'graduation_calendar',
    })
    setFormBuilderOpen(true)
  }

  const deleteForm = async (formId) => {
    if (!window.confirm('Delete this form and all its submissions?')) return
    try {
      await apiClient.delete(`/forms/${formId}`)
      notify('Form deleted')
      await loadForms()
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to delete form')
    }
  }

  const toggleFormStatus = async (form) => {
    const nextStatus = form.status === 'active' ? 'closed' : 'active'
    try {
      await apiClient.patch(`/forms/${form.id}`, { status: nextStatus })
      notify(`Form ${nextStatus === 'active' ? 'opened' : 'closed'}`)
      await loadForms()
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to update form status')
    }
  }

  const reviewSubmission = async (submissionId, status, notes) => {
    try {
      await apiClient.patch(`/forms/submissions/${submissionId}/review`, { status, reviewNotes: notes })
      notify(`Submission ${status}`)
      if (selectedFormForSubmissions) {
        await loadFormSubmissions(selectedFormForSubmissions)
      }
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to review submission')
    }
  }

  const loadLecturers = async () => {
    try {
      const res = await apiClient.get('/lecturers')
      setLecturers(res.data)
    } catch { /* silently ignore */ }
  }



  const openCredentialForm = async () => {
    setCredentialFormOpen(true)
    setCredentialStudentId(null)
    setCredentialUsername('')
    setCredentialPassword('')
    setCredentialPasswordConfirm('')
    setCredentialStudentSearch('')
    try {
      const res = await apiClient.get('/students')
      setCredentialAllStudents(res.data || [])
    } catch { notify('Failed to load students') }
  }

  const generateCredentialPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
    let pwd = ''
    for (let i = 0; i < 14; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)]
    }
    setCredentialPassword(pwd)
    setCredentialPasswordConfirm(pwd)
  }

  const saveCredential = async () => {
    if (!credentialStudentId) { notify('Please select a student'); return }
    if (!credentialPassword) { notify('Please enter a password'); return }
    if (credentialPassword !== credentialPasswordConfirm) { notify('Passwords do not match'); return }

    setCredentialSaving(true)
    try {
      await apiClient.post('/credentials', {
        studentId: credentialStudentId,
        username: credentialUsername,
        password: credentialPassword,
      })
      notify('Credential created successfully')
      setCredentialFormOpen(false)
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to create credential')
    } finally { setCredentialSaving(false) }
  }



  const loadCourses = async () => {
    const response = await apiClient.get('/courses')
    const ownCourses = user?.role === 'admin'
      ? response.data
      : response.data.filter(
          (course) => Number(course.lecturer_id) === Number(user?.id) || Number(course.created_by) === Number(user?.id)
        )
    setCourses(ownCourses)
    if (!selectedCourseId && ownCourses.length) {
      const currentCourse = ownCourses.find((course) => Boolean(course.is_current))
      setSelectedCourseId(String(currentCourse?.id || ownCourses[0].id))
    }
  }

  useEffect(() => {
    const currentCourse = courses.find((course) => Boolean(course.is_current))
    if (currentCourse && String(selectedCourseId || '') !== String(currentCourse.id)) {
      setSelectedCourseId(String(currentCourse.id))
    }
  }, [courses])

  const loadAllStudents = async () => {
    const response = await apiClient.get('/students')
    setAllStudents(response.data)
    return response.data
  }

  const loadCohorts = async () => {
    const response = await apiClient.get('/cohorts')
    setCohorts(response.data)
  }

  const loadGraduationMatrix = async () => {
    const response = await apiClient.get('/students/graduation-matrix')
    setGraduationMatrix(response.data)
  }

  const loadBatches = async (courseId) => {
    if (!courseId) {
      setBatches([])
      setSelectedBatchId('')
      setBatchStudents([])
      return []
    }

    const response = await apiClient.get(`/batches?courseId=${courseId}`)
    setBatches(response.data)
    if (!response.data.length) {
      setSelectedBatchId('')
      setBatchStudents([])
      return []
    }

    setSelectedBatchId((prev) => {
      const exists = response.data.some((batch) => String(batch.id) === String(prev))
      return exists ? prev : String(response.data[0].id)
    })

    return response.data
  }

  const loadBatchStudents = async (batchId) => {
    if (!batchId) {
      setBatchStudents([])
      return
    }

    const response = await apiClient.get(`/enrollments/batch/${batchId}`)
    setBatchStudents(response.data)
  }

  const loadCourseScopedData = async (courseId, classNumber = selectedClassNumber) => {
    if (!courseId) {
      setCourseStudents([])
      setAttendanceStatus({ activeSession: null, attendeeCount: 0 })
      setAttendanceHistory([])
      setAttendanceRoster([])
      setAttendanceSummary([])
      setCourseResults([])
      setEligibleStudents([])
      setCourseAllEnrollments([])
      return
    }

    const [studentsRes, statusRes, rosterRes, historyRes, summaryRes, resultsRes, eligibleRes, allEnrollRes] = await Promise.all([
      apiClient.get(`/courses/${courseId}/students`),
      apiClient.get(`/attendance/course/${courseId}/status?classNumber=${classNumber}`),
      apiClient.get(`/attendance/course/${courseId}/roster?classNumber=${classNumber}`),
      apiClient.get(`/attendance/course/${courseId}/history`),
      apiClient.get(`/attendance/course/${courseId}/students-summary`),
      apiClient.get(`/results/course/${courseId}`),
      apiClient.get(`/assignments/eligible/${courseId}`),
      apiClient.get(`/courses/${courseId}/enrollments`),
    ])

    setCourseStudents(studentsRes.data)
    setAttendanceStatus(statusRes.data)
    setAttendanceRoster(rosterRes.data.roster)
    setAttendanceHistory(historyRes.data)
    setAttendanceSummary(summaryRes.data)
    setCourseResults(resultsRes.data)
    setEligibleStudents(eligibleRes.data)
    setCourseAllEnrollments(allEnrollRes.data)
  }

  const selectedCourse = useMemo(
    () => courses.find((course) => String(course.id) === String(selectedCourseId)),
    [courses, selectedCourseId]
  )

  useEffect(() => {
    loadCourses()
    loadAllStudents()
    loadGraduationMatrix()
    loadCohorts()
    loadLecturers()
  }, [user?.id])

  useEffect(() => {
    if (!selectedCourseId) return

    loadCourseScopedData(selectedCourseId, selectedClassNumber)
    loadBatches(selectedCourseId)
    const interval = setInterval(() => loadCourseScopedData(selectedCourseId, selectedClassNumber), 5000)

    return () => clearInterval(interval)
  }, [selectedCourseId, selectedClassNumber])

  useEffect(() => {
    if (!selectedBatchId) {
      setBatchStudents([])
      return
    }

    loadBatchStudents(selectedBatchId)
  }, [selectedBatchId])

  useEffect(() => {
    if (!selectedCourse) {
      setSelectedClassNumber('1')
      return
    }

    const maxClass = Math.max(1, Number(selectedCourse.duration_weeks || 1))
    if (Number(selectedClassNumber) > maxClass) {
      setSelectedClassNumber('1')
    }
  }, [selectedCourse?.id, selectedCourse?.duration_weeks])

  useEffect(() => {
    if (!selectedCourse) return
    if (selectedResultType === 'Assignment' && !selectedCourse.has_assignment) {
      setSelectedResultType('Final')
    }
    if (selectedResultType === 'Exam' && !selectedCourse.has_exam) {
      setSelectedResultType('Final')
    }
  }, [selectedCourse, selectedResultType])

  // Load plan items for the timeline tab based on calendarYear
  useEffect(() => {
    if (coursesTab !== 'timeline') return
    let cancelled = false
    const doLoad = async () => {
      setTimelinePlanLoading(true)
      try {
        let allPlans = plans
        if (!allPlans.length) {
          const res = await apiClient.get('/course-plans')
          if (cancelled) return
          setPlans(res.data)
          allPlans = res.data
        }
        const match = allPlans.find((p) => Number(p.year) === calendarYear)
        if (!match) {
          if (!cancelled) setTimelinePlanItems([])
          return
        }
        const res = await apiClient.get(`/course-plans/${match.id}`)
        if (!cancelled) setTimelinePlanItems(res.data.items || [])
      } catch { /* silently ignore */ }
      finally { if (!cancelled) setTimelinePlanLoading(false) }
    }
    doLoad()
    return () => { cancelled = true }
  }, [coursesTab, calendarYear])

  const classOptions = useMemo(() => {
    const totalClasses = Math.max(1, Number(selectedCourse?.duration_weeks || 1))
    return Array.from({ length: totalClasses }, (_, index) => index + 1)
  }, [selectedCourse?.duration_weeks])


  const enrolledIds = useMemo(
    () => new Set(batchStudents.map((student) => Number(student.student_id))),
    [batchStudents]
  )

  const filteredStudents = useMemo(() => {
    let result = allStudents

    if (studentCohortFilter) {
      result = result.filter((student) => String(student.cohort_id || '') === studentCohortFilter)
    }

    if (studentStatusFilter === 'current') {
      result = result.filter((student) => !['Graduated', 'Alumni'].includes(student.status))
    } else if (studentStatusFilter !== 'all') {
      result = result.filter((student) => student.status === studentStatusFilter)
    }

    // Column/global search is handled by DataTable — keep only toolbar filters here
    return result
  }, [allStudents, studentCohortFilter, studentStatusFilter])

  const filteredGraduationStudents = useMemo(() => {
    const query = graduationSearch.trim().toLowerCase()
    let rows = graduationMatrix.students || []

    if (graduationStatusFilter !== 'all') {
      rows = rows.filter((student) => student.status === graduationStatusFilter)
    }

    if (graduationCohortFilter) {
      rows = rows.filter((student) => String(student.cohort_id || '') === graduationCohortFilter)
    }

    if (query) {
      rows = rows.filter(
        (student) =>
          student.full_name.toLowerCase().includes(query) ||
          student.email.toLowerCase().includes(query) ||
          student.matric_no.toLowerCase().includes(query)
      )
    }

    const sorted = [...rows]
    if (graduationSortBy === 'name') {
      sorted.sort((a, b) => a.full_name.localeCompare(b.full_name))
    } else if (graduationSortBy === 'status') {
      sorted.sort((a, b) => a.status.localeCompare(b.status) || b.completion_pct - a.completion_pct)
    } else {
      sorted.sort((a, b) => b.completion_pct - a.completion_pct || a.full_name.localeCompare(b.full_name))
    }
    return sorted
  }, [graduationMatrix.students, graduationSearch, graduationSortBy, graduationStatusFilter, graduationCohortFilter])

  const graduationStatusCounts = useMemo(() => {
    const counts = { total: graduationMatrix.students?.length || 0, Graduating: 0, Graduated: 0, Alumni: 0 }
    for (const student of graduationMatrix.students || []) {
      if (student.status === 'Graduating') counts.Graduating += 1
      if (student.status === 'Graduated') counts.Graduated += 1
      if (student.status === 'Alumni') counts.Alumni += 1
    }
    return counts
  }, [graduationMatrix.students])

  const currentCourseResultMap = useMemo(() => {
    const map = new Map()
    for (const row of courseResults) {
      if ((row.result_type || 'Final') === selectedResultType) {
        map.set(Number(row.student_id), row)
      }
    }
    return map
  }, [courseResults, selectedResultType])

  const sortedCourseStudentsForResults = useMemo(() => {
    const clone = [...courseStudents]
    if (resultSortBy === 'score') {
      clone.sort((a, b) => {
        const aScore = Number(currentCourseResultMap.get(Number(a.student_id))?.score ?? -1)
        const bScore = Number(currentCourseResultMap.get(Number(b.student_id))?.score ?? -1)
        return bScore - aScore
      })
    } else if (resultSortBy === 'status') {
      clone.sort((a, b) => {
        const aStatus = currentCourseResultMap.get(Number(a.student_id))?.status || ''
        const bStatus = currentCourseResultMap.get(Number(b.student_id))?.status || ''
        return aStatus.localeCompare(bStatus)
      })
    } else {
      clone.sort((a, b) => a.full_name.localeCompare(b.full_name))
    }
    return clone
  }, [courseStudents, resultSortBy, currentCourseResultMap])

  const studentGraduationProgress = useMemo(() => {
    if (!selectedStudent || !graduationMatrix.courses?.length) return null
    const enrollmentByCourse = {}
    for (const enrollment of studentHistory.enrollments) {
      enrollmentByCourse[enrollment.course_id] = enrollment
    }
    const passed = []
    const failed = []
    const active = []
    const notStarted = []
    for (const course of graduationMatrix.courses) {
      const enrollment = enrollmentByCourse[course.id]
      if (!enrollment) {
        notStarted.push(course)
      } else if (enrollment.result_status === 'Pass') {
        passed.push({ ...course, enrollment })
      } else if (enrollment.result_status === 'Fail') {
        failed.push({ ...course, enrollment })
      } else {
        active.push({ ...course, enrollment })
      }
    }
    return { passed, failed, active, notStarted, total: graduationMatrix.courses.length }
  }, [selectedStudent, studentHistory.enrollments, graduationMatrix.courses])

  const suggestedCourseEndDate = useMemo(
    () => suggestCourseEndDate(courseForm.startDate, courseForm.durationWeeks, courseForm.classDay),
    [courseForm.startDate, courseForm.durationWeeks, courseForm.classDay]
  )

  const loadReports = async () => {
    setReportLoading(true)
    try {
      const [general, attendance] = await Promise.all([
        apiClient.get('/reports/general', { params: reportFilters }),
        apiClient.get('/reports/attendance', { params: reportFilters }),
      ])
      setReportStats(general.data)
      setAttendanceReport(attendance.data)
    } catch (error) {
      console.error('Failed to load reports:', error)
    } finally {
      setReportLoading(false)
    }
  }

  useEffect(() => {
    const next = {}
    for (const row of courseResults) {
      if ((row.result_type || 'Final') !== selectedResultType) continue
      next[row.student_id] = {
        score: String(row.score ?? ''),
        status: row.status || 'Pass',
      }
    }
    setResultRowEdits(next)
  }, [courseResults, selectedResultType])

  useEffect(() => {
    if (section === 'forms') {
      loadForms()
      apiClient.get('/batches').then(res => setBatches(res.data)).catch(() => {})
    }
    if (section === 'students') {
      loadProspectiveStudents()
    }
    if (section === 'reports') {
      loadReports()
    }
  }, [section, user?.role, reportFilters])

  useEffect(() => {
    if (section === 'assignments' && selectedCourseId) {
      loadExams(selectedCourseId)
      loadExamEligible(selectedCourseId)
    }
  }, [section, selectedCourseId])

  const createCourse = async (event) => {
    event.preventDefault()
    try {
      await apiClient.post('/courses', {
        ...courseForm,
        lecturerId: user.id,
      })
      setCourseForm({ title: '', courseCode: '', lecturerName: '', durationWeeks: 6, minAttendanceRequired: 4, hasAssignment: false, hasExam: false })
      await loadCourses()
      notify('Course created successfully')
    } catch (error) {
      notify(error?.response?.data?.message || 'Unable to create course')
    }
  }

  const createStudent = async (event) => {
    event.preventDefault()
    try {
      await apiClient.post('/students', {
        fullName: studentForm.fullName,
        email: studentForm.email,
        phone: studentForm.phone,
        matricNo: studentForm.matricNo,
        comments: studentForm.comments,
        status: studentForm.status,
        cohortId: studentForm.cohortId ? Number(studentForm.cohortId) : undefined,
      })

      setStudentForm({
        fullName: '',
        email: '',
        phone: '',
        matricNo: '',
        comments: '',
        status: 'Prospective',
        cohortId: '',
      })
      await Promise.all([loadAllStudents(), loadGraduationMatrix()])
      notify('Student created successfully')
    } catch (error) {
      notify(error?.response?.data?.message || 'Unable to create student')
    }
  }

  const createStudentBatch = async (event) => {
    event.preventDefault()
    if (!cohortForm.name.trim() || !cohortForm.startDate || !cohortForm.endDate) {
      notify('Batch name, start date, and end date are required')
      return
    }
    try {
      await apiClient.post('/cohorts', {
        name: cohortForm.name.trim(),
        startDate: cohortForm.startDate,
        endDate: cohortForm.endDate,
      })
      setCohortForm({ name: '', startDate: '', endDate: '' })
      await loadCohorts()
      notify('Student batch created')
    } catch (error) {
      notify(error?.response?.data?.message || 'Unable to create student batch')
    }
  }

  const startEditCohort = (cohort) => {
    setEditingCohortId(cohort.id)
    setCohortEditForm({
      name: cohort.name || '',
      startDate: cohort.start_date || '',
      endDate: cohort.end_date || '',
      status: cohort.status || 'active',
    })
  }

  const saveCohortEdit = async (cohortId) => {
    try {
      await apiClient.patch(`/cohorts/${cohortId}`, {
        name: cohortEditForm.name,
        startDate: cohortEditForm.startDate,
        endDate: cohortEditForm.endDate,
        status: cohortEditForm.status,
      })
      setEditingCohortId(null)
      await loadCohorts()
      notify('Batch updated')
    } catch (error) {
      notify(error?.response?.data?.message || 'Unable to update batch')
    }
  }

  const moveCohortLocally = (dragId, dropId) => {
    if (!dragId || !dropId || dragId === dropId) return
    setCohorts((prev) => {
      const list = [...prev]
      const from = list.findIndex((item) => Number(item.id) === Number(dragId))
      const to = list.findIndex((item) => Number(item.id) === Number(dropId))
      if (from < 0 || to < 0) return prev
      const [moved] = list.splice(from, 1)
      list.splice(to, 0, moved)
      return list
    })
  }

  const persistCohortOrder = async () => {
    try {
      const orderedIds = cohorts.map((item) => item.id)
      await apiClient.patch('/cohorts/reorder', { orderedIds })
      await loadCohorts()
      notify('Batch order saved')
    } catch (error) {
      notify(error?.response?.data?.message || 'Unable to save batch order')
    }
  }

  const deleteCohortSafely = async (cohort) => {
    const confirmed = window.confirm(`Delete batch "${cohort.name}"?`)
    if (!confirmed) return

    try {
      await apiClient.delete(`/cohorts/${cohort.id}`)
      if (editingCohortId === cohort.id) {
        setEditingCohortId(null)
      }
      await loadCohorts()
      notify('Batch deleted')
    } catch (error) {
      if (error?.response?.status === 409) {
        const forceConfirmed = window.confirm(
          'This batch has students assigned. Remove students from this batch and delete anyway?'
        )
        if (!forceConfirmed) return
        await apiClient.delete(`/cohorts/${cohort.id}?force=true`)
        if (editingCohortId === cohort.id) {
          setEditingCohortId(null)
        }
        await loadCohorts()
        notify('Batch deleted and students unassigned')
        return
      }
      notify(error?.response?.data?.message || 'Unable to delete batch')
    }
  }

  const setCourseAsCurrent = async (courseId) => {
    await apiClient.patch(`/courses/${courseId}/set-current`)
    await loadCourses()
    notify('Current course updated')
  }

  const deleteCourse = async (courseId, courseTitle) => {
    if (!window.confirm(`Delete "${courseTitle}"? This will also remove all enrollments, attendance and results for this course.`)) return
    try {
      await apiClient.delete(`/courses/${courseId}`)
      await loadCourses()
      if (String(selectedCourseId) === String(courseId)) setSelectedCourseId('')
      notify('Course deleted')
    } catch (err) {
      notify(err?.response?.data?.message || 'Unable to delete course')
    }
  }

  const exportStudentList = async () => {
    const response = await apiClient.get('/students/export', { responseType: 'blob' })
    const href = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = href
    link.setAttribute('download', 'students.xlsx')
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(href)
  }

  const uploadStudents = async () => {
    if (!studentUploadFile) return
    try {
      const formData = new FormData()
      formData.append('file', studentUploadFile)
      const response = await apiClient.post('/students/upload', formData)
      await Promise.all([loadAllStudents(), loadCourseScopedData(selectedCourseId), loadGraduationMatrix()])
      notify(`Students uploaded: ${response.data.processed} processed`)
      setStudentUploadFile(null)
    } catch (err) {
      notify(err?.response?.data?.message || 'Upload failed. Please try again.')
    }
  }

  const uploadCourses = async () => {
    if (!courseUploadFile) return
    const formData = new FormData()
    formData.append('file', courseUploadFile)
    try {
      const res = await apiClient.post('/courses/bulk-upload', formData)
      await loadCourses()
      setCourseUploadFile(null)
      const errCount = res.data.errors?.length || 0
      notify(`Courses uploaded: ${res.data.created} created${errCount ? `, ${errCount} skipped` : ''}`)
    } catch (err) {
      notify(err?.response?.data?.message || 'Course upload failed')
    }
  }

  const downloadTemplate = async (type) => {
    try {
      const res = await apiClient.get(`/${type}/template`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}_template.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      notify('Failed to download template')
    }
  }

  const enrollStudent = async (studentId) => {
    if (!selectedBatchId) {
      notify('Select a batch first')
      return
    }

    await apiClient.post('/enrollments', {
      studentId,
      batchId: Number(selectedBatchId),
    })
    await Promise.all([
      loadCourseScopedData(selectedCourseId),
      loadBatchStudents(selectedBatchId),
      loadCourses(),
      loadGraduationMatrix(),
    ])
    notify('Student enrolled to batch')
  }

  const openStudentPanel = async (student) => {
    setSelectedStudent(student)
    setStudentEditForm({ ...student })
    setNewStatusInput('')
    setStatusTransitionReason('')
    setPanelStatusOpen(false)
    setStudentTimeline([])
    setLoadingStudentHistory(true)
    try {
      const [historyRes, timelineRes, nextStatusesRes, statusHistoryRes] = await Promise.allSettled([
        apiClient.get(`/enrollments/student/${student.id}/history`),
        apiClient.get(`/enrollments/student/${student.id}/timeline`),
        apiClient.get(`/students/${student.id}/next-statuses`),
        apiClient.get(`/students/${student.id}/status-history`),
      ])
      if (historyRes.status === 'fulfilled') {
        setStudentHistory(historyRes.value.data)
        const notesMap = {}
        for (const enrollment of historyRes.value.data.enrollments || []) {
          notesMap[enrollment.id] = enrollment.notes || ''
        }
        setEnrollmentNotesEdits(notesMap)
      }
      if (timelineRes.status === 'fulfilled') {
        setStudentTimeline(timelineRes.value.data.timeline || [])
      }
      if (nextStatusesRes.status === 'fulfilled') {
        setValidNextStatuses(nextStatusesRes.value.data.nextStatuses || [])
      }
      if (statusHistoryRes.status === 'fulfilled') {
        setStatusHistory(statusHistoryRes.value.data || [])
      }
    } finally {
      setLoadingStudentHistory(false)
    }
  }

  const closeStudentPanel = () => {
    setSelectedStudent(null)
    setStudentEditForm(null)
    setStudentHistory({ enrollments: [], activities: [] })
    setStudentTimeline([])
    setEnrollmentNotesEdits({})
    setNewStatusInput('')
    setValidNextStatuses([])
    setStatusHistory([])
    setStatusTransitionReason('')
    setPanelStatusOpen(false)
  }

  const saveStudentEdit = async (event) => {
    event.preventDefault()
    if (!studentEditForm) return
    await apiClient.put(`/students/${studentEditForm.id}`, {
      fullName: studentEditForm.full_name,
      email: studentEditForm.email,
      phone: studentEditForm.phone,
      status: studentEditForm.status,
      matricNo: studentEditForm.matric_no,
      comments: studentEditForm.comments,
      cohortId: studentEditForm.cohort_id ? Number(studentEditForm.cohort_id) : null,
    })
    // If status changed, also call the lifecycle endpoint so email notifications fire
    if (studentEditForm.status !== selectedStudent?.status) {
      await apiClient.patch(`/students/${studentEditForm.id}/lifecycle-status`, {
        status: studentEditForm.status,
        reason: statusTransitionReason || null,
      })
    }
    await Promise.all([loadAllStudents(), loadCourseScopedData(selectedCourseId)])
    closeStudentPanel()
    notify('Student updated')
  }

  const addStudentStatus = async () => {
    if (!selectedStudent || !newStatusInput.trim()) return
    await apiClient.post(`/students/${selectedStudent.id}/status`, {
      statusName: newStatusInput.trim(),
    })

    const students = await loadAllStudents()
    const refreshed = students.find((student) => student.id === selectedStudent.id)
    if (refreshed) {
      setSelectedStudent(refreshed)
      setStudentEditForm({ ...refreshed })
    }
    setNewStatusInput('')
    notify('Student status added')
  }

  const removeStudentStatus = async (statusId) => {
    if (!selectedStudent) return
    await apiClient.delete(`/students/${selectedStudent.id}/status/${statusId}`)

    const students = await loadAllStudents()
    const refreshed = students.find((student) => student.id === selectedStudent.id)
    if (refreshed) {
      setSelectedStudent(refreshed)
      setStudentEditForm({ ...refreshed })
    }
    notify('Student status removed')
  }

  const uploadProfileImage = async () => {
    if (!selectedStudent || !profileImageFile) return
    setProfileImageUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', profileImageFile)
      const res = await apiClient.post(`/students/${selectedStudent.id}/photo`, formData)
      const updated = { ...selectedStudent, profile_image_url: res.data.profileImageUrl }
      setSelectedStudent(updated)
      setStudentEditForm((prev) => ({ ...prev, profile_image_url: res.data.profileImageUrl }))
      setAllStudents((prev) =>
        prev.map((s) => (s.id === selectedStudent.id ? { ...s, profile_image_url: res.data.profileImageUrl } : s))
      )
      setProfileImageFile(null)
      notify('Profile image uploaded')
    } catch (err) {
      notify(err?.response?.data?.message || 'Upload failed')
    } finally {
      setProfileImageUploading(false)
    }
  }

  const startAttendance = async () => {
    if (!attendanceForm.date || !attendanceForm.startTime || !attendanceForm.endTime) {
      notify('Date, start time and end time are required')
      return
    }

    const startDateTime = new Date(`${attendanceForm.date}T${attendanceForm.startTime}`)
    const endDateTime = new Date(`${attendanceForm.date}T${attendanceForm.endTime}`)
    if (Number.isNaN(startDateTime.getTime()) || Number.isNaN(endDateTime.getTime())) {
      notify('Invalid date or time')
      return
    }
    if (endDateTime <= startDateTime) {
      notify('End time must be after start time')
      return
    }

    await apiClient.post('/attendance/start', {
      courseId: Number(selectedCourseId),
      classNumber: Number(selectedClassNumber),
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      secondaryLecturerId: attendanceForm.secondaryLecturerId || null,
      lecturerNotes: attendanceForm.lecturerNotes || '',
    })
    setAttendanceForm({ date: '', startTime: '', endTime: '', secondaryLecturerId: '', lecturerNotes: '' })
    await loadCourseScopedData(selectedCourseId, selectedClassNumber)
  }

  const closeAttendance = async () => {
    await apiClient.post('/attendance/close', {
      courseId: Number(selectedCourseId),
      classNumber: Number(selectedClassNumber),
    })
    await loadCourseScopedData(selectedCourseId, selectedClassNumber)
  }

  const markStudentPresent = async (studentId) => {
    await apiClient.post('/attendance/manual-mark', {
      courseId: Number(selectedCourseId),
      studentId,
      classNumber: Number(selectedClassNumber),
    })
    await loadCourseScopedData(selectedCourseId, selectedClassNumber)
  }

  const openEditSession = async (session) => {
    setEditSessionLoading(true)
    try {
      const res = await apiClient.get(`/attendance/session/${session.id}/roster`)
      setEditingSession(res.data)
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to load session roster')
    } finally {
      setEditSessionLoading(false)
    }
  }

  const toggleSessionAttendance = async (sessionId, studentId) => {
    try {
      const res = await apiClient.patch(`/attendance/session/${sessionId}/toggle`, { studentId })
      // Update the roster in state immediately (optimistic)
      setEditingSession((prev) => ({
        ...prev,
        roster: prev.roster.map((r) =>
          r.student_id === studentId ? { ...r, present: res.data.present } : r
        ),
      }))
      // Refresh summary counts
      await loadCourseScopedData(selectedCourseId, selectedClassNumber)
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to update attendance')
    }
  }

  const deleteSession = async () => {
    if (!deleteSessionReason.trim()) {
      notify('Please enter a reason before deleting')
      return
    }
    try {
      await apiClient.delete(`/attendance/session/${editingSession.session.id}`, {
        data: { reason: deleteSessionReason.trim() },
      })
      setEditingSession(null)
      setDeleteSessionReason('')
      setShowDeleteSessionConfirm(false)
      await loadCourseScopedData(selectedCourseId, selectedClassNumber)
      notify('Attendance session deleted')
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to delete session')
    }
  }

  const updateResultInline = async (studentId, score, status) => {
    if (!selectedCourseId) {
      notify('Select a course first')
      return
    }
    if (!['Pass', 'Fail'].includes(status)) {
      notify('Status must be Pass or Fail')
      return
    }
    await apiClient.post('/results', {
      courseId: Number(selectedCourseId),
      studentId,
      resultType: selectedResultType,
      score: score !== '' && score !== null && score !== undefined ? Number(score) : undefined,
      status,
    })
    await Promise.all([loadCourseScopedData(selectedCourseId), loadGraduationMatrix()])
    notify('Result updated')
  }

  const downloadResultTemplate = async () => {
    if (!selectedCourseId || !selectedBatchId) {
      notify('Select course and batch first')
      return
    }
    const response = await apiClient.get(
      `/results/template?courseId=${selectedCourseId}&batchId=${selectedBatchId}`,
      { responseType: 'blob' }
    )
    const href = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = href
    link.setAttribute('download', `results-template-course-${selectedCourseId}-batch-${selectedBatchId}.csv`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(href)
  }

  const uploadResultsFile = async () => {
    if (!resultUploadFile) {
      notify('Select a file first')
      return
    }
    if (!selectedCourseId || !selectedBatchId) {
      notify('Select course and batch first')
      return
    }
    const formData = new FormData()
    formData.append('file', resultUploadFile)
    formData.append('courseId', String(selectedCourseId))
    formData.append('batchId', String(selectedBatchId))

    const response = await apiClient.post('/results/bulk-upload', formData)
    setResultUploadSummary(response.data)
    await Promise.all([loadCourseScopedData(selectedCourseId), loadGraduationMatrix()])
    notify(`Imported ${response.data.imported} result(s)`)
  }

  const updateResultRowField = (studentId, field, value) => {
    setResultRowEdits((prev) => ({
      ...prev,
      [studentId]: {
        score: prev[studentId]?.score ?? '',
        status: prev[studentId]?.status ?? 'Pass',
        [field]: value,
      },
    }))
  }

  const exportResultsCsv = () => {
    apiClient
      .get(`/results/course/${selectedCourseId}/export`, { responseType: 'blob' })
      .then((response) => {
        const href = URL.createObjectURL(response.data)
        const link = document.createElement('a')
        link.href = href
        link.setAttribute('download', `course-${selectedCourseId}-results.csv`)
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(href)
      })
  }

  const createAssignment = async (event) => {
    event.preventDefault()
    const formData = new FormData()
    formData.append('courseId', String(selectedCourseId))
    formData.append('title', assignmentForm.title)
    formData.append('description', assignmentForm.description)
    if (assignmentForm.dueDate) {
      formData.append('dueDate', assignmentForm.dueDate)
    }
    if (assignmentForm.file) {
      formData.append('file', assignmentForm.file)
    }

    await apiClient.post('/assignments', formData)
    setAssignmentForm({ title: '', description: '', dueDate: '', file: null })
    await loadCourseScopedData(selectedCourseId)
    notify('Assignment sent to eligible students')
  }

  const loadExams = async (courseId) => {
    if (!courseId) { setExams([]); return }
    try {
      setExamsLoading(true)
      const res = await apiClient.get(`/exams/course/${courseId}`)
      setExams(res.data)
    } catch { setExams([]) }
    finally { setExamsLoading(false) }
  }

  const loadExamEligible = async (courseId) => {
    if (!courseId) { setExamEligible([]); return }
    try {
      const res = await apiClient.get(`/exams/eligible/${courseId}`)
      setExamEligible(res.data)
      setExamSelected(Object.fromEntries(res.data.map((s) => [s.id, true])))
    } catch { setExamEligible([]) }
  }

  const blankMcqQuestion = () => ({
    text: '',
    options: [
      { key: 'A', label: '' },
      { key: 'B', label: '' },
      { key: 'C', label: '' },
      { key: 'D', label: '' },
    ],
    correctAnswer: 'A',
  })

  const createExam = async (event) => {
    event.preventDefault()
    if (!examForm.title.trim()) { notify('Exam title is required'); return }

    let questions
    if (examForm.examType === 'mcq') {
      questions = examForm.questions
        .map((q) => ({
          text: (q.text || '').trim(),
          options: (q.options || []).filter((o) => (o.label || '').trim()),
          correctAnswer: q.correctAnswer || 'A',
        }))
        .filter((q) => q.text && q.options.length >= 2)
      if (!questions.length) {
        notify('Add at least one MCQ with 2+ options and a correct answer')
        return
      }
      const bad = questions.find((q) => !q.options.some((o) => o.key === q.correctAnswer))
      if (bad) {
        notify('Each MCQ must have a correct answer matching one of its options')
        return
      }
    } else {
      questions = examForm.questions.filter((q) => (q.text || '').trim()).map((q) => ({ text: q.text.trim() }))
      if (!questions.length) {
        notify('Add at least one exam question')
        return
      }
    }

    try {
      const res = await apiClient.post('/exams', {
        courseId: Number(selectedCourseId),
        planId: examForm.planId ? Number(examForm.planId) : null,
        title: examForm.title.trim(),
        description: examForm.description.trim(),
        dueDate: examForm.dueDate || null,
        examType: examForm.examType,
        questions,
      })
      setExamForm({
        title: '',
        description: '',
        dueDate: '',
        examType: 'essay',
        planId: '',
        questions: [{ text: '', options: [{ key: 'A', label: '' }, { key: 'B', label: '' }], correctAnswer: 'A' }],
      })
      await loadExams(selectedCourseId)
      if (res.data?.take_url) {
        notify('MCQ exam saved. Share the quiz link when you send it to students.')
      } else {
        notify('Exam saved')
      }
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to save exam')
    }
  }

  const openExamSubmissions = async (exam) => {
    setExamSubmissionsView(exam)
    setExamSubmissions([])
    setExamSubmissionsLoading(true)
    try {
      const res = await apiClient.get(`/exams/${exam.id}/submissions`)
      setExamSubmissions(res.data.submissions || [])
    } catch {
      setExamSubmissions([])
      notify('Failed to load submissions')
    } finally {
      setExamSubmissionsLoading(false)
    }
  }

  const sendMcqResultsNow = async () => {
    if (!examSubmissionsView) return
    setExamResultsSending(true)
    try {
      const res = await apiClient.post(`/exams/${examSubmissionsView.id}/send-results`, {})
      notify(`Results emailed to ${res.data.sent} of ${res.data.total} student(s)`)
      await openExamSubmissions(examSubmissionsView)
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to send results')
    } finally {
      setExamResultsSending(false)
    }
  }

  const openExamSend = (exam) => {
    setExamSendTarget(exam)
    setExamSendResult(null)
  }

  const sendExamNow = async () => {
    if (!examSendTarget) return
    setExamSending(true)
    setExamSendResult(null)
    const ids = examEligible.filter((s) => examSelected[s.id]).map((s) => s.id)
    if (!ids.length) {
      setExamSending(false)
      notify('Select at least one student to send to')
      return
    }
    try {
      const res = await apiClient.post(`/exams/${examSendTarget.id}/send`, { studentIds: ids })
      setExamSendResult(res.data)
      notify(`Exam sent to ${res.data.sent} of ${res.data.total} student(s)`)
      await loadExams(selectedCourseId)
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to send exam')
    } finally {
      setExamSending(false)
    }
  }

  const deleteExamItem = async (examId) => {
    if (!window.confirm('Delete this exam and its delivery records?')) return
    try {
      await apiClient.delete(`/exams/${examId}`)
      await loadExams(selectedCourseId)
      notify('Exam deleted')
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to delete exam')
    }
  }

  const saveEnrollmentNote = async (enrollmentId) => {
    await apiClient.patch(`/enrollments/${enrollmentId}/notes`, {
      notes: enrollmentNotesEdits[enrollmentId] || '',
    })

    if (selectedStudent) {
      const response = await apiClient.get(`/enrollments/student/${selectedStudent.id}/history`)
      setStudentHistory(response.data)
    }
    notify('Enrollment note updated')
  }

  const updateStudentLifecycle = async (student, status) => {
    await apiClient.put(`/students/${student.id}`, { status })
    await Promise.all([loadAllStudents(), loadGraduationMatrix()])
    notify(`Student moved to ${status}`)
  }

  const openGradVetting = (student, targetStatus) => {
    const confirmations = {}
    for (const course of graduationMatrix.courses) {
      const info = student.courses?.[course.id]
      confirmations[course.id] = Boolean(info && info.result_status === 'Pass')
    }
    setGradVetting({ student, targetStatus })
    setGradVettingConfirm(confirmations)
    setGradVettingReason('')
    setGradVettingSaving(false)
    setOpenGraduationActionFor(null)
  }

  const vettingAllConfirmed = useMemo(() => {
    if (!gradVetting) return false
    return graduationMatrix.courses.every((course) => gradVettingConfirm[course.id])
  }, [gradVetting, gradVettingConfirm, graduationMatrix.courses])

  const confirmGradVetting = async () => {
    if (!gradVetting || !vettingAllConfirmed) return
    setGradVettingSaving(true)
    try {
      await apiClient.patch(`/students/${gradVetting.student.id}/lifecycle-status`, {
        status: gradVetting.targetStatus,
        reason: gradVettingReason || null,
        courseIds: graduationMatrix.courses.map((course) => course.id),
      })
      await Promise.all([loadAllStudents(), loadGraduationMatrix()])
      setGradVetting(null)
      notify(`Student moved to ${gradVetting.targetStatus}`)
    } catch (err) {
      notify(err?.response?.data?.message || 'Failed to update status')
    } finally {
      setGradVettingSaving(false)
    }
  }

  const sectionTitle = {
    courses: 'Courses',
    students: 'Students',
    batches: 'Batches',
    attendance: 'Attendance',
    results: 'Results',
    graduation: 'Graduation',
    assignments: 'Assignments',
    lecturers: 'Lecturers',
    'email-process': 'Email Process',
    forms: 'Forms',
    reports: 'Reports',
    'book-ministry': 'Book Ministry',
    settings: 'Settings',
  }[section] || 'Lecturer Dashboard'

  return (
    <AppShell title={sectionTitle} groups={lecturerNavGroups}>
      <div className="h-full flex flex-col gap-5 overflow-hidden">
      {notice ? <div className="mb-4 rounded-lg bg-emerald-100 text-emerald-800 px-4 py-2 text-sm shrink-0">{notice}</div> : null}

      {section === 'attendance' ? (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <Card title="My Courses" value={courses.length} />
            <Card title="Active Session" value={attendanceStatus.activeSession ? 'Yes' : 'No'} />
            <Card title="Present Students" value={attendanceStatus.attendeeCount || 0} />
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mb-6">
            <div className="grid lg:grid-cols-1 gap-3 items-center">
              <div>
                <h3 className="font-semibold text-slate-900">Current course</h3>
                <p className="text-sm text-slate-500">
                  {selectedCourse
                    ? `${selectedCourse.title} • ${selectedCourse.class_day || 'N/A'} ${selectedCourse.class_time || ''} • ${fmtDateRange(selectedCourse.start_date, selectedCourse.end_date)}`
                    : 'Set one course as current from Courses page to begin attendance'}
                </p>
                <p className="text-xs text-slate-400 mt-1">Attendance uses the current active course only.</p>
              </div>
            </div>
          </div>
        </div>

      ) : null}

      {section === 'courses' ? (
        <div className="space-y-6 flex-1 min-h-0 overflow-auto">
          {/* Tab switcher */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
            {['courses', 'plans', 'timeline'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setCoursesTab(tab)}
                className={`rounded-lg px-5 py-1.5 text-sm font-medium capitalize transition-colors ${coursesTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {tab === 'courses' ? 'Courses' : tab === 'plans' ? 'Plans' : 'Timeline'}
              </button>
            ))}
          </div>

          {/* ── COURSES TAB ── */}
          {coursesTab === 'courses' ? (
        <div className="grid lg:grid-cols-[390px_1fr] gap-6">
          <div className="space-y-6">
          <form onSubmit={createCourse} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-slate-900">Create Course</h3>

            <label className="text-sm text-slate-600 block">
              Course Title
              <input className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="Course title" value={courseForm.title} onChange={(event) => setCourseForm((prev) => ({ ...prev, title: event.target.value }))} required />
            </label>

            <label className="text-sm text-slate-600 block">
              Course Code
              <input className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="e.g. GTS101" value={courseForm.courseCode} onChange={(event) => setCourseForm((prev) => ({ ...prev, courseCode: event.target.value }))} />
            </label>

            <label className="text-sm text-slate-600 block">
              Lecturer
              <select className="mt-1 w-full border rounded-lg px-3 py-2" value={courseForm.lecturerName} onChange={(event) => setCourseForm((prev) => ({ ...prev, lecturerName: event.target.value }))}>
                <option value="">— No lecturer —</option>
                {lecturers.map((l) => (
                  <option key={l.id} value={l.name}>{l.name}</option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-600 block">
              Secondary Lecturer
              <select className="mt-1 w-full border rounded-lg px-3 py-2" value={courseForm.secondaryLecturerId || ''} onChange={(event) => setCourseForm((prev) => ({ ...prev, secondaryLecturerId: event.target.value || null }))}>
                <option value="">— No secondary lecturer —</option>
                {lecturers.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-600 block">
              Duration (weeks)
              <input className="mt-1 w-full border rounded-lg px-3 py-2" type="number" min="1" value={courseForm.durationWeeks} onChange={(event) => setCourseForm((prev) => ({ ...prev, durationWeeks: Number(event.target.value) }))} required />
            </label>

            <label className="text-sm text-slate-600 block">
              Minimum Attendance Required
              <input className="mt-1 w-full border rounded-lg px-3 py-2" type="number" min="0" value={courseForm.minAttendanceRequired} onChange={(event) => setCourseForm((prev) => ({ ...prev, minAttendanceRequired: Number(event.target.value) }))} required />
            </label>

            <div className="border rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-slate-700">Course Features</p>
              <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded"
                  checked={courseForm.hasAssignment}
                  onChange={(e) => setCourseForm((prev) => ({ ...prev, hasAssignment: e.target.checked }))}
                />
                Has Assignments
              </label>
              <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded"
                  checked={courseForm.hasExam}
                  onChange={(e) => setCourseForm((prev) => ({ ...prev, hasExam: e.target.checked }))}
                />
                Has Exam
              </label>
            </div>

            <button className="w-full bg-slate-900 text-white rounded-lg py-2">Save Course</button>
          </form>

          {/* Bulk course upload */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Bulk Upload Courses</h3>
              <button
                type="button"
                onClick={() => downloadTemplate('courses')}
                className="text-xs text-slate-500 underline"
              >
                Download Template
              </button>
            </div>
            <input type="file" accept=".xlsx,.xls" onChange={(e) => setCourseUploadFile(e.target.files?.[0] || null)} className="w-full border rounded-lg px-3 py-2" />
            <button onClick={uploadCourses} disabled={!courseUploadFile} className="w-full bg-slate-900 text-white rounded-lg py-2 disabled:opacity-50">
              Upload Courses
            </button>
          </div>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="font-semibold text-slate-900 text-base">Course List</h3>
              <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2.5 py-0.5 font-medium">{courses.length} courses</span>
            </div>
            <DataTable
              data={courses}
              rowKey="id"
              initialPageSize={25}
              emptyMessage="No courses yet. Create one using the form."
              emptyIcon={<BookOpen size={32} />}
              rowClassName={(course) => (course.is_current ? '!bg-amber-50/50' : '')}
              globalSearchPlaceholder="Search code, title, lecturer…"
              defaultSort={{ id: 'title', dir: 'asc' }}
              columns={[
                {
                  id: 'course_code',
                  header: 'Code',
                  accessor: 'course_code',
                  width: '110px',
                  cell: (course) => (
                    <span className="font-mono text-xs font-medium text-slate-600 bg-slate-100 rounded-md px-2 py-0.5">
                      {course.course_code || '—'}
                    </span>
                  ),
                },
                {
                  id: 'title',
                  header: 'Course Title',
                  accessor: 'title',
                  cell: (course) => (
                    <div className="flex items-center gap-2 min-w-0">
                      <Link to={`/lecturer/courses/${course.id}`} className="font-medium text-slate-900 hover:text-gold-700 transition-colors truncate">
                        {course.title}
                      </Link>
                      {course.is_current ? (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          Current
                        </span>
                      ) : null}
                    </div>
                  ),
                },
                {
                  id: 'lecturer',
                  header: 'Lecturer',
                  accessor: (c) => c.lecturer_name || c.assigned_lecturer || '',
                  cell: (c) => c.lecturer_name || c.assigned_lecturer || null,
                },
                {
                  id: 'schedule',
                  header: 'Schedule',
                  accessor: (c) => [c.class_day, c.class_time].filter(Boolean).join(' '),
                  cell: (course) => (
                    course.class_day || course.class_time ? (
                      <div className="flex flex-col">
                        {course.class_day ? <span className="text-slate-700 font-medium">{course.class_day}</span> : null}
                        {course.class_time ? <span className="text-xs text-slate-400">{course.class_time}</span> : null}
                      </div>
                    ) : null
                  ),
                },
                {
                  id: 'duration',
                  header: 'Duration',
                  accessor: 'duration_weeks',
                  sortType: 'number',
                  cell: (course) => (
                    <div className="flex flex-col">
                      <span className="text-slate-700 text-xs">{fmtDateRange(course.start_date, course.end_date)}</span>
                      <span className="text-[11px] text-slate-400">{course.duration_weeks} week{course.duration_weeks !== 1 ? 's' : ''}</span>
                    </div>
                  ),
                },
                {
                  id: 'attendance',
                  header: 'Attendance',
                  accessor: 'min_attendance_required',
                  sortType: 'number',
                  width: '110px',
                  cell: (c) => (c.min_attendance_required != null ? `${c.min_attendance_required}%` : null),
                },
                {
                  id: 'status',
                  header: 'Status',
                  accessor: (c) => (c.is_current ? 'Active' : 'Inactive'),
                  filterType: 'select',
                  filterOptions: ['Active', 'Inactive'],
                  align: 'center',
                  width: '120px',
                  cell: (course) => (
                    course.is_current ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-2.5 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCourseAsCurrent(course.id)}
                        className="rounded-lg px-2.5 py-1 text-[11px] font-medium bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
                      >
                        Set active
                      </button>
                    )
                  ),
                },
                {
                  id: 'actions',
                  header: '',
                  filterable: false,
                  sortable: false,
                  align: 'right',
                  width: '90px',
                  cell: (course) => (
                    <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      <Link
                        to={`/lecturer/courses/${course.id}`}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                        title="View course"
                      >
                        <BookOpen size={15} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => deleteCourse(course.id, course.title)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                        title="Delete course"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </div>
      ) : null}

      {/* ── PLANS TAB ── */}
      {coursesTab === 'plans' ? (() => {
        const loadPlans = async () => {
          const res = await apiClient.get('/course-plans')
          setPlans(res.data)
        }
        const openPlan = async (plan) => {
          setPlanLoading(true)
          const [planRes, eligRes] = await Promise.all([
            apiClient.get(`/course-plans/${plan.id}`),
            apiClient.get(`/course-plans/${plan.id}/eligible-students`),
          ])
          setSelectedPlan(planRes.data)
          setEligibleStudents(eligRes.data.students || [])
          setPlanItemForm({ courseId: '', startDate: '', endDate: '' })
          setPlanLoading(false)
        }
        const createPlan = async (ev) => {
          ev.preventDefault()
          if (!planForm.name || !planForm.year) return
          const res = await apiClient.post('/course-plans', { name: planForm.name, year: Number(planForm.year) })
          setPlanForm({ name: '', year: new Date().getFullYear() })
          const updated = await apiClient.get('/course-plans')
          setPlans(updated.data)
          openPlan(res.data)
        }
        const savePlanEdit = async (ev) => {
          ev.preventDefault()
          await apiClient.put(`/course-plans/${editingPlan.id}`, { name: editingPlan.name, year: Number(editingPlan.year) })
          setEditingPlan(null)
          const updated = await apiClient.get('/course-plans')
          setPlans(updated.data)
          if (selectedPlan?.id === editingPlan.id) {
            const res = await apiClient.get(`/course-plans/${editingPlan.id}`)
            setSelectedPlan(res.data)
          }
        }
        const setActive = async (planId) => {
          await apiClient.patch(`/course-plans/${planId}/set-active`)
          const updated = await apiClient.get('/course-plans')
          setPlans(updated.data)
          if (selectedPlan?.id === planId) {
            setSelectedPlan((p) => p ? { ...p, is_active: true } : p)
          }
          notify('Active plan updated')
        }
        const deletePlan = async (planId) => {
          if (!window.confirm('Delete this plan?')) return
          await apiClient.delete(`/course-plans/${planId}`)
          if (selectedPlan?.id === planId) { setSelectedPlan(null); setEligibleStudents([]) }
          const updated = await apiClient.get('/course-plans')
          setPlans(updated.data)
        }
        const addItem = async (ev) => {
          ev.preventDefault()
          if (!selectedPlan || !planItemForm.courseId) return
          await apiClient.post(`/course-plans/${selectedPlan.id}/items`, {
            courseId: Number(planItemForm.courseId),
            startDate: planItemForm.startDate || null,
            endDate: planItemForm.endDate || null,
          })
          setPlanItemForm({ courseId: '', startDate: '', endDate: '' })
          const res = await apiClient.get(`/course-plans/${selectedPlan.id}`)
          setSelectedPlan(res.data)
        }
        const removeItem = async (itemId) => {
          await apiClient.delete(`/course-plans/${selectedPlan.id}/items/${itemId}`)
          const res = await apiClient.get(`/course-plans/${selectedPlan.id}`)
          setSelectedPlan(res.data)
        }
        // Load plans on first render of this tab (only once)
        if (plans.length === 0 && !planLoading) {
          setPlanLoading(true)
          apiClient.get('/course-plans').then((r) => { setPlans(r.data); setPlanLoading(false) })
        }
        return (
          <div className="grid lg:grid-cols-[320px_1fr] gap-6">
            {/* Left: create + list */}
            <div className="space-y-4">
              {/* Create plan form */}
              <form onSubmit={createPlan} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                <h3 className="font-semibold text-slate-900">New Plan</h3>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Plan name (e.g. 2026 Academic Year)"
                  value={planForm.name}
                  onChange={(e) => setPlanForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  type="number"
                  placeholder="Year"
                  value={planForm.year}
                  onChange={(e) => setPlanForm((p) => ({ ...p, year: e.target.value }))}
                  required
                />
                <button className="w-full bg-slate-900 text-white rounded-lg py-2 text-sm">Create Plan</button>
              </form>

              {/* Plan list */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <h3 className="font-semibold text-slate-900 mb-3">All Plans</h3>
                {plans.length === 0 && !planLoading ? (
                  <p className="text-sm text-slate-400">No plans yet. Create one above.</p>
                ) : null}
                {plans.map((plan) => (
                  <div key={plan.id}>
                    {editingPlan?.id === plan.id ? (
                      <form onSubmit={savePlanEdit} className="border border-slate-300 rounded-xl p-3 space-y-2 bg-slate-50">
                        <input
                          className="w-full border rounded-lg px-3 py-1.5 text-sm"
                          value={editingPlan.name}
                          onChange={(e) => setEditingPlan((p) => ({ ...p, name: e.target.value }))}
                          required
                        />
                        <input
                          type="number"
                          className="w-full border rounded-lg px-3 py-1.5 text-sm"
                          value={editingPlan.year}
                          onChange={(e) => setEditingPlan((p) => ({ ...p, year: e.target.value }))}
                          required
                        />
                        <div className="flex gap-2">
                          <button type="submit" className="flex-1 bg-slate-900 text-white rounded-lg py-1.5 text-xs">Save</button>
                          <button type="button" onClick={() => setEditingPlan(null)} className="flex-1 bg-slate-100 text-slate-700 rounded-lg py-1.5 text-xs">Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <div
                        className={`flex items-start justify-between rounded-xl px-3 py-3 cursor-pointer border transition-colors ${selectedPlan?.id === plan.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:bg-slate-50'}`}
                        onClick={() => openPlan(plan)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-slate-900 truncate">{plan.name}</p>
                            {plan.is_active ? (
                              <span className="shrink-0 rounded-full bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 font-medium">Active</span>
                            ) : null}
                          </div>
                          <p className="text-xs text-slate-500">{plan.year} · {plan.item_count} course{plan.item_count !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="flex items-center gap-1 ml-2 shrink-0">
                          {!plan.is_active ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setActive(plan.id) }}
                              className="text-emerald-600 hover:text-emerald-800 text-xs px-2 py-1 rounded-lg hover:bg-emerald-50"
                            >
                              Set Active
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setEditingPlan({ id: plan.id, name: plan.name, year: plan.year }) }}
                            className="text-slate-500 hover:text-slate-800 text-xs px-2 py-1 rounded-lg hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); deletePlan(plan.id) }}
                            className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded-lg hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: plan detail */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              {!selectedPlan ? (
                <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
                  Select or create a plan to view its courses
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900 text-lg">{selectedPlan.name}</h3>
                        {selectedPlan.is_active ? (
                          <span className="rounded-full bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 font-medium">Active Plan</span>
                        ) : null}
                      </div>
                      <p className="text-sm text-slate-500">{selectedPlan.year} · {selectedPlan.items?.length || 0} courses planned</p>
                    </div>
                  </div>

                  {/* Eligible students summary */}
                  {eligibleStudents.length > 0 ? (
                    <div className="rounded-xl border border-gold-200 bg-gold-50 p-4">
                      <p className="text-sm font-medium text-gold-800 mb-1">
                        {eligibleStudents.length} Eligible Student{eligibleStudents.length !== 1 ? 's' : ''} for {selectedPlan.year}
                      </p>
                      <p className="text-xs text-gold-600">
                        Includes cohorts {selectedPlan.year - 1}–{selectedPlan.year} plus any student with a prior failed result.
                      </p>
                      <details className="mt-2">
                        <summary className="text-xs text-gold-700 cursor-pointer select-none">View list</summary>
                        <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                          {eligibleStudents.map((s) => (
                            <div key={s.id} className="flex items-center justify-between text-xs">
                              <span className="text-slate-800">{s.full_name} {s.matric_no ? `(${s.matric_no})` : ''}</span>
                              <span className={`rounded-full px-2 py-0.5 ${s.reason === 'failed_reenroll' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                {s.reason === 'failed_reenroll' ? 'Re-enroll' : s.cohort_name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No eligible students found for cohort years {selectedPlan.year - 1}–{selectedPlan.year}.</p>
                  )}

                  {/* Add course to plan */}
                  <form onSubmit={addItem} className="border border-slate-200 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-medium text-slate-700">Add Course to Plan</p>
                    <select
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={planItemForm.courseId}
                      onChange={(e) => setPlanItemForm((p) => ({ ...p, courseId: e.target.value }))}
                      required
                    >
                      <option value="">Select a course</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.course_code ? `${c.course_code} — ` : ''}{c.title}</option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-xs text-slate-500 block">
                        Start Date
                        <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={planItemForm.startDate} onChange={(e) => setPlanItemForm((p) => ({ ...p, startDate: e.target.value }))} />
                      </label>
                      <label className="text-xs text-slate-500 block">
                        End Date
                        <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={planItemForm.endDate} onChange={(e) => setPlanItemForm((p) => ({ ...p, endDate: e.target.value }))} />
                      </label>
                    </div>
                    <button className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm">Add to Plan</button>
                  </form>

                  {/* Plan items table */}
                  {selectedPlan.items?.length === 0 ? (
                    <p className="text-sm text-slate-400">No courses in this plan yet.</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700">Planned Courses</p>
                      <table className="data-table w-full text-sm">
                        <thead className="text-left text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="pb-2">Code</th>
                            <th className="pb-2">Course</th>
                            <th className="pb-2">Lecturer</th>
                            <th className="pb-2">Start</th>
                            <th className="pb-2">End</th>
                            <th className="pb-2">Weeks</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPlan.items.map((item) => (
                            <tr key={item.id} className="border-t border-slate-100">
                              <td className="py-2 text-slate-500">{item.course_code || '-'}</td>
                              <td className="py-2 font-medium text-slate-900">{item.course_title}</td>
                              <td className="py-2 text-slate-600">{item.lecturer_name || '-'}</td>
                              <td className="py-2 text-slate-600">{item.start_date ? new Date(item.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                              <td className="py-2 text-slate-600">{item.end_date ? new Date(item.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                              <td className="py-2 text-slate-600">{item.duration_weeks}w</td>
                              <td className="py-2">
                                <button type="button" onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })() : null}

      {/* ── TIMELINE TAB ── */}
      {coursesTab === 'timeline' ? (() => {
        const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
        const COURSE_COLORS = [
          'bg-sky-500', 'bg-violet-500', 'bg-emerald-500', 'bg-rose-500',
          'bg-amber-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-teal-500',
        ]

        const yearStart = new Date(calendarYear, 0, 1)
        const yearEnd = new Date(calendarYear, 11, 31)
        const yearMs = yearEnd - yearStart + 86400000

        // Build a lookup: course_id → plan dates for this year's plan
        const planDateByCourse = {}
        for (const item of timelinePlanItems) {
          planDateByCourse[item.course_id] = { start_date: item.start_date, end_date: item.end_date }
        }

        const hasPlan = timelinePlanItems.length > 0 || plans.some((p) => Number(p.year) === calendarYear)
        const matchedPlan = plans.find((p) => Number(p.year) === calendarYear)

        const bars = courses
          .map((c) => ({
            ...c,
            start_date: planDateByCourse[c.id]?.start_date ?? c.start_date,
            end_date: planDateByCourse[c.id]?.end_date ?? c.end_date,
            fromPlan: !!planDateByCourse[c.id],
          }))
          .filter((c) => {
            if (!c.start_date && !c.end_date) return false // hide completely undated in plan view
            const s = c.start_date ? new Date(c.start_date) : null
            const e = c.end_date ? new Date(c.end_date) : null
            return (!e || e >= yearStart) && (!s || s <= yearEnd)
          })
          .map((c, idx) => {
            const s = c.start_date ? new Date(c.start_date) : null
            const e = c.end_date ? new Date(c.end_date) : null
            const clampedStart = s ? Math.max(s - yearStart, 0) : 0
            const clampedEnd = e ? Math.min(e - yearStart + 86400000, yearMs) : yearMs
            const left = Math.round((clampedStart / yearMs) * 100)
            const width = Math.max(Math.round(((clampedEnd - clampedStart) / yearMs) * 100), 3)
            return { ...c, left, width, color: COURSE_COLORS[idx % COURSE_COLORS.length] }
          })

        return (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            {/* Header row: year nav + plan badge */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
              <button type="button" onClick={() => setCalendarYear((y) => y - 1)} className="rounded-lg px-2 py-1 text-sm bg-slate-100 hover:bg-slate-200">◀</button>
              <span className="font-semibold text-slate-900">{calendarYear} Timeline</span>
              <button type="button" onClick={() => setCalendarYear((y) => y + 1)} className="rounded-lg px-2 py-1 text-sm bg-slate-100 hover:bg-slate-200">▶</button>
              {timelinePlanLoading ? (
                <span className="text-xs text-slate-400 animate-pulse">Loading plan…</span>
              ) : matchedPlan ? (
                <span className="text-xs rounded-full bg-sky-100 text-sky-700 px-3 py-0.5 font-medium">
                  {matchedPlan.name}{matchedPlan.is_active ? ' · Active' : ''}
                </span>
              ) : (
                <span className="text-xs text-slate-400">No plan for {calendarYear}</span>
              )}
            </div>

            {/* Month header */}
            <div className="grid grid-cols-12 mb-1">
              {MONTHS.map((m) => (
                <div key={m} className="text-center text-xs text-slate-400 py-1">{m}</div>
              ))}
            </div>

            {/* Timeline bar chart */}
            <div className="relative border border-slate-200 rounded-xl overflow-hidden" style={{ minHeight: Math.max(bars.length * 44 + 16, 80) }}>
              {/* vertical month dividers */}
              <div className="absolute inset-0 grid grid-cols-12 pointer-events-none">
                {MONTHS.map((m) => (
                  <div key={m} className="border-r border-slate-100 last:border-0" />
                ))}
              </div>

              {/* Today marker */}
              {(() => {
                const today = new Date()
                if (today.getFullYear() === calendarYear) {
                  const pct = ((today - yearStart) / yearMs) * 100
                  return (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-red-400 opacity-60 pointer-events-none"
                      style={{ left: `${pct}%` }}
                    />
                  )
                }
                return null
              })()}

              {bars.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-10">
                  {matchedPlan
                    ? `${matchedPlan.name} has no course items yet. Add courses in the Plans tab.`
                    : `No plan found for ${calendarYear}. Create one in the Plans tab.`}
                </p>
              ) : null}

              {bars.map((c, idx) => (
                <div
                  key={c.id}
                  className="absolute flex items-center"
                  style={{ top: idx * 44 + 8, left: `${c.left}%`, width: `${c.width}%`, height: 36 }}
                >
                  <Link
                    to={`/lecturer/courses/${c.id}`}
                    title={`${c.title}${c.start_date ? ` · ${fmtDateRange(c.start_date, c.end_date)}` : ''}`}
                    className={`w-full h-full rounded-lg flex items-center px-2 gap-2 text-white text-xs font-medium truncate shadow-sm hover:opacity-90 transition-opacity ${c.color} ${c.is_current ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
                  >
                    {c.is_current ? <span className="shrink-0 text-amber-200">●</span> : null}
                    <span className="truncate">{c.course_code ? `${c.course_code} · ` : ''}{c.title}</span>
                    <button
                      type="button"
                      className="ml-auto shrink-0 opacity-70 hover:opacity-100"
                      title="Set as active course"
                      onClick={(ev) => {
                        ev.preventDefault()
                        ev.stopPropagation()
                        setCourseAsCurrent(c.id)
                      }}
                    >
                      {c.is_current ? '★' : '☆'}
                    </button>
                  </Link>
                </div>
              ))}
            </div>

            {/* Legend */}
            {bars.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-3">
                {bars.map((c) => (
                  <div key={c.id} className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className={`inline-block w-2.5 h-2.5 rounded-sm ${c.color}`} />
                    {c.title}
                    {c.fromPlan ? <span className="text-sky-500 ml-0.5" title="Dates from plan">●</span> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )
      })() : null}

    </div>
) : null}

      {section === 'courses' ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mt-6 overflow-auto flex-1 min-h-0">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="font-semibold text-slate-900">Course History by Batch</h3>
            <select className="border rounded-lg px-3 py-2 text-sm" value={selectedBatchId} onChange={(event) => setSelectedBatchId(event.target.value)}>
              <option value="">Select batch</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  Batch #{batch.id} • {fmtDateRange(batch.start_date, batch.end_date)}
                </option>
              ))}
            </select>
          </div>
          <DataTable
            data={batchStudents}
            rowKey="id"
            initialPageSize={25}
            emptyMessage="No students found for selected batch."
            globalSearchPlaceholder="Search student, matric, status…"
            defaultSort={{ id: 'full_name', dir: 'asc' }}
            columns={[
              {
                id: 'full_name',
                header: 'Student',
                accessor: 'full_name',
                cell: (student) => (
                  <Link to={`/lecturer/students/${student.student_id}`} className="font-medium text-slate-900 hover:underline">
                    {student.full_name}
                  </Link>
                ),
              },
              { id: 'matric_no', header: 'Matric', accessor: 'matric_no' },
              {
                id: 'status',
                header: 'Enrollment',
                accessor: 'status',
                filterType: 'select',
                filterOptions: [...new Set(batchStudents.map((s) => s.status).filter(Boolean))],
              },
              {
                id: 'result_status',
                header: 'Result',
                accessor: 'result_status',
                filterType: 'select',
                filterOptions: ['Pass', 'Fail', 'Pending'],
              },
              {
                id: 'score',
                header: 'Score',
                accessor: 'score',
                sortType: 'number',
                cell: (s) => (s.score != null ? s.score : null),
              },
              { id: 'notes', header: 'Notes', accessor: 'notes' },
            ]}
          />
        </div>
      ) : null}

      {section === 'students' ? (
        <div className="space-y-6 flex-1 min-h-0 overflow-auto">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
            {[
              { key: 'students', label: 'All Students' },
              { key: 'prospective', label: 'Prospective' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setStudentsTab(key)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  studentsTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {studentsTab === 'prospective' ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-xl font-semibold text-slate-900">Prospective Students</h3>
                <p className="text-sm text-slate-500 mt-1">Students created from approved form submissions.</p>
              </div>
              {prospectiveStudentsLoading ? (
                <p className="text-sm text-slate-500">Loading...</p>
              ) : (
                <div>
                    <DataTable
                      data={prospectiveStudents}
                      rowKey="student_id"
                      initialPageSize={25}
                      emptyMessage="No prospective students yet."
                      emptyIcon={<UserPlus size={32} />}
                      globalSearchPlaceholder="Search name, email, form…"
                      defaultSort={{ id: 'submitted_at', dir: 'desc' }}
                      columns={[
                        { id: 'full_name', header: 'Name', accessor: 'full_name', cell: (s) => <span className="font-medium text-slate-900">{s.full_name}</span> },
                        { id: 'email', header: 'Email', accessor: 'email' },
                        { id: 'form_title', header: 'Form', accessor: 'form_title' },
                        { id: 'cohort_name', header: 'Cohort', accessor: 'cohort_name' },
                        {
                          id: 'submitted_at',
                          header: 'Submitted',
                          accessor: 'submitted_at',
                          sortType: 'date',
                          cell: (s) => (s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : null),
                        },
                        {
                          id: 'status',
                          header: 'Status',
                          accessor: 'status',
                          filterType: 'select',
                          filterOptions: ['Prospective'],
                          cell: (s) => (
                            <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">
                              {s.status}
                            </span>
                          ),
                        },
                      ]}
                    />
                </div>
              )}
            </div>
          ) : (
          <div className="grid xl:grid-cols-[390px_1fr] gap-6">
          <div className="space-y-4 xl:overflow-y-auto xl:pr-1.5" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            <form onSubmit={createStudent} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="font-semibold text-slate-900">Create Student</h3>
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Full name" value={studentForm.fullName} onChange={(event) => setStudentForm((prev) => ({ ...prev, fullName: event.target.value }))} required />
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Email" type="email" value={studentForm.email} onChange={(event) => setStudentForm((prev) => ({ ...prev, email: event.target.value }))} required />
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Phone" value={studentForm.phone} onChange={(event) => setStudentForm((prev) => ({ ...prev, phone: event.target.value }))} required />
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Matric Number (optional)" value={studentForm.matricNo} onChange={(event) => setStudentForm((prev) => ({ ...prev, matricNo: event.target.value }))} />
              <textarea className="w-full border rounded-lg px-3 py-2" placeholder="Comments" value={studentForm.comments} onChange={(event) => setStudentForm((prev) => ({ ...prev, comments: event.target.value }))} rows={3} />
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={studentForm.status}
                onChange={(event) => {
                  const nextStatus = event.target.value
                  setStudentForm((prev) => ({
                    ...prev,
                    status: nextStatus,
                  }))
                }}
              >
                <option value="Prospective">Prospective (applied, not yet active)</option>
                <option value="Active">Active</option>
                <option value="Graduating">Graduating</option>
                <option value="Graduated">Graduated</option>
                <option value="Alumni">Alumni</option>
              </select>
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={studentForm.cohortId || ''}
                onChange={(event) => setStudentForm((prev) => ({ ...prev, cohortId: event.target.value }))}
              >
                <option value="">Assign to batch (optional)</option>
                {cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.name} ({cohort.status})
                  </option>
                ))}
              </select>
              <button className="w-full bg-slate-900 text-white rounded-lg py-2">Create Student</button>
            </form>

            <form onSubmit={createStudentBatch} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="font-semibold text-slate-900">Create Student Batch</h3>
              <input
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Batch name (e.g. February 2026)"
                value={cohortForm.name}
                onChange={(event) => setCohortForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-slate-600 block">
                  Start Date
                  <input
                    type="date"
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                    value={cohortForm.startDate}
                    onChange={(event) => setCohortForm((prev) => ({ ...prev, startDate: event.target.value }))}
                    required
                  />
                </label>
                <label className="text-sm text-slate-600 block">
                  End Date
                  <input
                    type="date"
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                    value={cohortForm.endDate}
                    onChange={(event) => setCohortForm((prev) => ({ ...prev, endDate: event.target.value }))}
                    required
                  />
                </label>
              </div>
              <button className="w-full bg-slate-900 text-white rounded-lg py-2">Create Batch</button>
            </form>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Upload Students (Excel/CSV)</h3>
                <button
                  type="button"
                  onClick={() => downloadTemplate('students')}
                  className="text-xs text-slate-500 underline"
                >
                  Download Template
                </button>
              </div>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => setStudentUploadFile(event.target.files?.[0] || null)} className="w-full border rounded-lg px-3 py-2" />
              <button onClick={uploadStudents} disabled={!studentUploadFile} className="w-full bg-slate-900 text-white rounded-lg py-2 disabled:opacity-50 flex items-center justify-center gap-2">
                <Upload size={16} /> Upload List
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="font-semibold text-slate-900">Student Batches</h3>
              <div className="max-h-72 overflow-auto space-y-2">
                {cohorts.map((cohort) => (
                  <div key={cohort.id} className="rounded-lg border border-slate-200 p-3">
                    {editingCohortId === cohort.id ? (
                      <div className="space-y-2">
                        <input
                          className="w-full border rounded-lg px-2 py-1 text-sm"
                          value={cohortEditForm.name}
                          onChange={(event) => setCohortEditForm((prev) => ({ ...prev, name: event.target.value }))}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            className="w-full border rounded-lg px-2 py-1 text-sm"
                            value={cohortEditForm.startDate || ''}
                            onChange={(event) => setCohortEditForm((prev) => ({ ...prev, startDate: event.target.value }))}
                          />
                          <input
                            type="date"
                            className="w-full border rounded-lg px-2 py-1 text-sm"
                            value={cohortEditForm.endDate || ''}
                            onChange={(event) => setCohortEditForm((prev) => ({ ...prev, endDate: event.target.value }))}
                          />
                        </div>
                        <select
                          className="w-full border rounded-lg px-2 py-1 text-sm"
                          value={cohortEditForm.status}
                          onChange={(event) => setCohortEditForm((prev) => ({ ...prev, status: event.target.value }))}
                        >
                          <option value="upcoming">upcoming</option>
                          <option value="active">active</option>
                          <option value="completed">completed</option>
                        </select>
                        <div className="flex gap-2">
                          <button type="button" className="rounded-lg bg-slate-900 text-white px-2 py-1 text-xs" onClick={() => saveCohortEdit(cohort.id)}>Save</button>
                          <button type="button" className="rounded-lg bg-slate-200 px-2 py-1 text-xs" onClick={() => setEditingCohortId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{cohort.name}</p>
                          <p className="text-xs text-slate-500">{fmtDateRange(cohort.start_date, cohort.end_date)} • {cohort.status} • {cohort.student_count || 0} student(s)</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button type="button" className="rounded-lg bg-slate-100 px-2 py-1 text-xs" onClick={() => startEditCohort(cohort)}>Edit</button>
                          <button type="button" className="rounded-lg bg-rose-100 text-rose-700 px-2 py-1 text-xs" onClick={() => deleteCohortSafely(cohort)}>Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {!cohorts.length ? <p className="text-sm text-slate-500">No student batches created yet.</p> : null}
              </div>
            </div>

          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h3 className="font-semibold text-slate-900">Student Directory</h3>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="border rounded-lg px-3 py-2 text-sm"
                  value={studentCohortFilter}
                  onChange={(event) => setStudentCohortFilter(event.target.value)}
                >
                  <option value="">All Batches</option>
                  {cohorts.map((cohort) => (
                    <option key={cohort.id} value={String(cohort.id)}>
                      {cohort.name}
                    </option>
                  ))}
                </select>
                <select
                  className="border rounded-lg px-3 py-2 text-sm"
                  value={studentStatusFilter}
                  onChange={(event) => setStudentStatusFilter(event.target.value)}
                >
                  <option value="current">Current students</option>
                  <option value="all">All students</option>
                  <option value="Active">Active</option>
                  <option value="Prospective">Prospective</option>
                  <option value="Graduating">Graduating</option>
                  <option value="Graduated">Graduated</option>
                  <option value="Alumni">Alumni</option>
                </select>
                <button
                  type="button"
                  onClick={exportStudentList}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white cursor-pointer"
                >
                  <Download size={14} /> Export
                </button>
                <button
                  type="button"
                  onClick={() => setShowBatchDrawer(true)}
                  className="rounded-lg bg-slate-200 px-3 py-2 text-sm text-slate-700 cursor-pointer"
                >
                  Manage Batches
                </button>
              </div>
            </div>
            <DataTable
              data={filteredStudents}
              rowKey="id"
              initialPageSize={25}
              emptyMessage="No students match these filters."
              emptyIcon={<Users size={32} />}
              globalSearchPlaceholder="Search name, email, matric, phone…"
              defaultSort={{ id: 'full_name', dir: 'asc' }}
              columns={[
                {
                  id: 'avatar',
                  header: '',
                  filterable: false,
                  sortable: false,
                  width: '52px',
                  cell: (student) => (
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                      {student.profile_image_url ? (
                        <img src={student.profile_image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-slate-500">{(student.full_name || '?')[0].toUpperCase()}</span>
                      )}
                    </div>
                  ),
                },
                {
                  id: 'full_name',
                  header: 'Name',
                  accessor: 'full_name',
                  cell: (student) => (
                    <Link to={`/lecturer/students/${student.id}`} className="font-medium text-slate-900 hover:underline">
                      {student.full_name}
                    </Link>
                  ),
                },
                {
                  id: 'matric_no',
                  header: 'Matric',
                  accessor: 'matric_no',
                  cell: (s) => s.matric_no || <span className="text-slate-400 text-xs italic">pending</span>,
                },
                { id: 'phone', header: 'Phone', accessor: 'phone' },
                { id: 'email', header: 'Email', accessor: 'email' },
                {
                  id: 'status',
                  header: 'Status',
                  accessor: 'status',
                  filterType: 'select',
                  filterOptions: ['Active', 'Prospective', 'Graduating', 'Graduated', 'Alumni', 'On Hold', 'Suspended'],
                  cell: (student) => (
                    <button
                      type="button"
                      className={`rounded-full px-2.5 py-1 text-xs font-medium cursor-pointer transition-all hover:ring-2 hover:ring-gold-300 ${STATUS_COLORS[student.status] || 'bg-slate-100 text-slate-700'}`}
                      onClick={() => {
                        setQuickStatusStudent(student)
                        setQuickSelectedStatus(null)
                        setQuickStatusReason('')
                        apiClient.get(`/students/${student.id}/next-statuses`).then((r) => setQuickStatusOptions(r.data.nextStatuses || [])).catch(() => setQuickStatusOptions([]))
                        setShowQuickStatus(true)
                      }}
                    >
                      {student.status}
                    </button>
                  ),
                },
                {
                  id: 'cohort_name',
                  header: 'Batch',
                  accessor: 'cohort_name',
                  filterType: 'select',
                  filterOptions: cohorts.map((c) => c.name).filter(Boolean),
                },
                {
                  id: 'actions',
                  header: 'Actions',
                  filterable: false,
                  sortable: false,
                  align: 'right',
                  cell: (student) => (
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => openStudentPanel(student)} className="rounded-lg px-3 py-1.5 bg-slate-100 text-slate-700 text-xs hover:bg-slate-200 cursor-pointer">View</button>
                      <button
                        type="button"
                        className="rounded-lg px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 text-xs hover:bg-red-100 cursor-pointer"
                        onClick={async () => {
                          if (!window.confirm(`Delete ${student.full_name}? This cannot be undone.`)) return
                          try {
                            await apiClient.delete(`/students/${student.id}`)
                            setAllStudents((prev) => prev.filter((s) => s.id !== student.id))
                          } catch (err) {
                            alert(err?.response?.data?.message || 'Delete failed')
                          }
                        }}
                      >Delete</button>
                    </div>
                  ),
                },
              ]}
            />
          </div>

          {selectedStudent && studentEditForm ? (
            <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-slate-200 shadow-2xl z-50 overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Student Profile</h3>
                <button type="button" onClick={closeStudentPanel} className="rounded-lg p-1 hover:bg-slate-100">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={saveStudentEdit} className="p-4 space-y-3">
                {/* Profile Image */}
                <div className="flex items-center gap-4 mb-4">
                  <div
                    className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => studentEditForm.profile_image_url && setLightboxOpen(true)}
                  >
                    {studentEditForm.profile_image_url ? (
                      <img src={studentEditForm.profile_image_url} alt={studentEditForm.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl font-bold text-slate-500">{(studentEditForm.full_name || '?')[0].toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="text-sm text-slate-600 block">
                      Profile Image
                      <input
                        type="file"
                        accept="image/*"
                        className="mt-1 w-full text-sm"
                        onChange={(e) => setProfileImageFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    {profileImageFile && (
                      <button
                        type="button"
                        onClick={uploadProfileImage}
                        disabled={profileImageUploading}
                        className="mt-1 text-xs bg-slate-900 text-white rounded-lg px-3 py-1 disabled:opacity-50"
                      >
                        {profileImageUploading ? 'Uploading...' : 'Upload'}
                      </button>
                    )}
                  </div>
                </div>

                <input className="w-full border rounded-lg px-3 py-2" value={studentEditForm.full_name || ''} onChange={(event) => setStudentEditForm((prev) => ({ ...prev, full_name: event.target.value }))} required />
                <input className="w-full border rounded-lg px-3 py-2" value={studentEditForm.email || ''} onChange={(event) => setStudentEditForm((prev) => ({ ...prev, email: event.target.value }))} required />
                <input className="w-full border rounded-lg px-3 py-2" value={studentEditForm.phone || ''} onChange={(event) => setStudentEditForm((prev) => ({ ...prev, phone: event.target.value }))} required />
                <input className="w-full border rounded-lg px-3 py-2" value={studentEditForm.matric_no || ''} onChange={(event) => setStudentEditForm((prev) => ({ ...prev, matric_no: event.target.value }))} />
                <textarea className="w-full border rounded-lg px-3 py-2" placeholder="Comments" rows={3} value={studentEditForm.comments || ''} onChange={(event) => setStudentEditForm((prev) => ({ ...prev, comments: event.target.value }))} />

                {/* Status Pipeline */}
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Student Status</p>
                  <div className="relative mb-2">
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium cursor-pointer transition-all hover:ring-2 hover:ring-slate-300 ${
                        STATUS_COLORS[studentEditForm.status] || 'bg-slate-100 text-slate-700'
                      }`}
                      onClick={() => setPanelStatusOpen((open) => !open)}
                    >
                      {studentEditForm.status} <span className="text-[10px] ml-0.5 opacity-50">▼</span>
                    </button>
                    <div className={`absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 min-w-[180px] transition-all py-1 max-h-64 overflow-y-auto ${
                        panelStatusOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
                      }`}>
                      {ALL_STATUSES.map((s) => {
                        const isCurrent = studentEditForm.status === s
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
                                setPanelStatusOpen(false)
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

                  {/* Status History inline */}
                  {statusHistory.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs text-slate-500 mb-1">Status History</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {statusHistory.slice(0, 5).map((h) => (
                          <div key={h.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-2.5 py-1.5">
                            <div>
                              <span className="text-slate-500">{h.from_status}</span>
                              <span className="mx-1 text-slate-300">→</span>
                              <span className="font-medium text-slate-800">{h.to_status}</span>
                              {h.reason && <span className="ml-1.5 text-slate-400 italic">({h.reason})</span>}
                            </div>
                            <span className="text-slate-400 shrink-0 ml-2">{new Date(h.changed_at).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <label className="text-sm text-slate-600 block">
                  Batch
                  <select
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                    value={studentEditForm.cohort_id || ''}
                    onChange={(event) => setStudentEditForm((prev) => ({ ...prev, cohort_id: event.target.value ? Number(event.target.value) : null }))}
                  >
                    <option value="">No batch</option>
                    {cohorts.map((cohort) => (
                      <option key={cohort.id} value={cohort.id}>
                        {cohort.name} ({cohort.status})
                      </option>
                    ))}
                  </select>
                </label>

                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Additional Statuses</p>
                  <div className="space-y-2">
                    {(studentEditForm.statuses || []).map((statusItem) => (
                      <div key={statusItem.id} className="flex items-center justify-between bg-slate-100 rounded-lg px-3 py-2 text-sm">
                        <span>{statusItem.statusName}</span>
                        <button type="button" onClick={() => removeStudentStatus(statusItem.id)} className="text-red-600">Remove</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <input className="flex-1 border rounded-lg px-3 py-2" placeholder="Add status" value={newStatusInput} onChange={(event) => setNewStatusInput(event.target.value)} />
                  <button type="button" onClick={addStudentStatus} className="bg-slate-900 text-white rounded-lg px-3 py-2">Add</button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button className="bg-slate-900 text-white rounded-lg py-2">Save</button>
                  <button type="button" className="bg-slate-200 rounded-lg py-2" onClick={closeStudentPanel}>Cancel</button>
                </div>

              {/* Lightbox */}
              {lightboxOpen && studentEditForm.profile_image_url && (
                <div
                  className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
                  onClick={() => setLightboxOpen(false)}
                >
                  <div className="relative max-w-xl w-full" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(false)}
                      className="absolute -top-3 -right-3 bg-white rounded-full p-1 shadow-lg z-10 hover:bg-slate-100"
                    >
                      <X size={20} />
                    </button>
                    <img
                      src={studentEditForm.profile_image_url}
                      alt={studentEditForm.full_name}
                      className="w-full h-auto rounded-2xl shadow-2xl"
                    />
                  </div>
                </div>
              )}

              {/* Status Confirm Modal */}
              {statusConfirmOpen && (
                <div
                  className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
                  onClick={() => setStatusConfirmOpen(false)}
                >
                  <div
                    className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 className="font-semibold text-slate-900 mb-2">Change Status</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      Move <strong>{selectedStudent?.full_name}</strong> from{' '}
                      <strong>{studentEditForm.status}</strong> → <strong>{pendingStatus}</strong>
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
                          if (!selectedStudent) return
                          setStatusSaving(true)
                          try {
                            await apiClient.patch(`/students/${selectedStudent.id}/lifecycle-status`, {
                              status: pendingStatus,
                              reason: statusTransitionReason,
                            })
                            setStudentEditForm((prev) => ({ ...prev, status: pendingStatus }))
                            // Refresh history
                            const hRes = await apiClient.get(`/students/${selectedStudent.id}/status-history`)
                            setStatusHistory(hRes.data || [])
                            const nRes = await apiClient.get(`/students/${selectedStudent.id}/next-statuses`)
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

                <div className="pt-3 border-t border-red-100">
                  <button
                    type="button"
                    className="w-full bg-red-50 text-red-600 border border-red-200 rounded-lg py-2 text-sm font-medium hover:bg-red-100"
                    onClick={async () => {
                      if (!window.confirm(`Delete ${selectedStudent.full_name}? This cannot be undone.`)) return
                      await apiClient.delete(`/students/${selectedStudent.id}`)
                      setAllStudents((prev) => prev.filter((s) => s.id !== selectedStudent.id))
                      closeStudentPanel()
                    }}
                  >
                    Delete Student
                  </button>
                </div>

                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <h4 className="font-semibold text-slate-900">Course History & Notes</h4>
                  {studentGraduationProgress ? (
                    <div className="rounded-lg border border-slate-200 p-3 bg-slate-50 text-sm text-slate-700 space-y-1">
                      <p>
                        Completed: <span className="font-semibold">{studentGraduationProgress.passed.length}</span> / {studentGraduationProgress.total}
                      </p>
                      <p>
                        Remaining: <span className="font-semibold">{studentGraduationProgress.notStarted.length + studentGraduationProgress.active.length + studentGraduationProgress.failed.length}</span>
                      </p>
                      <p>
                        Failed: <span className="font-semibold text-red-600">{studentGraduationProgress.failed.length}</span>
                      </p>
                      {studentGraduationProgress.notStarted.length ? (
                        <p className="text-xs text-slate-500">
                          Not started: {studentGraduationProgress.notStarted.map((course) => course.course_code || course.title).join(', ')}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {loadingStudentHistory ? <p className="text-sm text-slate-500">Loading history...</p> : null}
                  {studentHistory.enrollments.map((enrollment) => (
                    <div key={enrollment.id} className="border rounded-lg p-3 space-y-2">
                      <p className="text-sm font-medium text-slate-900">{enrollment.course_title} ({enrollment.course_code || '-'})</p>
                      <p className="text-xs text-slate-500">Batch #{enrollment.batch_id} • {enrollment.start_date} - {enrollment.end_date} • {enrollment.status}</p>
                      <p className="text-xs text-slate-500">Result: {enrollment.result_status || '-'} {enrollment.score !== null && enrollment.score !== undefined ? `(${enrollment.score})` : ''}</p>
                      <textarea
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        rows={2}
                        placeholder="Enrollment notes"
                        value={enrollmentNotesEdits[enrollment.id] || ''}
                        onChange={(event) => setEnrollmentNotesEdits((prev) => ({ ...prev, [enrollment.id]: event.target.value }))}
                      />
                      <button type="button" className="bg-slate-900 text-white rounded-lg px-3 py-2 text-sm" onClick={() => saveEnrollmentNote(enrollment.id)}>Save Note</button>
                    </div>
                  ))}

                  <h4 className="font-semibold text-slate-900 pt-2">Activity Log</h4>
                  <div className="max-h-40 overflow-auto space-y-2">
                    {studentHistory.activities.map((activity, index) => (
                      <div key={`${activity.action}-${activity.created_at}-${index}`} className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
                        <p className="font-medium">{activity.action}</p>
                        <p>{new Date(activity.created_at).toLocaleString()}</p>
                      </div>
                    ))}
                    {!studentHistory.activities.length ? <p className="text-sm text-slate-500">No activity yet.</p> : null}
                  </div>

                  {/* Unified Timeline */}
                  {studentTimeline.length > 0 ? (
                    <div className="pt-3 border-t border-slate-200">
                      <h4 className="font-semibold text-slate-900 mb-3">Timeline</h4>
                      <div className="space-y-2 max-h-60 overflow-auto">
                        {studentTimeline.slice(0, 30).map((event) => (
                          <div key={event.id} className="flex items-start gap-2.5 rounded-lg bg-slate-50 px-3 py-2">
                            <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-slate-400" />
                            <div className="min-w-0 flex-1">
                              {event.type === 'status_transition' ? (
                                <p className="text-xs text-slate-700">
                                  Status: <span className="text-slate-500">{event.from_status}</span> →{' '}
                                  <span className="font-medium text-slate-800">{event.to_status}</span>
                                  {event.reason ? <span className="text-slate-400 italic"> ({event.reason})</span> : null}
                                </p>
                              ) : event.type === 'enrollment' ? (
                                <p className="text-xs text-slate-700">
                                  {event.auto_enrolled ? 'Auto-enrolled' : 'Enrolled'} in{' '}
                                  <span className="font-medium text-slate-800">{event.course_title}</span>
                                  {event.course_code ? <span className="text-slate-400"> ({event.course_code})</span> : null}
                                  {event.result_status ? (
                                    <span className={`ml-1 font-medium ${event.result_status === 'Pass' ? 'text-emerald-600' : 'text-red-600'}`}>
                                      · {event.result_status}
                                    </span>
                                  ) : null}
                                </p>
                              ) : (
                                <p className="text-xs text-slate-700">
                                  <span className="font-medium">{event.action?.replace(/_/g, ' ')}</span>
                                </p>
                              )}
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {new Date(event.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                {event.actor ? <span> · by {event.actor}</span> : null}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </form>
            </div>
          ) : null}

          {showBatchDrawer ? (
            <div className="fixed inset-0 z-40">
              <div className="absolute inset-0 bg-slate-900/20" onClick={() => setShowBatchDrawer(false)} />
              <div className="absolute right-0 top-0 h-full w-120 max-w-full bg-white border-l border-slate-200 shadow-2xl overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Manage Student Batches</h3>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={persistCohortOrder} className="rounded-lg bg-slate-900 text-white px-3 py-2 text-xs">Save Order</button>
                    <button type="button" onClick={() => setShowBatchDrawer(false)} className="rounded-lg p-1 hover:bg-slate-100">
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {cohorts.map((cohort) => (
                    <div
                      key={cohort.id}
                      draggable
                      onDragStart={() => setDraggingCohortId(cohort.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        moveCohortLocally(draggingCohortId, cohort.id)
                        setDraggingCohortId(null)
                      }}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      {editingCohortId === cohort.id ? (
                        <div className="space-y-2">
                          <input
                            className="w-full border rounded-lg px-2 py-1 text-sm"
                            value={cohortEditForm.name}
                            onChange={(event) => setCohortEditForm((prev) => ({ ...prev, name: event.target.value }))}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="date"
                              className="w-full border rounded-lg px-2 py-1 text-sm"
                              value={cohortEditForm.startDate || ''}
                              onChange={(event) => setCohortEditForm((prev) => ({ ...prev, startDate: event.target.value }))}
                            />
                            <input
                              type="date"
                              className="w-full border rounded-lg px-2 py-1 text-sm"
                              value={cohortEditForm.endDate || ''}
                              onChange={(event) => setCohortEditForm((prev) => ({ ...prev, endDate: event.target.value }))}
                            />
                          </div>
                          <select
                            className="w-full border rounded-lg px-2 py-1 text-sm"
                            value={cohortEditForm.status}
                            onChange={(event) => setCohortEditForm((prev) => ({ ...prev, status: event.target.value }))}
                          >
                            <option value="upcoming">upcoming</option>
                            <option value="active">active</option>
                            <option value="completed">completed</option>
                          </select>
                          <div className="flex gap-2">
                            <button type="button" className="rounded-lg bg-slate-900 text-white px-2 py-1 text-xs" onClick={() => saveCohortEdit(cohort.id)}>Save</button>
                            <button type="button" className="rounded-lg bg-slate-200 px-2 py-1 text-xs" onClick={() => setEditingCohortId(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-slate-900">{cohort.name}</p>
                            <p className="text-xs text-slate-500">{fmtDateRange(cohort.start_date, cohort.end_date)}</p>
                            <p className="text-xs text-slate-500">Status: {cohort.status} • Students: {cohort.student_count || 0}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">Drag</span>
                            <button type="button" className="rounded-lg bg-slate-100 px-2 py-1 text-xs" onClick={() => startEditCohort(cohort)}>Edit</button>
                            <button type="button" className="rounded-lg bg-rose-100 text-rose-700 px-2 py-1 text-xs" onClick={() => deleteCohortSafely(cohort)}>Delete</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {!cohorts.length ? <p className="text-sm text-slate-500">No batches found.</p> : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
        )}
      </div>
      ) : null}

      {section === 'batches' ? (
        <div className="grid lg:grid-cols-[390px_1fr] gap-6 flex-1 min-h-0 overflow-auto">
          <form onSubmit={createStudentBatch} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-slate-900">Create Student Batch</h3>
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Batch name (e.g. February 2026)"
              value={cohortForm.name}
              onChange={(event) => setCohortForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-slate-600 block">
                Start Date
                <input
                  type="date"
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={cohortForm.startDate}
                  onChange={(event) => setCohortForm((prev) => ({ ...prev, startDate: event.target.value }))}
                  required
                />
              </label>
              <label className="text-sm text-slate-600 block">
                End Date
                <input
                  type="date"
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={cohortForm.endDate}
                  onChange={(event) => setCohortForm((prev) => ({ ...prev, endDate: event.target.value }))}
                  required
                />
              </label>
            </div>
            <button className="w-full bg-slate-900 text-white rounded-lg py-2">Create Batch</button>
          </form>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
            {/* Header + controls */}
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h3 className="font-semibold text-slate-900">Student Batches</h3>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Status filter toggle */}
                <div className="flex gap-0.5 bg-slate-100 rounded-xl p-1">
                  {[
                    { key: 'active', label: 'Active' },
                    { key: 'upcoming', label: 'Upcoming' },
                    { key: 'completed', label: 'Completed' },
                    { key: 'all', label: 'All' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setBatchViewFilter(key)}
                      className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                        batchViewFilter === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={persistCohortOrder} className="rounded-lg bg-slate-900 text-white px-3 py-1.5 text-xs">
                  Save Order
                </button>
              </div>
            </div>

            {/* Filtered cohort cards */}
            {(() => {
              const COHORT_STATUS_STYLES = {
                active: 'bg-emerald-100 text-emerald-700',
                upcoming: 'bg-sky-100 text-sky-700',
                completed: 'bg-slate-100 text-slate-500',
              }
              const matrixStudentById = Object.fromEntries(
                (graduationMatrix.students || []).map((s) => [s.id, s])
              )
              const filtered = batchViewFilter === 'all'
                ? cohorts
                : cohorts.filter((c) => c.status === batchViewFilter)

              if (!filtered.length) {
                return (
                  <p className="text-sm text-slate-400 py-4 text-center">
                    No {batchViewFilter === 'all' ? '' : batchViewFilter + ' '}batches found.
                  </p>
                )
              }

              return (
                <div className="space-y-3">
                  {filtered.map((cohort) => {
                    const cohortStudents = allStudents.filter((s) => s.cohort_id === cohort.id)
                    const isExpanded = expandedCohortIds.has(cohort.id)
                    const isInactive = cohort.status !== 'active'
                    const retakeCount = cohortStudents.filter((s) => (matrixStudentById[s.id]?.failed || 0) > 0).length

                    return (
                      <div
                        key={cohort.id}
                        draggable
                        onDragStart={() => setDraggingCohortId(cohort.id)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          moveCohortLocally(draggingCohortId, cohort.id)
                          setDraggingCohortId(null)
                        }}
                        className={`rounded-xl border p-4 bg-white transition-colors ${
                          isInactive ? 'border-slate-200' : 'border-emerald-200'
                        }`}
                      >
                        {editingCohortId === cohort.id ? (
                          <div className="space-y-2">
                            <input
                              className="w-full border rounded-lg px-2 py-1 text-sm"
                              value={cohortEditForm.name}
                              onChange={(event) => setCohortEditForm((prev) => ({ ...prev, name: event.target.value }))}
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="date"
                                className="w-full border rounded-lg px-2 py-1 text-sm"
                                value={cohortEditForm.startDate || ''}
                                onChange={(event) => setCohortEditForm((prev) => ({ ...prev, startDate: event.target.value }))}
                              />
                              <input
                                type="date"
                                className="w-full border rounded-lg px-2 py-1 text-sm"
                                value={cohortEditForm.endDate || ''}
                                onChange={(event) => setCohortEditForm((prev) => ({ ...prev, endDate: event.target.value }))}
                              />
                            </div>
                            <select
                              className="w-full border rounded-lg px-2 py-1 text-sm"
                              value={cohortEditForm.status}
                              onChange={(event) => setCohortEditForm((prev) => ({ ...prev, status: event.target.value }))}
                            >
                              <option value="upcoming">upcoming</option>
                              <option value="active">active</option>
                              <option value="completed">completed</option>
                            </select>
                            <div className="flex gap-2">
                              <button type="button" className="rounded-lg bg-slate-900 text-white px-2 py-1 text-xs" onClick={() => saveCohortEdit(cohort.id)}>Save</button>
                              <button type="button" className="rounded-lg bg-slate-200 px-2 py-1 text-xs" onClick={() => setEditingCohortId(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Cohort header row */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-semibold text-slate-900">{cohort.name}</p>
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COHORT_STATUS_STYLES[cohort.status] || 'bg-slate-100 text-slate-500'}`}>
                                    {cohort.status}
                                  </span>
                                  {retakeCount > 0 ? (
                                    <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium">
                                      {retakeCount} need retake
                                    </span>
                                  ) : null}
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {fmtDateRange(cohort.start_date, cohort.end_date)} · {cohortStudents.length} student{cohortStudents.length !== 1 ? 's' : ''}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  className="rounded-lg bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200"
                                  onClick={() =>
                                    setExpandedCohortIds((prev) => {
                                      const next = new Set(prev)
                                      next.has(cohort.id) ? next.delete(cohort.id) : next.add(cohort.id)
                                      return next
                                    })
                                  }
                                >
                                  {isExpanded ? 'Hide' : `Students ${cohortStudents.length > 0 ? `(${cohortStudents.length})` : ''}`}
                                </button>
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-400">⠿</span>
                                <button type="button" className="rounded-lg bg-slate-100 px-2 py-1 text-xs" onClick={() => startEditCohort(cohort)}>Edit</button>
                                <button type="button" className="rounded-lg bg-rose-100 text-rose-700 px-2 py-1 text-xs" onClick={() => deleteCohortSafely(cohort)}>Delete</button>
                              </div>
                            </div>

                            {/* Student list (expandable) */}
                            {isExpanded ? (
                              <div className="mt-3 border-t border-slate-100 pt-3 space-y-1">
                                {cohortStudents.length === 0 ? (
                                  <p className="text-xs text-slate-400">No students assigned to this batch yet.</p>
                                ) : cohortStudents.map((student) => {
                                  const mx = matrixStudentById[student.id]
                                  const needsRetake = (mx?.failed || 0) > 0
                                  const inProgress = (mx?.enrolled_active || 0) > 0
                                  const pct = mx?.completion_pct ?? 0
                                  return (
                                    <div key={student.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-slate-50">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <Link
                                          to={`/lecturer/students/${student.id}`}
                                          className="text-sm font-medium text-slate-900 hover:underline truncate"
                                        >
                                          {student.full_name}
                                        </Link>
                                        <span className="text-xs text-slate-400 shrink-0">{student.matric_no}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                                        {/* Completion */}
                                        <span className="text-xs text-slate-500">{pct}%</span>
                                        {/* Status tags */}
                                        {needsRetake ? (
                                          <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium">
                                            Retake needed ({mx.failed})
                                          </span>
                                        ) : null}
                                        {inProgress && !needsRetake ? (
                                          <span className="rounded-full bg-sky-100 text-sky-700 px-2 py-0.5 text-xs">
                                            In progress
                                          </span>
                                        ) : null}
                                        {!mx || (pct === 0 && !inProgress && !needsRetake) ? (
                                          <span className="rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-xs">Not started</span>
                                        ) : pct === 100 ? (
                                          <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">✓ Complete</span>
                                        ) : null}
                                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                                          student.status === 'Active' ? 'bg-emerald-50 text-emerald-600' :
                                          student.status === 'Graduating' ? 'bg-gold-100 text-gold-600' :
                                          'bg-slate-100 text-slate-500'
                                        }`}>
                                          {student.status}
                                        </span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
      ) : null}

      {/* Quick Status Change Modal */}
      {showQuickStatus && quickStatusStudent ? (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowQuickStatus(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-slate-900 mb-1">Change Status</h3>
            <p className="text-sm text-slate-500 mb-4">
              <strong>{quickStatusStudent.full_name}</strong> ({quickStatusStudent.status})
            </p>

            {!quickSelectedStatus ? (
              <>
                <p className="text-xs font-medium text-slate-600 mb-2">Select new status:</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {quickStatusOptions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors hover:ring-2 hover:ring-slate-400 ${STATUS_COLORS[s] || 'bg-slate-100 text-slate-700'}`}
                      onClick={() => setQuickSelectedStatus(s)}
                    >
                      {s}
                    </button>
                  ))}
                  {quickStatusOptions.length === 0 && (
                    <p className="text-xs text-slate-400">No valid next statuses available.</p>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200"
                    onClick={() => setShowQuickStatus(false)}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-600 mb-4">
                  Move from <strong>{quickStatusStudent.status}</strong> →{' '}
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[quickSelectedStatus] || 'bg-slate-100 text-slate-700'}`}>{quickSelectedStatus}</span>
                </p>
                <label className="text-sm text-slate-600 block mb-4">
                  Reason for change
                  <input
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="e.g. Completed orientation"
                    value={quickStatusReason}
                    onChange={(e) => setQuickStatusReason(e.target.value)}
                    autoFocus
                  />
                </label>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200"
                    onClick={() => setQuickSelectedStatus(null)}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={quickStatusSaving}
                    className="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white disabled:opacity-50"
                    onClick={async () => {
                      setQuickStatusSaving(true)
                      try {
                        await apiClient.patch(`/students/${quickStatusStudent.id}/lifecycle-status`, {
                          status: quickSelectedStatus,
                          reason: quickStatusReason || null,
                        })
                        await Promise.all([loadAllStudents(), loadGraduationMatrix()])
                        setShowQuickStatus(false)
                        notify(`Status changed to ${quickSelectedStatus}`)
                      } catch (err) {
                        notify(err?.response?.data?.message || 'Failed to update status')
                      } finally {
                        setQuickStatusSaving(false)
                      }
                    }}
                  >
                    {quickStatusSaving ? 'Saving…' : 'Confirm'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {gradVetting ? (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setGradVetting(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="font-semibold text-slate-900">Graduation Vetting</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Confirm that <strong>{gradVetting.student.full_name}</strong> ({gradVetting.student.matric_no}) passed every course before moving to{' '}
                  <span className="font-semibold text-slate-700">{gradVetting.targetStatus}</span>.
                </p>
              </div>
              <button type="button" onClick={() => setGradVetting(null)} className="rounded-lg p-1 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 mt-4">
              <div className="px-4 py-2 grid grid-cols-[1fr_auto_auto] gap-3 items-center text-xs font-semibold text-slate-500">
                <span>Course</span>
                <span>Status</span>
                <span>Passed?</span>
              </div>
              {graduationMatrix.courses.map((course) => {
                const info = gradVetting.student.courses?.[course.id]
                const isPass = info?.result_status === 'Pass'
                const isFail = info?.result_status === 'Fail'
                return (
                  <div key={course.id} className="px-4 py-3 grid grid-cols-[1fr_auto_auto] gap-3 items-center">
                    <span className="text-sm text-slate-900">{course.title}</span>
                    <span className="text-xs font-medium">
                      {isPass ? (
                        <span className="rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-1">Pass</span>
                      ) : isFail ? (
                        <span className="rounded-full bg-red-100 text-red-700 px-2.5 py-1">Fail</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 text-slate-600 px-2.5 py-1">No result</span>
                      )}
                    </span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded"
                        checked={Boolean(gradVettingConfirm[course.id])}
                        onChange={(e) => setGradVettingConfirm((prev) => ({ ...prev, [course.id]: e.target.checked }))}
                      />
                      <span className="text-xs font-medium text-slate-700">Yes</span>
                    </label>
                  </div>
                )
              })}
            </div>

            {!vettingAllConfirmed ? (
              <p className="text-xs text-amber-600 mt-3">
                Confirm each course below by ticking the “Passed?” box. All courses must be confirmed.
              </p>
            ) : null}

            <label className="text-sm text-slate-600 block mt-4">
              Reason
              <input
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Completed all courses for 2026 plan"
                value={gradVettingReason}
                onChange={(e) => setGradVettingReason(e.target.value)}
              />
            </label>

            <div className="flex gap-2 justify-end mt-4">
              <button
                type="button"
                className="px-4 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200"
                onClick={() => setGradVetting(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!vettingAllConfirmed || gradVettingSaving}
                onClick={confirmGradVetting}
                className="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white disabled:opacity-40"
              >
                {gradVettingSaving ? 'Saving…' : `Move to ${gradVetting.targetStatus}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {section === 'attendance' ? (
        <div className="grid xl:grid-cols-[390px_1fr] gap-6 flex-1 min-h-0 overflow-auto">
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h3 className="font-semibold text-slate-900">Attendance Session</h3>
                <p className="text-sm text-slate-500 mt-1">Mark students present. Unmarked students are treated as absent.</p>
              </div>
              <label className="text-sm text-slate-600 block">
                Select Class
                <select
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
                  value={selectedClassNumber}
                  onChange={(event) => setSelectedClassNumber(event.target.value)}
                >
                  {classOptions.map((classNo) => (
                    <option key={classNo} value={classNo}>{`Class ${classNo}`}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-600 block">
                Session Date
                <input type="date" className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" value={attendanceForm.date} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, date: event.target.value }))} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-slate-600 block">
                  Start Time
                  <input type="time" className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" value={attendanceForm.startTime} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, startTime: event.target.value }))} />
                </label>
                <label className="text-sm text-slate-600 block">
                  End Time
                  <input type="time" className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" value={attendanceForm.endTime} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, endTime: event.target.value }))} />
                </label>
              </div>
              <label className="text-sm text-slate-600 block">
                Secondary Lecturer
                <select className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2" value={attendanceForm.secondaryLecturerId || ''} onChange={(event) => setAttendanceForm((prev) => ({ ...prev, secondaryLecturerId: event.target.value || '' }))}>
                  <option value="">— No secondary lecturer —</option>
                  {lecturers.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-600 block">
                Session Notes
                <textarea
                  className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2"
                  rows={2}
                  value={attendanceForm.lecturerNotes || ''}
                  onChange={(event) => setAttendanceForm((prev) => ({ ...prev, lecturerNotes: event.target.value }))}
                  placeholder="Optional notes for this session"
                />
              </label>
              <button onClick={startAttendance} disabled={!selectedCourseId || Boolean(attendanceStatus.classCompleted) || Boolean(attendanceStatus.activeSession)} className="w-full bg-slate-900 text-white rounded-lg px-4 py-2 disabled:opacity-50">Start Attendance</button>
              <button onClick={closeAttendance} disabled={!attendanceStatus.activeSession} className="w-full bg-slate-200 text-slate-800 rounded-lg px-4 py-2 disabled:opacity-50">Close Attendance</button>
              <div className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                <p>Class: {selectedClassNumber}</p>
                <p>Completed: {attendanceStatus.classCompleted ? 'Yes' : 'No'}</p>
                <p>Active: {attendanceStatus.activeSession ? 'Yes' : 'No'}</p>
                <p>Ends: {attendanceStatus.activeSession?.end_time ? new Date(attendanceStatus.activeSession.end_time).toLocaleString() : '-'}</p>
                <p>Present: {attendanceStatus.attendeeCount || 0}</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-900">Session History</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600 max-h-56 overflow-auto">
                {attendanceHistory.map((session) => (
                  <li key={session.id} className="rounded-lg bg-slate-50 px-3 py-2 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-slate-800">Class {session.class_number}</div>
                      <div className="text-xs text-slate-500">{new Date(session.start_time).toLocaleString()}</div>
                      <div className="text-xs text-slate-500">{session.attendees} present</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEditSession(session)}
                      className="shrink-0 rounded-lg px-3 py-1.5 bg-slate-200 text-slate-700 text-xs hover:bg-slate-300"
                    >
                      Edit
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-6">
            {attendanceStatus.canMark ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
                <h3 className="font-semibold text-slate-900 mb-4">Roll Call (Editable)</h3>
                <table className="data-table w-full text-sm">
                  <thead className="text-left text-slate-500">
                    <tr><th className="pb-2">Name</th><th>Matric</th><th>Status</th><th>Attendance</th></tr>
                  </thead>
                  <tbody>
                    {attendanceRoster.map((student) => (
                      <tr key={student.student_id} className="border-t border-slate-200">
                        <td className="py-3">{student.full_name}</td>
                        <td>{student.matric_no}</td>
                        <td>{student.status}</td>
                        <td>
                          <button onClick={() => markStudentPresent(student.student_id)} disabled={!attendanceStatus.activeSession || student.present} className={`rounded-lg px-3 py-2 ${student.present ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-900 text-white disabled:opacity-50'}`}>
                            {student.present ? 'Present' : 'Mark Present'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm text-sm text-slate-600">
                Roll call is locked for this class. View summary below.
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
              <h3 className="font-semibold text-slate-900 mb-4">Attendance Summary by Student</h3>
              <table className="data-table w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr><th className="pb-2">Name</th><th>Present</th><th>Absent</th><th>Rate</th><th>Eligible</th></tr>
                </thead>
                <tbody>
                  {attendanceSummary.map((student) => (
                    <tr key={student.student_id} className="border-t border-slate-200">
                      <td className="py-3">{student.full_name}</td>
                      <td>{student.present_count}</td>
                      <td>{student.absent_count}</td>
                      <td>{student.attendance_rate}%</td>
                      <td className={student.eligible ? 'text-emerald-600' : 'text-amber-600'}>{student.eligible ? 'Eligible' : 'Not Eligible'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {section === 'results' ? (() => {
        const ensurePlans = async () => {
          if (plans.length) return
          try {
            const res = await apiClient.get('/course-plans')
            setPlans(res.data)
          } catch { /* ignore */ }
        }

        const loadResultsHistory = async () => {
          setResultsHistoryLoading(true)
          try {
            const res = await apiClient.get('/results/history')
            setResultsHistory(res.data)
          } catch { /* ignore */ }
          finally { setResultsHistoryLoading(false) }
        }

        const loadPlanCourses = async (planId) => {
          if (!planId) { setPlanCourses([]); return }
          try {
            const res = await apiClient.get(`/course-plans/${planId}`)
            setPlanCourses(res.data.items || [])
          } catch { setPlanCourses([]) }
        }

        const loadPlanGrid = async () => {
          if (!resultPlanId || !resultCourseId) return
          setPlanGridLoading(true)
          setPlanGrid(null)
          setPlanGridEdits({})
          try {
            const res = await apiClient.get(`/results/plan-course-grid?planId=${resultPlanId}&courseId=${resultCourseId}&includeAllStudents=${includeAllStudents}`)
            setPlanGrid(res.data)
          } catch (err) { notify(err.response?.data?.message || 'Failed to load grid') }
          finally { setPlanGridLoading(false) }
        }

        const saveAllEdits = async () => {
          const entries = Object.entries(planGridEdits)
            .map(([key, edit]) => {
              const [studentId] = key.split('_')
              return {
                studentId: Number(studentId),
                courseId: Number(resultCourseId),
                resultType: planGridResultType,
                score: edit.score !== '' && edit.score !== undefined ? Number(edit.score) : undefined,
                status: edit.status,
              }
            })
            .filter((e) => e.status)
          if (!entries.length) { notify('No changes to save'); return }
          try {
            await apiClient.post('/results/bulk-plan', { entries })
            setPlanGridEdits({})
            await loadPlanGrid()
            await loadGraduationMatrix()
            notify('Results saved')
          } catch (err) { notify(err.response?.data?.message || 'Save failed') }
        }

        return (
          <div className="space-y-5 flex-1 min-h-0 overflow-auto">
            {/* Tab bar */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
              {[{ key: 'input', label: 'Enter Results' }, { key: 'history', label: 'History' }].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setResultsTab(key); if (key === 'history') loadResultsHistory(); else ensurePlans() }}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${resultsTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Shared selectors */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex flex-wrap gap-4 items-end">
                <label className="text-sm text-slate-600 block flex-1 min-w-[200px]">
                  Plan
                  <select
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                    value={resultPlanId}
                    onClick={ensurePlans}
                    onChange={(e) => { setResultPlanId(e.target.value); setResultCourseId(''); setPlanCourses([]); setPlanGrid(null); setPlanGridEdits({}); loadPlanCourses(e.target.value) }}
                  >
                    <option value="">Select plan</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.year})</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-600 block flex-1 min-w-[200px]">
                  Course
                  <select
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                    value={resultCourseId}
                    onChange={(e) => { setResultCourseId(e.target.value); setPlanGrid(null); setPlanGridEdits({}) }}
                  >
                    <option value="">Select course</option>
                    {planCourses.map((c) => (
                      <option key={c.course_id} value={c.course_id}>{c.course_code ? `${c.course_code} — ` : ''}{c.course_title}</option>
                    ))}
                  </select>
                </label>
                {resultsTab === 'input' ? (
                  <label className="text-sm text-slate-600 block">
                    Result Type
                    <select
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                      value={planGridResultType}
                      onChange={(e) => setPlanGridResultType(e.target.value)}
                    >
                      <option value="Final">Final</option>
                      <option value="Assignment">Assignment</option>
                      <option value="Exam">Exam</option>
                    </select>
                  </label>
                ) : null}
                {resultsTab === 'input' ? (
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer pb-1">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded"
                      checked={includeAllStudents}
                      onChange={(e) => setIncludeAllStudents(e.target.checked)}
                    />
                    Include unenrolled students
                  </label>
                ) : null}
                <button
                  type="button"
                  onClick={loadPlanGrid}
                  disabled={!resultPlanId || !resultCourseId || planGridLoading}
                  className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
                >
                  {planGridLoading ? 'Loading...' : 'Load Grid'}
                </button>
              </div>
            </div>

            {/* Input grid tab */}
            {resultsTab === 'input' ? (
              planGrid ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{planGrid.plan.name} — {planGrid.course.title}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{planGrid.students.length} students · {planGridResultType}</p>
                    </div>
                    <button
                      type="button"
                      disabled={Object.keys(planGridEdits).length === 0}
                      onClick={saveAllEdits}
                      className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-50"
                    >
                      Save Changes {Object.keys(planGridEdits).length > 0 ? `(${Object.keys(planGridEdits).length})` : ''}
                    </button>
                  </div>
                  {planGrid.students.length === 0 ? (
                    <p className="text-sm text-slate-400">No students found for this course. Toggle "Include unenrolled students" and reload.</p>
                  ) : (
                    <table className="data-table w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="py-2 pr-4 text-left text-slate-500 font-medium min-w-[160px]">Student</th>
                          <th className="py-2 pr-3 text-left text-slate-500 font-medium">Matric</th>
                          <th className="py-2 pr-3 text-left text-slate-500 font-medium text-xs w-20">Status</th>
                          <th className="py-2 px-3 text-left text-slate-500 font-medium text-xs">Score</th>
                          <th className="py-2 px-3 text-left text-slate-500 font-medium text-xs">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {planGrid.students.map((student) => {
                          const editKey = `${student.student_id}_${planGrid.course.id}`
                          const edit = planGridEdits[editKey]
                          const existing = student.results?.[planGridResultType]
                          const displayScore = edit?.score !== undefined ? edit.score : (existing?.score != null ? String(existing.score) : '')
                          const displayStatus = edit?.status !== undefined ? edit.status : (existing?.status || 'Pass')
                          const isEdited = !!edit
                          return (
                            <tr key={student.student_id} className={`border-b border-slate-100 hover:bg-slate-50 ${!student.is_enrolled ? 'bg-amber-50/50' : ''}`}>
                              <td className="py-2.5 pr-4 font-medium text-slate-800 flex items-center gap-2">
                                {student.full_name}
                                {!student.is_enrolled ? (
                                  <span className="text-[10px] bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 font-medium">not enrolled</span>
                                ) : null}
                              </td>
                              <td className="py-2.5 pr-3 text-slate-500 text-xs">{student.matric_no || '—'}</td>
                              <td className="py-2.5 pr-3 text-xs">
                                {student.is_enrolled ? (
                                  <span className="text-emerald-600">Enrolled</span>
                                ) : (
                                  <span className="text-amber-600">Not enrolled</span>
                                )}
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  placeholder="Score"
                                  className={`w-20 border rounded px-2 py-1 text-xs ${isEdited ? 'border-gold-400 bg-gold-50' : 'border-slate-200'}`}
                                  value={displayScore}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    const autoStatus = val !== '' ? (Number(val) >= 50 ? 'Pass' : 'Fail') : (edit?.status || existing?.status || 'Pass')
                                    setPlanGridEdits((prev) => ({
                                      ...prev,
                                      [editKey]: { ...(prev[editKey] || {}), score: val, status: autoStatus },
                                    }))
                                  }}
                                />
                              </td>
                              <td className="py-2 px-3">
                                <select
                                  className={`border rounded px-1 py-0.5 text-xs ${isEdited ? 'border-gold-400 bg-gold-50' : 'border-slate-200'}`}
                                  value={displayStatus}
                                  onChange={(e) => setPlanGridEdits((prev) => ({
                                    ...prev,
                                    [editKey]: { ...(prev[editKey] || { score: displayScore }), status: e.target.value },
                                  }))}
                                >
                                  <option value="Pass">Pass</option>
                                  <option value="Fail">Fail</option>
                                </select>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <p className="text-sm text-slate-400 text-center py-6">
                    Select a plan and course, then click "Load Grid" to enter results.
                  </p>
                </div>
              )
            ) : null}

            {/* History tab — auto-loads all results */}
            {resultsTab === 'history' ? (
              <div className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                    <h3 className="font-semibold text-slate-900">All Saved Results</h3>
                    <input
                      className="border rounded-lg px-3 py-2 text-sm w-64"
                      placeholder="Search by student or course..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    {resultsHistoryLoading ? 'Loading...' : `${resultsHistory.reduce((sum, c) => sum + c.courses.reduce((s, co) => s + co.students.length, 0), 0)} results across ${resultsHistory.length} cohorts`}
                  </p>

                  {resultsHistoryLoading ? (
                    <p className="text-sm text-slate-400 py-6 text-center">Loading results...</p>
                  ) : resultsHistory.length === 0 ? (
                    <p className="text-sm text-slate-400 py-6 text-center">No results saved yet.</p>
                  ) : (
                    <div className="space-y-6">
                      {resultsHistory.map((cohort) => {
                        const filteredCourses = cohort.courses
                          .map((course) => ({
                            ...course,
                            filteredStudents: course.students.filter((s) =>
                              !historySearch ||
                              s.full_name.toLowerCase().includes(historySearch.toLowerCase()) ||
                              course.course_title.toLowerCase().includes(historySearch.toLowerCase())
                            ),
                          }))
                          .filter((c) => c.filteredStudents.length > 0)

                        if (!filteredCourses.length) return null

                        return (
                          <div key={cohort.cohort_id}>
                            <h4 className="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                              <span className="rounded-full bg-sky-100 text-sky-700 px-3 py-0.5 text-xs">{cohort.cohort_name}</span>
                            </h4>
                            <div className="space-y-3">
                              {filteredCourses.map((course) => (
                                <div key={course.course_id} className="border border-slate-200 rounded-xl overflow-hidden">
                                  <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                                    <span className="text-sm font-medium text-slate-800">{course.course_title}{course.course_code ? ` (${course.course_code})` : ''}</span>
                                    <span className="text-xs text-slate-400">{course.filteredStudents.length} students</span>
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="data-table w-full text-sm">
                                      <thead>
                                        <tr className="border-b border-slate-100">
                                          <th className="py-2 px-4 text-left text-slate-500 font-medium">Student</th>
                                          <th className="py-2 px-3 text-left text-slate-500 font-medium">Matric</th>
                                          <th className="py-2 px-3 text-left text-slate-500 font-medium">Result Type</th>
                                          <th className="py-2 px-3 text-left text-slate-500 font-medium">Score</th>
                                          <th className="py-2 px-3 text-left text-slate-500 font-medium">Status</th>
                                          <th className="py-2 px-3 text-left text-slate-500 font-medium">Date</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {course.filteredStudents.map((s) => (
                                          <tr key={s.result_id || `${s.student_id}-${course.course_id}`} className="border-b border-slate-100 hover:bg-slate-50">
                                            <td className="py-2 px-4 font-medium text-slate-800">{s.full_name}</td>
                                            <td className="py-2 px-3 text-slate-500">{s.matric_no || '—'}</td>
                                            <td className="py-2 px-3 text-slate-500 text-xs">{s.result_type || '—'}</td>
                                            <td className="py-2 px-3">{s.score != null ? s.score : '—'}</td>
                                            <td className="py-2 px-3">
                                              {s.result_status ? (
                                                <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${s.result_status === 'Pass' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                  {s.result_status}
                                                </span>
                                              ) : (
                                                <span className="text-slate-300">—</span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3 text-xs text-slate-400 whitespace-nowrap">{s.uploaded_at ? fmtDate(s.uploaded_at) : '—'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )
      })() : null}

      {section === 'graduation' ? (
        <div className="space-y-6 flex-1 min-h-0 overflow-auto">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Graduation</h2>
              <p className="text-sm text-slate-500 mt-1">Track progress and set up the rector meeting calendar for graduates.</p>
            </div>
            <button
              type="button"
              onClick={openGraduationCalendarTemplate}
              className="inline-flex items-center gap-2 bg-sky-600 text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-sky-700 shadow-sm"
            >
              <GraduationCap size={16} />
              Graduation calendar form
            </button>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <p className="font-semibold">Rector meeting calendar (Calendly-style)</p>
            <p className="mt-1 text-sky-800/90">
              Opens a form prefilled with a graduate name dropdown, contact fields, and unique date/time booking slots. Save it, set status to <strong>Active</strong>, then share the public link with graduating students.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card title="Total Students" value={graduationStatusCounts.total} />
            <Card title="Graduating" value={graduationStatusCounts.Graduating} />
            <Card title="Graduated" value={graduationStatusCounts.Graduated} />
            <Card title="Alumni" value={graduationStatusCounts.Alumni} />
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h3 className="font-semibold text-slate-900">Graduation Matrix</h3>
              <div className="flex flex-wrap items-center gap-2">
                {['all', 'Active', 'Graduating', 'Graduated', 'Alumni'].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setGraduationStatusFilter(value)}
                    className={`rounded-full px-3 py-1 text-xs border cursor-pointer ${graduationStatusFilter === value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300'}`}
                  >
                    {value === 'all' ? 'All Statuses' : value}
                  </button>
                ))}
                <select
                  className="rounded-full px-3 py-1 text-xs border bg-white text-slate-600"
                  value={graduationCohortFilter}
                  onChange={(event) => setGraduationCohortFilter(event.target.value)}
                >
                  <option value="">All Batches</option>
                  {cohorts.map((cohort) => (
                    <option key={cohort.id} value={String(cohort.id)}>
                      {cohort.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DataTable
              data={filteredGraduationStudents}
              rowKey="id"
              initialPageSize={25}
              maxHeight="70vh"
              emptyMessage="No students match the current filters."
              emptyIcon={<GraduationCap size={32} />}
              globalSearchPlaceholder="Search name, matric, status…"
              defaultSort={{ id: 'completion_pct', dir: 'desc' }}
              columns={[
                {
                  id: 'full_name',
                  header: 'Student',
                  accessor: 'full_name',
                  cell: (student) => (
                    <Link to={`/lecturer/students/${student.id}`} className="font-medium text-slate-900 hover:underline">
                      {student.full_name}
                    </Link>
                  ),
                },
                { id: 'matric_no', header: 'Matric', accessor: 'matric_no' },
                {
                  id: 'status',
                  header: 'Status',
                  accessor: 'status',
                  filterType: 'select',
                  filterOptions: ['Active', 'Graduating', 'Graduated', 'Alumni'],
                  cell: (s) => (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[s.status] || 'bg-slate-100 text-slate-700'}`}>
                      {s.status}
                    </span>
                  ),
                },
                {
                  id: 'completion_pct',
                  header: 'Progress',
                  accessor: 'completion_pct',
                  sortType: 'number',
                  cell: (s) => (
                    <div className="flex items-center gap-2 min-w-[100px]">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full rounded-full bg-gold-600" style={{ width: `${Math.min(Number(s.completion_pct) || 0, 100)}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 tabular-nums w-9 text-right">{s.completion_pct}%</span>
                    </div>
                  ),
                },
                { id: 'passed', header: 'Passed', accessor: 'passed', sortType: 'number', align: 'center' },
                { id: 'remaining', header: 'Remaining', accessor: 'remaining', sortType: 'number', align: 'center' },
                ...(graduationMatrix.courses || []).map((course) => ({
                  id: `course_${course.id}`,
                  header: course.course_code || course.title,
                  accessor: (student) => {
                    const info = student.courses?.[course.id]
                    if (info?.result_status === 'Pass') return 'Pass'
                    if (info?.result_status === 'Fail') return 'Fail'
                    if (info?.enrollment_status === 'active') return 'Active'
                    return ''
                  },
                  filterType: 'select',
                  filterOptions: ['Pass', 'Fail', 'Active'],
                  align: 'center',
                  sortable: true,
                  cell: (student) => {
                    const info = student.courses?.[course.id]
                    const isCurrent = info?.enrollment_status === 'active'
                    const content = info?.result_status === 'Pass'
                      ? <span className="text-emerald-600 font-semibold">✓</span>
                      : info?.result_status === 'Fail'
                      ? <span className="text-red-500 font-semibold">✗</span>
                      : info?.enrollment_status === 'active'
                      ? <span className="text-sky-600 font-medium text-xs">In progress</span>
                      : null
                    return (
                      <span className={`inline-flex min-w-[2rem] justify-center rounded-md px-1 ${isCurrent ? 'bg-amber-50' : ''}`}>
                        {content}
                      </span>
                    )
                  },
                })),
                {
                  id: 'actions',
                  header: 'Action',
                  filterable: false,
                  sortable: false,
                  align: 'right',
                  cell: (student) => (
                    <div className="relative">
                      <button
                        type="button"
                        className="rounded-lg p-2 bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                        onClick={() => setOpenGraduationActionFor((prev) => (prev === student.id ? null : student.id))}
                      >
                        <MoreVertical size={16} />
                      </button>
                      {openGraduationActionFor === student.id ? (
                        <div className="absolute right-0 mt-2 z-30 w-44 rounded-xl border border-slate-200 bg-white shadow-lg p-1">
                          <button type="button" className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer" onClick={() => openGradVetting(student, 'Graduating')}>
                            Mark as Graduating
                          </button>
                          <button
                            type="button"
                            className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                            disabled={student.remaining > 0 || student.failed > 0}
                            onClick={() => openGradVetting(student, 'Graduated')}
                          >
                            Mark as Graduated
                          </button>
                          <button
                            type="button"
                            className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                            disabled={student.status !== 'Graduated'}
                            onClick={() => { updateStudentLifecycle(student, 'Alumni'); setOpenGraduationActionFor(null) }}
                          >
                            Mark as Alumni
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </div>
      ) : null}

      {section === 'assignments' ? (
        <div className="space-y-5 flex-1 min-h-0 overflow-auto">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {['assignments', 'exams'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setExamsTab(tab)}
                  className={`rounded-lg px-5 py-1.5 text-sm font-medium capitalize transition-colors ${examsTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {tab === 'assignments' ? 'Assignments' : 'Exams'}
                </button>
              ))}
            </div>
            <label className="text-sm text-slate-600 flex items-center gap-2">
              Course
              <select
                className="border rounded-lg px-3 py-2 text-sm font-medium min-w-64 bg-white"
                value={selectedCourseId || ''}
                onChange={(e) => setSelectedCourseId(e.target.value)}
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.is_current ? '★ ' : ''}{course.course_code ? `${course.course_code} — ` : ''}{course.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {examsTab === 'assignments' ? (
            <div className="grid xl:grid-cols-[390px_1fr] gap-6">
              <form onSubmit={createAssignment} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                <h3 className="font-semibold text-slate-900">Create Assignment</h3>
                <p className="text-sm text-slate-500">Assignments are sent only to students who are eligible from attendance.</p>
                <input className="w-full border rounded-lg px-3 py-2" placeholder="Title" value={assignmentForm.title} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, title: event.target.value }))} required />
                <textarea className="w-full min-h-36 border rounded-lg px-3 py-2" placeholder="Description" value={assignmentForm.description} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, description: event.target.value }))} required />
                <input className="w-full border rounded-lg px-3 py-2" type="date" value={assignmentForm.dueDate} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, dueDate: event.target.value }))} />
                <input className="w-full border rounded-lg px-3 py-2" type="file" onChange={(event) => setAssignmentForm((prev) => ({ ...prev, file: event.target.files?.[0] || null }))} />
                <button className="bg-slate-900 text-white rounded-lg px-4 py-2">Send Assignment</button>
              </form>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
                <h3 className="font-semibold text-slate-900 mb-4">Eligible Students ({eligibleStudents.length})</h3>
                <table className="data-table w-full text-sm">
                  <thead className="text-left text-slate-500">
                    <tr><th className="pb-2">Name</th><th>Matric</th><th>Email</th><th>Attendance</th></tr>
                  </thead>
                  <tbody>
                    {eligibleStudents.map((student) => (
                      <tr key={student.id} className="border-t border-slate-200">
                        <td className="py-3">{student.full_name}</td>
                        <td>{student.matric_no}</td>
                        <td>{student.email}</td>
                        <td>{student.attendance_count}/{student.min_attendance_required}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">Create Exam</h3>
                  <p className="text-sm text-slate-500">Build questions on the left — live preview on the right. Save when ready, then send to students.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setExamSavedListOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 shadow-sm"
                >
                  <FileText size={16} />
                  Saved Exams ({exams.length})
                </button>
              </div>

              <div className="grid xl:grid-cols-[1.15fr_0.85fr] gap-6 items-start">
                <form onSubmit={createExam} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-1.5">Plan (academic year)</p>
                      <select
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        value={examForm.planId}
                        onChange={(event) => setExamForm((prev) => ({ ...prev, planId: event.target.value }))}
                      >
                        <option value="">None (general exam)</option>
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {p.year}{p.is_active ? ' (active)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-1.5">Due date</p>
                      <input className="w-full border rounded-lg px-3 py-2 text-sm" type="date" value={examForm.dueDate} onChange={(event) => setExamForm((prev) => ({ ...prev, dueDate: event.target.value }))} />
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1.5">Exam Type</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'essay', label: 'Essay', hint: 'Questions emailed to students' },
                        { key: 'mcq', label: 'MCQ', hint: 'In-system quiz + access ID' },
                      ].map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => setExamForm((prev) => ({
                            ...prev,
                            examType: t.key,
                            questions: t.key === 'mcq'
                              ? (prev.examType === 'mcq' ? prev.questions : [blankMcqQuestion()])
                              : (prev.examType === 'essay' ? prev.questions : [{ text: '' }]),
                          }))}
                          className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                            examForm.examType === t.key ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className="block text-sm font-semibold text-slate-900">{t.label}</span>
                          <span className="block text-xs text-slate-500 mt-0.5">{t.hint}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <input className="w-full border rounded-lg px-3 py-2.5 text-sm" placeholder="Exam title (e.g. 2026 Plan — Final Exam)" value={examForm.title} onChange={(event) => setExamForm((prev) => ({ ...prev, title: event.target.value }))} required />
                  <textarea className="w-full min-h-20 border rounded-lg px-3 py-2 text-sm" placeholder="Instructions / description" value={examForm.description} onChange={(event) => setExamForm((prev) => ({ ...prev, description: event.target.value }))} />

                  {examForm.examType === 'mcq' ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">MCQ Questions</p>
                        <button
                          type="button"
                          onClick={() => setExamForm((prev) => ({ ...prev, questions: [...prev.questions, blankMcqQuestion()] }))}
                          className="inline-flex items-center gap-1 text-xs rounded-lg bg-slate-100 px-2.5 py-1.5 hover:bg-slate-200"
                        >
                          <Plus size={14} /> Add question
                        </button>
                      </div>
                      <p className="text-xs text-slate-400">After save, a quiz URL is generated. Students unlock with Access ID; scores are stored and mailed when you release results.</p>
                      {examForm.questions.map((q, idx) => (
                        <div key={idx} className="border border-slate-200 rounded-xl p-4 space-y-2 bg-slate-50">
                          <div className="flex items-start gap-2">
                            <span className="text-xs font-bold text-slate-400 pt-2">Q{idx + 1}</span>
                            <textarea
                              className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                              rows={3}
                              placeholder="Question text"
                              value={q.text}
                              onChange={(event) => setExamForm((prev) => ({
                                ...prev,
                                questions: prev.questions.map((item, i) => (i === idx ? { ...item, text: event.target.value } : item)),
                              }))}
                            />
                            {examForm.questions.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => setExamForm((prev) => ({
                                  ...prev,
                                  questions: prev.questions.filter((_, i) => i !== idx),
                                }))}
                                className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              >
                                <X size={16} />
                              </button>
                            ) : null}
                          </div>
                          <div className="space-y-1.5 pl-6">
                            {(q.options || []).map((opt, optIdx) => (
                              <div key={opt.key || optIdx} className="flex items-center gap-2">
                                <button
                                  type="button"
                                  title="Mark as correct answer"
                                  onClick={() => setExamForm((prev) => ({
                                    ...prev,
                                    questions: prev.questions.map((item, i) => (i === idx ? { ...item, correctAnswer: opt.key } : item)),
                                  }))}
                                  className={`shrink-0 w-7 h-7 rounded-lg text-xs font-bold border ${
                                    q.correctAnswer === opt.key
                                      ? 'bg-emerald-600 text-white border-emerald-600'
                                      : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400'
                                  }`}
                                >
                                  {opt.key}
                                </button>
                                <input
                                  className="flex-1 border rounded-lg px-2 py-1.5 text-sm bg-white"
                                  placeholder={`Option ${opt.key}`}
                                  value={opt.label}
                                  onChange={(event) => setExamForm((prev) => ({
                                    ...prev,
                                    questions: prev.questions.map((item, i) => {
                                      if (i !== idx) return item
                                      const options = (item.options || []).map((o, j) => (j === optIdx ? { ...o, label: event.target.value } : o))
                                      return { ...item, options }
                                    }),
                                  }))}
                                />
                                {(q.options || []).length > 2 ? (
                                  <button
                                    type="button"
                                    onClick={() => setExamForm((prev) => ({
                                      ...prev,
                                      questions: prev.questions.map((item, i) => {
                                        if (i !== idx) return item
                                        const options = (item.options || []).filter((_, j) => j !== optIdx)
                                        const correctAnswer = options.some((o) => o.key === item.correctAnswer)
                                          ? item.correctAnswer
                                          : (options[0]?.key || 'A')
                                        return { ...item, options, correctAnswer }
                                      }),
                                    }))}
                                    className="text-xs text-red-500"
                                  >
                                    ×
                                  </button>
                                ) : null}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => setExamForm((prev) => ({
                                ...prev,
                                questions: prev.questions.map((item, i) => {
                                  if (i !== idx) return item
                                  const nextKey = String.fromCharCode(65 + (item.options || []).length)
                                  return { ...item, options: [...(item.options || []), { key: nextKey, label: '' }] }
                                }),
                              }))}
                              className="text-xs text-sky-600 hover:underline"
                            >
                              + Add option
                            </button>
                            <p className="text-[11px] text-slate-400">Green letter = correct answer</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-slate-700">Essay Questions</p>
                        <button
                          type="button"
                          onClick={() => setExamForm((prev) => ({ ...prev, questions: [...prev.questions, { text: '' }] }))}
                          className="inline-flex items-center gap-1 text-xs rounded-lg bg-slate-100 px-2.5 py-1.5 hover:bg-slate-200"
                        >
                          <Plus size={14} /> Add question
                        </button>
                      </div>
                      <div className="space-y-3">
                        {examForm.questions.map((q, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="text-xs font-bold text-slate-400 pt-2.5">Q{idx + 1}</span>
                            <textarea
                              className="w-full border rounded-lg px-3 py-2 text-sm"
                              rows={3}
                              placeholder="Question text"
                              value={q.text}
                              onChange={(event) => setExamForm((prev) => ({
                                ...prev,
                                questions: prev.questions.map((item, i) => (i === idx ? { ...item, text: event.target.value } : item)),
                              }))}
                            />
                            {examForm.questions.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => setExamForm((prev) => ({
                                  ...prev,
                                  questions: prev.questions.filter((_, i) => i !== idx),
                                }))}
                                className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              >
                                <X size={16} />
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button className="w-full bg-slate-900 text-white rounded-xl px-4 py-3 text-sm font-semibold">Save Exam</button>
                </form>

                {/* Live preview */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm sticky top-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-900">Student preview</h3>
                    <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${examForm.examType === 'mcq' ? 'bg-sky-100 text-sky-700' : 'bg-gold-100 text-gold-700'}`}>
                      {examForm.examType === 'mcq' ? 'MCQ' : 'Essay'}
                    </span>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div>
                      <p className="text-lg font-bold text-slate-900">{examForm.title || 'Untitled exam'}</p>
                      {examForm.description ? <p className="text-sm text-slate-600 mt-1">{examForm.description}</p> : null}
                      {examForm.dueDate ? <p className="text-xs text-slate-400 mt-1">Due {examForm.dueDate}</p> : null}
                    </div>
                    {examForm.examType === 'mcq' ? (
                      <div className="space-y-3">
                        <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                          Students enter their Access ID first, then see questions like this.
                        </div>
                        {examForm.questions.filter((q) => (q.text || '').trim() || (q.options || []).some((o) => (o.label || '').trim())).length === 0 ? (
                          <p className="text-sm text-slate-400 text-center py-8">Add questions to preview them here.</p>
                        ) : (
                          examForm.questions.map((q, idx) => (
                            <div key={idx} className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                              <p className="text-sm font-semibold text-slate-900">
                                <span className="text-slate-400 mr-1.5">Q{idx + 1}.</span>
                                {q.text || <span className="text-slate-300 italic">Question text…</span>}
                              </p>
                              <div className="space-y-1.5">
                                {(q.options || []).filter((o) => (o.label || '').trim() || true).map((opt) => (
                                  <div
                                    key={opt.key}
                                    className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-sm ${
                                      q.correctAnswer === opt.key ? 'border-emerald-300 bg-emerald-50' : 'border-slate-100 bg-slate-50'
                                    }`}
                                  >
                                    <span className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold ${
                                      q.correctAnswer === opt.key ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                                    }`}>
                                      {opt.key}
                                    </span>
                                    <span className="pt-0.5 text-slate-700">{opt.label || <span className="text-slate-300 italic">Option…</span>}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          Essay questions are emailed to students as a paper list.
                        </div>
                        {examForm.questions.filter((q) => (q.text || '').trim()).length === 0 ? (
                          <p className="text-sm text-slate-400 text-center py-8">Add questions to preview them here.</p>
                        ) : (
                          <ol className="space-y-3 list-decimal list-inside">
                            {examForm.questions.map((q, idx) => (
                              (q.text || '').trim() ? (
                                <li key={idx} className="text-sm text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
                                  {q.text}
                                </li>
                              ) : null
                            ))}
                          </ol>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {examSavedListOpen ? (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex justify-end"
          onClick={() => setExamSavedListOpen(false)}
        >
          <div
            className="bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="font-semibold text-slate-900">Saved Exams</h3>
                <p className="text-xs text-slate-500 mt-0.5">{exams.length} for this course</p>
              </div>
              <button type="button" onClick={() => setExamSavedListOpen(false)} className="rounded-lg p-1 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {examsLoading ? (
                <p className="text-sm text-slate-400 py-6 text-center">Loading exams…</p>
              ) : exams.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">No exams saved for this course yet.</p>
              ) : (
                exams.map((exam) => (
                  <div key={exam.id} className="border border-slate-200 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">
                          {exam.title}
                          <span className={`ml-2 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 align-middle ${exam.exam_type === 'mcq' ? 'bg-sky-100 text-sky-700' : 'bg-gold-100 text-gold-700'}`}>
                            {exam.exam_type === 'mcq' ? 'MCQ' : 'Essay'}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {exam.question_count} question(s)
                          {' • '}{exam.delivery_count} delivered
                          {exam.exam_type === 'mcq' ? ` • ${exam.submission_count || 0} submitted` : ''}
                          {exam.plan_name ? ` • ${exam.plan_name} (${exam.plan_year})` : ''}
                          {exam.due_date ? ` • Due ${fmtDate(exam.due_date)}` : ''}
                        </p>
                        {exam.exam_type === 'mcq' && exam.take_url ? (
                          <p className="text-xs text-sky-700 mt-1 break-all">
                            <a href={exam.take_url} target="_blank" rel="noreferrer" className="underline">{exam.take_url}</a>
                            <button
                              type="button"
                              className="ml-2 text-sky-600 hover:underline"
                              onClick={() => {
                                navigator.clipboard.writeText(exam.take_url)
                                notify('Quiz link copied')
                              }}
                            >
                              Copy
                            </button>
                          </p>
                        ) : null}
                        {exam.description ? <p className="text-sm text-slate-600 mt-1">{exam.description}</p> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => { setExamSavedListOpen(false); openExamSend(exam) }}
                        className="text-xs rounded-lg bg-slate-900 text-white px-3 py-1.5 hover:bg-slate-700"
                      >
                        Send Exam
                      </button>
                      {exam.exam_type === 'mcq' ? (
                        <button
                          type="button"
                          onClick={() => { setExamSavedListOpen(false); openExamSubmissions(exam) }}
                          className="text-xs rounded-lg bg-sky-50 text-sky-700 px-3 py-1.5 hover:bg-sky-100"
                        >
                          Submissions
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => deleteExamItem(exam.id)}
                        className="text-xs rounded-lg bg-rose-50 text-rose-600 px-3 py-1.5 hover:bg-rose-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {examSubmissionsView ? (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setExamSubmissionsView(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="font-semibold text-slate-900">MCQ Submissions</h3>
                <p className="text-sm text-slate-500 mt-0.5">{examSubmissionsView.title}</p>
              </div>
              <button type="button" onClick={() => setExamSubmissionsView(null)} className="rounded-lg p-1 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-600">{examSubmissions.length} submission(s)</p>
              <button
                type="button"
                disabled={examResultsSending || !examSubmissions.some((s) => !s.result_sent_at)}
                onClick={sendMcqResultsNow}
                className="text-xs rounded-lg bg-emerald-600 text-white px-3 py-1.5 hover:bg-emerald-700 disabled:opacity-50"
              >
                {examResultsSending ? 'Sending…' : 'Email results to students'}
              </button>
            </div>
            {examSubmissionsLoading ? (
              <p className="text-sm text-slate-400 py-6 text-center">Loading…</p>
            ) : examSubmissions.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">No submissions yet.</p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="data-table w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="px-3 py-2">Student</th>
                      <th className="px-3 py-2">Score</th>
                      <th className="px-3 py-2">Submitted</th>
                      <th className="px-3 py-2">Result mailed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {examSubmissions.map((s) => (
                      <tr key={s.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <p className="font-medium text-slate-900">{s.student_name}</p>
                          <p className="text-xs text-slate-400">{s.student_email}</p>
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-800">
                          {s.score}% <span className="text-xs font-normal text-slate-400">({s.correct_count}/{s.total_questions})</span>
                        </td>
                        <td className="px-3 py-2 text-slate-600 text-xs">{s.submitted_at ? new Date(s.submitted_at).toLocaleString() : '—'}</td>
                        <td className="px-3 py-2 text-xs">
                          {s.result_sent_at ? (
                            <span className="text-emerald-700">Sent {new Date(s.result_sent_at).toLocaleDateString()}</span>
                          ) : (
                            <span className="text-amber-600">Pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {examSendTarget ? (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setExamSendTarget(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="font-semibold text-slate-900">Send Exam</h3>
                <p className="text-sm text-slate-500 mt-0.5">{examSendTarget.title}</p>
              </div>
              <button type="button" onClick={() => setExamSendTarget(null)} className="rounded-lg p-1 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-700">Recipients ({examEligible.filter((s) => examSelected[s.id]).length})</p>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  className="rounded-lg bg-slate-100 px-2.5 py-1 hover:bg-slate-200"
                  onClick={() => setExamSelected(Object.fromEntries(examEligible.map((s) => [s.id, true])))}
                >
                  All
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-slate-100 px-2.5 py-1 hover:bg-slate-200"
                  onClick={() => setExamSelected(Object.fromEntries(examEligible.map((s) => [s.id, false])))}
                >
                  None
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-3">Students listed are those eligible for this course (by attendance). Uncheck anyone you don't want to receive it.</p>

            <div className="border border-slate-200 rounded-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
              {examEligible.map((student) => (
                <label key={student.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded"
                    checked={Boolean(examSelected[student.id])}
                    onChange={(e) => setExamSelected((prev) => ({ ...prev, [student.id]: e.target.checked }))}
                  />
                  <span className="text-sm text-slate-900">{student.full_name}</span>
                  <span className="text-xs text-slate-500 ml-auto">{student.matric_no}</span>
                </label>
              ))}
              {examEligible.length === 0 ? (
                <p className="text-sm text-slate-400 p-4 text-center">No eligible students for this course yet.</p>
              ) : null}
            </div>

            {examSendResult ? (
              <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm">
                <p className="text-emerald-700 font-medium">Sent to {examSendResult.sent} of {examSendResult.total} student(s).</p>
                {examSendResult.failed > 0 ? (
                  <p className="text-rose-600 mt-1">{examSendResult.failed} failed (see errors):</p>
                ) : null}
                {examSendResult.errors?.slice(0, 5).map((err, i) => (
                  <p key={i} className="text-xs text-slate-500 mt-1">{err.student}: {err.error}</p>
                ))}
              </div>
            ) : null}

            <div className="flex gap-2 justify-end mt-4">
              <button
                type="button"
                className="px-4 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200"
                onClick={() => setExamSendTarget(null)}
              >
                Close
              </button>
              <button
                type="button"
                disabled={examSending}
                onClick={sendExamNow}
                className="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white disabled:opacity-50"
              >
                {examSending ? 'Sending…' : 'Send Exam'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {section === 'lecturers' ? (
        <div className="grid lg:grid-cols-[360px_1fr] gap-6 flex-1 min-h-0 overflow-auto">
          {/* Create lecturer form */}
          <form
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3 self-start"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!lecturerForm.name.trim()) return
              try {
                await apiClient.post('/lecturers', lecturerForm)
                setLecturerForm({ name: '', email: '', phone: '' })
                await loadLecturers()
                notify('Lecturer added')
              } catch (err) {
                notify(err?.response?.data?.message || 'Unable to add lecturer')
              }
            }}
          >
            <h3 className="font-semibold text-slate-900">Add Lecturer</h3>
            <label className="text-sm text-slate-600 block">
              Name *
              <input
                className="mt-1 w-full border rounded-lg px-3 py-2"
                placeholder="Full name"
                value={lecturerForm.name}
                onChange={(e) => setLecturerForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </label>
            <label className="text-sm text-slate-600 block">
              Email
              <input
                type="email"
                className="mt-1 w-full border rounded-lg px-3 py-2"
                placeholder="email@example.com"
                value={lecturerForm.email}
                onChange={(e) => setLecturerForm((p) => ({ ...p, email: e.target.value }))}
              />
            </label>
            <label className="text-sm text-slate-600 block">
              Phone
              <input
                className="mt-1 w-full border rounded-lg px-3 py-2"
                placeholder="+1 234 567 8900"
                value={lecturerForm.phone}
                onChange={(e) => setLecturerForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </label>
            <button className="w-full bg-slate-900 text-white rounded-lg py-2">Add Lecturer</button>
          </form>

          {/* Lecturers list */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
            <h3 className="font-semibold text-slate-900 mb-4">All Lecturers ({lecturers.length})</h3>
            {lecturers.length === 0 ? (
              <p className="text-sm text-slate-400">No lecturers yet. Add one using the form.</p>
            ) : (
              <table className="data-table w-full text-sm">
                <thead className="text-left text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">Phone</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {lecturers.map((l) => (
                    <tr key={l.id} className="border-t border-slate-100">
                      {editingLecturerId === l.id ? (
                        <>
                          <td className="py-2 pr-2">
                            <input
                              className="w-full border rounded px-2 py-1 text-sm"
                              value={lecturerEditForm.name}
                              onChange={(e) => setLecturerEditForm((p) => ({ ...p, name: e.target.value }))}
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="email"
                              className="w-full border rounded px-2 py-1 text-sm"
                              value={lecturerEditForm.email}
                              onChange={(e) => setLecturerEditForm((p) => ({ ...p, email: e.target.value }))}
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              className="w-full border rounded px-2 py-1 text-sm"
                              value={lecturerEditForm.phone}
                              onChange={(e) => setLecturerEditForm((p) => ({ ...p, phone: e.target.value }))}
                            />
                          </td>
                          <td className="py-2 whitespace-nowrap">
                            <button
                              type="button"
                              className="text-xs bg-slate-900 text-white rounded px-2 py-1 mr-1"
                              onClick={async () => {
                                try {
                                  await apiClient.put(`/lecturers/${l.id}`, lecturerEditForm)
                                  setEditingLecturerId(null)
                                  await loadLecturers()
                                  notify('Lecturer updated')
                                } catch (err) {
                                  notify(err?.response?.data?.message || 'Unable to update lecturer')
                                }
                              }}
                            >Save</button>
                            <button
                              type="button"
                              className="text-xs text-slate-500 hover:text-slate-700"
                              onClick={() => setEditingLecturerId(null)}
                            >Cancel</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 pr-4 font-medium">{l.name}</td>
                          <td className="py-3 pr-4 text-slate-500">{l.email || '—'}</td>
                          <td className="py-3 pr-4 text-slate-500">{l.phone || '—'}</td>
                          <td className="py-3 whitespace-nowrap">
                            <button
                              type="button"
                              className="text-xs text-sky-600 hover:underline mr-3"
                              onClick={() => {
                                setEditingLecturerId(l.id)
                                setLecturerEditForm({ name: l.name, email: l.email || '', phone: l.phone || '' })
                              }}
                            >Edit</button>
                            <button
                              type="button"
                              className="text-xs text-red-500 hover:underline"
                              onClick={async () => {
                                if (!window.confirm(`Delete lecturer "${l.name}"?`)) return
                                try {
                                  await apiClient.delete(`/lecturers/${l.id}`)
                                  await loadLecturers()
                                  notify('Lecturer deleted')
                                } catch (err) {
                                  notify(err?.response?.data?.message || 'Unable to delete lecturer')
                                }
                              }}
                            >Delete</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}

      {section === 'email-process' ? (
        <div className="flex-1 min-h-0 overflow-auto">
        <EmailProcesses notify={notify} />
        </div>
      ) : null}

      {section === 'settings' ? (
        <div className="space-y-6 flex-1 min-h-0 overflow-auto">
          <div className="flex flex-wrap gap-1 mb-5 bg-slate-100 rounded-xl p-1 w-fit">
            {[
              { key: 'credentials', label: 'Credentials' },
            ].filter(Boolean).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setSettingsTab(key)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  settingsTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {settingsTab === 'credentials' ? (
            <div className="max-w-lg">
              {!credentialFormOpen ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center">
                  <UserCog size={40} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-sm text-slate-500 mb-4">No student credentials have been created.</p>
                  <button type="button" onClick={openCredentialForm}
                    className="inline-flex items-center gap-1.5 bg-slate-900 text-white rounded-xl px-5 py-2 text-sm font-medium hover:bg-slate-800 transition-colors"
                  ><Plus size={15} /> Add Credential</button>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-slate-900">Create Student Credential</h3>
                    <button type="button" onClick={() => setCredentialFormOpen(false)} className="text-sm text-slate-500 hover:text-slate-900">Cancel</button>
                  </div>
                  <label className="text-sm text-slate-600 block">
                    Student
                    <div className="relative mt-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm" placeholder="Search students..." value={credentialStudentSearch}
                        onChange={(e) => setCredentialStudentSearch(e.target.value)} />
                    </div>
                    <select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={credentialStudentId || ''}
                      onChange={(e) => {
                        const id = e.target.value ? Number(e.target.value) : null
                        setCredentialStudentId(id)
                        const s = credentialAllStudents.find((st) => st.id === id)
                        setCredentialUsername(s?.email || '')
                      }}
                    >
                      <option value="">Select a student...</option>
                      {credentialAllStudents.filter((s) =>
                        !credentialStudentSearch ||
                        s.full_name?.toLowerCase().includes(credentialStudentSearch.toLowerCase()) ||
                        s.email?.toLowerCase().includes(credentialStudentSearch.toLowerCase())
                      ).map((s) => (
                        <option key={s.id} value={s.id}>{s.full_name} ({s.email})</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm text-slate-600 block">
                    Username
                    <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={credentialUsername} readOnly
                      placeholder="Auto-populated from email" />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-sm text-slate-600 block">
                      Password
                      <div className="flex gap-2 mt-1">
                        <input type="password" className="flex-1 border rounded-lg px-3 py-2 text-sm" value={credentialPassword}
                          onChange={(e) => setCredentialPassword(e.target.value)} placeholder="Enter password" />
                      </div>
                    </label>
                    <label className="text-sm text-slate-600 block">
                      Confirm Password
                      <input type="password" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={credentialPasswordConfirm}
                        onChange={(e) => setCredentialPasswordConfirm(e.target.value)}
                        placeholder="Confirm password" />
                    </label>
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <button type="button" onClick={generateCredentialPassword}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-2 rounded-lg hover:bg-slate-100"
                    >Generate Password</button>
                    <button type="button" disabled={credentialSaving} onClick={saveCredential}
                      className="bg-slate-900 text-white rounded-xl px-5 py-2 text-sm font-medium disabled:opacity-50"
                    >{credentialSaving ? 'Saving...' : 'Save Credential'}</button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {section === 'reports' ? (
        <div className="space-y-6 flex-1 min-h-0 overflow-auto">
          {/* Filter Header */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-wrap gap-4 items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Reporting & Analytics</h2>
              <p className="text-sm text-slate-500">Comprehensive system performance and academic metrics.</p>
            </div>
            <div className="flex gap-3">
              <select
                className="border rounded-lg px-3 py-2 text-sm"
                value={reportFilters.year}
                onChange={(e) => setReportFilters(prev => ({ ...prev, year: e.target.value }))}
              >
                <option value="">All Years</option>
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select
                className="border rounded-lg px-3 py-2 text-sm"
                value={reportFilters.courseId}
                onChange={(e) => setReportFilters(prev => ({ ...prev, courseId: e.target.value }))}
              >
                <option value="">All Courses</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <button
                onClick={loadReports}
                className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium"
              >
                Refresh
              </button>
            </div>
          </div>

          {reportLoading && !reportStats ? (
            <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div></div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-gold-50 rounded-lg text-gold-600"><Users className="w-6 h-6" /></div>
                    <span className="text-xs font-medium text-slate-500 uppercase">Students</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{reportStats?.students?.total_students || 0}</div>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full">{reportStats?.students?.active_students} Active</span>
                    <span className="text-xs px-2 py-0.5 bg-slate-50 text-slate-600 rounded-full">{reportStats?.students?.prospective_students} Pros.</span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-gold-100 rounded-lg text-gold-600"><BookOpen className="w-6 h-6" /></div>
                    <span className="text-xs font-medium text-slate-500 uppercase">Courses</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{reportStats?.courses?.total_courses || 0}</div>
                  <div className="text-xs text-slate-500 mt-2">{reportStats?.courses?.active_courses} Currently active</div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-orange-50 rounded-lg text-orange-600"><ClipboardCheck className="w-6 h-6" /></div>
                    <span className="text-xs font-medium text-slate-500 uppercase">Attendance</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{attendanceReport?.summary?.avg_attendance_rate || 0}%</div>
                  <div className="text-xs text-slate-500 mt-2">Average across all sessions</div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><GraduationCap className="w-6 h-6" /></div>
                    <span className="text-xs font-medium text-slate-500 uppercase">Graduation</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{reportStats?.students?.graduating_students || 0}</div>
                  <div className="text-xs text-slate-500 mt-2">Candidates for completion</div>
                </div>
              </div>

              {/* Attendance Table */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="font-semibold text-slate-900">Attendance & Eligibility Detail</h3>
                  <div className="flex gap-4 text-sm text-slate-500">
                    <span>Eligible: <b className="text-green-600">{attendanceReport?.summary?.eligible_students}</b></span>
                    <span>Ineligible: <b className="text-red-600">{attendanceReport?.summary?.ineligible_students}</b></span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] font-semibold tracking-wider">
                      <tr>
                        <th className="px-6 py-4">Student</th>
                        <th className="px-6 py-4">Course</th>
                        <th className="px-6 py-4">Sessions</th>
                        <th className="px-6 py-4">Present</th>
                        <th className="px-6 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {attendanceReport?.data?.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-900">{row.full_name}</td>
                          <td className="px-6 py-4 text-slate-600">{row.course_title}</td>
                          <td className="px-6 py-4">{row.total_sessions}</td>
                          <td className="px-6 py-4">{row.present_count}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${
                              row.eligibility_status === 'Eligible'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {row.eligibility_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
      {section === 'prospective-students' ? (
        <div className="space-y-6 flex-1 min-h-0 overflow-auto">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Prospective Students</h2>
            <p className="text-sm text-slate-500 mt-1">Students created from approved form submissions.</p>
          </div>

          {prospectiveStudentsLoading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="data-table w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 font-medium text-slate-700">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-700">Email</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-700">Form</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-700">Cohort</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-700">Submitted</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prospectiveStudents.map((s) => (
                      <tr key={s.student_id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">{s.full_name}</td>
                        <td className="px-4 py-3 text-slate-600">{s.email}</td>
                        <td className="px-4 py-3 text-slate-600">{s.form_title || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {s.cohort_name || '-'}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!prospectiveStudents.length && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                          No prospective students yet. Approve submissions on student application forms to create them.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {section === 'forms' ? (
        <div className="space-y-6 flex-1 min-h-0 overflow-auto">
          {/* Forms header */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Form Builder</h2>
              <p className="text-sm text-slate-500 mt-1">Create dynamic forms for applications, onboarding, and surveys. Graduation calendar is under Graduation.</p>
            </div>
            <button
              type="button"
              onClick={() => { setEditingForm(null); setFormBuilderOpen(true) }}
              className="bg-slate-900 text-white rounded-xl px-4 py-2 text-sm"
            >
              New Form
            </button>
          </div>

          {/* Forms list */}
          {formsLoading ? (
            <p className="text-sm text-slate-500">Loading forms...</p>
          ) : (
            <div className="grid gap-4">
              {forms.map((form) => (
                <div key={form.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-slate-900">{form.title}</h3>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          form.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                          form.status === 'closed' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {form.status}
                        </span>
                      </div>
                      {form.description && <p className="text-sm text-slate-500 mt-1">{form.description}</p>}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {form.maps_to_student && (
                          <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-sky-100 text-sky-700">
                            Student Application
                          </span>
                        )}
                        {form.cohort_name && (
                          <span className="text-xs text-slate-400">Cohort: {form.cohort_name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                        <span>Slug: <code className="bg-slate-100 px-1.5 py-0.5 rounded">{form.slug}</code></span>
                        <span>{form.submission_count || 0} submissions</span>
                        <span>{form.fields?.length || 0} fields</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <code className="text-xs bg-sky-50 text-sky-700 px-2 py-1 rounded-lg border border-sky-200 break-all">
                          {window.location.origin}/forms/{form.slug}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/forms/${form.slug}`)
                            setCopiedFormId(form.id)
                            setTimeout(() => setCopiedFormId(null), 2000)
                          }}
                          className={`text-xs rounded-lg px-2.5 py-1.5 shrink-0 transition-colors ${
                            copiedFormId === form.id
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-sky-100 text-sky-700 hover:bg-sky-200'
                          }`}
                          title="Copy public link"
                        >
                          {copiedFormId === form.id ? 'Copied!' : 'Copy Link'}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleFormStatus(form)}
                        className={`text-xs rounded-lg px-3 py-1.5 hover:brightness-95 ${
                          form.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-emerald-600 text-white'
                        }`}
                        title={form.status === 'active' ? 'Stop accepting submissions' : 'Start accepting submissions'}
                      >
                        {form.status === 'active' ? 'Close' : 'Open'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSelectedFormForSubmissions(form.id); loadFormSubmissions(form.id) }}
                        className="text-xs bg-slate-100 text-slate-700 rounded-lg px-3 py-1.5 hover:bg-slate-200"
                      >
                        View Submissions
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingForm(form); setFormBuilderOpen(true) }}
                        className="text-xs bg-sky-100 text-sky-700 rounded-lg px-3 py-1.5 hover:bg-sky-200"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteForm(form.id)}
                        className="text-xs bg-red-50 text-red-600 rounded-lg px-3 py-1.5 hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {!forms.length && !formsLoading && (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
                  <p className="text-slate-500">No forms yet. Create your first form to get started.</p>
                </div>
              )}
            </div>
          )}

          {/* Submissions drawer */}
          {selectedFormForSubmissions && (
            <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
              <div className="bg-white w-full max-w-3xl h-full overflow-y-auto shadow-2xl">
                <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Submissions</h3>
                  <button type="button" onClick={() => setSelectedFormForSubmissions(null)} className="rounded-lg p-1 hover:bg-slate-100">
                    <X size={18} />
                  </button>
                </div>
                <div className="p-5">
                  {submissionsLoading ? (
                    <p className="text-sm text-slate-500">Loading submissions...</p>
                  ) : (
                    <div className="space-y-4">
                      {formSubmissions.map((sub) => (
                        <div key={sub.id} className="border border-slate-200 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="font-medium text-slate-900">{sub.submitter_name || 'Anonymous'}</p>
                              {sub.submitter_email && <p className="text-xs text-slate-500">{sub.submitter_email}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                sub.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                sub.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                sub.status === 'reviewed' ? 'bg-sky-100 text-sky-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {sub.status}
                              </span>
                              <span className="text-xs text-slate-400">{new Date(sub.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          {/* Submission data */}
                          <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1 mb-3">
                            {Object.entries(sub.data || {}).map(([key, value]) => (
                              <div key={key} className="flex gap-2">
                                <span className="text-slate-500 shrink-0">#{key}:</span>
                                <span className="text-slate-800">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                          {/* Review actions */}
                          {sub.status === 'submitted' && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => reviewSubmission(sub.id, 'approved')}
                                className="text-xs bg-emerald-600 text-white rounded-lg px-3 py-1.5 hover:bg-emerald-700"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => reviewSubmission(sub.id, 'rejected')}
                                className="text-xs bg-red-600 text-white rounded-lg px-3 py-1.5 hover:bg-red-700"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                          {sub.review_notes && (
                            <p className="text-xs text-slate-500 mt-2">Notes: {sub.review_notes}</p>
                          )}
                        </div>
                      ))}
                      {!formSubmissions.length && !submissionsLoading && (
                        <p className="text-sm text-slate-400 text-center py-8">No submissions yet.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Form Builder Drawer */}
          {formBuilderOpen && (
            <FormBuilderDrawer
              form={editingForm}
              batches={batches}
              onClose={() => { setFormBuilderOpen(false); setEditingForm(null) }}
              onSave={saveForm}
            />
          )}
        </div>
      ) : null}

      {/* ── Edit Session Modal ─────────────────────────────────────── */}
      {editingSession ? (() => {
        const presentList = editingSession.roster.filter((s) => s.present)
        const absentList  = editingSession.roster.filter((s) => !s.present)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                <div>
                  <h3 className="font-semibold text-slate-900">
                    Class {editingSession.session.class_number} — Session Details
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {new Date(editingSession.session.start_time).toLocaleString()}
                    {editingSession.session.end_time
                      ? ` – ${new Date(editingSession.session.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setEditingSession(null); setShowDeleteSessionConfirm(false); setDeleteSessionReason('') }}
                  className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-500"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Summary bar */}
              <div className="flex gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-sm">
                <span className="text-emerald-700 font-medium">{presentList.length} present</span>
                <span className="text-slate-400">·</span>
                <span className="text-red-600 font-medium">{absentList.length} absent</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-600">{editingSession.roster.length} total</span>
              </div>

              {/* Roster body */}
              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
                {editSessionLoading ? (
                  <p className="text-sm text-slate-500">Loading roster…</p>
                ) : (
                  <>
                    {/* Present */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-2">
                        Present ({presentList.length})
                      </p>
                      {presentList.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No students marked present</p>
                      ) : (
                        <ul className="space-y-1">
                          {presentList.map((s) => (
                            <li key={s.student_id} className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
                              <div>
                                <span className="text-sm font-medium text-slate-800">{s.full_name}</span>
                                {s.matric_no && <span className="ml-2 text-xs text-slate-400">{s.matric_no}</span>}
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleSessionAttendance(editingSession.session.id, s.student_id)}
                                className="text-xs rounded-lg px-3 py-1 bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                              >
                                Mark Absent
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Absent */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-red-600 mb-2">
                        Absent ({absentList.length})
                      </p>
                      {absentList.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">All students are marked present</p>
                      ) : (
                        <ul className="space-y-1">
                          {absentList.map((s) => (
                            <li key={s.student_id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                              <div>
                                <span className="text-sm font-medium text-slate-800">{s.full_name}</span>
                                {s.matric_no && <span className="ml-2 text-xs text-slate-400">{s.matric_no}</span>}
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleSessionAttendance(editingSession.session.id, s.student_id)}
                                className="text-xs rounded-lg px-3 py-1 bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                              >
                                Mark Present
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Delete session */}
                    <div className="pt-3 border-t border-red-100">
                      {!showDeleteSessionConfirm ? (
                        <button
                          type="button"
                          onClick={() => setShowDeleteSessionConfirm(true)}
                          className="text-xs text-red-600 underline hover:text-red-800"
                        >
                          Delete this attendance session…
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-red-700">Delete Session</p>
                          <p className="text-xs text-slate-500">
                            This will permanently remove the session and all attendance records for Class {editingSession.session.class_number}. This cannot be undone.
                          </p>
                          <textarea
                            className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                            rows={2}
                            placeholder="Reason for deletion (required)"
                            value={deleteSessionReason}
                            onChange={(e) => setDeleteSessionReason(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={deleteSession}
                              disabled={!deleteSessionReason.trim()}
                              className="rounded-lg px-4 py-1.5 bg-red-600 text-white text-sm disabled:opacity-50 hover:bg-red-700"
                            >
                              Confirm Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => { setShowDeleteSessionConfirm(false); setDeleteSessionReason('') }}
                              className="rounded-lg px-4 py-1.5 bg-slate-100 text-slate-700 text-sm hover:bg-slate-200"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-slate-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => { setEditingSession(null); setShowDeleteSessionConfirm(false); setDeleteSessionReason('') }}
                  className="rounded-lg px-4 py-2 bg-slate-900 text-white text-sm"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )
      })() : null}
      </div>
    </AppShell>
  )
}

export default LecturerDashboard

const FIELD_TYPES = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'multiselect', label: 'Multi-Select' },
  { value: 'radio', label: 'Radio Buttons' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'graduate_select', label: 'Graduate Student (dropdown)' },
  { value: 'availability', label: 'Availability / Calendar slots' },
]

const GRADUATION_CALENDAR_TEMPLATE = {
  title: 'Graduation Calendar — Rector Meeting',
  slug: 'graduation-calendar',
  description: 'Select your name and book a unique time slot to meet with the Rector.',
  status: 'draft',
  mapsToStudent: false,
  fields: [
    {
      fieldType: 'graduate_select',
      label: 'Graduate name',
      placeholder: 'Select your name',
      required: true,
      options: [],
      validation: {},
      section: 'Student',
      width: 'full',
      fieldConditions: null,
      mapsToColumn: '',
    },
    {
      fieldType: 'email',
      label: 'Email',
      placeholder: 'Your email',
      required: true,
      options: [],
      validation: {},
      section: 'Student',
      width: 'half',
      fieldConditions: null,
      mapsToColumn: '',
    },
    {
      fieldType: 'phone',
      label: 'Phone',
      placeholder: 'Your phone number',
      required: false,
      options: [],
      validation: {},
      section: 'Student',
      width: 'half',
      fieldConditions: null,
      mapsToColumn: '',
    },
    {
      fieldType: 'availability',
      label: 'Meeting date & time',
      placeholder: '',
      required: true,
      options: [
        {
          value: '__recurring__',
          label: 'Rector meeting slot',
          recurring: {
            weekdays: [1, 2, 3, 4, 5],
            startTime: '09:00',
            endTime: '16:00',
            slotMinutes: 30,
            capacity: 1,
            weeksAhead: 4,
          },
        },
      ],
      validation: {},
      section: 'Booking',
      width: 'full',
      fieldConditions: null,
      mapsToColumn: '',
    },
    {
      fieldType: 'textarea',
      label: 'Notes for the Rector (optional)',
      placeholder: 'Anything you would like to discuss…',
      required: false,
      options: [],
      validation: {},
      section: 'Booking',
      width: 'full',
      fieldConditions: null,
      mapsToColumn: '',
    },
  ],
}

function FormBuilderDrawer({ form, onClose, onSave }) {
  const [title, setTitle] = useState(form?.title || '')
  const [slug, setSlug] = useState(form?.slug || '')
  const [description, setDescription] = useState(form?.description || '')
  const [status, setStatus] = useState(form?.status || 'draft')
  const [mapsToStudent, setMapsToStudent] = useState(form?.maps_to_student || false)
  const [cohortId, setCohortId] = useState(form?.cohort_id || '')
  const [cohorts, setCohorts] = useState([])
  const [showCreateCohort, setShowCreateCohort] = useState(false)
  const [newCohort, setNewCohort] = useState({ name: '', startDate: '', endDate: '' })
  const [fields, setFields] = useState(
    form?.fields?.map((f) => ({
      id: f.id,
      fieldType: f.field_type || f.fieldType,
      label: f.label,
      placeholder: f.placeholder || '',
      required: f.required || false,
      options: f.options || [],
      validation: f.validation || {},
      section: f.section || '',
      width: f.width || 'full',
      fieldConditions: f.field_conditions || f.fieldConditions || null,
      mapsToColumn: f.maps_to_column || f.mapsToColumn || '',
    })) || []
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiClient.get('/cohorts').then(res => setCohorts(res.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!mapsToStudent) return
    setFields(prev => {
      const hasName = prev.some(f => f.mapsToColumn === 'full_name')
      const hasEmail = prev.some(f => f.mapsToColumn === 'email')
      const hasPhone = prev.some(f => f.mapsToColumn === 'phone')
      if (hasName && hasEmail && hasPhone) return prev
      const autoFields = []
      if (!hasName) autoFields.push({ fieldType: 'text', label: 'Full Name', placeholder: 'Enter your full name', required: true, options: [], validation: {}, section: '', width: 'full', fieldConditions: null, mapsToColumn: 'full_name' })
      if (!hasEmail) autoFields.push({ fieldType: 'email', label: 'Email', placeholder: 'Enter your email', required: true, options: [], validation: {}, section: '', width: 'half', fieldConditions: null, mapsToColumn: 'email' })
      if (!hasPhone) autoFields.push({ fieldType: 'phone', label: 'Phone Number', placeholder: 'Enter your phone number', required: true, options: [], validation: {}, section: '', width: 'half', fieldConditions: null, mapsToColumn: 'phone' })
      return [...autoFields, ...prev]
    })
  }, [mapsToStudent])

  const addField = () => {
    setFields((prev) => [
      ...prev,
      { fieldType: 'text', label: '', placeholder: '', required: false, options: [], validation: {}, section: '', width: 'full', fieldConditions: null, mapsToColumn: '' },
    ])
  }

  const removeField = (index) => {
    setFields((prev) => prev.filter((_, i) => i !== index))
  }

  const moveFieldUp = (index) => {
    if (index === 0) return
    setFields((prev) => {
      const next = [...prev]
      const temp = next[index - 1]
      next[index - 1] = next[index]
      next[index] = temp
      return next
    })
  }

  const moveFieldDown = (index) => {
    setFields((prev) => {
      if (index >= prev.length - 1) return prev
      const next = [...prev]
      const temp = next[index + 1]
      next[index + 1] = next[index]
      next[index] = temp
      return next
    })
  }

  const handleCreateCohort = async (e) => {
    e.preventDefault()
    if (!newCohort.name) return
    try {
      const res = await apiClient.post('/cohorts', newCohort)
      setCohorts(prev => [...prev, res.data])
      setCohortId(String(res.data.id))
      setShowCreateCohort(false)
      setNewCohort({ name: '', startDate: '', endDate: '' })
    } catch (err) {
      alert(err?.response?.data?.message || 'Failed to create student batch')
    }
  }

  const updateField = (index, updates) => {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...updates } : f)))
  }

  const addOption = (fieldIndex) => {
    setFields((prev) =>
      prev.map((f, i) =>
        i === fieldIndex ? { ...f, options: [...f.options, { label: '', value: '' }] } : f
      )
    )
  }

  const getRecurring = (field) => (field?.options || []).find((o) => o && o.recurring) || null

  const updateRecurring = (fieldIndex, updates) => {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== fieldIndex) return f
        const existing = (f.options || []).find((o) => o && o.recurring)
        const rest = (f.options || []).filter((o) => !o || !o.recurring)
        const base = existing || { value: '__recurring__', label: '', recurring: { weekdays: [3], startTime: '09:00', endTime: '17:00', slotMinutes: 60, capacity: 1, weeksAhead: 4 } }
        const next = { ...base, recurring: { ...base.recurring, ...updates } }
        return { ...f, options: [...rest, next] }
      })
    )
  }

  const updateRecurringMeta = (fieldIndex, updates) => {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== fieldIndex) return f
        const existing = (f.options || []).find((o) => o && o.recurring)
        if (!existing) return f
        const rest = (f.options || []).filter((o) => !o || !o.recurring)
        return { ...f, options: [...rest, { ...existing, ...updates }] }
      })
    )
  }

  const addSlot = (fieldIndex) => {
    const idx = fields[fieldIndex]?.options?.length || 0
    setFields((prev) =>
      prev.map((f, i) =>
        i === fieldIndex
          ? { ...f, options: [...f.options, { label: '', value: `slot_${idx + 1}`, date: '', start: '', end: '', capacity: 1 }] }
          : f
      )
    )
  }

  const updateOption = (fieldIndex, optIndex, updates) => {
    setFields((prev) =>
      prev.map((f, i) =>
        i === fieldIndex
          ? {
              ...f,
              options: f.options.map((o, j) => (j === optIndex ? { ...o, ...updates } : o)),
            }
          : f
      )
    )
  }

  const removeOption = (fieldIndex, optIndex) => {
    setFields((prev) =>
      prev.map((f, i) =>
        i === fieldIndex ? { ...f, options: f.options.filter((_, j) => j !== optIndex) } : f
      )
    )
  }

  const removeRecurring = (fieldIndex) => {
    setFields((prev) =>
      prev.map((f, i) => (i === fieldIndex ? { ...f, options: (f.options || []).filter((o) => !o || !o.recurring) } : f))
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim() || !slug.trim()) return
    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        slug: slug.trim(),
        description: description.trim(),
        status,
        mapsToStudent,
        cohortId: cohortId ? Number(cohortId) : null,
        fields: fields.map((f) => ({
          fieldType: f.fieldType,
          label: f.label,
          placeholder: f.placeholder,
          required: f.required,
          options: f.options,
          validation: f.validation,
          section: f.section,
          width: f.width,
          fieldConditions: f.fieldConditions,
          mapsToColumn: f.mapsToColumn || null,
        })),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="bg-white w-full max-w-3xl h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">{form ? 'Edit Form' : 'Create Form'}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-6">
          {/* Basic info */}
          <div className="space-y-3">
            <label className="text-sm text-slate-600 block">
              Title *
              <input
                className="mt-1 w-full border rounded-lg px-3 py-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>
            <label className="text-sm text-slate-600 block">
              Slug *
              <input
                className="mt-1 w-full border rounded-lg px-3 py-2"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                placeholder="e.g. student-application"
                required
              />
            </label>
            <label className="text-sm text-slate-600 block">
              Description
              <textarea
                className="mt-1 w-full border rounded-lg px-3 py-2"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="text-sm text-slate-600 block">
              Status
              <select
                className="mt-1 w-full border rounded-lg px-3 py-2"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            {/* Form type presets */}
            <div className="pt-2 space-y-2">
              <p className="text-sm font-medium text-slate-700">Form type</p>
              <label className="flex items-start gap-3 text-sm text-slate-700 cursor-pointer rounded-xl border border-slate-200 px-3 py-2.5 hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded mt-0.5"
                  checked={mapsToStudent}
                  onChange={(e) => {
                    setMapsToStudent(e.target.checked)
                    if (e.target.checked && form?._template === 'graduation_calendar') {
                      // switching away from graduation template flag when marking as student app
                    }
                  }}
                />
                <span>
                  <span className="font-medium block">Student Application Form</span>
                  <span className="text-xs text-slate-400">Auto-creates a student record on approval</span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-700 cursor-pointer rounded-xl border border-slate-200 px-3 py-2.5 hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded mt-0.5"
                  checked={!!(form?._template === 'graduation_calendar' || fields.some((f) => f.fieldType === 'graduate_select' || f.fieldType === 'availability'))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setMapsToStudent(false)
                      setTitle((t) => t || GRADUATION_CALENDAR_TEMPLATE.title)
                      setSlug((s) => s || GRADUATION_CALENDAR_TEMPLATE.slug)
                      setDescription((d) => d || GRADUATION_CALENDAR_TEMPLATE.description)
                      setFields((prev) => {
                        if (prev.some((f) => f.fieldType === 'graduate_select' || f.fieldType === 'availability')) return prev
                        return GRADUATION_CALENDAR_TEMPLATE.fields.map((f) => ({ ...f }))
                      })
                    } else {
                      setFields((prev) => prev.filter((f) => f.fieldType !== 'graduate_select' && f.fieldType !== 'availability'))
                    }
                  }}
                />
                <span>
                  <span className="font-medium block">Graduation Calendar Form</span>
                  <span className="text-xs text-slate-400">Graduate dropdown + unique date/time booking slots</span>
                </span>
              </label>
            </div>
            {mapsToStudent && (
              <div className="pl-7 space-y-3">
                <label className="text-sm text-slate-600 block">
                  Target Cohort (Student Batch) *
                  <select
                    className="mt-1 w-full border rounded-lg px-3 py-2"
                    value={cohortId}
                    onChange={(e) => {
                      if (e.target.value === '__new__') {
                        setShowCreateCohort(true)
                      } else {
                        setCohortId(e.target.value)
                      }
                    }}
                    required={mapsToStudent}
                  >
                    <option value="">Select a cohort...</option>
                    {cohorts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.start_date ? ` (${new Date(c.start_date).toLocaleDateString()})` : ''}
                      </option>
                    ))}
                    <option value="__new__">+ Create New Cohort</option>
                  </select>
                </label>
                <p className="text-xs text-slate-400">
                  Map field columns below in each field's settings to define which submission data creates the student record.
                </p>
              </div>
            )}

            {/* Create Cohort Modal */}
            {showCreateCohort && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                  <h3 className="font-semibold text-slate-900 mb-4">Create New Cohort (Student Batch)</h3>
                  <div className="space-y-3">
                    <label className="text-sm text-slate-600 block">
                      Name *
                      <input
                        className="mt-1 w-full border rounded-lg px-3 py-2"
                        value={newCohort.name}
                        onChange={(e) => setNewCohort(p => ({ ...p, name: e.target.value }))}
                        placeholder="e.g. 2026 Fall Intake"
                        required
                      />
                    </label>
                    <label className="text-sm text-slate-600 block">
                      Start Date
                      <input
                        type="date"
                        className="mt-1 w-full border rounded-lg px-3 py-2"
                        value={newCohort.startDate}
                        onChange={(e) => setNewCohort(p => ({ ...p, startDate: e.target.value }))}
                      />
                    </label>
                    <label className="text-sm text-slate-600 block">
                      End Date
                      <input
                        type="date"
                        className="mt-1 w-full border rounded-lg px-3 py-2"
                        value={newCohort.endDate}
                        onChange={(e) => setNewCohort(p => ({ ...p, endDate: e.target.value }))}
                      />
                    </label>
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={handleCreateCohort}
                      className="bg-slate-900 text-white rounded-xl px-6 py-2 text-sm"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateCohort(false)}
                      className="bg-slate-100 text-slate-700 rounded-xl px-6 py-2 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Fields */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-slate-900">Fields ({fields.length})</h4>
              <button type="button" onClick={addField} className="text-sm bg-slate-900 text-white rounded-lg px-3 py-1.5">
                Add Field
              </button>
            </div>

            <div className="space-y-4">
              {fields.map((field, idx) => (
                <div key={idx} className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => moveFieldUp(idx)} disabled={idx === 0} className="text-xs text-slate-400 hover:text-slate-700 disabled:opacity-30" title="Move up">▲</button>
                      <button type="button" onClick={() => moveFieldDown(idx)} disabled={idx >= fields.length - 1} className="text-xs text-slate-400 hover:text-slate-700 disabled:opacity-30" title="Move down">▼</button>
                      <span className="text-xs font-medium text-slate-500 ml-1">Field #{idx + 1}</span>
                    </div>
                    <button type="button" onClick={() => removeField(idx)} className="text-xs text-red-500 hover:underline">
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-sm text-slate-600 block">
                      Type
                      <select
                        className="mt-1 w-full border rounded-lg px-3 py-2"
                        value={field.fieldType}
                        onChange={(e) => updateField(idx, { fieldType: e.target.value })}
                      >
                        {FIELD_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm text-slate-600 block">
                      Width
                      <select
                        className="mt-1 w-full border rounded-lg px-3 py-2"
                        value={field.width}
                        onChange={(e) => updateField(idx, { width: e.target.value })}
                      >
                        <option value="full">Full Width</option>
                        <option value="half">Half Width</option>
                        <option value="third">Third Width</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-sm text-slate-600 block">
                      Section (optional)
                      <input
                        className="mt-1 w-full border rounded-lg px-3 py-2"
                        value={field.section}
                        onChange={(e) => updateField(idx, { section: e.target.value })}
                        placeholder="e.g. Personal Info"
                      />
                    </label>
                    {mapsToStudent && (
                      <label className="text-sm text-slate-600 block">
                        Maps to student column
                        <select
                          className="mt-1 w-full border rounded-lg px-3 py-2"
                          value={field.mapsToColumn}
                          onChange={(e) => updateField(idx, { mapsToColumn: e.target.value })}
                        >
                          <option value="">-- Not mapped --</option>
                          <option value="full_name">Full Name</option>
                          <option value="email">Email</option>
                          <option value="phone">Phone</option>
                          <option value="comments">Comments</option>
                        </select>
                      </label>
                    )}
                  </div>

                  <label className="text-sm text-slate-600 block">
                    Label *
                    <input
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                      value={field.label}
                      onChange={(e) => updateField(idx, { label: e.target.value })}
                      required
                    />
                  </label>

                  <label className="text-sm text-slate-600 block">
                    Placeholder
                    <input
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                      value={field.placeholder}
                      onChange={(e) => updateField(idx, { placeholder: e.target.value })}
                    />
                  </label>

                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-3 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded"
                        checked={field.required}
                        onChange={(e) => updateField(idx, { required: e.target.checked })}
                      />
                      Required
                    </label>
                  </div>

                  {/* Conditional visibility */}
                  <details className="text-sm">
                    <summary className="cursor-pointer text-slate-500 hover:text-slate-700 font-medium">
                      Conditional visibility
                    </summary>
                    <div className="mt-2 space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
                      {field.fieldConditions ? (
                        <>
                          <label className="text-sm text-slate-600 block">
                            Show when field
                            <select
                              className="mt-1 w-full border rounded-lg px-3 py-2"
                              value={field.fieldConditions.fieldId || ''}
                              onChange={(e) => {
                                const cond = { ...field.fieldConditions, fieldId: Number(e.target.value) }
                                updateField(idx, { fieldConditions: cond })
                              }}
                            >
                              <option value="">Select a field...</option>
                              {fields.filter((_, i) => i !== idx).map((f, i) => (
                                <option key={i} value={f.id || `_idx_${i}`}>
                                  {f.label || `Field #${i + 1}`}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-sm text-slate-600 block">
                            Operator
                            <select
                              className="mt-1 w-full border rounded-lg px-3 py-2"
                              value={field.fieldConditions.operator || 'equals'}
                              onChange={(e) => {
                                const cond = { ...field.fieldConditions, operator: e.target.value }
                                updateField(idx, { fieldConditions: cond })
                              }}
                            >
                              <option value="equals">equals</option>
                              <option value="not_equals">not equals</option>
                              <option value="contains">contains</option>
                              <option value="is_checked">is checked</option>
                            </select>
                          </label>
                          <label className="text-sm text-slate-600 block">
                            Value
                            <input
                              className="mt-1 w-full border rounded-lg px-3 py-2"
                              value={field.fieldConditions.value || ''}
                              onChange={(e) => {
                                const cond = { ...field.fieldConditions, value: e.target.value }
                                updateField(idx, { fieldConditions: cond })
                              }}
                              placeholder="Value to match"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => updateField(idx, { fieldConditions: null })}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Remove condition
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => updateField(idx, { fieldConditions: { fieldId: '', operator: 'equals', value: '' } })}
                          className="text-xs text-sky-600 hover:underline"
                        >
                          + Add condition
                        </button>
                      )}
                    </div>
                  </details>

                  {/* Options for select/multiselect/radio */}
                  {['select', 'multiselect', 'radio'].includes(field.fieldType) && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">Options</span>
                        <button type="button" onClick={() => addOption(idx)} className="text-xs text-sky-600 hover:underline">
                          + Add Option
                        </button>
                      </div>
                      {field.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <input
                            className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                            placeholder="Label"
                            value={opt.label}
                            onChange={(e) => updateOption(idx, optIdx, { label: e.target.value })}
                          />
                          <input
                            className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                            placeholder="Value"
                            value={opt.value}
                            onChange={(e) => updateOption(idx, optIdx, { value: e.target.value })}
                          />
                          <button type="button" onClick={() => removeOption(idx, optIdx)} className="text-xs text-red-500">
                            ×
                          </button>
                        </div>
                      ))}
                      {!field.options.length && (
                        <p className="text-xs text-slate-400">No options added yet.</p>
                      )}
                    </div>
                  )}

                  {/* Availability slot editor */}
                  {field.fieldType === 'availability' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">Time Slots (Calendly)</span>
                        <span className="text-xs text-slate-400">Recurring availability + one-off slots</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Students pick one slot when they submit. Capacity stops a slot once it's fully booked (set 1 for a personal one-on-one booking).
                      </p>

                      {/* Recurring weekly availability */}
                      {(() => {
                        const rec = getRecurring(field)
                        const r = rec?.recurring || {}
                        return (
                          <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-white">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                                <input
                                  type="checkbox"
                                  checked={!!rec}
                                  onChange={(e) => (e.target.checked ? updateRecurring(idx, {}) : removeRecurring(idx))}
                                  className="accent-sky-600"
                                />
                                Recurring weekly availability
                              </label>
                              {rec && (
                                <button type="button" onClick={() => removeRecurring(idx)} className="text-xs text-red-500 hover:underline">
                                  Remove
                                </button>
                              )}
                            </div>
                            {rec && (
                              <>
                                <div>
                                  <p className="text-xs text-slate-600 mb-1.5">Days of the week</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName, d) => {
                                      const dayNum = d + 1
                                      const active = (r.weekdays || []).includes(dayNum)
                                      return (
                                        <button
                                          key={dayNum}
                                          type="button"
                                          onClick={() =>
                                            updateRecurring(
                                              idx,
                                              active
                                                ? { weekdays: (r.weekdays || []).filter((x) => x !== dayNum) }
                                                : { weekdays: [...(r.weekdays || []), dayNum] }
                                            )
                                          }
                                          className={`rounded-lg px-2.5 py-1 text-xs border ${
                                            active ? 'bg-sky-600 text-white border-sky-600' : 'border-slate-200 text-slate-600'
                                          }`}
                                        >
                                          {dayName}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <label className="text-xs text-slate-600 block">
                                    Start time
                                    <input
                                      type="time"
                                      className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm"
                                      value={r.startTime || '09:00'}
                                      onChange={(e) => updateRecurring(idx, { startTime: e.target.value })}
                                    />
                                  </label>
                                  <label className="text-xs text-slate-600 block">
                                    End time
                                    <input
                                      type="time"
                                      className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm"
                                      value={r.endTime || '17:00'}
                                      onChange={(e) => updateRecurring(idx, { endTime: e.target.value })}
                                    />
                                  </label>
                                  <label className="text-xs text-slate-600 block">
                                    Slot length (min)
                                    <input
                                      type="number"
                                      min="15"
                                      step="15"
                                      className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm"
                                      value={r.slotMinutes || 60}
                                      onChange={(e) => updateRecurring(idx, { slotMinutes: Number(e.target.value) || 60 })}
                                    />
                                  </label>
                                  <label className="text-xs text-slate-600 block">
                                    Booking capacity per slot
                                    <input
                                      type="number"
                                      min="1"
                                      className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm"
                                      value={r.capacity || 1}
                                      onChange={(e) => updateRecurring(idx, { capacity: Number(e.target.value) || 1 })}
                                    />
                                  </label>
                                  <label className="text-xs text-slate-600 block col-span-2">
                                    Bookable for next (weeks)
                                    <input
                                      type="number"
                                      min="1"
                                      max="12"
                                      className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm"
                                      value={r.weeksAhead || 4}
                                      onChange={(e) => updateRecurring(idx, { weeksAhead: Number(e.target.value) || 4 })}
                                    />
                                  </label>
                                </div>
                                <label className="text-xs text-slate-600 block">
                                  Label (shown to students)
                                  <input
                                    className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm"
                                    placeholder="e.g. Weekly mentorship slot"
                                    value={rec.label || ''}
                                    onChange={(e) => updateRecurringMeta(idx, { label: e.target.value })}
                                  />
                                </label>
                              </>
                            )}
                          </div>
                        )
                      })()}

                      {/* One-off manual slots */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-sm font-medium text-slate-700">One-off slots</span>
                        <button type="button" onClick={() => addSlot(idx)} className="text-xs text-sky-600 hover:underline">
                          + Add Slot
                        </button>
                      </div>
                      {field.options.map((opt, optIdx) => (
                        opt.recurring ? null : (
                        <div key={optIdx} className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-xs text-slate-600 block">
                              Date
                              <input
                                type="date"
                                className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm"
                                value={opt.date || ''}
                                onChange={(e) => updateOption(idx, optIdx, { date: e.target.value })}
                              />
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="text-xs text-slate-600 block">
                                Start
                                <input
                                  type="time"
                                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm"
                                  value={opt.start || ''}
                                  onChange={(e) => updateOption(idx, optIdx, { start: e.target.value })}
                                />
                              </label>
                              <label className="text-xs text-slate-600 block">
                                End
                                <input
                                  type="time"
                                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm"
                                  value={opt.end || ''}
                                  onChange={(e) => updateOption(idx, optIdx, { end: e.target.value })}
                                />
                              </label>
                            </div>
                          </div>
                          <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
                            <label className="text-xs text-slate-600 block">
                              Label (shown to students)
                              <input
                                className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm"
                                placeholder="e.g. Meeting with the Rector"
                                value={opt.label}
                                onChange={(e) => updateOption(idx, optIdx, { label: e.target.value })}
                              />
                            </label>
                            <label className="text-xs text-slate-600 block w-20">
                              Capacity
                              <input
                                type="number"
                                min="1"
                                className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-sm"
                                value={opt.capacity || 1}
                                onChange={(e) => updateOption(idx, optIdx, { capacity: Number(e.target.value) || 1 })}
                              />
                            </label>
                            <button type="button" onClick={() => removeOption(idx, optIdx)} className="text-xs text-red-500 pb-1.5">
                              ×
                            </button>
                          </div>
                        </div>
                        )
                      ))}
                      {(() => {
                        const manualCount = (field.options || []).filter((o) => !o || !o.recurring).length
                        const rec = getRecurring(field)
                        return (!manualCount && !rec) ? (
                          <p className="text-xs text-slate-400">No time slots added yet.</p>
                        ) : null
                      })()}
                    </div>
                  )}
                </div>
              ))}
              {!fields.length && (
                <p className="text-sm text-slate-400 text-center py-4">No fields added yet. Click "Add Field" to start.</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-3 border-t border-slate-200">
            <button
              type="submit"
              disabled={saving || !title.trim() || !slug.trim()}
              className="bg-slate-900 text-white rounded-xl px-6 py-2 text-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : form ? 'Update Form' : 'Create Form'}
            </button>
            <button type="button" onClick={onClose} className="bg-slate-100 text-slate-700 rounded-xl px-6 py-2 text-sm">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
