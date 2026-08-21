import { useEffect, useMemo, useState } from 'react'
import { BookOpen, BookmarkCheck, Library, RefreshCw, Link2, FileText, Shield, Settings, Sliders, ExternalLink, Sparkles, Mail } from 'lucide-react'
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

  const isEnabled = settingVal('enabled') === 'true'
  const notifEmail = settingVal('notification_email')

  return (
    <AppShell title="Book Ministry" groups={lecturerNavGroups}>
      {notice ? (
        <div className="mb-4 rounded-[16px] bg-[#EEF2FF] border border-[#C7D2FE] text-[#3730A3] px-4 py-2.5 text-sm font-semibold flex items-center gap-2 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-[#4F46E5] animate-pulse shrink-0" />
          {notice}
        </div>
      ) : null}

      <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* Header — dramatic indigo bento 24px */}
      <div className="shrink-0">
        <div className="card card-hover rounded-[24px] p-5 bg-white border border-slate-200 shadow-sm relative overflow-hidden">
          {/* indigo top rule */}
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#4F46E5] via-[#8B5CF6] to-[#6366F1]" />
          {/* soft blobs */}
          <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-[#EEF2FF] blur-3xl opacity-70" />
          <div className="pointer-events-none absolute -bottom-20 -left-12 h-56 w-56 rounded-full bg-[#F5F3FF] blur-2xl opacity-60" />

          <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-2xl bg-[#4F46E5] text-white flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0">
                  <Library size={22} strokeWidth={2} />
                </div>
                <div>
                  <h2 className="font-display text-[22px] md:text-[26px] font-extrabold tracking-[-0.04em] text-slate-900 leading-none">Book Ministry</h2>
                  <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#6366F1] mt-1 flex items-center gap-1.5">
                    <Sparkles size={11} /> GTS · External Sync
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[13.5px] font-medium leading-relaxed text-slate-500 max-w-[62ch] font-sans">
                Manage library-linked student accounts, borrowing records, reading progress, and access permissions. This module connects GTS student data with the Book Ministry application.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <Badge tone={isEnabled ? 'emerald' : 'slate'} dot className={isEnabled ? '!bg-[#ECFDF5] !text-[#047857] !border-[#6EE7B7]' : '!bg-slate-100 !text-slate-600 !border-slate-200'}>
                  {isEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
                <span className="hidden sm:inline h-4 w-px bg-slate-200" />
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-3 py-1">
                  <Mail size={12} className="text-[#6366F1]" />
                  {notifEmail ? <span className="font-mono text-[11px] text-slate-700">{notifEmail}</span> : <span className="italic">No notification email set</span>}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.06em] uppercase text-[#4338CA] bg-[#EEF2FF] border border-[#C7D2FE] rounded-full px-2.5 py-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  {isEnabled ? 'Sync ready' : 'Sync paused'}
                </span>
              </div>
            </div>

            {/* bento mini metrics */}
            <div className="hidden lg:flex items-stretch gap-3 shrink-0">
              <div className="rounded-2xl bg-[#F8FAFC] border border-slate-200 p-3.5 min-w-[132px] flex flex-col justify-center">
                <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400">Linked</p>
                <p className="font-display text-xl font-extrabold tracking-[-0.03em] text-slate-900 mt-1">{stats?.linkedAccounts ?? '—'}</p>
                <p className="text-[11px] font-medium text-slate-500">accounts</p>
              </div>
              <div className="rounded-2xl bg-[#4F46E5] text-white p-3.5 min-w-[132px] flex flex-col justify-center shadow-md shadow-indigo-200">
                <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-indigo-200">Pending</p>
                <p className="font-display text-xl font-extrabold tracking-[-0.03em] mt-1">{stats?.pendingRequests ?? '—'}</p>
                <p className="text-[11px] font-medium text-indigo-100">requests</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs — indigo pill bento */}
      <div className="shrink-0 flex flex-wrap gap-1.5 p-1.5 rounded-2xl bg-white border border-slate-200 shadow-sm w-fit max-w-full">
        {tabs.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-all duration-200 border cursor-pointer ${
                active
                  ? 'bg-[#4F46E5] text-white border-[#4338CA] shadow-md shadow-indigo-200'
                  : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon size={14} strokeWidth={active ? 2.3 : 1.9} />
              {label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 rounded-[24px] bg-white border border-slate-200" />
            ))}
          </div>
          <p className="text-slate-400 text-sm mt-6 font-medium">Loading ministry data…</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto flex flex-col gap-4 pr-1 [scrollbar-width:thin]">
        <>
          {/* Overview — bento 5 */}
          {activeTab === 'overview' && stats && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <Card title="Linked Accounts" value={stats.linkedAccounts} accent="sky" icon={<Link2 size={18} />} className="card-hover !rounded-[24px] !border-slate-200 stat-hover" hint="synced via API" />
                <Card title="Active Borrows" value={stats.activeBorrows} accent="emerald" icon={<BookOpen size={18} />} className="card-hover !rounded-[24px] !border-slate-200 stat-hover" hint="currently out" />
                <Card title="Active Reading" value={stats.activeReading} accent="gold" icon={<BookmarkCheck size={18} />} className="card-hover !rounded-[24px] !border-slate-200 stat-hover" hint="in progress" />
                <Card title="Active Permissions" value={stats.activePermissions} accent="sky" icon={<Shield size={18} />} className="card-hover !rounded-[24px] !border-slate-200 stat-hover" hint="granted" />
                <Card title="Pending Requests" value={stats.pendingRequests} accent="rose" icon={<FileText size={18} />} className="card-hover !rounded-[24px] !border-slate-200 stat-hover" hint="awaiting review" />
              </div>

              <Card title="Integration Status" className="!rounded-[24px] card-hover !border-slate-200">
                <div className="grid sm:grid-cols-2 gap-0 rounded-2xl border border-slate-200 overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
                  <div className="p-4 bg-white">
                    <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400">Book Ministry Feature</p>
                    <p className="mt-1 inline-flex items-center gap-2 font-semibold text-slate-900">
                      <span className={`h-2 w-2 rounded-full ${isEnabled ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]' : 'bg-slate-300'}`} />
                      {isEnabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <div className="p-4 bg-[#F8FAFC]">
                    <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400">Max Requests per Student</p>
                    <p className="mt-1 font-mono text-sm font-bold text-slate-800">{settingVal('max_requests_per_student', '5')}</p>
                  </div>
                  <div className="p-4 bg-[#F8FAFC] sm:bg-white">
                    <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400">Notification Email</p>
                    <p className="mt-1 font-mono text-sm font-medium text-slate-800 truncate">{settingVal('notification_email') || 'Not configured'}</p>
                  </div>
                  <div className="p-4 bg-white sm:bg-[#F8FAFC]">
                    <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400">External Sync</p>
                    <p className="mt-1 inline-flex items-center gap-1.5 font-semibold text-[#4338CA]">
                      <ExternalLink size={13} /> Book Ministry App (external)
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Linked Accounts */}
          {activeTab === 'linked' && (
            <div className="flex flex-col gap-4 flex-1 min-h-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-display text-[15px] font-bold tracking-[-0.02em] text-slate-900 flex items-center gap-2">
                  <span className="h-7 w-7 rounded-xl bg-[#EEF2FF] border border-[#C7D2FE] text-[#4F46E5] flex items-center justify-center"><Link2 size={14} /></span>
                  Linked Accounts
                </h3>
                <span className="chip !bg-[#EEF2FF] !text-[#4338CA] !border-[#C7D2FE] !rounded-full">{linkedAccounts.length} linked</span>
              </div>
              <DataTable
                data={linkedAccounts}
                rowKey="id"
                initialPageSize={25}
                emptyMessage="No linked accounts. Sync data from the Book Ministry app to populate."
                globalSearchPlaceholder="Search student, matric, account…"
                defaultSort={{ id: 'full_name', dir: 'asc' }}
                columns={[
                  { id: 'full_name', header: 'Student', accessor: 'full_name', cell: (a) => <span className="font-semibold text-slate-900">{a.full_name}</span> },
                  { id: 'matric_no', header: 'Matric', accessor: 'matric_no', cell: (a) => <span className="font-mono text-xs bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-lg">{a.matric_no}</span> },
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
                    cell: (a) => <code className="text-xs font-mono bg-[#EEF2FF] border border-[#C7D2FE] text-[#4338CA] px-1.5 py-0.5 rounded-lg">{a.external_account_id}</code>,
                  },
                  { id: 'external_system', header: 'System', accessor: 'external_system' },
                  { id: 'linked_at', header: 'Linked At', accessor: 'linked_at', sortType: 'date', cell: (a) => <span className="text-slate-600">{fmtDate(a.linked_at)}</span> },
                  { id: 'last_synced_at', header: 'Last Synced', accessor: 'last_synced_at', sortType: 'date', cell: (a) => (a.last_synced_at ? <span className="text-slate-600">{fmtDate(a.last_synced_at)}</span> : <span className="text-slate-300">—</span>) },
                ]}
              />
            </div>
          )}

          {/* Borrowing */}
          {activeTab === 'borrowing' && (
            <div className="flex flex-col gap-4 flex-1 min-h-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-display text-[15px] font-bold tracking-[-0.02em] text-slate-900 flex items-center gap-2">
                  <span className="h-7 w-7 rounded-xl bg-[#ECFDF5] border border-emerald-200 text-emerald-700 flex items-center justify-center"><BookOpen size={14} /></span>
                  Borrowing History
                </h3>
                <select
                  className="select w-auto !rounded-xl !border-slate-200 bg-white text-sm font-medium"
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
                  { id: 'full_name', header: 'Student', accessor: 'full_name', cell: (b) => <span className="font-semibold text-slate-900">{b.full_name}</span> },
                  { id: 'book_title', header: 'Book Title', accessor: 'book_title', cell: (b) => <span className="font-medium text-slate-800">{b.book_title}</span> },
                  { id: 'author', header: 'Author', accessor: 'author' },
                  { id: 'isbn', header: 'ISBN', accessor: 'isbn', cell: (b) => <span className="font-mono text-xs text-slate-600">{b.isbn}</span> },
                  { id: 'borrowed_at', header: 'Borrowed', accessor: 'borrowed_at', sortType: 'date', cell: (b) => <span className="text-slate-600">{fmtDate(b.borrowed_at)}</span> },
                  { id: 'due_at', header: 'Due', accessor: 'due_at', sortType: 'date', cell: (b) => (b.due_at ? <span className="text-slate-600">{fmtDate(b.due_at)}</span> : <span className="text-slate-300">—</span>) },
                  { id: 'returned_at', header: 'Returned', accessor: 'returned_at', sortType: 'date', cell: (b) => (b.returned_at ? <span className="text-slate-600">{fmtDate(b.returned_at)}</span> : <span className="text-slate-300">—</span>) },
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
            <div className="flex flex-col gap-4 flex-1 min-h-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-display text-[15px] font-bold tracking-[-0.02em] text-slate-900 flex items-center gap-2">
                  <span className="h-7 w-7 rounded-xl bg-[#EEF2FF] border border-[#C7D2FE] text-[#4F46E5] flex items-center justify-center"><BookmarkCheck size={14} /></span>
                  Reading Records
                </h3>
                <select
                  className="select w-auto !rounded-xl !border-slate-200 bg-white text-sm font-medium"
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
                  { id: 'full_name', header: 'Student', accessor: 'full_name', cell: (r) => <span className="font-semibold text-slate-900">{r.full_name}</span> },
                  { id: 'book_title', header: 'Book Title', accessor: 'book_title', cell: (r) => <span className="font-medium text-slate-800">{r.book_title}</span> },
                  { id: 'author', header: 'Author', accessor: 'author' },
                  {
                    id: 'progress_percentage',
                    header: 'Progress',
                    accessor: 'progress_percentage',
                    sortType: 'number',
                    cell: (r) => (
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-100 border border-slate-200 rounded-full h-2 overflow-hidden">
                          <div className="bg-[#4F46E5] rounded-full h-2 transition-all" style={{ width: `${Math.min(r.progress_percentage || 0, 100)}%` }} />
                        </div>
                        <span className="text-xs font-mono font-semibold text-slate-600">{r.progress_percentage || 0}%</span>
                      </div>
                    ),
                  },
                  { id: 'started_at', header: 'Started', accessor: 'started_at', sortType: 'date', cell: (r) => (r.started_at ? <span className="text-slate-600">{fmtDate(r.started_at)}</span> : <span className="text-slate-300">—</span>) },
                  { id: 'completed_at', header: 'Completed', accessor: 'completed_at', sortType: 'date', cell: (r) => (r.completed_at ? <span className="text-slate-600">{fmtDate(r.completed_at)}</span> : <span className="text-slate-300">—</span>) },
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
            <div className="flex flex-col gap-4 flex-1 min-h-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-display text-[15px] font-bold tracking-[-0.02em] text-slate-900 flex items-center gap-2">
                  <span className="h-7 w-7 rounded-xl bg-[#EEF2FF] border border-[#C7D2FE] text-[#4F46E5] flex items-center justify-center"><Shield size={14} /></span>
                  Library Permissions
                </h3>
                <span className="chip !bg-[#EEF2FF] !text-[#4338CA] !border-[#C7D2FE] !rounded-full">{permissions.length} total</span>
              </div>
              <DataTable
                data={permissions}
                rowKey="id"
                initialPageSize={25}
                emptyMessage="No permissions assigned yet."
                globalSearchPlaceholder="Search student, permission…"
                defaultSort={{ id: 'granted_at', dir: 'desc' }}
                columns={[
                  { id: 'student_name', header: 'Student', accessor: 'student_name', cell: (p) => <span className="font-semibold text-slate-900">{p.student_name}</span> },
                  { id: 'matric_no', header: 'Matric', accessor: 'matric_no', cell: (p) => <span className="font-mono text-xs bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-lg">{p.matric_no}</span> },
                  {
                    id: 'permission_type',
                    header: 'Permission',
                    accessor: 'permission_type',
                    cell: (p) => <code className="text-xs font-mono bg-[#EEF2FF] border border-[#C7D2FE] text-[#4338CA] px-1.5 py-0.5 rounded-lg">{p.permission_type}</code>,
                  },
                  { id: 'granted_at', header: 'Granted At', accessor: 'granted_at', sortType: 'date', cell: (p) => <span className="text-slate-600">{fmtDate(p.granted_at)}</span> },
                  { id: 'expires_at', header: 'Expires', accessor: 'expires_at', sortType: 'date', cell: (p) => (p.expires_at ? <span className="text-slate-600">{fmtDate(p.expires_at)}</span> : <span className="text-slate-500 font-medium">Never</span>) },
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
            <div className="flex flex-col gap-4 flex-1 min-h-0">
              <h3 className="font-display text-[15px] font-bold tracking-[-0.02em] text-slate-900 flex items-center gap-2">
                <span className="h-7 w-7 rounded-xl bg-[#F5F3FF] border border-violet-200 text-violet-700 flex items-center justify-center"><Sliders size={14} /></span>
                Access Rules by Student Status
              </h3>
              <DataTable
                data={accessRules}
                rowKey="id"
                globalSearchPlaceholder="Search status, notes…"
                defaultSort={{ id: 'student_status', dir: 'asc' }}
                columns={[
                  { id: 'student_status', header: 'Student Status', accessor: 'student_status', cell: (r) => <span className="font-semibold text-slate-900">{r.student_status}</span> },
                  { id: 'max_borrow_limit', header: 'Max Borrow Limit', accessor: 'max_borrow_limit', sortType: 'number', cell: (r) => <span className="font-mono font-semibold text-slate-800">{r.max_borrow_limit}</span> },
                  { id: 'borrowing_days', header: 'Borrowing Days', accessor: 'borrowing_days', sortType: 'number', cell: (r) => <span className="font-mono font-semibold text-slate-800">{r.borrowing_days}</span> },
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
                  { id: 'notes', header: 'Notes', accessor: 'notes', cell: (r) => <span className="text-slate-500 max-w-60 truncate block">{r.notes || <span className="text-slate-300">—</span>}</span> },
                ]}
              />
            </div>
          )}

          {/* Book Requests */}
          {activeTab === 'requests' && (
            <div className="flex flex-col gap-4 flex-1 min-h-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-display text-[15px] font-bold tracking-[-0.02em] text-slate-900 flex items-center gap-2">
                  <span className="h-7 w-7 rounded-xl bg-[#FFF7ED] border border-orange-200 text-orange-700 flex items-center justify-center"><FileText size={14} /></span>
                  Book Requests
                </h3>
                <span className="chip !bg-[#EEF2FF] !text-[#4338CA] !border-[#C7D2FE] !rounded-full">{bookRequests.length} requests</span>
              </div>
              <DataTable
                data={bookRequests}
                rowKey="id"
                initialPageSize={25}
                emptyMessage="No book requests yet."
                globalSearchPlaceholder="Search student, book, ISBN…"
                defaultSort={{ id: 'created_at', dir: 'desc' }}
                columns={[
                  { id: 'student_name', header: 'Student', accessor: 'student_name', cell: (r) => <span className="font-semibold text-slate-900">{r.student_name}</span> },
                  { id: 'matric_no', header: 'Matric', accessor: 'matric_no', cell: (r) => <span className="font-mono text-xs bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-lg">{r.matric_no}</span> },
                  { id: 'book_title', header: 'Book Title', accessor: 'book_title', cell: (r) => <span className="font-medium text-slate-800">{r.book_title}</span> },
                  { id: 'author', header: 'Author', accessor: 'author' },
                  { id: 'isbn', header: 'ISBN', accessor: 'isbn', cell: (r) => <span className="font-mono text-xs text-slate-600">{r.isbn}</span> },
                  { id: 'requested_by_name', header: 'Requested By', accessor: 'requested_by_name' },
                  { id: 'created_at', header: 'Date', accessor: 'created_at', sortType: 'date', cell: (r) => <span className="text-slate-600">{fmtDate(r.created_at)}</span> },
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

          {/* Integration — dramatic indigo */}
          {activeTab === 'integration' && (
            <div className="space-y-4">
              <div className="card card-hover rounded-[24px] p-5 bg-white border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#4F46E5] to-[#8B5CF6]" />
                <h3 className="font-display text-[15px] font-bold tracking-[-0.02em] text-slate-900 flex items-center gap-2.5">
                  <span className="h-8 w-8 rounded-xl bg-[#4F46E5] text-white flex items-center justify-center shadow-md shadow-indigo-200"><ExternalLink size={15} /></span>
                  Book Ministry Application Integration
                </h3>
                <p className="mt-3 text-[13.5px] font-medium leading-relaxed text-slate-500 max-w-[70ch]">
                  GTS Book Ministry is designed to sync with an external Book Ministry application.
                  When the Book Ministry app is ready, it will push data into these GTS endpoints:
                </p>
                <div className="mt-5 grid sm:grid-cols-2 gap-3">
                  {[
                    { endpoint: 'POST /api/book-ministry/linked-accounts', desc: 'Link a GTS student to their Book Ministry account ID' },
                    { endpoint: 'POST /api/book-ministry/borrowing', desc: 'Record a new book borrowing (sync from external system)' },
                    { endpoint: 'PATCH /api/book-ministry/borrowing/:id', desc: 'Update borrowing status (returned, overdue, lost)' },
                    { endpoint: 'POST /api/book-ministry/reading', desc: 'Record reading progress for a student' },
                    { endpoint: 'PATCH /api/book-ministry/reading/:id', desc: 'Update reading progress and status' },
                    { endpoint: 'POST /api/book-ministry/requests', desc: 'Create book requests from students' },
                  ].map(({ endpoint, desc }) => (
                    <div key={endpoint} className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-3.5 hover:border-[#C7D2FE] hover:bg-[#EEF2FF]/50 transition-colors">
                      <code className="font-mono text-[11px] font-bold bg-[#0F172A] text-indigo-300 px-2 py-1 rounded-lg border border-slate-800">{endpoint}</code>
                      <p className="text-xs font-medium text-slate-500 mt-2 leading-relaxed">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Card title="Configuration" className="!rounded-[24px] card-hover !border-slate-200">
                <div className="space-y-4 max-w-lg">
                  <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-[#F8FAFC] border border-slate-200">
                    <div>
                      <p className="text-sm font-bold text-slate-900 tracking-[-0.01em]">Feature Enabled</p>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">Enable or disable Book Ministry features across GTS</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
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
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4F46E5] shadow-inner" />
                    </label>
                  </div>
                  <div>
                    <p className="field-label font-semibold tracking-[-0.01em]">Notification Email</p>
                    <div className="flex gap-2">
                      <input
                        className="input !rounded-xl !border-slate-200"
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
                        className="btn btn-primary btn-sm lift gap-2 !bg-[#4F46E5] hover:!bg-[#4338CA] !rounded-xl shrink-0"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="field-label font-semibold tracking-[-0.01em]">Max Requests per Student</p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        className="input w-24 !rounded-xl !border-slate-200 font-mono"
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
                        className="btn btn-primary btn-sm lift gap-2 !bg-[#4F46E5] hover:!bg-[#4338CA] !rounded-xl"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              </Card>

              <div className="rounded-[24px] bg-amber-50 border border-amber-200 p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="h-8 w-8 rounded-xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                    <RefreshCw size={16} />
                  </span>
                  <div>
                    <p className="font-display text-sm font-bold tracking-[-0.02em] text-amber-900">External Data Source</p>
                    <p className="text-xs font-medium leading-relaxed text-amber-800 mt-1">
                      The borrowing history, reading records, and linked accounts are intended to be populated
                      by the Book Ministry application. When the external app is built, configure it to send data
                      to the API endpoints listed above. Students are matched via <code className="font-mono bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-lg text-amber-900 text-[11px]">external_account_id</code> linked to their GTS profile.
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
