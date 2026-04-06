import { useEffect, useMemo, useState } from 'react'
import { Download, MoreVertical, Upload, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/ui/Card'
import apiClient from '../api/client'
import { useAuth } from '../context/AuthContext'
import { lecturerNavItems } from '../constants/lecturerNav'
import { fmtDateRange } from '../utils/formatDate'

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
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [studentEditForm, setStudentEditForm] = useState(null)
  const [studentHistory, setStudentHistory] = useState({ enrollments: [], activities: [] })
  const [enrollmentNotesEdits, setEnrollmentNotesEdits] = useState({})
  const [loadingStudentHistory, setLoadingStudentHistory] = useState(false)
  const [newStatusInput, setNewStatusInput] = useState('')

  const [assignmentForm, setAssignmentForm] = useState({ title: '', description: '', dueDate: '', file: null })
  const [eligibleStudents, setEligibleStudents] = useState([])

  const [attendanceForm, setAttendanceForm] = useState({ date: '', startTime: '', endTime: '' })

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
  const [openGraduationActionFor, setOpenGraduationActionFor] = useState(null)

  const [courseStudents, setCourseStudents] = useState([])
  const [coursesView, setCoursesView] = useState('list') // 'list' | 'calendar'
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
  const [coursesTab, setCoursesTab] = useState('courses') // 'courses' | 'plans'
  const [plans, setPlans] = useState([])
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [planForm, setPlanForm] = useState({ name: '', year: new Date().getFullYear() })
  const [planItemForm, setPlanItemForm] = useState({ courseId: '', startDate: '', endDate: '' })
  const [planLoading, setPlanLoading] = useState(false)
  const [cohorts, setCohorts] = useState([])
  const [cohortForm, setCohortForm] = useState({ name: '', startDate: '', endDate: '' })
  const [editingCohortId, setEditingCohortId] = useState(null)
  const [cohortEditForm, setCohortEditForm] = useState({ name: '', startDate: '', endDate: '', status: 'active' })
  const [draggingCohortId, setDraggingCohortId] = useState(null)
  const [showBatchDrawer, setShowBatchDrawer] = useState(false)
  const [batchViewFilter, setBatchViewFilter] = useState('active')
  const [expandedCohortIds, setExpandedCohortIds] = useState(new Set())
  const [studentCohortFilter, setStudentCohortFilter] = useState('')
  const [graduationSearch, setGraduationSearch] = useState('')
  const [graduationMatrix, setGraduationMatrix] = useState({ courses: [], students: [] })
  const [graduationSortBy, setGraduationSortBy] = useState('progress')
  const [graduationStatusFilter, setGraduationStatusFilter] = useState('all')
  const [notice, setNotice] = useState('')

  const notify = (message) => {
    setNotice(message)
    setTimeout(() => setNotice(''), 3500)
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
      apiClient.get(`/attendance/course/${courseId}/students-summary?classNumber=${classNumber}`),
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

    if (!studentSearch.trim()) return result
    const lower = studentSearch.toLowerCase()
    return result.filter(
      (student) =>
        student.full_name.toLowerCase().includes(lower) ||
        student.email.toLowerCase().includes(lower) ||
        student.matric_no.toLowerCase().includes(lower)
    )
  }, [allStudents, studentSearch, studentCohortFilter])

  const filteredGraduationStudents = useMemo(() => {
    const query = graduationSearch.trim().toLowerCase()
    let rows = graduationMatrix.students || []

    if (graduationStatusFilter !== 'all') {
      rows = rows.filter((student) => student.status === graduationStatusFilter)
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
  }, [graduationMatrix.students, graduationSearch, graduationSortBy, graduationStatusFilter])

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

  const createCourse = async (event) => {
    event.preventDefault()
    try {
      await apiClient.post('/courses', {
        ...courseForm,
        lecturerId: user.id,
      })
      setCourseForm({ title: '', courseCode: '', lecturerName: '', durationWeeks: 6, minAttendanceRequired: 4 })
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
    const formData = new FormData()
    formData.append('file', studentUploadFile)
    const response = await apiClient.post('/students/upload', formData)
    await Promise.all([loadAllStudents(), loadCourseScopedData(selectedCourseId), loadGraduationMatrix()])
    notify(`Students uploaded: ${response.data.processed} processed`)
    setStudentUploadFile(null)
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
    setLoadingStudentHistory(true)
    try {
      const response = await apiClient.get(`/enrollments/student/${student.id}/history`)
      setStudentHistory(response.data)
      const notesMap = {}
      for (const enrollment of response.data.enrollments || []) {
        notesMap[enrollment.id] = enrollment.notes || ''
      }
      setEnrollmentNotesEdits(notesMap)
    } finally {
      setLoadingStudentHistory(false)
    }
  }

  const closeStudentPanel = () => {
    setSelectedStudent(null)
    setStudentEditForm(null)
    setStudentHistory({ enrollments: [], activities: [] })
    setEnrollmentNotesEdits({})
    setNewStatusInput('')
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
    })
    setAttendanceForm({ date: '', startTime: '', endTime: '' })
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

  const sectionTitle = {
    courses: 'Courses',
    students: 'Students',
    batches: 'Batches',
    attendance: 'Attendance',
    results: 'Results',
    graduation: 'Graduation',
    assignments: 'Assignments',
  }[section] || 'Lecturer Dashboard'

  return (
    <AppShell title={sectionTitle} navItems={lecturerNavItems}>
      {notice ? <div className="mb-4 rounded-lg bg-emerald-100 text-emerald-800 px-4 py-2 text-sm">{notice}</div> : null}

      {section === 'attendance' ? (
        <>
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
        </>
      ) : null}

      {section === 'courses' ? (
        <div className="space-y-6">
          {/* Tab switcher */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
            {['courses', 'plans'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setCoursesTab(tab)}
                className={`rounded-lg px-5 py-1.5 text-sm font-medium capitalize transition-colors ${coursesTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {tab === 'courses' ? 'Courses' : 'Plans'}
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
              Lecturer Name
              <input className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="Lecturer name" value={courseForm.lecturerName} onChange={(event) => setCourseForm((prev) => ({ ...prev, lecturerName: event.target.value }))} />
            </label>

            <label className="text-sm text-slate-600 block">
              Duration (weeks)
              <input className="mt-1 w-full border rounded-lg px-3 py-2" type="number" min="1" value={courseForm.durationWeeks} onChange={(event) => setCourseForm((prev) => ({ ...prev, durationWeeks: Number(event.target.value) }))} required />
            </label>

            <label className="text-sm text-slate-600 block">
              Minimum Attendance Required
              <input className="mt-1 w-full border rounded-lg px-3 py-2" type="number" min="0" value={courseForm.minAttendanceRequired} onChange={(event) => setCourseForm((prev) => ({ ...prev, minAttendanceRequired: Number(event.target.value) }))} required />
            </label>

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

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
            {/* View toggle */}
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h3 className="font-semibold text-slate-900">Course List</h3>
              <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                {['list', 'calendar'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCoursesView(v)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors capitalize ${
                      coursesView === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {v === 'list' ? 'List' : 'Timeline'}
                  </button>
                ))}
              </div>
            </div>

            {/* LIST VIEW */}
            {coursesView === 'list' ? (
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="pb-2">Code</th>
                    <th className="pb-2">Title</th>
                    <th>Lecturer</th>
                    <th>Schedule</th>
                    <th>Date Range</th>
                    <th>Weeks</th>
                    <th>Required Attendance</th>
                    <th>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <tr key={course.id} className={`border-t border-slate-200 ${course.is_current ? 'bg-amber-50' : ''}`}>
                      <td className="py-3">{course.course_code || '-'}</td>
                      <td className="py-3">
                        <Link to={`/lecturer/courses/${course.id}`} className="font-medium text-slate-900 hover:underline">
                          {course.title}
                        </Link>
                        {course.is_current ? (
                          <span className="ml-2 inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-800">Current</span>
                        ) : null}
                      </td>
                      <td>{course.lecturer_name || course.assigned_lecturer || '-'}</td>
                      <td>{course.class_day || '-'} {course.class_time || ''}</td>
                      <td>{fmtDateRange(course.start_date, course.end_date)}</td>
                      <td>{course.duration_weeks}</td>
                      <td>{course.min_attendance_required}</td>
                      <td>
                        {course.is_current ? (
                          <span className="text-xs text-amber-700 font-medium">Active</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCourseAsCurrent(course.id)}
                            className="rounded-lg px-2 py-1 text-xs bg-slate-100 text-slate-700 hover:bg-slate-200"
                          >
                            Set active
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!courses.length ? (
                    <tr><td colSpan={8} className="py-8 text-center text-slate-400">No courses yet. Create one using the form.</td></tr>
                  ) : null}
                </tbody>
              </table>
            ) : null}

            {/* CALENDAR / TIMELINE VIEW */}
            {coursesView === 'calendar' ? (() => {
              const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
              const COURSE_COLORS = [
                'bg-sky-500', 'bg-violet-500', 'bg-emerald-500', 'bg-rose-500',
                'bg-amber-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-teal-500',
              ]

              // Map each course to its bar position (left%, width%) within the year grid
              const yearStart = new Date(calendarYear, 0, 1)
              const yearEnd = new Date(calendarYear, 11, 31)
              const yearMs = yearEnd - yearStart + 86400000

              const bars = courses
                .filter((c) => {
                  if (!c.start_date && !c.end_date) return true // show undated at top
                  const s = c.start_date ? new Date(c.start_date) : null
                  const e = c.end_date ? new Date(c.end_date) : null
                  // show if overlaps this year
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
                <div>
                  {/* Year nav */}
                  <div className="flex items-center gap-3 mb-4">
                    <button type="button" onClick={() => setCalendarYear((y) => y - 1)} className="rounded-lg px-2 py-1 text-sm bg-slate-100 hover:bg-slate-200">◀</button>
                    <span className="font-semibold text-slate-900 text-sm">{calendarYear}</span>
                    <button type="button" onClick={() => setCalendarYear((y) => y + 1)} className="rounded-lg px-2 py-1 text-sm bg-slate-100 hover:bg-slate-200">▶</button>
                    <span className="text-xs text-slate-400 ml-2">Click a course bar to open it · Click a month header to schedule a new course starting that month</span>
                  </div>

                  {/* Month header */}
                  <div className="grid grid-cols-12 mb-1">
                    {MONTHS.map((m, i) => (
                      <button
                        key={m}
                        type="button"
                        title={`Start a new course in ${m} ${calendarYear}`}
                        className="text-center text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded py-1 transition-colors"
                        onClick={() => {
                          const d = `${calendarYear}-${String(i + 1).padStart(2, '0')}-01`
                          setCourseForm((prev) => ({ ...prev, startDate: d }))
                          setCoursesView('list')
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  {/* Month dividers background */}
                  <div className="relative border border-slate-200 rounded-xl overflow-hidden" style={{ minHeight: Math.max(bars.length * 44 + 16, 80) }}>
                    {/* vertical month lines */}
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

                    {/* Course bars */}
                    {bars.length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-8">No courses scheduled in {calendarYear}. Click a month header above to add one.</p>
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
                  <div className="mt-3 flex flex-wrap gap-3">
                    {bars.map((c) => (
                      <div key={c.id} className="flex items-center gap-1.5 text-xs text-slate-600">
                        <span className={`inline-block w-2.5 h-2.5 rounded-sm ${c.color}`} />
                        {c.title}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })() : null}
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
          const res = await apiClient.get(`/course-plans/${plan.id}`)
          setSelectedPlan(res.data)
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
        const deletePlan = async (planId) => {
          if (!window.confirm('Delete this plan?')) return
          await apiClient.delete(`/course-plans/${planId}`)
          if (selectedPlan?.id === planId) setSelectedPlan(null)
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

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                <h3 className="font-semibold text-slate-900 mb-3">All Plans</h3>
                {plans.length === 0 && !planLoading ? (
                  <p className="text-sm text-slate-400">No plans yet. Create one above.</p>
                ) : null}
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={`flex items-center justify-between rounded-xl px-3 py-3 cursor-pointer border transition-colors ${selectedPlan?.id === plan.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:bg-slate-50'}`}
                    onClick={() => openPlan(plan)}
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{plan.name}</p>
                      <p className="text-xs text-slate-500">{plan.year} · {plan.item_count} course{plan.item_count !== 1 ? 's' : ''}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deletePlan(plan.id) }}
                      className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded-lg hover:bg-red-50"
                    >
                      Delete
                    </button>
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
                  <div>
                    <h3 className="font-semibold text-slate-900 text-lg">{selectedPlan.name}</h3>
                    <p className="text-sm text-slate-500">{selectedPlan.year} · {selectedPlan.items?.length || 0} courses planned</p>
                  </div>

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

                  {/* Plan items */}
                  {selectedPlan.items?.length === 0 ? (
                    <p className="text-sm text-slate-400">No courses in this plan yet.</p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700">Planned Courses</p>
                      <table className="w-full text-sm">
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

    </div>
) : null}

      {section === 'courses' ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm mt-6 overflow-auto">
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
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr><th className="pb-2">Student</th><th>Matric</th><th>Enrollment</th><th>Result</th><th>Score</th><th>Notes</th></tr>
            </thead>
            <tbody>
              {batchStudents.map((student) => (
                <tr key={student.id} className="border-t border-slate-200">
                  <td className="py-3">
                    <Link to={`/lecturer/students/${student.student_id}`} className="font-medium text-slate-900 hover:underline">
                      {student.full_name}
                    </Link>
                  </td>
                  <td>{student.matric_no}</td>
                  <td>{student.status}</td>
                  <td>{student.result_status || '-'}</td>
                  <td>{student.score ?? '-'}</td>
                  <td>{student.notes || '-'}</td>
                </tr>
              ))}
              {!batchStudents.length ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">No students found for selected batch.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {section === 'students' ? (
        <div className="grid xl:grid-cols-[390px_1fr] gap-6">
          <div className="space-y-6">
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

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="font-semibold text-slate-900">Student Directory</h3>
              <div className="flex items-center gap-2">
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
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Search name/email/matric" value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} />
                <button
                  type="button"
                  onClick={exportStudentList}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
                >
                  <Download size={14} /> Export
                </button>
                <button
                  type="button"
                  onClick={() => setShowBatchDrawer(true)}
                  className="rounded-lg bg-slate-200 px-3 py-2 text-sm text-slate-700"
                >
                  Manage Batches
                </button>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr><th className="pb-2">Name</th><th>Matric</th><th>Phone</th><th>Email</th><th>Status</th><th>Batch</th><th>View</th></tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="border-t border-slate-200">
                    <td className="py-3">
                      <Link to={`/lecturer/students/${student.id}`} className="font-medium text-slate-900 hover:underline">
                        {student.full_name}
                      </Link>
                    </td>
                    <td>{student.matric_no || <span className="text-slate-400 text-xs italic">pending</span>}</td>
                    <td>{student.phone || '—'}</td>
                    <td>{student.email}</td>
                    <td>{student.status}</td>
                    <td>{student.cohort_name || <span className="text-slate-400">—</span>}</td>
                    <td>
                      <button onClick={() => openStudentPanel(student)} className="rounded-lg px-3 py-2 bg-slate-100 text-slate-700">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                <input className="w-full border rounded-lg px-3 py-2" value={studentEditForm.full_name || ''} onChange={(event) => setStudentEditForm((prev) => ({ ...prev, full_name: event.target.value }))} required />
                <input className="w-full border rounded-lg px-3 py-2" value={studentEditForm.email || ''} onChange={(event) => setStudentEditForm((prev) => ({ ...prev, email: event.target.value }))} required />
                <input className="w-full border rounded-lg px-3 py-2" value={studentEditForm.phone || ''} onChange={(event) => setStudentEditForm((prev) => ({ ...prev, phone: event.target.value }))} required />
                <input className="w-full border rounded-lg px-3 py-2" value={studentEditForm.matric_no || ''} onChange={(event) => setStudentEditForm((prev) => ({ ...prev, matric_no: event.target.value }))} />
                <textarea className="w-full border rounded-lg px-3 py-2" placeholder="Comments" rows={3} value={studentEditForm.comments || ''} onChange={(event) => setStudentEditForm((prev) => ({ ...prev, comments: event.target.value }))} />
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={studentEditForm.status || 'Active'}
                  onChange={(event) => {
                    const nextStatus = event.target.value
                    setStudentEditForm((prev) => ({
                      ...prev,
                      status: nextStatus,
                    }))
                  }}
                >
                  <option>Prospective</option>
                  <option>Active</option>
                  <option>Graduating</option>
                  <option>Graduated</option>
                  <option>Alumni</option>
                </select>

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

                <div className="pt-3 border-t border-red-100">
                  <button
                    type="button"
                    className="w-full bg-red-50 text-red-600 border border-red-200 rounded-lg py-2 text-sm font-medium hover:bg-red-100"
                    onClick={async () => {
                      if (!window.confirm(`Delete ${selectedStudent.full_name}? This cannot be undone.`)) return
                      await apiClient.delete(`/students/${selectedStudent.id}`)
                      setStudents((prev) => prev.filter((s) => s.id !== selectedStudent.id))
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
      ) : null}

      {section === 'batches' ? (
        <div className="grid lg:grid-cols-[390px_1fr] gap-6">
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
                upcoming: 'bg-blue-100 text-blue-700',
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
                                          student.status === 'Graduating' ? 'bg-blue-50 text-blue-600' :
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

      {section === 'attendance' ? (
        <div className="grid xl:grid-cols-[390px_1fr] gap-6">
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
                  <li key={session.id} className="rounded-lg bg-slate-50 px-3 py-2">
                    <div>Class {session.class_number}</div>
                    <div>{new Date(session.start_time).toLocaleString()}</div>
                    <div>{session.attendees} present</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-6">
            {attendanceStatus.canMark ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
                <h3 className="font-semibold text-slate-900 mb-4">Roll Call (Editable)</h3>
                <table className="w-full text-sm">
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
              <table className="w-full text-sm">
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
        // Tab switcher
        const loadHistory = async () => {
          if (resultsHistory.length > 0) return
          setResultsHistoryLoading(true)
          try {
            const res = await apiClient.get('/results/history')
            setResultsHistory(res.data)
          } catch { /* silently fail */ }
          finally { setResultsHistoryLoading(false) }
        }

        // Build the student list for the results table.
        // If a cohort/batch is selected: use all enrollments for the course, filtered to that cohort.
        // Otherwise: use active-only courseStudents (current behaviour).
        const studentsByIdFromAll = Object.fromEntries(allStudents.map((s) => [s.id, s]))

        const resultsStudentList = resultCohortFilter
          ? (() => {
              // deduplicate by student_id (a student may have multiple enrollment rows)
              const seen = new Set()
              return courseAllEnrollments
                .filter((e) => {
                  const s = studentsByIdFromAll[e.student_id]
                  return s && String(s.cohort_id) === String(resultCohortFilter)
                })
                .filter((e) => {
                  if (seen.has(e.student_id)) return false
                  seen.add(e.student_id)
                  return true
                })
                .map((e) => ({
                  student_id: e.student_id,
                  full_name: e.full_name,
                  matric_no: e.matric_no,
                  enrollment_status: e.status,
                }))
            })()
          : sortedCourseStudentsForResults

        const selectedCohortName = cohorts.find((c) => String(c.id) === String(resultCohortFilter))?.name

        return (
          <div className="space-y-5">
            {/* Tab bar */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
              {[{ key: 'input', label: 'Enter Results' }, { key: 'history', label: 'Results History' }].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setResultsTab(key); if (key === 'history') loadHistory() }}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${resultsTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>

          {resultsTab === 'input' ? (
          <div className="grid lg:grid-cols-[390px_1fr] gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="font-semibold text-slate-900">Results Setup</h3>
              <label className="text-sm text-slate-600 block">
                Course
                <select
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={selectedCourseId}
                  onChange={(event) => {
                    setSelectedCourseId(event.target.value)
                    setResultCohortFilter('')
                  }}
                >
                  <option value="">Select course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.course_code ? `${course.course_code} — ` : ''}{course.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-slate-600 block">
                Batch / Cohort
                <select
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={resultCohortFilter}
                  onChange={(event) => setResultCohortFilter(event.target.value)}
                  disabled={!selectedCourseId}
                >
                  <option value="">Current (active enrollments only)</option>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.status}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Select a batch to enter results for past or upcoming cohorts.
                </p>
              </label>

              <label className="text-sm text-slate-600 block">
                Result Type
                <select
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  value={selectedResultType}
                  onChange={(event) => setSelectedResultType(event.target.value)}
                >
                  <option value="Final">Final</option>
                  <option value="Assignment" disabled={!selectedCourse?.has_assignment}>Assignment</option>
                  <option value="Exam" disabled={!selectedCourse?.has_exam}>Exam</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">Assignment/Exam is available only if enabled on the course.</p>
              </label>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div>
                  <h3 className="font-semibold text-slate-900">Student Results Table</h3>
                  {selectedCohortName ? (
                    <p className="text-xs text-slate-400 mt-0.5">Showing batch: <span className="font-medium text-slate-700">{selectedCohortName}</span> — all enrolled students</p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-0.5">Showing active enrollments only</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <select className="border rounded-lg px-3 py-2 text-sm" value={resultSortBy} onChange={(event) => setResultSortBy(event.target.value)}>
                    <option value="name">Sort by Name</option>
                    <option value="score">Sort by Score</option>
                    <option value="status">Sort by Status</option>
                  </select>
                  <button onClick={exportResultsCsv} type="button" disabled={!selectedCourseId} className="bg-slate-900 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50">Export CSV</button>
                </div>
              </div>

              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="pb-2">Name</th>
                    <th>Matric</th>
                    {resultCohortFilter ? <th>Enrollment</th> : null}
                    <th>Current Result</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedCourseId ? resultsStudentList : []).map((student) => {
                    const row = currentCourseResultMap.get(Number(student.student_id))
                    const rowKey = row?.id || `course-${selectedCourseId}-student-${student.student_id}-${selectedResultType}`
                    const isEditing = editingResultRowId === student.student_id
                    return (
                      <tr key={rowKey} className="border-t border-slate-200">
                        <td className="py-3">{student.full_name}</td>
                        <td>{student.matric_no || '—'}</td>
                        {resultCohortFilter ? (
                          <td>
                            <span className={`text-xs rounded-full px-2 py-0.5 ${
                              student.enrollment_status === 'active' ? 'bg-sky-100 text-sky-700' :
                              student.enrollment_status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-slate-100 text-slate-500'
                            }`}>
                              {student.enrollment_status || '—'}
                            </span>
                          </td>
                        ) : null}
                        <td>
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                className="w-20 border rounded-lg px-2 py-1"
                                placeholder="Score"
                                value={resultRowEdits[student.student_id]?.score ?? (row?.score != null ? String(row.score) : '')}
                                onChange={(event) => updateResultRowField(student.student_id, 'score', event.target.value)}
                              />
                              <select
                                className="border rounded-lg px-2 py-1"
                                value={resultRowEdits[student.student_id]?.status ?? row?.status ?? 'Pass'}
                                onChange={(event) => updateResultRowField(student.student_id, 'status', event.target.value)}
                              >
                                <option>Pass</option>
                                <option>Fail</option>
                              </select>
                            </div>
                          ) : row ? (
                            <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${row.status === 'Pass' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                              {row.status}{row.score != null ? ` (${row.score})` : ''}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">No result yet</span>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="rounded-lg px-3 py-1.5 bg-slate-900 text-white text-sm disabled:opacity-50"
                                disabled={
                                  !['Pass', 'Fail'].includes(resultRowEdits[student.student_id]?.status || row?.status || '') ||
                                  (resultRowEdits[student.student_id]?.score !== '' && resultRowEdits[student.student_id]?.score !== undefined && (
                                    Number(resultRowEdits[student.student_id]?.score) < 0 ||
                                    Number(resultRowEdits[student.student_id]?.score) > 100
                                  ))
                                }
                                onClick={async () => {
                                  await updateResultInline(
                                    Number(student.student_id),
                                    resultRowEdits[student.student_id]?.score ?? row?.score ?? '',
                                    resultRowEdits[student.student_id]?.status || row?.status || 'Pass'
                                  )
                                  setEditingResultRowId(null)
                                }}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="rounded-lg px-3 py-1.5 bg-slate-200 text-slate-700 text-sm"
                                onClick={() => { setEditingResultRowId(null); setResultRowEdits((prev) => { const next = { ...prev }; delete next[student.student_id]; return next }) }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="rounded-lg px-3 py-1.5 bg-slate-100 text-slate-700 text-sm hover:bg-slate-200"
                              onClick={() => {
                                setEditingResultRowId(student.student_id)
                                setResultRowEdits((prev) => ({
                                  ...prev,
                                  [student.student_id]: { score: row?.score != null ? String(row.score) : '', status: row?.status ?? 'Pass' },
                                }))
                              }}
                            >
                              {row ? 'Edit' : 'Enter Result'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {!selectedCourseId ? (
                    <tr><td colSpan={5} className="py-8 text-center text-slate-400">Select a course to enter results.</td></tr>
                  ) : resultsStudentList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        {resultCohortFilter
                          ? 'No students from the selected batch are enrolled in this course.'
                          : 'No active students found in selected course.'}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
          ) : null}

          {resultsTab === 'history' ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="font-semibold text-slate-900">Results History by Batch</h3>
              {resultsHistoryLoading ? (
                <p className="text-sm text-slate-400">Loading...</p>
              ) : resultsHistory.length === 0 ? (
                <p className="text-sm text-slate-400">No results recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  {resultsHistory.map((cohort) => {
                    const isOpen = historyOpenCohort === cohort.cohort_id
                    const totalStudents = new Set(cohort.courses.flatMap(c => c.students.map(s => s.student_id))).size
                    const coursesWithResults = cohort.courses.filter(c => c.students.some(s => s.result_status))
                    return (
                      <div key={cohort.cohort_id} className="border border-slate-200 rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setHistoryOpenCohort(isOpen ? null : cohort.cohort_id)}
                          className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 hover:bg-slate-100 text-left"
                        >
                          <div>
                            <span className="font-semibold text-slate-900">{cohort.cohort_name}</span>
                            <span className="ml-3 text-xs text-slate-500">{totalStudents} student{totalStudents !== 1 ? 's' : ''} · {cohort.courses.length} course{cohort.courses.length !== 1 ? 's' : ''}</span>
                          </div>
                          <span className="text-slate-400 text-sm">{isOpen ? '▲' : '▼'}</span>
                        </button>
                        {isOpen ? (
                          <div className="divide-y divide-slate-100">
                            {cohort.courses.map((course) => {
                              const passCount = course.students.filter(s => s.result_status === 'Pass').length
                              const failCount = course.students.filter(s => s.result_status === 'Fail').length
                              const noResult = course.students.filter(s => !s.result_status).length
                              return (
                                <div key={course.course_id} className="px-5 py-4">
                                  <div className="flex items-center gap-3 mb-3">
                                    <p className="font-medium text-slate-800">{course.course_title}</p>
                                    {course.course_code ? <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 font-mono">{course.course_code}</span> : null}
                                    <div className="ml-auto flex gap-2 text-xs">
                                      <span className="bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">{passCount} Pass</span>
                                      <span className="bg-red-100 text-red-700 rounded-full px-2 py-0.5">{failCount} Fail</span>
                                      {noResult > 0 ? <span className="bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">{noResult} Pending</span> : null}
                                    </div>
                                  </div>
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-left text-slate-500">
                                        <th className="pb-1.5 font-medium">Name</th>
                                        <th className="font-medium">Matric</th>
                                        <th className="font-medium">Result</th>
                                        <th className="font-medium">Score</th>
                                        <th className="font-medium">Type</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {course.students.map((s) => (
                                        <tr key={s.student_id} className="border-t border-slate-100">
                                          <td className="py-2">{s.full_name}</td>
                                          <td>{s.matric_no || <span className="text-slate-300 italic text-xs">pending</span>}</td>
                                          <td>
                                            {s.result_status ? (
                                              <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${s.result_status === 'Pass' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                {s.result_status}
                                              </span>
                                            ) : <span className="text-slate-300 text-xs">—</span>}
                                          </td>
                                          <td>{s.score != null ? s.score : <span className="text-slate-300 text-xs">—</span>}</td>
                                          <td className="text-slate-500 text-xs">{s.result_type || '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )
                            })}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : null}
          </div>
        )
      })() : null}

      {section === 'graduation' ? (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card title="Total Students" value={graduationStatusCounts.total} />
            <Card title="Graduating" value={graduationStatusCounts.Graduating} />
            <Card title="Graduated" value={graduationStatusCounts.Graduated} />
            <Card title="Alumni" value={graduationStatusCounts.Alumni} />
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="font-semibold text-slate-900">Graduation Matrix</h3>
              <div className="flex items-center gap-2">
                <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Search name/email/matric" value={graduationSearch} onChange={(event) => setGraduationSearch(event.target.value)} />
                <select className="border rounded-lg px-3 py-2 text-sm" value={graduationSortBy} onChange={(event) => setGraduationSortBy(event.target.value)}>
                  <option value="progress">Sort: Progress</option>
                  <option value="name">Sort: Name</option>
                  <option value="status">Sort: Status</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {['all', 'Active', 'Graduating', 'Graduated', 'Alumni'].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setGraduationStatusFilter(value)}
                  className={`rounded-full px-3 py-1 text-xs border ${graduationStatusFilter === value ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300'}`}
                >
                  {value === 'all' ? 'All Statuses' : value}
                </button>
              ))}
            </div>

            <table className="w-full text-sm min-w-275">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="pb-2 sticky left-0 bg-white">Student</th>
                  <th>Matric</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Passed</th>
                  <th>Remaining</th>
                  {graduationMatrix.courses.map((course) => (
                    <th key={course.id} className="whitespace-nowrap">
                      <Link to={`/lecturer/courses/${course.id}`} className="hover:underline text-slate-700">
                        {course.course_code || course.title}
                      </Link>
                    </th>
                  ))}
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredGraduationStudents.map((student) => (
                  <tr key={student.id} className="border-t border-slate-200">
                    <td className="py-3 sticky left-0 bg-white">
                      <Link to={`/lecturer/students/${student.id}`} className="font-medium text-slate-900 hover:underline">
                        {student.full_name}
                      </Link>
                    </td>
                    <td>{student.matric_no}</td>
                    <td>{student.status}</td>
                    <td>{student.completion_pct}%</td>
                    <td>{student.passed}</td>
                    <td>{student.remaining}</td>
                    {graduationMatrix.courses.map((course) => {
                      const info = student.courses?.[course.id]
                      const isCurrent = info?.enrollment_status === 'active'
                      const content = info?.result_status === 'Pass'
                        ? <span className="text-emerald-600 font-semibold">✓</span>
                        : info?.result_status === 'Fail'
                        ? <span className="text-red-500 font-semibold">✗</span>
                        : info?.enrollment_status === 'active'
                        ? <span className="text-sky-600">⏳</span>
                        : <span className="text-slate-300">—</span>
                      return (
                        <td key={`${student.id}-${course.id}`} className={`text-center ${isCurrent ? 'bg-amber-50' : ''}`}>
                          {content}
                        </td>
                      )
                    })}
                    <td>
                      <div className="relative">
                        <button
                          type="button"
                          className="rounded-lg p-2 bg-slate-100 text-slate-700"
                          onClick={() => setOpenGraduationActionFor((prev) => (prev === student.id ? null : student.id))}
                        >
                          <MoreVertical size={16} />
                        </button>
                        {openGraduationActionFor === student.id ? (
                          <div className="absolute right-0 mt-2 z-20 w-44 rounded-xl border border-slate-200 bg-white shadow-lg p-1">
                            <button type="button" className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-slate-50" onClick={() => { updateStudentLifecycle(student, 'Graduating'); setOpenGraduationActionFor(null) }}>
                              Mark as Graduating
                            </button>
                            <button
                              type="button"
                              className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-40"
                              disabled={student.remaining > 0 || student.failed > 0}
                              onClick={() => { updateStudentLifecycle(student, 'Graduated'); setOpenGraduationActionFor(null) }}
                            >
                              Mark as Graduated
                            </button>
                            <button
                              type="button"
                              className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-40"
                              disabled={student.status !== 'Graduated'}
                              onClick={() => { updateStudentLifecycle(student, 'Alumni'); setOpenGraduationActionFor(null) }}
                            >
                              Mark as Alumni
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredGraduationStudents.length ? (
                  <tr>
                    <td colSpan={7 + (graduationMatrix.courses?.length || 0)} className="py-6 text-center text-slate-500">No students match the current filters.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {section === 'assignments' ? (
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
            <table className="w-full text-sm">
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
      ) : null}
    </AppShell>
  )
}

export default LecturerDashboard
