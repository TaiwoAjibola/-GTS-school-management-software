import { useEffect, useState } from 'react'
import { X, Eye, Trash2, Plus, Pen, LayoutTemplate, Sparkles, Palette } from 'lucide-react'
import apiClient from '../api/client'
import WysiwygEditor from './WysiwygEditor'

// Core tokens every format understands. (Form-field tokens like {{Full Name}}
// and student-comm tokens like {{student_name}} also resolve in their context.)
const FORMAT_TOKENS = [
  { token: '{{message}}', label: 'Message' },
  { token: '{{submitter_name}}', label: 'Submitter Name' },
  { token: '{{submitter_email}}', label: 'Submitter Email' },
]

function substitute(html, vars) {
  if (!html) return ''
  return html.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key) => {
    const k = String(key).trim().toLowerCase()
    const matchKey = Object.keys(vars).find((vk) => vk.toLowerCase() === k)
    return matchKey ? (vars[matchKey] ?? '') : `{{${key}}}`
  })
}

export default function EmailFormats({ notify }) {
  const [formats, setFormats] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', html: '' })
  const [previewOpen, setPreviewOpen] = useState(false)

  const load = async () => {
    try {
      const res = await apiClient.get('/email-formats')
      setFormats(res.data || [])
    } catch {
      notify?.('Failed to load email formats')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const select = (f) => {
    setSelectedId(f.id)
    setIsNew(false)
    setForm({ name: f.name || '', description: f.description || '', html: f.html || '' })
  }

  const newFormat = () => {
    setSelectedId(null)
    setIsNew(true)
    setForm({
      name: '',
      description: '',
      html: '<p>Write your email content here. Use <strong>{{message}}</strong> where the message goes.</p>',
    })
  }

  const save = async () => {
    if (!form.name.trim()) { notify?.('Format name is required'); return }
    if (!form.html.trim()) { notify?.('Format HTML is required'); return }
    setSaving(true)
    try {
      if (isNew) {
        const res = await apiClient.post('/email-formats', form)
        setSelectedId(res.data.id)
        setIsNew(false)
        notify?.('Format created')
      } else {
        await apiClient.patch(`/email-formats/${selectedId}`, form)
        notify?.('Format saved')
      }
      await load()
    } catch (err) {
      notify?.(err?.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id, name, isDefault) => {
    if (isDefault) { notify?.('Default formats cannot be deleted'); return }
    if (!window.confirm(`Delete format "${name}"? This cannot be undone.`)) return
    try {
      await apiClient.delete(`/email-formats/${id}`)
      if (selectedId === id) { setSelectedId(null); setIsNew(false); setForm({ name: '', description: '', html: '' }) }
      notify?.('Format deleted')
      await load()
    } catch { notify?.('Delete failed') }
  }

  const previewHtml = substitute(form.html, {
    message: '<p>Your message content will appear here.</p>',
    submitter_name: 'John Doe',
    submitter_email: 'john@example.com',
  })

  if (loading) return <p className="text-sm text-slate-500 py-12 text-center">Loading email formats…</p>

  return (
    <div className="h-full flex gap-4 overflow-hidden">
      {/* Left: list */}
      <div className="w-80 shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
        <div className="shrink-0 p-3 border-b border-slate-100 bg-white flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
            <LayoutTemplate size={15} /> Email Formats
          </h3>
          <button type="button" onClick={newFormat}
            className="flex items-center gap-1 text-xs font-medium bg-slate-900 text-white rounded-lg px-3 py-1.5 hover:bg-slate-800">
            <Plus size={13} /> New
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {formats.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">No formats yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {formats.map((f) => (
                <div key={f.id}
                  className={`px-3 py-3 transition-colors ${selectedId === f.id ? 'bg-indigo-50 border-l-2 border-indigo-500' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => select(f)}>
                      <p className="text-sm font-medium text-slate-900 truncate flex items-center gap-1.5">
                        {f.name}
                        {f.is_default && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            <Sparkles size={9} /> default
                          </span>
                        )}
                      </p>
                      {f.description && (
                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{f.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button type="button" onClick={() => select(f)} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700" title="Edit"><Pen size={13} /></button>
                      <button type="button" onClick={() => remove(f.id, f.name, f.is_default)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600" title="Delete"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="shrink-0 p-3 border-t border-slate-100 text-[11px] text-slate-400">
          Formats are reusable email designs. Pick one whenever you compose or send emails.
        </div>
      </div>

      {/* Right: editor */}
      <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
        {selectedId || isNew ? (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="shrink-0 p-4 border-b border-slate-100 bg-white flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                {isNew ? 'New Email Format' : selectedId ? 'Edit Format' : 'Email Format'}
              </h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPreviewOpen(true)}
                  className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100">
                  <Eye size={14} /> Preview
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
              <label className="text-sm text-slate-600 block">
                Format Name
                <input
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="e.g. Newsletter, Announcement"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </label>
              <label className="text-sm text-slate-600 block">
                Description <span className="text-slate-400 font-normal">(optional)</span>
                <input
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Short note about when to use this format"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </label>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-slate-600 font-medium">Design</span>
                  <span className="text-[11px] text-slate-400">Use the toolbar — no HTML required</span>
                </div>
                <WysiwygEditor
                  key={selectedId || 'new'}
                  value={form.html}
                  onChange={(html) => setForm((p) => ({ ...p, html }))}
                  tokens={FORMAT_TOKENS}
                />
                <p className="text-[11px] text-slate-400 mt-2">
                  Insert <code className="font-mono">{'{{message}}'}</code> where the email&apos;s written content goes, and{' '}
                  <code className="font-mono">{'{{submitter_name}}'}</code> / <code className="font-mono">{'{{submitter_email}}'}</code> for personalization. Form-field tokens (e.g. <code className="font-mono">{'{{Full Name}}'}</code>) also work when sending form submissions.
                </p>
              </div>
            </div>
            <div className="shrink-0 px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-end gap-2">
              <button type="button" onClick={() => { setSelectedId(null); setIsNew(false) }}
                className="px-4 py-2 text-sm rounded-lg bg-slate-100 hover:bg-slate-200">Cancel</button>
              <button type="button" disabled={saving} onClick={save}
                className="px-6 py-2 text-sm rounded-lg bg-[#4F46E5] text-white disabled:opacity-50 flex items-center gap-1.5">
                {saving ? 'Saving…' : isNew ? 'Create Format' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center flex-1">
            <div className="text-center">
              <Palette size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-400">Select a format or create a new one</p>
              <button type="button" onClick={newFormat}
                className="mt-3 inline-flex items-center gap-1.5 bg-slate-900 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-slate-800">
                <Plus size={15} /> New Format
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview modal */}
      {previewOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreviewOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900 flex items-center gap-1.5"><Eye size={16} /> Format Preview</h3>
              <button type="button" onClick={() => setPreviewOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
            </div>
            <div
              className="border border-slate-200 rounded-xl overflow-hidden bg-white"
              dangerouslySetInnerHTML={{ __html: previewHtml || '<p class="text-slate-400 p-4">Nothing to preview</p>' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
