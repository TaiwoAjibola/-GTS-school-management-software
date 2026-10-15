import { useEffect, useMemo, useState } from 'react'
import { X, Send, Mail, FileText, Loader2 } from 'lucide-react'
import apiClient from '../api/client'

function resolveEmail(sub, fields) {
  if (sub.submitter_email) return sub.submitter_email
  const emailField = fields.find((f) => f.field_type === 'email')
  if (!emailField) return null
  const v = sub.data?.[emailField.id]
  if (Array.isArray(v)) return v[0] || null
  return v || null
}

function buildVars(sub, fields) {
  const vars = {
    submitter_name: sub.submitter_name || '',
    submitter_email: sub.submitter_email || '',
  }
  for (const f of fields) {
    let v = sub.data?.[f.id]
    if (Array.isArray(v)) v = v.join(', ')
    else if (v != null && typeof v === 'object') v = JSON.stringify(v)
    vars[f.label] = v == null ? '' : String(v)
  }
  return vars
}

function substitute(template, vars) {
  if (!template) return ''
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key) => {
    const k = String(key).trim().toLowerCase()
    const matchKey = Object.keys(vars).find((vk) => vk.toLowerCase() === k)
    return matchKey ? (vars[matchKey] ?? '') : ''
  })
}

export default function EmailComposeModal({ open, onClose, formId, submissions, fields, onSent }) {
  const [templates, setTemplates] = useState([])
  const [templateId, setTemplateId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const emailable = useMemo(
    () => submissions.filter((s) => resolveEmail(s, fields)),
    [submissions, fields]
  )
  const skippedCount = submissions.length - emailable.length

  const previewVars = useMemo(() => {
    if (!emailable.length) return {}
    return buildVars(emailable[0], fields)
  }, [emailable, fields])

  useEffect(() => {
    if (!open) return
    setError('')
    setSending(false)
    setTemplateId('')
    setSubject('')
    setBody('')
    apiClient
      .get('/email-processes')
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => setTemplates([]))
  }, [open])

  if (!open) return null

  const loadTemplate = (id) => {
    setTemplateId(id)
    const t = templates.find((x) => String(x.id) === String(id))
    if (t) {
      setSubject(t.subject_template || '')
      setBody(t.body_template || '')
    }
  }

  const previewSubject = substitute(subject, previewVars)
  const previewBody = substitute(body, previewVars)

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      setError('Subject and body are required')
      return
    }
    if (!emailable.length) {
      setError('None of the selected submissions have an email address')
      return
    }
    setSending(true)
    setError('')
    try {
      const res = await apiClient.post(`/forms/${formId}/submissions/email`, {
        submissionIds: emailable.map((s) => s.id),
        subject,
        body,
      })
      onSent?.(res.data)
    } catch (e) {
      setError(e?.message || 'Failed to send emails')
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Mail size={18} className="text-indigo-600" /> Email Submissions
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 font-medium">
              {emailable.length} will receive
            </span>
            {skippedCount > 0 && (
              <span className="rounded-full bg-amber-50 text-amber-700 px-2.5 py-0.5 font-medium">
                {skippedCount} skipped (no email)
              </span>
            )}
            <span className="text-slate-400">of {submissions.length} selected</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Use saved template (optional)</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={templateId}
              onChange={(e) => loadTemplate(e.target.value)}
            >
              <option value="">— Compose from scratch —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Subject</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Thank you for your submission"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Message
            </label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm"
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Use {{Field Label}} to personalize, e.g. Dear {{Full Name}}"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Available tokens: <code className="font-mono">{'{{submitter_name}}'}</code>,{' '}
              <code className="font-mono">{'{{submitter_email}}'}</code>, and any form field label.
            </p>
          </div>

          {emailable.length > 0 && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
                <FileText size={13} /> Preview (first recipient)
              </div>
              <div className="text-sm font-medium text-slate-800">{previewSubject || <span className="text-slate-400">—</span>}</div>
              <div
                className="text-sm text-slate-600 mt-1 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: previewBody.replace(/\n/g, '<br>') || '<span class="text-slate-400">—</span>' }}
              />
            </div>
          )}

          {error && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !emailable.length}
            className="flex items-center gap-2 rounded-lg bg-[#4F46E5] text-white px-4 py-2 text-sm font-semibold hover:bg-[#4338ca] disabled:opacity-60"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Send {emailable.length > 0 ? `(${emailable.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
