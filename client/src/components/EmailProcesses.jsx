import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Eye, Send, Copy, Trash2, Plus, Search, Variable, Pen, Mail, Users, BookOpen } from 'lucide-react'
import apiClient from '../api/client'

const EXAM_FALLBACK_VARIABLES = [
  { id: 'fb_exam_title', variable_key: 'exam_title', display_label: 'Exam Title', category: 'exam', example_value: 'Midterm Exam' },
  { id: 'fb_exam_link', variable_key: 'exam_link', display_label: 'Exam Link', category: 'exam', example_value: 'https://example.com/exam/123' },
  { id: 'fb_access_code', variable_key: 'access_code', display_label: 'Exam Access Code', category: 'exam', example_value: 'ABC123' },
  { id: 'fb_due_date', variable_key: 'due_date', display_label: 'Exam Due Date', category: 'exam', example_value: '2026-05-01' },
  { id: 'fb_course_title', variable_key: 'course_title', display_label: 'Course Title', category: 'exam', example_value: 'GTS 101' },
]

export default function EmailProcesses({ notify }) {
  const pollRef = useRef(null)
  useEffect(() => () => clearTimeout(pollRef.current), [])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState({ name: '', subject_template: '', body_template: '' })
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const [variables, setVariables] = useState([])
  const [varCategories, setVarCategories] = useState([])
  const [varSearch, setVarSearch] = useState('')
  const [varCategoryFilter, setVarCategoryFilter] = useState('')
  const [focusedField, setFocusedField] = useState('body')

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const [sendOpen, setSendOpen] = useState(false)
  const [courses, setCourses] = useState([])
  const [students, setStudents] = useState([])
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedRecipients, setSelectedRecipients] = useState([])
  const [recipientMode, setRecipientMode] = useState('manual')
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [variablePlanId, setVariablePlanId] = useState('')
  const [variableCourseId, setVariableCourseId] = useState('')
  const [variableAssignmentId, setVariableAssignmentId] = useState('')
  const [variableExamId, setVariableExamId] = useState('')
  const [variableAssignments, setVariableAssignments] = useState([])
  const [variableExams, setVariableExams] = useState([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)
  const [examsLoading, setExamsLoading] = useState(false)
  const [coursePlans, setCoursePlans] = useState([])
  const [planCourses, setPlanCourses] = useState([])
  const [plansLoading, setPlansLoading] = useState(false)
  const [planItemsLoading, setPlanItemsLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendPreview, setSendPreview] = useState(null)
  const [sendStep, setSendStep] = useState('recipients')
  const [sendResult, setSendResult] = useState(null)

  const bodyRef = useRef(null)
  const subjectRef = useRef(null)

  // ── Detect which variable categories are used in current template ──
  const neededContexts = useMemo(() => {
    const text = `${form.subject_template || ''} ${form.body_template || ''}`
    const keys = [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])
    const cats = new Set()
    for (const k of keys) {
      const v = variables.find((x) => x.variable_key === k)
      if (v && v.category) cats.add(v.category)
      else if (k.startsWith('course_')) cats.add('course')
      else if (k.startsWith('assignment_')) cats.add('assignment')
      else if (k.startsWith('exam_') || k === 'exam_title' || k === 'exam_link' || k === 'quiz_url' || k === 'access_code') cats.add('exam')
      else if (k.startsWith('instructor_')) cats.add('instructor')
    }
    // Fallback regex checks for prefix even if variable not in library
    if (/\{\{\s*assignment_/i.test(text)) cats.add('assignment')
    if (/\{\{\s*exam_/i.test(text)) cats.add('exam')
    if (/\{\{\s*course_/i.test(text)) cats.add('course')
    if (/\{\{\s*instructor_/i.test(text)) cats.add('instructor')
    return cats
  }, [form.subject_template, form.body_template, variables])

  const needsCourse = neededContexts.has('course') || neededContexts.has('instructor')
  const needsAssignment = neededContexts.has('assignment')
  const needsExam = neededContexts.has('exam')
  const needsVariableContext = needsCourse || needsAssignment || needsExam

  const loadTemplates = async () => {
    try {
      const res = await apiClient.get('/email-processes')
      setTemplates(res.data || [])
    } catch { notify('Failed to load templates') }
    setLoading(false)
  }

  const loadVariables = async () => {
    try {
      const [varsRes, catsRes] = await Promise.all([
        apiClient.get('/email-processes/variables/all'),
        apiClient.get('/email-processes/variables/categories'),
      ])
      let vars = varsRes.data || []
      // Ensure exam placeholders are present even if backend has not seeded them
      for (const fb of EXAM_FALLBACK_VARIABLES) {
        if (!vars.some((v) => v.variable_key === fb.variable_key)) vars = [...vars, fb]
      }
      setVariables(vars)
      let cats = catsRes.data || []
      if (!cats.some((c) => (c.category || c) === 'exam')) {
        const examCount = vars.filter((v) => v.category === 'exam').length
        cats = [...cats, { category: 'exam', count: examCount }]
      }
      setVarCategories(cats)
    } catch {
      // Fallback to exam variables when API unavailable
      setVariables(EXAM_FALLBACK_VARIABLES)
      setVarCategories([{ category: 'exam', count: EXAM_FALLBACK_VARIABLES.length }])
    }
  }

  useEffect(() => { loadTemplates(); loadVariables() }, [])

  const selectTemplate = (t) => {
    setSelectedId(t.id)
    setIsNew(false)
    setForm({
      name: t.name || '',
      subject_template: t.subject_template || '',
      body_template: t.body_template || '',
    })
  }

  const newTemplate = () => {
    setSelectedId(null)
    setIsNew(true)
    setForm({ name: '', subject_template: '', body_template: '' })
  }

  const handleSave = async () => {
    if (!form.name.trim()) { notify('Template name is required'); return }
    setSaving(true)
    try {
      if (isNew) {
        const res = await apiClient.post('/email-processes', form)
        setSelectedId(res.data.id)
        setIsNew(false)
        notify('Template created')
      } else {
        await apiClient.patch(`/email-processes/${selectedId}`, form)
        notify('Template saved')
      }
      await loadTemplates()
    } catch (err) {
      notify(err?.response?.data?.message || 'Save failed')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    try {
      await apiClient.delete(`/email-processes/${id}`)
      if (selectedId === id) { setSelectedId(null); setIsNew(false); setForm({ name: '', subject_template: '', body_template: '' }) }
      notify('Template deleted')
      await loadTemplates()
    } catch { notify('Delete failed') }
  }

  const handleDuplicate = async (id) => {
    try {
      await apiClient.post(`/email-processes/${id}/duplicate`)
      notify('Template duplicated')
      await loadTemplates()
    } catch { notify('Duplicate failed') }
  }

  const handlePreview = async (id) => {
    setPreviewLoading(true)
    try {
      const res = await apiClient.get(`/email-processes/${id}/preview`)
      setPreviewData(res.data)
      setPreviewOpen(true)
    } catch { notify('Preview failed') }
    setPreviewLoading(false)
  }

  // ── Variable insertion at cursor position ──
  const insertVariable = (key) => {
    const ref = focusedField === 'subject' ? subjectRef : bodyRef
    const field = focusedField === 'subject' ? 'subject_template' : 'body_template'
    if (!ref.current) {
      setForm((prev) => ({ ...prev, [field]: (prev[field] || '') + `{{${key}}}` }))
      return
    }
    const start = ref.current.selectionStart
    const end = ref.current.selectionEnd
    const val = ref.current.value
    const tmpl = `{{${key}}}`
    const newVal = val.substring(0, start) + tmpl + val.substring(end)
    setForm((prev) => ({ ...prev, [field]: newVal }))
    requestAnimationFrame(() => {
      ref.current.focus()
      const pos = start + tmpl.length
      ref.current.setSelectionRange(pos, pos)
    })
  }

  // ── Drag and drop ──
  const handleDragStart = (e, key) => {
    e.dataTransfer.setData('text/plain', key)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDrop = (e, field) => {
    e.preventDefault()
    const key = e.dataTransfer.getData('text/plain')
    setFocusedField(field)
    // Small delay so the focused field ref is correct
    setTimeout(() => insertVariable(key), 0)
  }

  const handleDragOver = (e) => e.preventDefault()

  // ── Send workflow ──
  const openSend = async (templateId) => {
    const id = templateId || selectedId
    if (!id) return
    try {
      const [coursesRes, studentsRes, plansRes] = await Promise.all([
        apiClient.get('/courses'),
        apiClient.get('/students'),
        apiClient.get('/course-plans').catch(() => ({ data: [] })),
      ])
      const courseList = coursesRes.data || []
      setCourses(courseList)
      setStudents(studentsRes.data || [])
      setCoursePlans(plansRes.data || [])
      setPlanCourses([])
      setSelectedRecipients([])
      setStudentSearch('')
      setRecipientMode('manual')
      setSelectedCourseId('')
      setVariablePlanId('')
      // Default Variable Context course to active course (is_current) or first course
      const activeCourse = courseList.find((c) => c.is_current) || courseList[0] || null
      setVariableCourseId(activeCourse ? String(activeCourse.id) : '')
      setVariableAssignmentId('')
      setVariableExamId('')
      setVariableAssignments([])
      setVariableExams([])
      setSendPreview(null)
      setSendStep('recipients')
      setSelectedId(id)
      // Ensure form is synced with this template
      const t = templates.find((t2) => t2.id === id)
      if (t) {
        setForm({
          name: t.name || '',
          subject_template: t.subject_template || '',
          body_template: t.body_template || '',
        })
      }
      setSendOpen(true)
    } catch { notify('Failed to load data') }
  }

  const loadCourseStudents = async (courseId) => {
    if (!courseId) return
    try {
      const res = await apiClient.get(`/enrollments/course/${courseId}`)
      const enrolled = res.data || []
      const studentIds = enrolled.map((e) => e.student_id).filter(Boolean)
      const filtered = students.filter((s) => studentIds.includes(s.id))
      setStudents(filtered)
      setSelectedRecipients([])
    } catch { notify('Failed to load enrollments') }
  }

  const handleModeChange = (mode) => {
    setRecipientMode(mode)
    setSelectedRecipients([])
    setSelectedCourseId('')
    setStudentSearch('')
    if (mode === 'all') {
      setSelectedRecipients(students.map((s) => s.id))
    } else if (mode === 'manual') {
      // Reload all students
      apiClient.get('/students').then((res) => setStudents(res.data || [])).catch(() => {})
    }
  }

  const handleCourseChange = (courseId) => {
    setSelectedCourseId(courseId)
    setSelectedRecipients([])
    if (courseId) {
      loadCourseStudents(courseId)
    } else {
      apiClient.get('/students').then((res) => setStudents(res.data || [])).catch(() => {})
    }
  }

  const handleVariablePlanChange = (planId) => {
    setVariablePlanId(planId)
    setVariableCourseId('')
    setVariableAssignmentId('')
    setVariableExamId('')
    setPlanCourses([])
  }

  const handleVariableCourseChange = (courseId) => {
    setVariableCourseId(courseId)
    setVariableAssignmentId('')
    setVariableExamId('')
  }

  // Load course plans for Variable Context when modal opens (if not already loaded via openSend)
  useEffect(() => {
    if (!sendOpen) return
    if (coursePlans.length > 0) return
    setPlansLoading(true)
    apiClient.get('/course-plans')
      .then((res) => setCoursePlans(res.data || []))
      .catch(() => {})
      .finally(() => setPlansLoading(false))
  }, [sendOpen])

  // When Plan changes, fetch its courses from course_plan_items
  useEffect(() => {
    if (!sendOpen) return
    if (!variablePlanId) {
      setPlanCourses([])
      return
    }
    setPlanItemsLoading(true)
    apiClient.get(`/course-plans/${variablePlanId}`)
      .then((res) => setPlanCourses(res.data?.items || []))
      .catch(() => setPlanCourses([]))
      .finally(() => setPlanItemsLoading(false))
  }, [variablePlanId, sendOpen])

  // Load assignments/exams for Variable Context when course or needs change
  useEffect(() => {
    if (!sendOpen) return
    const vcId = variableCourseId || ''
    if (needsAssignment) {
      if (vcId) {
        setAssignmentsLoading(true)
        apiClient.get(`/assignments/course/${vcId}`)
          .then((res) => setVariableAssignments(res.data || []))
          .catch(() => setVariableAssignments([]))
          .finally(() => setAssignmentsLoading(false))
      } else {
        setVariableAssignments([])
      }
    } else {
      setVariableAssignments([])
    }
    if (needsExam) {
      if (vcId) {
        setExamsLoading(true)
        apiClient.get(`/exams/course/${vcId}`)
          .then((res) => setVariableExams(res.data || []))
          .catch(() => setVariableExams([]))
          .finally(() => setExamsLoading(false))
      } else {
        setVariableExams([])
        // If no course but exam needed, try load all? keep empty and show hint
      }
    } else {
      setVariableExams([])
    }
  }, [variableCourseId, sendOpen, needsAssignment, needsExam])

  const generateSendPreview = async () => {
    if (!selectedId || !selectedRecipients.length) return
    try {
      const firstId = selectedRecipients[0]
      const params = {}
      const cId = variableCourseId || selectedCourseId || undefined
      if (cId) params.courseId = cId
      if (variablePlanId) params.planId = variablePlanId
      if (variableAssignmentId) params.assignmentId = variableAssignmentId
      if (variableExamId) params.examId = variableExamId
      const res = await apiClient.get(`/email-processes/${selectedId}/preview/${firstId}`, { params })
      setSendPreview(res.data)
      setSendStep('preview')
    } catch { notify('Preview failed') }
  }

  const handleSend = async () => {
    if (!selectedRecipients.length) return
    setSending(true)
    setSendResult(null)
    try {
      const payload = {
        recipientIds: selectedRecipients,
        courseId: variableCourseId || selectedCourseId || undefined,
        planId: variablePlanId || undefined,
      }
      if (variableAssignmentId) payload.assignmentId = variableAssignmentId
      if (variableExamId) payload.examId = variableExamId
      const res = await apiClient.post(`/email-processes/${selectedId}/send`, payload)
      const jobId = res.data.jobId
      setSendResult({ type: 'progress', text: 'Queued…' })

      const poll = async () => {
        try {
          const statusRes = await apiClient.get(`/email-processes/send-status/${jobId}`)
          const s = statusRes.data
          if (s.status === 'completed' || s.status === 'failed') {
            const errors = s.errors || []
            const lines = [s.message]
            if (errors.length) {
              lines.push('', '── Errors ──')
              errors.forEach((e) => lines.push(e))
            }
            setSendResult({ type: errors.length === 0 ? 'success' : 'partial', text: lines.join('\n') })
            notify(s.message)
            setSending(false)
            return
          }
          setSendResult({ type: 'progress', text: s.message || 'Sending…' })
          pollRef.current = setTimeout(poll, 2000)
        } catch {
          setSendResult({ type: 'error', text: 'Failed to check send status' })
          setSending(false)
        }
      }
      pollRef.current = setTimeout(poll, 1500)
    } catch (err) {
      const detail = err.response?.data?.message || err.message || 'Send failed'
      setSendResult({ type: 'error', text: detail })
      notify(detail)
      setSending(false)
    }
  }

  const filteredVars = variables.filter((v) => {
    if (varCategoryFilter && v.category !== varCategoryFilter) return false
    if (varSearch) {
      const q = varSearch.toLowerCase()
      return v.display_label?.toLowerCase().includes(q) || v.variable_key?.toLowerCase().includes(q)
    }
    return true
  })

  const groupedVars = {}
  for (const v of filteredVars) {
    const cat = v.category || 'general'
    if (!groupedVars[cat]) groupedVars[cat] = []
    groupedVars[cat].push(v)
  }

  const filteredStudents = students.filter((s) => {
    if (!studentSearch) return true
    const q = studentSearch.toLowerCase()
    return s.full_name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)
  })

  const selectAllFiltered = () => {
    const ids = filteredStudents.map((s) => s.id)
    const allSelected = ids.every((id) => selectedRecipients.includes(id))
    setSelectedRecipients((prev) =>
      allSelected ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]
    )
  }

  const selectedTemplate = templates.find((t) => t.id === selectedId)

  if (loading) return <p className="text-sm text-slate-500 py-12 text-center">Loading templates...</p>

  return (
    <div className="flex gap-4 h-[calc(100vh-280px)] min-h-[500px]">
      {/* ── Left Panel: Variable Library ── */}
      <div className="w-72 shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
        <div className="p-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5 mb-2">
            <Variable size={15} />
            Variable Library
          </h3>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full border rounded-lg pl-8 pr-3 py-1.5 text-xs"
              placeholder="Search variables..."
              value={varSearch}
              onChange={(e) => setVarSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            <button
              type="button"
              onClick={() => setVarCategoryFilter('')}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${!varCategoryFilter ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              All
            </button>
            {varCategories.map((c) => (
              <button
                key={c.category}
                type="button"
                onClick={() => setVarCategoryFilter(c.category)}
                className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${varCategoryFilter === c.category ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {c.category} ({c.count})
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
            <span>Insert into:</span>
            <button
              type="button"
              onClick={() => setFocusedField('subject')}
              className={`px-2 py-0.5 rounded-full ${focusedField === 'subject' ? 'bg-sky-100 text-sky-700 font-medium' : 'bg-slate-50 text-slate-400'}`}
            >
              Subject
            </button>
            <button
              type="button"
              onClick={() => setFocusedField('body')}
              className={`px-2 py-0.5 rounded-full ${focusedField === 'body' ? 'bg-sky-100 text-sky-700 font-medium' : 'bg-slate-50 text-slate-400'}`}
            >
              Body
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">Click to insert, or drag into editor</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {Object.entries(groupedVars).map(([cat, vars]) => (
            <div key={cat}>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-2 py-1">{cat}</p>
              {vars.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  draggable
                  onDragStart={(e) => handleDragStart(e, v.variable_key)}
                  onClick={() => insertVariable(v.variable_key)}
                  className="w-full text-left rounded-lg px-2.5 py-2 text-xs hover:bg-slate-50 transition-colors group cursor-grab active:cursor-grabbing"
                >
                  <span className="font-mono text-sky-700 text-[11px] group-hover:text-sky-900">{`{{${v.variable_key}}}`}</span>
                  <span className="block text-slate-500 text-[10px] mt-0.5 truncate">{v.display_label}</span>
                </button>
              ))}
            </div>
          ))}
          {!filteredVars.length && <p className="text-xs text-slate-400 text-center py-6">No variables match</p>}
        </div>
      </div>

      {/* ── Center Panel: Template Builder ── */}
      <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
        {selectedId || isNew ? (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                {isNew ? 'New Template' : selectedTemplate?.name || 'Edit Template'}
              </h3>
              <div className="flex items-center gap-2">
                {selectedId && (
                  <>
                    <button type="button" onClick={() => handlePreview(selectedId)} disabled={previewLoading}
                      className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    ><Eye size={14} /> Preview</button>
                    <button type="button" onClick={() => openSend(selectedId)}
                      className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    ><Send size={14} /> Send</button>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <label className="text-sm text-slate-600 block">
                Template Name
                <input
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. Assignment Reminder, Resumption Notice"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </label>
              <label className="text-sm text-slate-600 block">
                Subject
                <input
                  ref={subjectRef}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm font-mono"
                  placeholder="e.g. New Assignment: {{assignment_title}}"
                  value={form.subject_template}
                  onFocus={() => setFocusedField('subject')}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, 'subject')}
                  onChange={(e) => setForm((prev) => ({ ...prev, subject_template: e.target.value }))}
                />
              </label>
              <label className="text-sm text-slate-600 block flex-1 flex flex-col">
                Email Body
                <textarea
                  ref={bodyRef}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm font-mono leading-relaxed flex-1 min-h-[280px]"
                  placeholder="Write your email body here. Use {{variable_name}} to personalize."
                  value={form.body_template}
                  onFocus={() => setFocusedField('body')}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, 'body')}
                  onChange={(e) => setForm((prev) => ({ ...prev, body_template: e.target.value }))}
                />
              </label>
            </div>
            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button type="button" onClick={() => { setSelectedId(null); setIsNew(false) }}
                className="px-4 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200"
              >Cancel</button>
              <button type="button" disabled={saving} onClick={handleSave}
                className="px-6 py-2 text-sm rounded-lg bg-slate-900 text-white disabled:opacity-50 flex items-center gap-1.5"
              >{saving ? 'Saving…' : isNew ? 'Create Template' : 'Save Changes'}</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center flex-1">
            <div className="text-center">
              <Pen size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-400">Select a template or create a new one</p>
              <button type="button" onClick={newTemplate}
                className="mt-3 inline-flex items-center gap-1.5 bg-slate-900 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-slate-800"
              ><Plus size={15} /> New Template</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Right Panel: My Templates ── */}
      <div className="w-80 shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">My Templates</h3>
          <button type="button" onClick={newTemplate}
            className="flex items-center gap-1 text-xs font-medium bg-slate-900 text-white rounded-lg px-3 py-1.5 hover:bg-slate-800 transition-colors"
          ><Plus size={13} /> New</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {templates.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">No templates yet. Create your first one!</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {templates.map((t) => (
                <div key={t.id}
                  className={`px-3 py-3 transition-colors ${selectedId === t.id ? 'bg-sky-50 border-l-2 border-sky-500' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => selectTemplate(t)}>
                      <p className="text-sm font-medium text-slate-900 truncate">{t.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {t.updated_at ? new Date(t.updated_at).toLocaleDateString() : '—'}
                        {t.creator_name ? ` · by ${t.creator_name}` : ''}
                      </p>
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 mt-1">
                        <Mail size={10} /> Email
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button type="button" onClick={() => selectTemplate(t)}
                        className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700" title="Edit"><Pen size={13} /></button>
                      <button type="button" onClick={() => handleDuplicate(t.id)}
                        className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700" title="Duplicate"><Copy size={13} /></button>
                      <button type="button" onClick={() => handlePreview(t.id)}
                        className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700" title="Preview"><Eye size={13} /></button>
                      <button type="button" onClick={() => openSend(t.id)}
                        className="p-1 rounded hover:bg-sky-100 text-slate-400 hover:text-sky-700" title="Send"><Send size={13} /></button>
                      <button type="button" onClick={() => handleDelete(t.id, t.name)}
                        className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600" title="Delete"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Preview Modal ── */}
      {previewOpen && previewData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreviewOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 flex items-center gap-1.5"><Eye size={16} /> Template Preview</h3>
              <button type="button" onClick={() => setPreviewOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Subject</span>
                <p className="text-sm text-slate-900 font-medium mt-1 bg-slate-50 rounded-lg px-3 py-2">{previewData.subject}</p>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Body (rendered with sample data)</span>
                {previewData.body && previewData.body.includes('<') ? (
                  <div className="mt-1 text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-lg p-3" dangerouslySetInnerHTML={{ __html: previewData.body }} />
                ) : (
                  <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-lg p-3">{previewData.body}</div>
                )}
              </div>
              {previewData.variables?.length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Sample Variable Values</span>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {previewData.variables.map((v) => (
                      <span key={v.variable_key} className="text-[10px] font-mono bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded">
                        {v.variable_key}={v.example_value || `[${v.display_label}]`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Send Modal ── */}
      {sendOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSendOpen(false)}>
          <div className="bg-white rounded-[24px] shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden isolate" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="shrink-0 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900 flex items-center gap-1.5"><Send size={16} /> Send Template</h3>
                <p className="text-xs text-slate-500 mt-0.5">Sending <strong>{selectedTemplate?.name || 'Untitled'}</strong></p>
              </div>
              <button type="button" onClick={() => setSendOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg shrink-0"><X size={18} /></button>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
              {/* Step indicator */}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className={`flex items-center gap-1 ${sendStep === 'recipients' ? 'text-slate-900 font-semibold' : ''}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${sendStep === 'recipients' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>1</span>
                  Select Recipients
                </span>
                <span className="text-slate-300">→</span>
                <span className={`flex items-center gap-1 ${sendStep === 'preview' ? 'text-slate-900 font-semibold' : ''}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${sendStep === 'preview' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>2</span>
                  Preview & Send
                </span>
              </div>

              {sendStep === 'recipients' && (
                <>
                  {/* Recipient mode selection */}
                  <div className="flex gap-2">
                  {[
                    { key: 'manual', label: 'Select Students', icon: Users },
                    { key: 'course', label: 'By Course', icon: BookOpen },
                    { key: 'all', label: 'All Students', icon: Mail },
                  ].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key} type="button"
                      onClick={() => handleModeChange(key)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        recipientMode === key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    ><Icon size={13} /> {label}</button>
                  ))}
                </div>

                {/* ── Variable Context panel ── */}
                {needsVariableContext ? (
                  <div className="border border-amber-200 bg-amber-50/60 rounded-xl p-3 space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Variable size={14} className="text-amber-700" />
                      <h4 className="text-xs font-semibold text-amber-900">Variable Context</h4>
                      <span className="text-[10px] text-amber-700/70">— map template variables to real entities before preview</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      This template uses <span className="font-mono font-semibold">{[...neededContexts].join(', ')}</span> variables. Select the source entities so <span className="font-mono">{'{{course_*}}'}</span>, <span className="font-mono">{'{{assignment_*}}'}</span> and <span className="font-mono">{'{{exam_*}}'}</span> render with real data.
                    </p>
                    {needsCourse && (
                      <>
                        <div>
                          <label className="text-xs font-medium text-slate-700 block mb-1">
                            Plan <span className="font-normal text-slate-400"> — select plan for plan-specific dates (course can be in multiple plans)</span>
                          </label>
                          <select
                            className="w-full border rounded-lg px-3 py-2 text-sm bg-white border-amber-200 focus:border-amber-300"
                            value={variablePlanId}
                            onChange={(e) => handleVariablePlanChange(e.target.value)}
                          >
                            <option value="">No plan — use general course dates</option>
                            {plansLoading ? (
                              <option disabled>Loading plans…</option>
                            ) : coursePlans.length === 0 ? (
                              <option disabled>No plans available</option>
                            ) : null}
                            {coursePlans.map((p) => (
                              <option key={p.id} value={p.id}>{p.name} ({p.year}){p.is_active ? ' — Active' : ''}</option>
                            ))}
                          </select>
                          <p className="text-[10px] text-slate-500 mt-1">When a plan is selected, course dates ({'{{course_start_date}}'} / {'{{course_end_date}}'}) use the plan-specific period. If empty, generic course dates are used.</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-700 block mb-1">
                            Course <span className="text-red-500">*</span>
                            <span className="font-normal text-slate-400"> — for {'{{course_code}}'}, {'{{course_name}}'}, {'{{course_description}}'}, {'{{course_start_date}}'}, {'{{course_end_date}}'} and {'{{instructor_*}}'}</span>
                          </label>
                          {variablePlanId && planItemsLoading ? (
                            <p className="text-xs text-slate-400 py-2">Loading courses in plan…</p>
                          ) : variablePlanId && planCourses.length === 0 ? (
                            <div>
                              <select
                                className="w-full border rounded-lg px-3 py-2 text-sm border-red-300 bg-red-50"
                                value={variableCourseId}
                                onChange={(e) => handleVariableCourseChange(e.target.value)}
                              >
                                <option value="">No courses in this plan</option>
                              </select>
                              <p className="text-[10px] text-red-600 mt-1">This plan has no courses. Select a different plan or clear plan to see all courses.</p>
                            </div>
                          ) : (
                            <select
                              className={`w-full border rounded-lg px-3 py-2 text-sm ${!variableCourseId ? 'border-red-300 bg-red-50' : 'bg-white border-amber-200 focus:border-amber-300'}`}
                              value={variableCourseId}
                              onChange={(e) => handleVariableCourseChange(e.target.value)}
                            >
                              <option value="">Select a course…</option>
                              {(variablePlanId ? planCourses : courses).map((c) => {
                                if (variablePlanId) {
                                  // c is from course_plan_items: has course_id, course_title, course_code, start_date, end_date
                                  const label = c.course_code ? `${c.course_code} - ${c.course_title}` : (c.course_title || c.title)
                                  const dates = c.start_date || c.end_date ? ` (${c.start_date ? new Date(c.start_date).toLocaleDateString() : '—'} → ${c.end_date ? new Date(c.end_date).toLocaleDateString() : '—'})` : ''
                                  return <option key={c.course_id} value={c.course_id}>{label}{dates}</option>
                                }
                                return <option key={c.id} value={c.id}>{c.course_code ? `${c.course_code} - ${c.title}` : c.title}{c.is_current ? ' (Active)' : ''}</option>
                              })}
                            </select>
                          )}
                          {!variableCourseId && <p className="text-[10px] text-red-600 mt-1">Course is required for course/instructor variables.</p>}
                          {variableCourseId && (() => {
                            const cc = variablePlanId ? planCourses.find((x) => String(x.course_id) === String(variableCourseId)) : null
                            const fallback = courses.find((x) => String(x.id) === String(variableCourseId))
                            const instr = cc?.lecturer_name || fallback?.lecturer_name || fallback?.assigned_lecturer || fallback?.lecturer_id || ''
                            const dateHint = variablePlanId && cc ? ` Plan dates: ${cc.start_date ? new Date(cc.start_date).toLocaleDateString() : '—'} → ${cc.end_date ? new Date(cc.end_date).toLocaleDateString() : '—'} — vars use plan period.` : ''
                            return <p className="text-[10px] text-slate-500 mt-1">Instructor will be <span className="font-medium text-slate-700">{instr || 'derived from course lecturer'}</span> — {'{{instructor_name}}'} / {'{{instructor_email}}'} auto-populated.{dateHint}</p>
                          })()}
                        </div>
                      </>
                    )}
                    {needsAssignment && (
                      <div>
                        <label className="text-xs font-medium text-slate-700 block mb-1">
                          Assignment <span className="text-red-500">*</span>
                          <span className="font-normal text-slate-400"> — for {'{{assignment_title}}'}, {'{{assignment_description}}'}, {'{{due_date}}'}</span>
                        </label>
                        {!variableCourseId ? (
                          <p className="text-[11px] text-amber-700 bg-white border border-amber-200 rounded-lg px-3 py-2">Select a course above to load its assignments.</p>
                        ) : assignmentsLoading ? (
                          <p className="text-xs text-slate-400 py-2">Loading assignments…</p>
                        ) : variableAssignments.length === 0 ? (
                          <p className="text-[11px] text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-2">No assignments found for this course. Create an assignment first or remove {'{{assignment_*}}'} from template.</p>
                        ) : (
                          <select
                            className={`w-full border rounded-lg px-3 py-2 text-sm ${!variableAssignmentId ? 'border-red-300 bg-red-50' : 'bg-white border-amber-200'}`}
                            value={variableAssignmentId}
                            onChange={(e) => setVariableAssignmentId(e.target.value)}
                          >
                            <option value="">Select an assignment…</option>
                            {variableAssignments.map((a) => (
                              <option key={a.id} value={a.id}>{a.title}{a.due_date ? ` — due ${new Date(a.due_date).toLocaleDateString()}` : ''}</option>
                            ))}
                          </select>
                        )}
                        {needsAssignment && !variableAssignmentId && variableCourseId && variableAssignments.length > 0 && <p className="text-[10px] text-red-600 mt-1">Assignment is required for assignment variables.</p>}
                      </div>
                    )}
                    {needsExam && (
                      <div>
                        <label className="text-xs font-medium text-slate-700 block mb-1">
                          Exam <span className="text-red-500">*</span>
                          <span className="font-normal text-slate-400"> — for {'{{exam_title}}'}, {'{{exam_link}}'}, {'{{access_code}}'}, {'{{due_date}}'}</span>
                        </label>
                        {!variableCourseId ? (
                          <p className="text-[11px] text-amber-700 bg-white border border-amber-200 rounded-lg px-3 py-2">Select a course above to load its exams.</p>
                        ) : examsLoading ? (
                          <p className="text-xs text-slate-400 py-2">Loading exams…</p>
                        ) : variableExams.length === 0 ? (
                          <p className="text-[11px] text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-2">No exams found for this course. Create an exam first or remove {'{{exam_*}}'} from template.</p>
                        ) : (
                          <select
                            className={`w-full border rounded-lg px-3 py-2 text-sm ${!variableExamId ? 'border-red-300 bg-red-50' : 'bg-white border-amber-200'}`}
                            value={variableExamId}
                            onChange={(e) => setVariableExamId(e.target.value)}
                          >
                            <option value="">Select an exam…</option>
                            {variableExams.map((ex) => (
                              <option key={ex.id} value={ex.id}>{ex.title} ({ex.exam_type || 'essay'}){ex.due_date ? ` — due ${new Date(ex.due_date).toLocaleDateString()}` : ''}</option>
                            ))}
                          </select>
                        )}
                        {needsExam && !variableExamId && variableCourseId && variableExams.length > 0 && <p className="text-[10px] text-red-600 mt-1">Exam is required for exam variables.</p>}
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Course dropdown for recipient filtering */}
                {recipientMode === 'course' && (
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={selectedCourseId}
                    onChange={(e) => handleCourseChange(e.target.value)}
                  >
                    <option value="">Select a course...</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.title} ({c.course_code || 'no code'})</option>
                    ))}
                  </select>
                )}

                {/* Student search */}
                {recipientMode !== 'all' && recipientMode !== 'course' && (
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm" placeholder="Search students..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} />
                  </div>
                )}

                {/* Select/Deselect all */}
                {recipientMode !== 'course' && filteredStudents.length > 0 && (
                  <button type="button" className="text-xs text-slate-500 hover:text-slate-900 font-medium" onClick={selectAllFiltered}>
                    {filteredStudents.every((s) => selectedRecipients.includes(s.id)) ? 'Deselect all' : 'Select all'}
                  </button>
                )}
                {(recipientMode === 'course' && selectedCourseId) && (
                  <button type="button" className="text-xs text-slate-500 hover:text-slate-900 font-medium" onClick={selectAllFiltered}>
                    {filteredStudents.every((s) => selectedRecipients.includes(s.id)) ? 'Deselect all' : 'Select all enrolled'}
                  </button>
                )}

                {/* Student list */}
                <div className="max-h-[300px] overflow-y-auto border border-slate-200 rounded-xl">
                  {filteredStudents.map((s) => (
                    <label key={s.id} className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors ${selectedRecipients.includes(s.id) ? 'bg-sky-50' : ''}`}>
                      <input type="checkbox" checked={selectedRecipients.includes(s.id)}
                        onChange={() => setSelectedRecipients((prev) => prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id])}
                        className="rounded shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">{s.full_name}</p>
                        <p className="text-xs text-slate-400 truncate">{s.email}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">{s.status}</span>
                    </label>
                  ))}
                  {!filteredStudents.length && <p className="text-sm text-slate-400 text-center py-8">No students found</p>}
                </div>

              </>
            )}

            {sendStep === 'preview' && (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                  <strong>Preview</strong> — showing email rendered with data from first selected recipient.
                </div>

                {sendPreview ? (
                  <>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">To: {sendPreview.student?.full_name} ({sendPreview.student?.email})</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Subject</span>
                      <p className="text-sm text-slate-900 font-medium mt-1 bg-slate-50 rounded-lg px-3 py-2">{sendPreview.subject}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Body</span>
                      {sendPreview.body && sendPreview.body.includes('<') ? (
                        <div className="mt-1 text-sm text-slate-700 leading-relaxed bg-white border border-slate-200 rounded-lg p-4" dangerouslySetInnerHTML={{ __html: sendPreview.body }} />
                      ) : (
                        <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-white border border-slate-200 rounded-lg p-4">{sendPreview.body}</div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-8">Generating preview...</p>
                )}

                {sendResult && (
                  <div className={`rounded-xl p-3 text-xs whitespace-pre-wrap flex items-center gap-2 ${
                    sendResult.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
                    sendResult.type === 'progress' ? 'bg-sky-50 border border-sky-200 text-sky-800' :
                    sendResult.type === 'partial' ? 'bg-amber-50 border border-amber-200 text-amber-800' :
                    'bg-red-50 border border-red-200 text-red-800'
                  }`}>
                    {sendResult.type === 'progress' && (
                      <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    <span>{sendResult.text}</span>
                  </div>
                )}
              </div>
            )}
            </div>
            {/* Footer */}
            {sendStep === 'recipients' && (
              <div className="shrink-0 px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">{selectedRecipients.length} student{selectedRecipients.length !== 1 ? 's' : ''} selected</p>
                  {needsVariableContext && (needsCourse && !variableCourseId || needsAssignment && !variableAssignmentId || needsExam && !variableExamId) && (
                    <p className="text-[11px] text-red-600 mt-1">Complete Variable Context above to enable preview.</p>
                  )}
                </div>
                <button type="button"
                  disabled={!selectedRecipients.length || (needsCourse && !variableCourseId) || (needsAssignment && !variableAssignmentId) || (needsExam && !variableExamId)}
                  onClick={generateSendPreview}
                  className="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white disabled:opacity-50 shrink-0"
                  title={needsVariableContext && (needsCourse && !variableCourseId || needsAssignment && !variableAssignmentId || needsExam && !variableExamId) ? 'Complete Variable Context first' : 'Review & Send'}
                >Review & Send</button>
              </div>
            )}
            {sendStep === 'preview' && (
              <div className="shrink-0 px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between gap-4">
                {sendResult && sendResult.type !== 'progress' ? (
                  <button type="button" onClick={() => { setSendOpen(false); setSendResult(null) }}
                    className="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white ml-auto"
                  >Close</button>
                ) : (
                  <>
                    <button type="button" onClick={() => setSendStep('recipients')}
                      className="text-sm text-slate-500 hover:text-slate-900 shrink-0"
                    >← Back to recipients</button>
                    <div className="flex gap-2 shrink-0">
                      <button type="button" onClick={() => setSendOpen(false)}
                        className="px-4 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200"
                      >Cancel</button>
                      <button type="button" disabled={!selectedRecipients.length || sending} onClick={handleSend}
                        className="px-6 py-2 text-sm rounded-lg bg-slate-900 text-white disabled:opacity-50 flex items-center gap-1.5"
                      >{sending ? 'Sending…' : <Send size={14} />}
                        {sending ? 'Sending…' : `Send to ${selectedRecipients.length}`}</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
