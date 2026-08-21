import { useEffect, useMemo, useState } from 'react'
import { BookOpen, BookmarkCheck, Library, RefreshCw, Link2, FileText, Shield, Settings, Sliders, ExternalLink } from 'lucide-react'
import AppShell from '../components/AppShell'
import DataTable from '../components/ui/DataTable'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
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

const statusBadge = (status, tones = {}) => {
  const tone = tones[status] || 'slate'
  return <Badge tone={tone} dot>{status}</Badge>
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
        <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 text-sm font-medium">{notice}</div>
      ) : null}

      <div className="h-full flex flex-col gap-5 overflow-hidden">
      {/* Header */}
      <div className="shrink-0">
        <div className="card card-hover p-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="ico h-11 w-11"><Library size={22} /></div>
            <h2 className="section-title">Book Ministry</h2>
          </div>
          <p className="section-sub max-w-2xl">
            Manage library-linked student accounts, borrowing records, reading progress, and access permissions.
            This module connects GTS student data with the Book Ministry application.
          </p>
          <div className="mt-3 flex items-center gap-4 flex-wrap">
            <Badge tone={settingVal('enabled') === 'true' ? 'emerald' : 'slate'} dot>
              {settingVal('enabled') === 'true' ? 'Enabled' : 'Disabled'}
            </Badge>
            <span className="text-xs text-slate-400">
              {settingVal('notification_email') ? `Notifications: ${settingVal('notification_email')}` : 'No notification email set'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 shrink-0">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`btn btn-sm lift ${activeTab === key ? 'btn-primary' : 'btn-ghost'}`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Loading...</p>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
        <>
          {/* Overview */}
          {activeTab === 'overview' && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <Card title="Linked Accounts" value={stats.linkedAccounts} accent="sky" icon={<Link2 size={20} />} />
                <Card title="Active Borrows" value={stats.activeBorrows} accent="emerald" icon={<BookOpen size={20} />} />
                <Card title="Active Reading" value={stats.activeReading} accent="gold" icon={<BookmarkCheck size={20} />} />
                <Card title="Active Permissions" value={stats.activePermissions} accent="sky" icon={<Shield size={20} />} />
                <Card title="Pending Requests" value={stats.pendingRequests} accent="rose" icon={<FileText size={20} />} />
              </div>

              <Card title="Integration Status">
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
              </Card>
            </div>
          )}

          {/* Linked Accounts */}
          {activeTab === 'linked' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="card-title">Linked Accounts</h3>
                <span className="chip">{linkedAccounts.length} linked</span>
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
                    cell: (a) => statusBadge(a.student_status, { Active: 'emerald', Graduating: 'sky', Graduated: 'gold' }),
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
                <h3 className="card-title">Borrowing History</h3>
                <select
                  className="select w-auto"
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
                    cell: (b) => statusBadge(b.status, { borrowed: 'sky', returned: 'emerald', overdue: 'rose', lost: 'slate' }),
                  },
                ]}
              />
            </div>
          )}

          {/* Reading Records */}
          {activeTab === 'reading' && (
            <div>
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <h3 className="card-title">Reading Records</h3>
                <select
                  className="select w-auto"
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
                    cell: (r) => statusBadge(r.status, { reading: 'sky', completed: 'emerald', paused: 'amber', abandoned: 'slate' }),
                  },
                ]}
              />
            </div>
          )}

          {/* Permissions */}
          {activeTab === 'permissions' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="card-title">Library Permissions</h3>
                <span className="chip">{permissions.length} total</span>
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
                    cell: (p) => statusBadge(p.is_active ? 'active' : 'revoked', { active: 'emerald', revoked: 'slate' }),
                  },
                ]}
              />
            </div>
          )}

          {/* Access Rules */}
          {activeTab === 'access-rules' && (
            <div>
              <h3 className="card-title mb-3">Access Rules by Student Status</h3>
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
                    cell: (r) => (r.can_request_books ? <Badge tone="emerald" dot>Yes</Badge> : <Badge tone="rose" dot>No</Badge>),
                  },
                  {
                    id: 'digital_access',
                    header: 'Digital Access',
                    accessor: (r) => (r.digital_access ? 'Yes' : 'No'),
                    filterType: 'select',
                    filterOptions: ['Yes', 'No'],
                    cell: (r) => (r.digital_access ? <Badge tone="emerald" dot>Yes</Badge> : <Badge tone="rose" dot>No</Badge>),
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
                <h3 className="card-title">Book Requests</h3>
                <span className="chip">{bookRequests.length} requests</span>
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
                    cell: (r) => statusBadge(r.status, { pending: 'amber', approved: 'sky', fulfilled: 'emerald', cancelled: 'slate' }),
                  },
                ]}
              />
            </div>
          )}

          {/* Integration */}
          {activeTab === 'integration' && (
            <div className="space-y-6">
              <div className="card card-hover p-6">
                <h3 className="card-title flex items-center gap-2 mb-4">
                  <ExternalLink size={16} />
                  Book Ministry Application Integration
                </h3>
                <p className="section-sub mb-4">
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

              <Card title="Configuration">
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
                    <p className="field-label">Notification Email</p>
                    <div className="flex gap-2">
                      <input
                        className="input"
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
                        className="btn btn-primary btn-sm lift"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="field-label">Max Requests per Student</p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="input w-24"
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
                        className="btn btn-primary btn-sm lift"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </Card>

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
        </div>
      )}
      </div>
    </AppShell>
  )
}
