import { useState } from 'react'
import { ExternalLink, Copy, Check, Globe, Link2, Activity } from 'lucide-react'
import apiClient from '../api/client'

const LMS_URL = 'https://lms.gtslagos.com'
const API_URL = 'https://api.gtslagos.com'

export default function LmsIntegrationPanel({ notify }) {
  const [copied, setCopied] = useState(false)
  const [conn, setConn] = useState(null) // null | 'ok' | 'fail'
  const [testing, setTesting] = useState(false)

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      notify && notify('Copied to clipboard')
    } catch {
      notify && notify('Copy failed')
    }
  }

  const testConnection = async () => {
    setTesting(true)
    setConn(null)
    try {
      const data = await apiClient.get('/settings/public', { auth: false })
      setConn({ ok: true, name: data?.school_name || 'Connected' })
    } catch {
      setConn({ ok: false })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="card card-hover rounded-[24px] border border-slate-200 shadow-sm p-5 bg-white">
        <h4 className="font-semibold text-slate-900 flex items-center gap-2">
          <Globe size={16} className="text-indigo-600" /> Student LMS
        </h4>
        <p className="text-sm text-slate-500 mt-1">
          A separate student-facing app at <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">lms.gtslagos.com</code> built on the indigo bento design. It signs students in with the admin API and consumes the same academic records (courses, enrolments, attendance, exams, results, graduation) — the admin remains the system of record.
        </p>
      </div>

      <div className="card card-hover rounded-[24px] border border-slate-200 shadow-sm bg-white overflow-hidden">
        <div className="shrink-0 px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Link2 size={16} className="text-indigo-600" /> Connection
          </span>
          <span className="text-xs text-slate-400">Settings → Integrations → Student LMS</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-slate-400">LMS App</p>
              <p className="text-sm font-medium text-slate-800 truncate">{LMS_URL}</p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button type="button" onClick={() => copy(LMS_URL)} className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-indigo-600 border border-slate-200" title="Copy">
                {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
              </button>
              <a href={LMS_URL} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-indigo-600 border border-slate-200" title="Open">
                <ExternalLink size={15} />
              </a>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-slate-400">API (shared)</p>
              <p className="text-sm font-medium text-slate-800 truncate">{API_URL}</p>
            </div>
            <button type="button" onClick={() => copy(API_URL)} className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-indigo-600 border border-slate-200" title="Copy">
              {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={testConnection}
              disabled={testing}
              className="flex items-center gap-2 rounded-xl bg-[#4F46E5] text-white px-3 py-2 text-sm font-semibold hover:bg-[#4338ca] disabled:opacity-60"
            >
              <Activity size={14} /> {testing ? 'Testing…' : 'Test connection'}
            </button>
            {conn && (
              <span className={`text-xs font-semibold ${conn.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                {conn.ok ? `Connected — ${conn.name}` : 'Could not reach API'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
