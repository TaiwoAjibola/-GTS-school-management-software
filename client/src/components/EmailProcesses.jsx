import { useEffect, useRef, useState } from 'react'
import { X, Eye, Send, Copy, Trash2, Plus, Search, Variable, ChevronDown, ChevronRight, Pen, Mail, MessageSquare, Smartphone, Bell, Clock, User, Check } from 'lucide-react'
import apiClient from '../api/client'

const CHANNEL_ICONS = { email: Mail, sms: MessageSquare, both: MessageSquare, whatsapp: Smartphone, push: Bell, in_app: Bell }
const CHANNEL_OPTIONS = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'both', label: 'Email + SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'push', label: 'Push Notification' },
  { value: 'in_app', label: 'In-App Notification' },
]

export default function EmailProcesses({ notify }) {
  // Templates
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [form, setForm] = useState({ name: '', subject_template: '', body_template: '', channel: 'email' })
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  // Variable library
  const [variables, setVariables] = useState([])
  const [varCategories, setVarCategories] = useState([])
  const [varSearch, setVarSearch] = useState('')
  const [varCategoryFilter, setVarCategoryFilter] = useState('')
  const [focusedField, setFocusedField] = useState('body') // 'subject' or 'body'

  // Preview
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Send
  const [sendOpen, setSendOpen] = useState(false)
  const [students, setStudents] = useState([])
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedRecipients, setSelectedRecipients] = useState([])
  const [sending, setSending] = useState(false)

  const bodyRef = useRef(null)
  const subjectRef = useRef(null)

  const loadTemplates = async () => {
    try {
      const res = await apiClient.get('/email-processes')
      setTemplates(res.data || [])
    } catch {
      notify('Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const loadVariables = async () => {
    try {
      const [varsRes, catsRes] = await Promise.all([
        apiClient.get('/email-processes/variables/all'),
        apiClient.get('/email-processes/variables/categories'),
      ])
      setVariables(varsRes.data || [])
      setVarCategories(catsRes.data || [])
    } catch {
      // silent
    }
  }

  useEffect(() => {
    loadTemplates()
    loadVariables()
  }, [])

  const selectTemplate = (t) => {
    setSelectedId(t.id)
    setIsNew(false)
    setForm({
      name: t.name || '',
      subject_template: t.subject_template || '',
      body_template: t.body_template || '',
      channel: t.channel || 'email',
    })
  }

  const newTemplate = () => {
    setSelectedId(null)
    setIsNew(true)
    setForm({ name: '', subject_template: '', body_template: '', channel: 'email' })
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
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    try {
      await apiClient.delete(`/email-processes/${id}`)
      if (selectedId === id) { setSelectedId(null); setIsNew(false); setForm({ name: '', subject_template: '', body_template: '', channel: 'email' }) }
      notify('Template deleted')
      await loadTemplates()
    } catch {
      notify('Delete failed')
    }
  }

  const handleDuplicate = async (id) => {
    try {
      await apiClient.post(`/email-processes/${id}/duplicate`)
      notify('Template duplicated')
      await loadTemplates()
    } catch {
      notify('Duplicate failed')
    }
  }

  const handlePreview = async (id) => {
    setPreviewLoading(true)
    try {
      const res = await apiClient.get(`/email-processes/${id}/preview`)
      setPreviewData(res.data)
      setPreviewOpen(true)
    } catch {
      notify('Preview failed')
    } finally {
      setPreviewLoading(false)
    }
  }

  const insertVariable = (key) => {
    const tmpl = `{{${key}}}`
    if (focusedField === 'subject') {
      setForm((prev) => ({ ...prev, subject_template: (prev.subject_template || '') + tmpl }))
      if (subjectRef.current) {
        subjectRef.current.focus()
        const start = subjectRef.current.selectionStart
        const end = subjectRef.current.selectionStart
        const val = subjectRef.current.value
        subjectRef.current.value = val.slice(0, start) + tmpl + val.slice(end)
        subjectRef.current.selectionStart = subjectRef.current.selectionEnd = start + tmpl.length
      }
    } else {
      setForm((prev) => ({ ...prev, body_template: (prev.body_template || '') + tmpl }))
      if (bodyRef.current) {
        bodyRef.current.focus()
        const start = bodyRef.current.selectionStart
        const end = bodyRef.current.selectionStart
        const val = bodyRef.current.value
        bodyRef.current.value = val.slice(0, start) + tmpl + val.slice(end)
        bodyRef.current.selectionStart = bodyRef.current.selectionEnd = start + tmpl.length
      }
    }
  }

  const openSend = async () => {
    try {
      const res = await apiClient.get('/students')
      setStudents(res.data || [])
      setSelectedRecipients([])
      setStudentSearch('')
      setSendOpen(true)
    } catch {
      notify('Failed to load students')
    }
  }

  const handleSend = async () => {
    if (!selectedRecipients.length) return
    setSending(true)
    try {
      const res = await apiClient.post(`/email-processes/${selectedId}/send`, {
        recipientIds: selectedRecipients,
      })
      notify(res.data.message || 'Sent successfully')
      setSendOpen(false)
    } catch (err) {
      notify(err?.response?.data?.message || 'Send failed')
    } finally {
      setSending(false)
    }
  }

  const filteredVars = variables.filter((v) => {
    if (varCategoryFilter && v.category !== varCategoryFilter) return false
    if (varSearch) {
      const q = varSearch.toLowerCase()
      return (
        v.display_label?.toLowerCase().includes(q) ||
        v.variable_key?.toLowerCase().includes(q) ||
        v.description?.toLowerCase().includes(q)
      )
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
    if (allSelected) {
      setSelectedRecipients((prev) => prev.filter((id) => !ids.includes(id)))
    } else {
      setSelectedRecipients((prev) => [...new Set([...prev, ...ids])])
    }
  }

  const selectedTemplate = templates.find((t) => t.id === selectedId)

  if (loading) {
    return <p className="text-sm text-slate-500 py-12 text-center">Loading templates...</p>
  }

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
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {Object.entries(groupedVars).map(([cat, vars]) => (
            <div key={cat}>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide px-2 py-1">{cat}</p>
              {vars.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => insertVariable(v.variable_key)}
                  className="w-full text-left rounded-lg px-2.5 py-2 text-xs hover:bg-slate-50 transition-colors group"
                  title={v.description || ''}
                >
                  <span className="font-mono text-sky-700 text-[11px] group-hover:text-sky-900">{`{{${v.variable_key}}}`}</span>
                  <span className="block text-slate-500 text-[10px] mt-0.5 truncate">{v.display_label}</span>
                </button>
              ))}
            </div>
          ))}
          {!filteredVars.length && (
            <p className="text-xs text-slate-400 text-center py-6">No variables match your search</p>
          )}
        </div>
      </div>

      {/* ── Center Panel: Template Builder ── */}
      <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
        {selectedId || isNew ? (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                {isNew ? 'New Template' : 'Edit Template'}
              </h3>
              <div className="flex items-center gap-2">
                {selectedId && (
                  <>
                    <button
                      type="button"
                      onClick={() => handlePreview(selectedId)}
                      disabled={previewLoading}
                      className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <Eye size={14} />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={openSend}
                      className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <Send size={14} />
                      Send
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-[1fr_180px] gap-3">
                <label className="text-sm text-slate-600 block">
                  Template Name
                  <input
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="e.g. Assignment Reminder"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </label>
                <label className="text-sm text-slate-600 block">
                  Channel
                  <select
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.channel}
                    onChange={(e) => setForm((prev) => ({ ...prev, channel: e.target.value }))}
                  >
                    {CHANNEL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="text-sm text-slate-600 block">
                Subject
                <input
                  ref={subjectRef}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm font-mono"
                  placeholder="e.g. New Assignment: {{assignment_title}}"
                  value={form.subject_template}
                  onFocus={() => setFocusedField('subject')}
                  onChange={(e) => setForm((prev) => ({ ...prev, subject_template: e.target.value }))}
                />
              </label>
              <label className="text-sm text-slate-600 block flex-1 flex flex-col">
                Body
                <textarea
                  ref={bodyRef}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm font-mono leading-relaxed flex-1 min-h-[250px]"
                  placeholder="Write your email body here. Use {{variable_name}} to personalize."
                  value={form.body_template}
                  onFocus={() => setFocusedField('body')}
                  onChange={(e) => setForm((prev) => ({ ...prev, body_template: e.target.value }))}
                />
              </label>
            </div>
            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setSelectedId(null); setIsNew(false) }}
                className="px-4 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="px-6 py-2 text-sm rounded-lg bg-slate-900 text-white disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving ? 'Saving…' : isNew ? 'Create Template' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center flex-1">
            <div className="text-center">
              <Pen size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-400">Select a template or create a new one</p>
              <button
                type="button"
                onClick={newTemplate}
                className="mt-3 inline-flex items-center gap-1.5 bg-slate-900 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-slate-800"
              >
                <Plus size={15} />
                New Template
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Right Panel: My Templates ── */}
      <div className="w-80 shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">My Templates</h3>
          <button
            type="button"
            onClick={newTemplate}
            className="flex items-center gap-1 text-xs font-medium bg-slate-900 text-white rounded-lg px-3 py-1.5 hover:bg-slate-800 transition-colors"
          >
            <Plus size={13} />
            New
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {templates.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">No templates yet. Create your first one!</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className={`px-3 py-3 transition-colors ${selectedId === t.id ? 'bg-sky-50 border-l-2 border-sky-500' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="min-w-0 flex-1 cursor-pointer"
                      onClick={() => selectTemplate(t)}
                    >
                      <p className="text-sm font-medium text-slate-900 truncate">{t.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {t.updated_at ? new Date(t.updated_at).toLocaleDateString() : '—'}
                        {t.creator_name ? ` · by ${t.creator_name}` : ''}
                      </p>
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400 mt-1">
                        {CHANNEL_ICONS[t.channel] && <Mail size={10} />}
                        {t.channel}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => selectTemplate(t)}
                        className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700"
                        title="Edit"
                      >
                        <Pen size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(t.id)}
                        className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700"
                        title="Duplicate"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePreview(t.id)}
                        className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700"
                        title="Preview"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(t.id, t.name)}
                        className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
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
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 flex items-center gap-1.5">
                <Eye size={16} />
                Template Preview
              </h3>
              <button type="button" onClick={() => setPreviewOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Subject</span>
                <p className="text-sm text-slate-900 font-medium mt-1 bg-slate-50 rounded-lg px-3 py-2">{previewData.subject}</p>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Body (rendered with sample data)</span>
                <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-lg p-3">
                  {previewData.body}
                </div>
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
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSendOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Send size={16} />
                  Send Template
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sending <strong>{selectedTemplate?.name}</strong>
                </p>
              </div>
              <button type="button" onClick={() => setSendOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm"
                  placeholder="Search students..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="text-xs text-slate-500 hover:text-slate-900 font-medium"
                onClick={selectAllFiltered}
              >
                {filteredStudents.every((s) => selectedRecipients.includes(s.id))
                  ? 'Deselect visible'
                  : 'Select visible'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl min-h-[200px]">
              {filteredStudents.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 transition-colors ${
                    selectedRecipients.includes(s.id) ? 'bg-sky-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedRecipients.includes(s.id)}
                    onChange={() => {
                      setSelectedRecipients((prev) =>
                        prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                      )
                    }}
                    className="rounded shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{s.full_name}</p>
                    <p className="text-xs text-slate-400 truncate">{s.email}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">{s.status}</span>
                </label>
              ))}
              {!filteredStudents.length && (
                <p className="text-sm text-slate-400 text-center py-8">No students found</p>
              )}
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
              <p className="text-sm text-slate-500">
                {selectedRecipients.length} student{selectedRecipients.length !== 1 ? 's' : ''} selected
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-4 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200"
                  onClick={() => setSendOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedRecipients.length || sending}
                  className="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white disabled:opacity-50 flex items-center gap-1.5"
                  onClick={handleSend}
                >
                  {sending ? 'Sending…' : <Send size={14} />}
                  {sending ? 'Sending…' : `Send to ${selectedRecipients.length}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
