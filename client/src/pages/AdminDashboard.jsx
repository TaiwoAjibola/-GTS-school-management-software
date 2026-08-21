import { useEffect, useState } from 'react'
import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Users,
  UserPlus,
  GraduationCap,
  LayoutDashboard,
  Sparkles,
  ShieldCheck,
  Activity,
  TrendingUp,
  Search,
  Hash,
  Clock3,
  Award,
  ArrowUpRight,
  Layers,
  Database,
} from 'lucide-react'
import { useLocation } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import apiClient from '../api/client'

const navItems = [
  { to: '/admin/overview', label: 'Overview', icon: BarChart3 },
  { to: '/admin/students', label: 'Students', icon: Users },
  { to: '/admin/courses', label: 'Courses', icon: BookOpen },
  { to: '/admin/attendance', label: 'Attendance', icon: ClipboardCheck },
]

const statusTone = (status) =>
  ({ Active: 'emerald', Graduating: 'sky', Alumni: 'gold', Inactive: 'slate' }[status] || 'slate')

const AdminDashboard = () => {
  const location = useLocation()
  const section = location.pathname.split('/')[2] || 'overview'
  const [students, setStudents] = useState([])
  const [courses, setCourses] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', status: 'Active' })

  const load = async () => {
    const [studentRes, courseRes, analyticsRes] = await Promise.all([
      apiClient.get('/students'),
      apiClient.get('/courses'),
      apiClient.get('/dashboard/admin-analytics'),
    ])
    setStudents(studentRes.data)
    setCourses(courseRes.data)
    setAnalytics(analyticsRes.data)
  }

  useEffect(() => {
    load()
  }, [])

  const createStudent = async (event) => {
    event.preventDefault()
    await apiClient.post('/students', form)
    setForm({ fullName: '', email: '', phone: '', status: 'Active' })
    await load()
  }

  const title = {
    overview: 'Overview',
    students: 'Students',
    courses: 'Courses',
    attendance: 'Attendance',
  }[section] || 'Admin Dashboard'

  return (
    <AppShell title={title} navItems={navItems}>
      <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
        {/* ── BENTO STATS — bento bento-4 dramatical indigo ── */}
        <div className="bento bento-4 gap-4 shrink-0">
          <Card
            title="Total Students"
            value={analytics?.totalStudents ?? 0}
            icon={<Users size={20} />}
            accent="gold"
            className="stat-hover lift"
            hint={`${students.length || 0} registered`}
          />
          <Card
            title="Total Courses"
            value={analytics?.totalCourses ?? 0}
            icon={<BookOpen size={20} />}
            accent="sky"
            className="stat-hover lift"
            hint="Active curricula"
          />
          <Card
            title="Attendance Sessions"
            value={analytics?.totalSessions ?? 0}
            icon={<ClipboardCheck size={20} />}
            accent="emerald"
            className="stat-hover lift"
            hint={`${analytics?.attendanceByCourse?.length ?? 0} courses tracked`}
          />
          <Card
            title="System Health"
            value="Operational"
            icon={<GraduationCap size={20} />}
            accent="gold"
            className="stat-hover lift"
            hint="All services running"
          />
        </div>

        {/* ── Content — single viewport, flex-1 min-h-0 overflow-auto ── */}
        <div className="flex-1 min-h-0 overflow-auto pr-1 -mr-1 pb-1 space-y-4 [scrollbar-width:thin]">
          {/* ── OVERVIEW ── */}
          {section === 'overview' ? (
            <div className="space-y-4">
              {/* subtle indigo metrics ribbon */}
              <div className="rounded-[24px] border border-[#E2E8F0] bg-white p-5 flex flex-wrap items-center justify-between gap-3 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-[#EEF2FF] border border-[#E0E7FF] flex items-center justify-center text-[#4F46E5]">
                    <Activity size={16} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold tracking-[0.12em] uppercase text-[#64748B]">Live telemetry</p>
                    <p className="text-sm font-semibold text-[#0F172A] tracking-tight">
                      {analytics?.attendanceByCourse?.length ?? 0} courses • {analytics?.totalStudents ?? 0} students • {analytics?.totalSessions ?? 0} sessions
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="emerald" dot>
                    <ShieldCheck size={10} className="mr-1" />
                    Healthy
                  </Badge>
                  <Badge tone="gold" dot>Live Sync</Badge>
                </div>
              </div>

              <Card
                title="Attendance Analytics"
                subtitle="Total attendance marks recorded per course"
                action={<Badge tone="gold" dot>Live</Badge>}
                className="card-hover overflow-hidden"
                bodyClassName="!px-0 !pb-0"
              >
                {/* indigo top accent */}
                <div className="h-[3px] w-full bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#8B5CF6]" />
                <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase text-[#64748B]">
                    <Layers size={12} className="text-[#4F46E5]" />
                    By course ledger
                  </div>
                  <span className="text-xs font-medium text-[#64748B] font-mono">{analytics?.attendanceByCourse?.length ?? 0} rows</span>
                </div>
                <div className="overflow-auto">
                  <table className="data-table w-full text-sm">
                    <thead>
                      <tr>
                        <th>
                          <span className="inline-flex items-center gap-1.5">
                            <BookOpen size={12} className="text-[#4F46E5]" />
                            Course
                          </span>
                        </th>
                        <th>Total Attendance Marks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics?.attendanceByCourse?.map((course) => (
                        <tr key={course.id}>
                          <td className="font-medium text-slate-800">
                            <span className="inline-flex items-center gap-2">
                              <span className="h-7 w-7 rounded-lg bg-[#EEF2FF] border border-[#E0E7FF] inline-flex items-center justify-center text-[#4F46E5] shrink-0">
                                <Hash size={12} />
                              </span>
                              <span className="tracking-tight">{course.title}</span>
                            </span>
                          </td>
                          <td>
                            <span className="inline-flex items-center gap-2 font-mono font-semibold text-[#0F172A]">
                              {course.total_attendance}
                              <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                            </span>
                          </td>
                        </tr>
                      ))}
                      {!analytics?.attendanceByCourse?.length ? (
                        <tr>
                          <td colSpan={2} className="py-10 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <div className="h-10 w-10 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#94A3B8]">
                                <Search size={16} />
                              </div>
                              <p className="text-sm font-medium text-slate-400">No attendance data yet.</p>
                              <p className="text-xs text-[#94A3B8]">Marks will appear once sessions are recorded.</p>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between">
                  <p className="text-xs text-[#64748B] flex items-center gap-1.5">
                    <TrendingUp size={12} className="text-[#4F46E5]" />
                    Attendance aggregates update live
                  </p>
                  <span className="text-[11px] font-bold tracking-widest uppercase text-[#94A3B8]">Indigo ledger</span>
                </div>
              </Card>
            </div>
          ) : null}

          {/* ── STUDENTS ── */}
          {section === 'students' ? (
            <div className="grid lg:grid-cols-5 gap-4">
              <Card
                title="Create Student"
                subtitle="Add a new student record"
                action={
                  <span className="h-8 w-8 rounded-xl bg-[#EEF2FF] border border-[#E0E7FF] inline-flex items-center justify-center text-[#4F46E5]">
                    <UserPlus size={16} />
                  </span>
                }
                className="card-hover lg:col-span-2 lg:sticky lg:top-0 self-start overflow-hidden"
              >
                <div className="h-[3px] w-full bg-gradient-to-r from-[#4F46E5] to-[#8B5CF6] rounded-full -mt-3 mb-4" />
                <form onSubmit={createStudent} className="grid gap-3">
                  <div>
                    <label className="field-label flex items-center gap-1.5">
                      <Users size={12} className="text-[#4F46E5]" />
                      Full name
                    </label>
                    <input
                      className="input"
                      placeholder="e.g. Grace Johnson"
                      value={form.fullName}
                      onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="field-label">Email</label>
                    <input
                      className="input"
                      type="email"
                      placeholder="student@gts.edu"
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="field-label">Phone</label>
                    <input
                      className="input"
                      placeholder="+234 800 000 0000"
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="field-label flex items-center gap-1.5">
                      <Award size={12} className="text-[#4F46E5]" />
                      Status
                    </label>
                    <select
                      className="select"
                      value={form.status}
                      onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                    >
                      <option>Active</option>
                      <option>Graduating</option>
                      <option>Alumni</option>
                    </select>
                    <p className="mt-1.5 text-xs text-[#64748B] flex items-center gap-1">
                      <Sparkles size={10} className="text-[#8B5CF6]" />
                      Alumni & Graduating map to indigo · sky tones
                    </p>
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm lift mt-1 w-full justify-center">
                    <UserPlus size={16} />
                    Create Student
                    <ArrowUpRight size={14} className="opacity-70" />
                  </button>
                  <p className="text-center text-[11px] font-medium tracking-wide text-[#94A3B8]">Indigo primary • Outfit 800 titles • 24px cards</p>
                </form>
              </Card>

              <Card
                title="Students"
                subtitle={`${students.length} records`}
                action={
                  <div className="flex items-center gap-1.5">
                    <Badge tone="slate">{students.length} total</Badge>
                    <span className="hidden sm:inline-flex h-7 w-7 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] items-center justify-center text-[#64748B]">
                      <Search size={12} />
                    </span>
                  </div>
                }
                className="card-hover lg:col-span-3 overflow-hidden"
                bodyClassName="!px-0 !pb-0"
              >
                <div className="h-[3px] w-full bg-gradient-to-r from-[#06B6D4]/0 via-[#6366F1]/30 to-[#8B5CF6]/0" />
                <div className="overflow-auto">
                  <table className="data-table w-full text-sm">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Matric</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student.id}>
                          <td className="font-medium text-slate-800">
                            <span className="inline-flex items-center gap-2">
                              <span className="h-8 w-8 rounded-xl bg-[#EEF2FF] border border-[#E0E7FF] inline-flex items-center justify-center text-[#4F46E5] font-bold text-xs shrink-0">
                                {student.full_name
                                  ?.split(' ')
                                  .map((w) => w[0])
                                  .slice(0, 2)
                                  .join('')
                                  .toUpperCase()}
                              </span>
                              <span className="tracking-tight">{student.full_name}</span>
                            </span>
                          </td>
                          <td>
                            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium bg-[#F8FAFC] border border-[#E2E8F0] rounded-full px-2.5 py-1 text-[#0F172A]">
                              <Hash size={10} className="text-[#64748B]" />
                              {student.matric_no}
                            </span>
                          </td>
                          <td>
                            <Badge tone={statusTone(student.status)} dot>
                              {student.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                      {!students.length ? (
                        <tr>
                          <td colSpan={3} className="py-10 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <div className="h-10 w-10 rounded-xl bg-[#EEF2FF] border border-[#E0E7FF] flex items-center justify-center text-[#4F46E5]">
                                <Users size={16} />
                              </div>
                              <p className="text-sm font-medium text-slate-400">No students found.</p>
                              <p className="text-xs text-[#94A3B8]">Create the first record with the form.</p>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                {students.length ? (
                  <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between">
                    <p className="text-xs text-[#64748B] font-sans">{students.length} enrolled • Outfit headings</p>
                    <span className="text-[11px] font-bold tracking-widest uppercase text-[#94A3B8]">Matric is JetBrains Mono</span>
                  </div>
                ) : null}
              </Card>
            </div>
          ) : null}

          {/* ── COURSES ── */}
          {section === 'courses' ? (
            <Card
              title="Courses"
              subtitle={`${courses.length} courses`}
              action={
                <div className="flex items-center gap-2">
                  <Badge tone="sky" dot>
                    {courses.length} active
                  </Badge>
                  <span className="h-8 w-8 rounded-xl bg-[#EEF2FF] border border-[#E0E7FF] hidden sm:inline-flex items-center justify-center text-[#4F46E5]">
                    <Layers size={14} />
                  </span>
                </div>
              }
              className="card-hover overflow-hidden"
              bodyClassName="!px-0 !pb-0"
            >
              <div className="h-[3px] w-full bg-gradient-to-r from-[#4F46E5] via-[#06B6D4] to-[#8B5CF6]" />
              <div className="px-5 pt-3 pb-2 flex flex-wrap items-center gap-2">
                <span className="chip">
                  <BookOpen size={12} />
                  Curriculum ledger
                </span>
                <span className="text-xs text-[#64748B]">Title • Duration • Min Attendance preserved</span>
              </div>
              <div className="overflow-auto">
                <table className="data-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Duration</th>
                      <th>Min Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((course) => (
                      <tr key={course.id}>
                        <td className="font-medium text-slate-800">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-7 w-7 rounded-lg bg-[#EEF2FF] border border-[#E0E7FF] inline-flex items-center justify-center text-[#4F46E5] shrink-0">
                              <BookOpen size={12} />
                            </span>
                            <span className="tracking-tight">{course.title}</span>
                          </span>
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-[#E2E8F0] px-2.5 py-1 text-xs font-semibold text-[#0F172A]">
                            <Clock3 size={12} className="text-[#64748B]" />
                            {course.duration_weeks} weeks
                          </span>
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold bg-[#EEF2FF] border border-[#C7D2FE] rounded-full px-2.5 py-1 text-[#4338CA]">
                            <Award size={11} />
                            {course.min_attendance_required}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!courses.length ? (
                      <tr>
                        <td colSpan={3} className="py-10 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <div className="h-10 w-10 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#94A3B8]">
                              <BookOpen size={16} />
                            </div>
                            <p className="text-sm font-medium text-slate-400">No courses found.</p>
                            <p className="text-xs text-[#94A3B8]">Courses appear once created.</p>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between">
                <p className="text-xs text-[#64748B] flex items-center gap-1.5">
                  <ShieldCheck size={12} className="text-[#10B981]" />
                  Bento grid • 24px radius • soft shadow
                </p>
                <span className="text-[11px] font-bold tracking-widest uppercase text-[#94A3B8]">Indigo system</span>
              </div>
            </Card>
          ) : null}

          {/* ── ATTENDANCE ── */}
          {section === 'attendance' ? (
            <Card
              title="Attendance By Course"
              subtitle="Marks recorded across all sessions"
              action={<Badge tone="gold" dot>Live Ledger</Badge>}
              className="card-hover overflow-hidden"
              bodyClassName="!px-0 !pb-0"
            >
              <div className="h-[3px] w-full bg-gradient-to-r from-[#8B5CF6] via-[#4F46E5] to-[#06B6D4]" />
              <div className="px-5 pt-3 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest uppercase text-[#64748B]">
                  <ClipboardCheck size={12} className="text-[#4F46E5]" />
                  Session marks
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[#0F172A] bg-[#EEF2FF] border border-[#E0E7FF] rounded-full px-2.5 py-1">
                  <Activity size={12} className="text-[#4F46E5]" />
                  {analytics?.attendanceByCourse?.length ?? 0} courses
                </span>
              </div>
              <div className="overflow-auto">
                <table className="data-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Total Attendance Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics?.attendanceByCourse?.map((course) => (
                      <tr key={course.id}>
                        <td className="font-medium text-slate-800">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-7 w-7 rounded-lg bg-[#F5F3FF] border border-[#DDD6FE] inline-flex items-center justify-center text-[#8B5CF6] shrink-0">
                              <Layers size={12} />
                            </span>
                            <span className="tracking-tight">{course.title}</span>
                          </span>
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-2">
                            <span className="font-mono font-bold text-[#0F172A] bg-[#EEF2FF] border border-[#E0E7FF] rounded-full px-2.5 py-1 text-xs">
                              {course.total_attendance}
                            </span>
                            <span className="h-1.5 w-1.5 rounded-full bg-[#8B5CF6] animate-pulse" />
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!analytics?.attendanceByCourse?.length ? (
                      <tr>
                        <td colSpan={2} className="py-10 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <div className="h-10 w-10 rounded-xl bg-[#F5F3FF] border border-[#DDD6FE] flex items-center justify-center text-[#8B5CF6]">
                              <ClipboardCheck size={16} />
                            </div>
                            <p className="text-sm font-medium text-slate-400">No attendance data yet.</p>
                            <p className="text-xs text-[#94A3B8]">Session marks will populate here.</p>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between">
                <p className="text-xs text-[#64748B]">24px cards • Inter body • JetBrains Mono for marks</p>
                <span className="text-[11px] font-bold tracking-widest uppercase text-[#94A3B8]">Violet accent</span>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </AppShell>
  )
}

export default AdminDashboard
