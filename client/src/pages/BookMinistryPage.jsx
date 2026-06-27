import { useEffect, useMemo, useState } from 'react'
import { BookOpen, BookmarkCheck, Library, RefreshCw, Link2, FileText, Shield, Settings, Sliders, ExternalLink } from 'lucide-react'
import AppShell from '../components/AppShell'
import apiClient from '../api/client'
import { lecturerNavItems } from '../constants/lecturerNav'
import { fmtDate } from '../utils/formatDate'

const tabs = [
  { key: 'overview', label: 'Overview', icon: Library },
  { key: 'linked', label: 'Linked Accounts', icon: Link2 },
  { key: 'borrowing', label: 'Borrowing', icon: BookOpen },
  { key: 'reading', label: 'Reading Records', icon: BookmarkCheck },
  { key: 'permissions', label: 'Permissions', icon: Shield },
  { key: 'access-rules', label: 'Access Rules', icon: Sliders },
  { key: 'requests', label: 'Book Requests', icon: FileText },
  { key: 'integration', label: 'Integration', icon: Settings },
]

const statusBadge = (status, colors) => {
  const color = colors[status] || 'bg-slate-100 text-slate-700'
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>{status}</span>
}

export default function BookMinistryPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [settings, setSettings] = useState([])
  const [linkedAccounts, setLinkedAccounts] = useState([])
  const [borrowing, setBorrowing] = useState([])
  const [readingRecords, setReadingRecords] = useState([])
  const [permissions, setPermissions] = useState([])
  const [accessRules, setAccessRules] = useState([])
  const [bookRequests, setBookRequests] = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [borrowStudentFilter, setBorrowStudentFilter] = useState('')
  const [readingStudentFilter, setReadingStudentFilter] = useState('')

  const notify = (msg) => {
    setNotice(msg)
    setTimeout(() => setNotice(''), 3500)
  }

  const loadAll = async () => {
    setLoading(true)
    try {
      const [
        statsRes, settingsRes, linkedRes, borrowingRes,
        readingRes, permsRes, rulesRes, requestsRes, studentsRes,
      ] = await Promise.allSettled([
        apiClient.get('/book-ministry/stats'),
        apiClient.get('/book-ministry/settings'),
        apiClient.get('/book-ministry/linked-accounts'),
        apiClient.get('/book-ministry/borrowing'),
        apiClient.get('/book-ministry/reading'),
        apiClient.get('/book-ministry/permissions'),
        apiClient.get('/book-ministry/access-rules'),
        apiClient.get('/book-ministry/requests'),
        apiClient.get('/students'),
      ])

      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data)
      if (settingsRes.status === 'fulfilled') setSettings(settingsRes.value.data)
      if (linkedRes.status === 'fulfilled') setLinkedAccounts(linkedRes.value.data)
      if (borrowingRes.status === 'fulfilled') setBorrowing(borrowingRes.value.data)
      if (readingRes.status === 'fulfilled') setReadingRecords(readingRes.value.data)
      if (permsRes.status === 'fulfilled') setPermissions(permsRes.value.data)
      if (rulesRes.status === 'fulfilled') setAccessRules(rulesRes.value.data)
      if (requestsRes.status === 'fulfilled') setBookRequests(requestsRes.value.data)
      if (studentsRes.status === 'fulfilled') setAllStudents(studentsRes.value.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const studentMap = useMemo(() => {
    const m = new Map()
    allStudents.forEach((s) => m.set(s.id, s))
    return m
  }, [allStudents])

  const settingMap = useMemo(() => {
    const m = new Map()
    settings.forEach((s) => m.set(s.key, s))
    return m
  }, [settings])

  const settingVal = (key, fallback = '') => {
    const s = settingMap.get(key)
    return s ? s.value : fallback
  }

  const filteredBorrowing = useMemo(() => {
    if (!borrowStudentFilter) return borrowing
    return borrowing.filter((b) => String(b.student_id) === borrowStudentFilter)
  }, [borrowing, borrowStudentFilter])

  const filteredReading = useMemo(() => {
    if (!readingStudentFilter) return readingRecords
    return readingRecords.filter((r) => String(r.student_id) === readingStudentFilter)
  }, [readingRecords, readingStudentFilter])

  return (
    <AppShell title="Book Ministry" navItems={lecturerNavItems}>
      {notice ? (
        <div className="mb-4 rounded-lg bg-emerald-100 text-emerald-800 px-4 py-2 text-sm">{notice}</div>
      ) : null}

      {/* Header */}
      <div className="mb-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-1">
            <Library size={24} className="text-slate-700" />
            <h2 className="text-2xl font-bold text-slate-900">Book Ministry</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Manage library-linked student accounts, borrowing records, reading progress, and access permissions.
            This module connects GTS student data with the Book Ministry application.
          </p>
          <div className="mt-3 flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <span className={`inline-block h-2 w-2 rounded-full ${settingVal('enabled') === 'true' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              {settingVal('enabled') === 'true' ? 'Enabled' : 'Disabled'}
            </span>
            <span className="text-xs text-slate-400">{settingVal('notification_email') ? `Notifications: ${settingVal('notification_email')}` : 'No notification email set'}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-5 bg-slate-100 rounded-xl p-1 w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Loading...</p>
      ) : (
        <>
          {/* Overview */}
          {activeTab === 'overview' && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                  { label: 'Linked Accounts', value: stats.linkedAccounts, color: 'text-sky-600', bg: 'bg-sky-50' },
                  { label: 'Active Borrows', value: stats.activeBorrows, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Active Reading', value: stats.activeReading, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Active Permissions', value: stats.activePermissions, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                  { label: 'Pending Requests', value: stats.pendingRequests, color: 'text-purple-600', bg: 'bg-purple-50' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`rounded-xl border border-slate-200 p-4 ${bg}`}>
                    <p className="text-3xl font-bold ${color}">{value}</p>
                    <p className="text-xs text-slate-500 mt-1">{label}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-2">Integration Status</h3>
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Book Ministry Feature</p>
                    <p className="font-medium text-slate-800">{settingVal('enabled') === 'true' ? 'Enabled' : 'Disabled'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Max Requests per Student</p>
                    <p className="font-medium text-slate-800">{settingVal('max_requests_per_student', '5')}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Notification Email</p>
                    <p className="font-medium text-slate-800">{settingVal('notification_email') || 'Not configured'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">External Sync</p>
                    <p className="font-medium text-slate-800">Book Ministry App (external)</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Linked Accounts */}
          {activeTab === 'linked' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">Linked Accounts</h3>
                <span className="text-xs text-slate-500">{linkedAccounts.length} linked</span>
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="pb-2">Student</th>
                    <th>Matric</th>
                    <th>Status</th>
                    <th>External Account ID</th>
                    <th>System</th>
                    <th>Linked At</th>
                    <th>Last Synced</th>
                  </tr>
                </thead>
                <tbody>
                  {linkedAccounts.map((a) => (
                    <tr key={a.id} className="border-t border-slate-200">
                      <td className="py-3 font-medium text-slate-900">{a.full_name}</td>
                      <td>{a.matric_no || '—'}</td>
                      <td>{statusBadge(a.student_status, { Active: 'bg-emerald-100 text-emerald-800', Graduating: 'bg-blue-100 text-blue-800', Graduated: 'bg-purple-100 text-purple-800' })}</td>
                      <td><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{a.external_account_id}</code></td>
                      <td>{a.external_system}</td>
                      <td className="whitespace-nowrap">{fmtDate(a.linked_at)}</td>
                      <td className="whitespace-nowrap">{a.last_synced_at ? fmtDate(a.last_synced_at) : '—'}</td>
                    </tr>
                  ))}
                  {!linkedAccounts.length && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">No linked accounts. Sync data from the Book Ministry app to populate.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Borrowing */}
          {activeTab === 'borrowing' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <h3 className="font-semibold text-slate-900">Borrowing History</h3>
                <select
                  className="border rounded-lg px-3 py-2 text-sm"
                  value={borrowStudentFilter}
                  onChange={(e) => setBorrowStudentFilter(e.target.value)}
                >
                  <option value="">All Students</option>
                  {allStudents.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="pb-2">Student</th>
                    <th>Book Title</th>
                    <th>Author</th>
                    <th>ISBN</th>
                    <th>Borrowed</th>
                    <th>Due</th>
                    <th>Returned</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBorrowing.map((b) => (
                    <tr key={b.id} className="border-t border-slate-200">
                      <td className="py-3 font-medium text-slate-900">{b.full_name}</td>
                      <td>{b.book_title}</td>
                      <td className="text-slate-500">{b.author || '—'}</td>
                      <td>{b.isbn || '—'}</td>
                      <td className="whitespace-nowrap">{fmtDate(b.borrowed_at)}</td>
                      <td className="whitespace-nowrap">{b.due_at ? fmtDate(b.due_at) : '—'}</td>
                      <td className="whitespace-nowrap">{b.returned_at ? fmtDate(b.returned_at) : '—'}</td>
                      <td>{statusBadge(b.status, { borrowed: 'bg-blue-100 text-blue-800', returned: 'bg-emerald-100 text-emerald-800', overdue: 'bg-red-100 text-red-800', lost: 'bg-slate-200 text-slate-700' })}</td>
                    </tr>
                  ))}
                  {!filteredBorrowing.length && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">No borrowing records yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Reading Records */}
          {activeTab === 'reading' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <h3 className="font-semibold text-slate-900">Reading Records</h3>
                <select
                  className="border rounded-lg px-3 py-2 text-sm"
                  value={readingStudentFilter}
                  onChange={(e) => setReadingStudentFilter(e.target.value)}
                >
                  <option value="">All Students</option>
                  {allStudents.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name}</option>
                  ))}
                </select>
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="pb-2">Student</th>
                    <th>Book Title</th>
                    <th>Author</th>
                    <th>Progress</th>
                    <th>Started</th>
                    <th>Completed</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReading.map((r) => (
                    <tr key={r.id} className="border-t border-slate-200">
                      <td className="py-3 font-medium text-slate-900">{r.full_name}</td>
                      <td>{r.book_title}</td>
                      <td className="text-slate-500">{r.author || '—'}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-200 rounded-full h-2">
                            <div
                              className="bg-slate-900 rounded-full h-2 transition-all"
                              style={{ width: `${Math.min(r.progress_percentage || 0, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">{r.progress_percentage || 0}%</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap">{r.started_at ? fmtDate(r.started_at) : '—'}</td>
                      <td className="whitespace-nowrap">{r.completed_at ? fmtDate(r.completed_at) : '—'}</td>
                      <td>{statusBadge(r.status, { reading: 'bg-blue-100 text-blue-800', completed: 'bg-emerald-100 text-emerald-800', paused: 'bg-amber-100 text-amber-800', abandoned: 'bg-slate-100 text-slate-500' })}</td>
                    </tr>
                  ))}
                  {!filteredReading.length && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">No reading records yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Permissions */}
          {activeTab === 'permissions' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">Library Permissions</h3>
                <span className="text-xs text-slate-500">{permissions.length} total</span>
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="pb-2">Student</th>
                    <th>Matric</th>
                    <th>Permission</th>
                    <th>Granted At</th>
                    <th>Expires</th>
                    <th>Granted By</th>
                    <th>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {permissions.map((p) => (
                    <tr key={p.id} className="border-t border-slate-200">
                      <td className="py-3 font-medium text-slate-900">{p.student_name}</td>
                      <td>{p.matric_no || '—'}</td>
                      <td><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{p.permission_type}</code></td>
                      <td className="whitespace-nowrap">{fmtDate(p.granted_at)}</td>
                      <td className="whitespace-nowrap">{p.expires_at ? fmtDate(p.expires_at) : 'Never'}</td>
                      <td>{p.granted_by_name || '—'}</td>
                      <td>{statusBadge(p.is_active ? 'active' : 'revoked', { active: 'bg-emerald-100 text-emerald-800', revoked: 'bg-slate-100 text-slate-500' })}</td>
                    </tr>
                  ))}
                  {!permissions.length && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">No permissions assigned yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Access Rules */}
          {activeTab === 'access-rules' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
              <h3 className="font-semibold text-slate-900 mb-4">Access Rules by Student Status</h3>
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="pb-2">Student Status</th>
                    <th>Max Borrow Limit</th>
                    <th>Borrowing Days</th>
                    <th>Can Request Books</th>
                    <th>Digital Access</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {accessRules.map((r) => (
                    <tr key={r.id} className="border-t border-slate-200">
                      <td className="py-3 font-medium text-slate-900">{r.student_status}</td>
                      <td>{r.max_borrow_limit}</td>
                      <td>{r.borrowing_days}</td>
                      <td>{r.can_request_books ? <span className="text-emerald-600 font-medium">Yes</span> : <span className="text-red-500 font-medium">No</span>}</td>
                      <td>{r.digital_access ? <span className="text-emerald-600 font-medium">Yes</span> : <span className="text-red-500 font-medium">No</span>}</td>
                      <td className="text-slate-500 max-w-60 truncate">{r.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Book Requests (from 012) */}
          {activeTab === 'requests' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">Book Requests</h3>
                <span className="text-xs text-slate-500">{bookRequests.length} requests</span>
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="pb-2">Student</th>
                    <th>Matric</th>
                    <th>Book Title</th>
                    <th>Author</th>
                    <th>ISBN</th>
                    <th>Requested By</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookRequests.map((r) => (
                    <tr key={r.id} className="border-t border-slate-200">
                      <td className="py-3 font-medium text-slate-900">{r.student_name}</td>
                      <td>{r.matric_no || '—'}</td>
                      <td>{r.book_title}</td>
                      <td className="text-slate-500">{r.author || '—'}</td>
                      <td>{r.isbn || '—'}</td>
                      <td>{r.requested_by_name || '—'}</td>
                      <td className="whitespace-nowrap">{fmtDate(r.created_at)}</td>
                      <td>{statusBadge(r.status, { pending: 'bg-amber-100 text-amber-800', approved: 'bg-blue-100 text-blue-800', fulfilled: 'bg-emerald-100 text-emerald-800', cancelled: 'bg-slate-100 text-slate-500' })}</td>
                    </tr>
                  ))}
                  {!bookRequests.length && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">No book requests yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Integration */}
          {activeTab === 'integration' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2 mb-4">
                  <ExternalLink size={16} />
                  Book Ministry Application Integration
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  GTS Book Ministry is designed to sync with an external Book Ministry application.
                  When the Book Ministry app is ready, it will push data into these GTS endpoints:
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { endpoint: 'POST /api/book-ministry/linked-accounts', desc: 'Link a GTS student to their Book Ministry account ID' },
                    { endpoint: 'POST /api/book-ministry/borrowing', desc: 'Record a new book borrowing (sync from external system)' },
                    { endpoint: 'PATCH /api/book-ministry/borrowing/:id', desc: 'Update borrowing status (returned, overdue, lost)' },
                    { endpoint: 'POST /api/book-ministry/reading', desc: 'Record reading progress for a student' },
                    { endpoint: 'PATCH /api/book-ministry/reading/:id', desc: 'Update reading progress and status' },
                    { endpoint: 'POST /api/book-ministry/requests', desc: 'Create book requests from students' },
                  ].map(({ endpoint, desc }) => (
                    <div key={endpoint} className="border border-slate-200 rounded-xl p-3">
                      <code className="text-xs bg-slate-900 text-emerald-300 px-1.5 py-0.5 rounded">{endpoint}</code>
                      <p className="text-xs text-slate-500 mt-1.5">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <h3 className="font-semibold text-slate-900 mb-4">Configuration</h3>
                <div className="space-y-4 max-w-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800">Feature Enabled</p>
                      <p className="text-xs text-slate-500">Enable or disable Book Ministry features across GTS</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={settingVal('enabled') === 'true'}
                        onChange={async (e) => {
                          const val = e.target.checked ? 'true' : 'false'
                          try {
                            await apiClient.patch('/book-ministry/settings', { key: 'enabled', value: val })
                            await loadAll()
                            notify(val === 'true' ? 'Book Ministry enabled' : 'Book Ministry disabled')
                          } catch (err) {
                            notify(err?.response?.data?.message || 'Failed to update setting')
                          }
                        }}
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900" />
                    </label>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 mb-1">Notification Email</p>
                    <div className="flex gap-2">
                      <input
                        className="flex-1 border rounded-lg px-3 py-2 text-sm"
                        defaultValue={settingVal('notification_email')}
                        placeholder="bookministry@example.com"
                        id="notif-email"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const val = document.getElementById('notif-email').value
                          try {
                            await apiClient.patch('/book-ministry/settings', { key: 'notification_email', value: val })
                            notify('Notification email updated')
                          } catch (err) {
                            notify(err?.response?.data?.message || 'Failed to update')
                          }
                        }}
                        className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800 mb-1">Max Requests per Student</p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="w-24 border rounded-lg px-3 py-2 text-sm"
                        defaultValue={settingVal('max_requests_per_student', '5')}
                        id="max-req"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const val = document.getElementById('max-req').value
                          try {
                            await apiClient.patch('/book-ministry/settings', { key: 'max_requests_per_student', value: val })
                            notify('Max requests updated')
                          } catch (err) {
                            notify(err?.response?.data?.message || 'Failed to update')
                          }
                        }}
                        className="bg-slate-900 text-white rounded-lg px-4 py-2 text-sm"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <RefreshCw size={18} className="text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">External Data Source</p>
                    <p className="text-xs text-amber-700 mt-1">
                      The borrowing history, reading records, and linked accounts are intended to be populated
                      by the Book Ministry application. When the external app is built, configure it to send data
                      to the API endpoints listed above. Students are matched via <code className="bg-amber-100 px-1 rounded text-xs">external_account_id</code> linked to their GTS profile.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}
