import { useEffect, useMemo, useState } from 'react'
import { BookOpen, BookmarkCheck, Library, RefreshCw, Link2, FileText, Shield, Settings, Sliders, ExternalLink } from 'lucide-react'
import AppShell from '../components/AppShell'
import DataTable from '../components/ui/DataTable'
import apiClient from '../api/client'
import { lecturerNavGroups } from '../constants/lecturerNav'
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
    <AppShell title="Book Ministry" groups={lecturerNavGroups}>
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
                  { label: 'Active Permissions', value: stats.activePermissions, color: 'text-gold-600', bg: 'bg-gold-50' },
                  { label: 'Pending Requests', value: stats.pendingRequests, color: 'text-gold-600', bg: 'bg-gold-50' },
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
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900">Linked Accounts</h3>
                <span className="text-xs text-slate-500">{linkedAccounts.length} linked</span>
              </div>
              <DataTable
                data={linkedAccounts}
                rowKey="id"
                initialPageSize={25}
                emptyMessage="No linked accounts. Sync data from the Book Ministry app to populate."
                globalSearchPlaceholder="Search student, matric, account…"
                defaultSort={{ id: 'full_name', dir: 'asc' }}
                columns={[
                  { id: 'full_name', header: 'Student', accessor: 'full_name', cell: (a) => <span className="font-medium text-slate-900">{a.full_name}</span> },
                  { id: 'matric_no', header: 'Matric', accessor: 'matric_no' },
                  {
                    id: 'student_status',
                    header: 'Status',
                    accessor: 'student_status',
                    filterType: 'select',
                    filterOptions: ['Active', 'Graduating', 'Graduated'],
                    cell: (a) => statusBadge(a.student_status, { Active: 'bg-emerald-100 text-emerald-800', Graduating: 'bg-sky-100 text-sky-800', Graduated: 'bg-gold-100 text-gold-800' }),
                  },
                  {
                    id: 'external_account_id',
                    header: 'External Account ID',
                    accessor: 'external_account_id',
                    cell: (a) => <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{a.external_account_id}</code>,
                  },
                  { id: 'external_system', header: 'System', accessor: 'external_system' },
                  { id: 'linked_at', header: 'Linked At', accessor: 'linked_at', sortType: 'date', cell: (a) => fmtDate(a.linked_at) },
                  { id: 'last_synced_at', header: 'Last Synced', accessor: 'last_synced_at', sortType: 'date', cell: (a) => (a.last_synced_at ? fmtDate(a.last_synced_at) : null) },
                ]}
              />
            </div>
          )}

          {/* Borrowing */}
          {activeTab === 'borrowing' && (
            <div>
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
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
              <DataTable
                data={filteredBorrowing}
                rowKey="id"
                initialPageSize={25}
                emptyMessage="No borrowing records yet."
                globalSearchPlaceholder="Search student, book, ISBN…"
                defaultSort={{ id: 'borrowed_at', dir: 'desc' }}
                columns={[
                  { id: 'full_name', header: 'Student', accessor: 'full_name', cell: (b) => <span className="font-medium text-slate-900">{b.full_name}</span> },
                  { id: 'book_title', header: 'Book Title', accessor: 'book_title' },
                  { id: 'author', header: 'Author', accessor: 'author' },
                  { id: 'isbn', header: 'ISBN', accessor: 'isbn' },
                  { id: 'borrowed_at', header: 'Borrowed', accessor: 'borrowed_at', sortType: 'date', cell: (b) => fmtDate(b.borrowed_at) },
                  { id: 'due_at', header: 'Due', accessor: 'due_at', sortType: 'date', cell: (b) => (b.due_at ? fmtDate(b.due_at) : null) },
                  { id: 'returned_at', header: 'Returned', accessor: 'returned_at', sortType: 'date', cell: (b) => (b.returned_at ? fmtDate(b.returned_at) : null) },
                  {
                    id: 'status',
                    header: 'Status',
                    accessor: 'status',
                    filterType: 'select',
                    filterOptions: ['borrowed', 'returned', 'overdue', 'lost'],
                    cell: (b) => statusBadge(b.status, { borrowed: 'bg-sky-100 text-sky-800', returned: 'bg-emerald-100 text-emerald-800', overdue: 'bg-red-100 text-red-800', lost: 'bg-slate-200 text-slate-700' }),
                  },
                ]}
              />
            </div>
          )}

          {/* Reading Records */}
          {activeTab === 'reading' && (
            <div>
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
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
              <DataTable
                data={filteredReading}
                rowKey="id"
                initialPageSize={25}
                emptyMessage="No reading records yet."
                globalSearchPlaceholder="Search student, book, author…"
                defaultSort={{ id: 'started_at', dir: 'desc' }}
                columns={[
                  { id: 'full_name', header: 'Student', accessor: 'full_name', cell: (r) => <span className="font-medium text-slate-900">{r.full_name}</span> },
                  { id: 'book_title', header: 'Book Title', accessor: 'book_title' },
                  { id: 'author', header: 'Author', accessor: 'author' },
                  {
                    id: 'progress_percentage',
                    header: 'Progress',
                    accessor: 'progress_percentage',
                    sortType: 'number',
                    cell: (r) => (
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-200 rounded-full h-2">
                          <div className="bg-gold-600 rounded-full h-2 transition-all" style={{ width: `${Math.min(r.progress_percentage || 0, 100)}%` }} />
                        </div>
                        <span className="text-xs text-slate-500">{r.progress_percentage || 0}%</span>
                      </div>
                    ),
                  },
                  { id: 'started_at', header: 'Started', accessor: 'started_at', sortType: 'date', cell: (r) => (r.started_at ? fmtDate(r.started_at) : null) },
                  { id: 'completed_at', header: 'Completed', accessor: 'completed_at', sortType: 'date', cell: (r) => (r.completed_at ? fmtDate(r.completed_at) : null) },
                  {
                    id: 'status',
                    header: 'Status',
                    accessor: 'status',
                    filterType: 'select',
                    filterOptions: ['reading', 'completed', 'paused', 'abandoned'],
                    cell: (r) => statusBadge(r.status, { reading: 'bg-sky-100 text-sky-800', completed: 'bg-emerald-100 text-emerald-800', paused: 'bg-amber-100 text-amber-800', abandoned: 'bg-slate-100 text-slate-500' }),
                  },
                ]}
              />
            </div>
          )}

          {/* Permissions */}
          {activeTab === 'permissions' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900">Library Permissions</h3>
                <span className="text-xs text-slate-500">{permissions.length} total</span>
              </div>
              <DataTable
                data={permissions}
                rowKey="id"
                initialPageSize={25}
                emptyMessage="No permissions assigned yet."
                globalSearchPlaceholder="Search student, permission…"
                defaultSort={{ id: 'granted_at', dir: 'desc' }}
                columns={[
                  { id: 'student_name', header: 'Student', accessor: 'student_name', cell: (p) => <span className="font-medium text-slate-900">{p.student_name}</span> },
                  { id: 'matric_no', header: 'Matric', accessor: 'matric_no' },
                  {
                    id: 'permission_type',
                    header: 'Permission',
                    accessor: 'permission_type',
                    cell: (p) => <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{p.permission_type}</code>,
                  },
                  { id: 'granted_at', header: 'Granted At', accessor: 'granted_at', sortType: 'date', cell: (p) => fmtDate(p.granted_at) },
                  { id: 'expires_at', header: 'Expires', accessor: 'expires_at', sortType: 'date', cell: (p) => (p.expires_at ? fmtDate(p.expires_at) : 'Never') },
                  { id: 'granted_by_name', header: 'Granted By', accessor: 'granted_by_name' },
                  {
                    id: 'is_active',
                    header: 'Active',
                    accessor: (p) => (p.is_active ? 'active' : 'revoked'),
                    filterType: 'select',
                    filterOptions: ['active', 'revoked'],
                    cell: (p) => statusBadge(p.is_active ? 'active' : 'revoked', { active: 'bg-emerald-100 text-emerald-800', revoked: 'bg-slate-100 text-slate-500' }),
                  },
                ]}
              />
            </div>
          )}

          {/* Access Rules */}
          {activeTab === 'access-rules' && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Access Rules by Student Status</h3>
              <DataTable
                data={accessRules}
                rowKey="id"
                globalSearchPlaceholder="Search status, notes…"
                defaultSort={{ id: 'student_status', dir: 'asc' }}
                columns={[
                  { id: 'student_status', header: 'Student Status', accessor: 'student_status', cell: (r) => <span className="font-medium text-slate-900">{r.student_status}</span> },
                  { id: 'max_borrow_limit', header: 'Max Borrow Limit', accessor: 'max_borrow_limit', sortType: 'number' },
                  { id: 'borrowing_days', header: 'Borrowing Days', accessor: 'borrowing_days', sortType: 'number' },
                  {
                    id: 'can_request_books',
                    header: 'Can Request Books',
                    accessor: (r) => (r.can_request_books ? 'Yes' : 'No'),
                    filterType: 'select',
                    filterOptions: ['Yes', 'No'],
                    cell: (r) => (r.can_request_books ? <span className="text-emerald-600 font-medium">Yes</span> : <span className="text-red-500 font-medium">No</span>),
                  },
                  {
                    id: 'digital_access',
                    header: 'Digital Access',
                    accessor: (r) => (r.digital_access ? 'Yes' : 'No'),
                    filterType: 'select',
                    filterOptions: ['Yes', 'No'],
                    cell: (r) => (r.digital_access ? <span className="text-emerald-600 font-medium">Yes</span> : <span className="text-red-500 font-medium">No</span>),
                  },
                  { id: 'notes', header: 'Notes', accessor: 'notes', cell: (r) => <span className="text-slate-500 max-w-60 truncate block">{r.notes || null}</span> },
                ]}
              />
            </div>
          )}

          {/* Book Requests */}
          {activeTab === 'requests' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900">Book Requests</h3>
                <span className="text-xs text-slate-500">{bookRequests.length} requests</span>
              </div>
              <DataTable
                data={bookRequests}
                rowKey="id"
                initialPageSize={25}
                emptyMessage="No book requests yet."
                globalSearchPlaceholder="Search student, book, ISBN…"
                defaultSort={{ id: 'created_at', dir: 'desc' }}
                columns={[
                  { id: 'student_name', header: 'Student', accessor: 'student_name', cell: (r) => <span className="font-medium text-slate-900">{r.student_name}</span> },
                  { id: 'matric_no', header: 'Matric', accessor: 'matric_no' },
                  { id: 'book_title', header: 'Book Title', accessor: 'book_title' },
                  { id: 'author', header: 'Author', accessor: 'author' },
                  { id: 'isbn', header: 'ISBN', accessor: 'isbn' },
                  { id: 'requested_by_name', header: 'Requested By', accessor: 'requested_by_name' },
                  { id: 'created_at', header: 'Date', accessor: 'created_at', sortType: 'date', cell: (r) => fmtDate(r.created_at) },
                  {
                    id: 'status',
                    header: 'Status',
                    accessor: 'status',
                    filterType: 'select',
                    filterOptions: ['pending', 'approved', 'fulfilled', 'cancelled'],
                    cell: (r) => statusBadge(r.status, { pending: 'bg-amber-100 text-amber-800', approved: 'bg-sky-100 text-sky-800', fulfilled: 'bg-emerald-100 text-emerald-800', cancelled: 'bg-slate-100 text-slate-500' }),
                  },
                ]}
              />
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
