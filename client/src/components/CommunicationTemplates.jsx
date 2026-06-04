import { useEffect, useState } from 'react'
import { X, Eye, Send, Copy, Archive, FileText, Mail, MessageSquare, Variable, Plus, ChevronDown, ChevronRight, Search, Check, AlertTriangle } from 'lucide-react'
import apiClient from '../api/client'

const CHANNEL_ICONS = { email: Mail, sms: MessageSquare, both: FileText }
const CHANNEL_COLORS = { email: 'bg-sky-100 text-sky-700', sms: 'bg-violet-100 text-violet-700', both: 'bg-amber-100 text-amber-700' }

const CATEGORIES = ['All', 'Onboarding', 'Assessment', 'Graduation', 'General', 'System']

const ALL_STATUSES = ['Applied', 'Under Review', 'Accepted', 'Prospective', 'Active', 'On Hold', 'Suspended', 'Withdrawn', 'Transferred', 'Graduating', 'Completed', 'Graduated', 'Alumni']

export default function CommunicationTemplates({ notify }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [showArchived, setShowArchived] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [editing, setEditing] = useState({})
  const [saving, setSaving] = useState({})
  const [previewData, setPreviewData] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [sendModal, setSendModal] = useState(null)
  const [students, setStudents] = useState([])
  const [selectedRecipients, setSelectedRecipients] = useState([])
  const [sending, setSending] = useState(false)

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

  useEffect(() => { loadTemplates() }, [])

  const filtered = templates.filter((t) => {
    if (t.archived && !showArchived) return false
    if (categoryFilter !== 'All' && t.category !== categoryFilter) return false
    if (search && !t.display_name?.toLowerCase().includes(search.toLowerCase()) && !t.process_key?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleSave = async (id) => {
    setSaving((prev) => ({ ...prev, [id]: true }))
    try {
      const e = editing[id] || {}
      await apiClient.patch(`/email-processes/${id}`, {
        displayName: e.display_name,
        description: e.description,
        category: e.category,
        subjectTemplate: e.subject_template,
        bodyTemplate: e.body_template,
        richBody: e.rich_body,
        channel: e.channel,
        enabled: e.enabled,
        canManualSend: e.can_manual_send,
      })
      notify('Template saved')
      await loadTemplates()
      setExpandedId(null)
    } catch (err) {
      notify(err?.response?.data?.message || 'Save failed')
    } finally {
      setSaving((prev) => ({ ...prev, [id]: false }))
    }
  }

  const handlePreview = async (id) => {
    setPreviewLoading(true)
    try {
      const res = await apiClient.get(`/email-processes/${id}/preview`)
      setPreviewData({ ...res.data, id })
    } catch {
      notify('Preview failed')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleArchive = async (id) => {
    if (!window.confirm('Archive this template? It will be disabled and hidden.')) return
    try {
      await apiClient.patch(`/email-processes/${id}/archive`)
      notify('Template archived')
      await loadTemplates()
    } catch {
      notify('Archive failed')
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

  const handleToggle = async (id) => {
    try {
      await apiClient.patch(`/email-processes/${id}/toggle`)
      await loadTemplates()
    } catch {
      notify('Toggle failed')
    }
  }

  const openSendModal = async (template) => {
    try {
      const res = await apiClient.get('/students')
      setStudents(res.data || [])
      setSelectedRecipients([])
      setSendModal(template)
    } catch {
      notify('Failed to load students')
    }
  }

  const handleSend = async () => {
    if (!selectedRecipients.length) return
    setSending(true)
    try {
      const res = await apiClient.post(`/email-processes/${sendModal.id}/send`, {
        recipientIds: selectedRecipients,
        recipientType: 'student',
      })
      notify(res.data.message || 'Sent successfully')
      setSendModal(null)
    } catch (err) {
      notify(err?.response?.data?.message || 'Send failed')
    } finally {
      setSending(false)
    }
  }

  const insertVariable = (id, key) => {
    setEditing((prev) => {
      const current = prev[id] || {}
      return {
        ...prev,
        [id]: {
          ...current,
          body_template: (current.body_template || '') + ` {{${key}}}`,
        },
      }
    })
  }

  const expandTemplate = (t) => {
    if (expandedId === t.id) {
      setExpandedId(null)
      setEditing((prev) => {
        const next = { ...prev }
        delete next[t.id]
        return next
      })
      return
    }
    setExpandedId(t.id)
    setEditing((prev) => ({
      ...prev,
      [t.id]: {
        display_name: t.display_name,
        description: t.description,
        category: t.category,
        subject_template: t.subject_template,
        body_template: t.body_template,
        rich_body: t.rich_body,
        channel: t.channel,
        enabled: t.enabled,
        can_manual_send: t.can_manual_send,
      },
    }))
  }

  if (loading) {
    return <p className="text-sm text-slate-500 py-8 text-center">Loading templates...</p>
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded"
          />
          Show archived
        </label>
      </div>

      {!filtered.length ? (
        <p className="text-sm text-slate-400 text-center py-12">No templates found</p>
      ) : null}

      <div className="space-y-3">
        {filtered.map((t) => {
          const isExpanded = expandedId === t.id
          const e = editing[t.id] || {}
          const ChannelIcon = CHANNEL_ICONS[t.channel] || Mail
          const isSaving = saving[t.id]

          return (
            <div
              key={t.id}
              className={`bg-white border rounded-2xl shadow-sm transition-all ${
                t.archived ? 'border-slate-200 opacity-60' : 'border-slate-200'
              }`}
            >
              {/* Card header */}
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 rounded-2xl transition-colors"
                onClick={() => expandTemplate(t)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {isExpanded ? <ChevronDown size={16} className="shrink-0 text-slate-400" /> : <ChevronRight size={16} className="shrink-0 text-slate-400" />}
                  <div className="min-w-0">
                    <h4 className="font-semibold text-slate-900 text-sm truncate">{t.display_name}</h4>
                    <p className="text-xs text-slate-400 truncate">{t.description || t.process_key}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${CHANNEL_COLORS[t.channel] || 'bg-slate-100 text-slate-600'}`}>
                    <ChannelIcon size={11} />
                    {t.channel}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${t.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                    {t.enabled ? 'Active' : 'Disabled'}
                  </span>
                  {t.archived && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500">Archived</span>
                  )}
                </div>
              </div>

              {/* Expanded editor */}
              {isExpanded && (
                <div className="border-t border-slate-100 px-5 py-4 space-y-4">
                  {/* Basic fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-sm text-slate-600 block">
                      Display Name
                      <input
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                        value={e.display_name ?? t.display_name}
                        onChange={(ev) => setEditing((prev) => ({ ...prev, [t.id]: { ...prev[t.id], display_name: ev.target.value } }))}
                      />
                    </label>
                    <label className="text-sm text-slate-600 block">
                      Category
                      <select
                        className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                        value={e.category ?? t.category}
                        onChange={(ev) => setEditing((prev) => ({ ...prev, [t.id]: { ...prev[t.id], category: ev.target.value } }))}
                      >
                        {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="text-sm text-slate-600 block">
                    Description
                    <input
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                      value={e.description ?? t.description}
                      onChange={(ev) => setEditing((prev) => ({ ...prev, [t.id]: { ...prev[t.id], description: ev.target.value } }))}
                    />
                  </label>

                  {/* Channel & controls */}
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="text-sm text-slate-600 flex items-center gap-2">
                      Channel
                      <select
                        className="border rounded-lg px-3 py-2 text-sm"
                        value={e.channel ?? t.channel}
                        onChange={(ev) => setEditing((prev) => ({ ...prev, [t.id]: { ...prev[t.id], channel: ev.target.value } }))}
                      >
                        <option value="email">Email</option>
                        <option value="sms">SMS</option>
                        <option value="both">Both</option>
                      </select>
                    </label>
                    <label className="text-sm text-slate-600 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={e.enabled ?? t.enabled}
                        onChange={(ev) => setEditing((prev) => ({ ...prev, [t.id]: { ...prev[t.id], enabled: ev.target.checked } }))}
                        className="rounded"
                      />
                      Enabled
                    </label>
                    <label className="text-sm text-slate-600 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={e.can_manual_send ?? t.can_manual_send}
                        onChange={(ev) => setEditing((prev) => ({ ...prev, [t.id]: { ...prev[t.id], can_manual_send: ev.target.checked } }))}
                        className="rounded"
                      />
                      Allow manual send
                    </label>
                  </div>

                  {/* Variable library + Subject + Body */}
                  <div className="grid grid-cols-[1fr_280px] gap-4">
                    {/* Main editor */}
                    <div className="space-y-3">
                      {/* Subject */}
                      <label className="text-sm text-slate-600 block">
                        Subject Template
                        <div className="mt-1 flex gap-2">
                          <input
                            className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono"
                            value={e.subject_template ?? t.subject_template}
                            onChange={(ev) => setEditing((prev) => ({ ...prev, [t.id]: { ...prev[t.id], subject_template: ev.target.value } }))}
                          />
                        </div>
                      </label>

                      {/* Body */}
                      <label className="text-sm text-slate-600 block">
                        Body Template
                        <textarea
                          className="mt-1 w-full border rounded-lg px-3 py-2 text-sm font-mono leading-relaxed"
                          rows={10}
                          value={e.body_template ?? t.body_template}
                          onChange={(ev) => setEditing((prev) => ({ ...prev, [t.id]: { ...prev[t.id], body_template: ev.target.value } }))}
                        />
                      </label>
                    </div>

                    {/* Variable library sidebar */}
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
                        <Variable size={13} />
                        Variable Library
                      </div>
                      <p className="text-[10px] text-slate-400 mb-2">Click to insert into body</p>
                      <div className="space-y-1 max-h-80 overflow-y-auto">
                        {(t.variables || []).map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => insertVariable(t.id, v.variable_key)}
                            className="w-full text-left rounded-lg px-2.5 py-2 text-xs hover:bg-white hover:shadow-sm transition-all group"
                            title={v.description || ''}
                          >
                            <span className="font-mono text-sky-700 group-hover:text-sky-900 transition-colors">{`{{${v.variable_key}}}`}</span>
                            <span className="block text-slate-400 text-[10px] mt-0.5 truncate">{v.display_label}</span>
                            {v.description && (
                              <span className="block text-slate-300 text-[9px] mt-0.5 truncate">{v.description}</span>
                            )}
                          </button>
                        ))}
                        {(!t.variables || !t.variables.length) && (
                          <p className="text-[10px] text-slate-400 italic py-2">No variables defined</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePreview(t.id)}
                        disabled={previewLoading}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                      >
                        <Eye size={14} />
                        {previewLoading ? 'Loading…' : 'Preview'}
                      </button>
                      {(t.can_manual_send || e.can_manual_send) && (
                        <button
                          type="button"
                          onClick={() => openSendModal(t)}
                          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <Send size={14} />
                          Send
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDuplicate(t.id)}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <Copy size={14} />
                        Duplicate
                      </button>
                      {!t.archived && (
                        <button
                          type="button"
                          onClick={() => handleArchive(t.id)}
                          className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Archive size={14} />
                          Archive
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSave(t.id)}
                      className="bg-slate-900 text-white rounded-xl px-6 py-1.5 text-sm font-medium shadow-sm hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isSaving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>

                  {/* Preview pane */}
                  {previewData && previewData.id === t.id && (
                    <div className="bg-white border border-slate-200 rounded-xl p-4 mt-2">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                          <Eye size={13} />
                          Rendered Preview
                        </h5>
                        <button
                          type="button"
                          onClick={() => setPreviewData(null)}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Subject</span>
                          <p className="text-slate-900 font-medium mt-0.5">{previewData.subject}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Body (rendered)</span>
                          <div className="mt-0.5 text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-lg p-3 text-sm">
                            {previewData.body}
                          </div>
                        </div>
                        {previewData.richBody && (
                          <div>
                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Rich Body (raw)</span>
                            <div className="mt-0.5 text-slate-700 text-xs bg-slate-50 rounded-lg p-3 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                              {previewData.richBody}
                            </div>
                          </div>
                        )}
                        {previewData.variables?.length > 0 && (
                          <div className="border-t border-slate-100 pt-2">
                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Sample Variable Values</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {previewData.variables.map((v) => (
                                <span key={v.id} className="text-[10px] font-mono bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded">
                                  {v.variable_key}={v.example_value || `[${v.variable_key}]`}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Preview modal (full-screen overlay for preview) */}
      {/* Note: inline preview is shown inside expanded card */}

      {/* Send modal */}
      {sendModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSendModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Send Template</h3>
              <button type="button" onClick={() => setSendModal(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Send <strong>{sendModal.display_name}</strong> to selected students
            </p>

            {/* Search + select all */}
            <div className="flex items-center gap-2 mb-3">
              <input
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
                placeholder="Search students..."
                onChange={(e) => {
                  const q = e.target.value.toLowerCase()
                  const filtered = students.filter(
                    (s) => s.full_name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)
                  )
                  setSelectedRecipients(filtered.map((s) => s.id))
                }}
              />
              <button
                type="button"
                className="text-xs text-slate-500 hover:text-slate-900 font-medium"
                onClick={() => {
                  if (selectedRecipients.length === students.length) {
                    setSelectedRecipients([])
                  } else {
                    setSelectedRecipients(students.map((s) => s.id))
                  }
                }}
              >
                {selectedRecipients.length === students.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            {/* Student list */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
              {students.map((s) => (
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
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{s.full_name}</p>
                    <p className="text-xs text-slate-400 truncate">{s.email}</p>
                  </div>
                  <span className="ml-auto text-xs text-slate-400 shrink-0">{s.status}</span>
                </label>
              ))}
              {!students.length && (
                <p className="text-sm text-slate-400 text-center py-8">No students found</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
              <p className="text-sm text-slate-500">
                {selectedRecipients.length} student{selectedRecipients.length !== 1 ? 's' : ''} selected
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-4 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200"
                  onClick={() => setSendModal(null)}
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
