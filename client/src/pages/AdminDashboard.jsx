import { useEffect, useState } from 'react'
import { BarChart3, BookOpen, ClipboardCheck, Users, UserPlus, GraduationCap, LayoutDashboard } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import PageHeader from '../components/ui/PageHeader'
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
      <div className="h-full flex flex-col gap-6 overflow-hidden">
        <PageHeader
          title="Admin Dashboard"
          subtitle="Manage students, courses, attendance and system health"
          icon={<LayoutDashboard size={22} />}
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          <Card title="Total Students" value={analytics?.totalStudents || 0} icon={<Users size={20} />} accent="gold" />
          <Card title="Total Courses" value={analytics?.totalCourses || 0} icon={<BookOpen size={20} />} accent="sky" />
          <Card title="Attendance Sessions" value={analytics?.totalSessions || 0} icon={<ClipboardCheck size={20} />} accent="emerald" />
          <Card title="System Health" value="Operational" icon={<GraduationCap size={20} />} accent="gold" hint="All services running" />
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
        {section === 'overview' ? (
          <Card title="Attendance Analytics" subtitle="Total attendance marks recorded per course" action={<Badge tone="gold" dot>Live</Badge>}>
            <div className="overflow-auto">
              <table className="data-table w-full text-sm">
                <thead>
                  <tr><th>Course</th><th>Total Attendance Marks</th></tr>
                </thead>
                <tbody>
                  {analytics?.attendanceByCourse?.map((course) => (
                    <tr key={course.id}>
                      <td className="font-medium text-slate-800">{course.title}</td>
                      <td>{course.total_attendance}</td>
                    </tr>
                  ))}
                  {!analytics?.attendanceByCourse?.length ? (
                    <tr><td colSpan={2} className="py-8 text-center text-slate-400">No attendance data yet.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        {section === 'students' ? (
          <div className="grid lg:grid-cols-2 gap-6">
            <Card title="Create Student" subtitle="Add a new student record" action={<UserPlus size={18} className="text-gold-700" />}>
              <form onSubmit={createStudent} className="grid gap-3">
                <div>
                  <label className="field-label">Full name</label>
                  <input className="input" placeholder="Full name" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} required />
                </div>
                <div>
                  <label className="field-label">Email</label>
                  <input className="input" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
                </div>
                <div>
                  <label className="field-label">Phone</label>
                  <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} required />
                </div>
                <div>
                  <label className="field-label">Status</label>
                  <select className="select" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                    <option>Active</option>
                    <option>Graduating</option>
                    <option>Alumni</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary lift mt-1">Create Student</button>
              </form>
            </Card>

            <Card title="Students" subtitle={`${students.length} records`}>
              <div className="overflow-auto">
                <table className="data-table w-full text-sm">
                  <thead>
                    <tr><th>Name</th><th>Matric</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.id}>
                        <td className="font-medium text-slate-800">{student.full_name}</td>
                        <td>{student.matric_no}</td>
                        <td><Badge tone={statusTone(student.status)} dot>{student.status}</Badge></td>
                      </tr>
                    ))}
                    {!students.length ? (
                      <tr><td colSpan={3} className="py-8 text-center text-slate-400">No students found.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : null}

        {section === 'courses' ? (
          <Card title="Courses" subtitle={`${courses.length} courses`}>
            <div className="overflow-auto">
              <table className="data-table w-full text-sm">
                <thead>
                  <tr><th>Title</th><th>Duration</th><th>Min Attendance</th></tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <tr key={course.id}>
                      <td className="font-medium text-slate-800">{course.title}</td>
                      <td>{course.duration_weeks} weeks</td>
                      <td>{course.min_attendance_required}</td>
                    </tr>
                  ))}
                  {!courses.length ? (
                    <tr><td colSpan={3} className="py-8 text-center text-slate-400">No courses found.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        {section === 'attendance' ? (
          <Card title="Attendance By Course" subtitle="Marks recorded across all sessions">
            <div className="overflow-auto">
              <table className="data-table w-full text-sm">
                <thead>
                  <tr><th>Course</th><th>Total Attendance Marks</th></tr>
                </thead>
                <tbody>
                  {analytics?.attendanceByCourse?.map((course) => (
                    <tr key={course.id}>
                      <td className="font-medium text-slate-800">{course.title}</td>
                      <td>{course.total_attendance}</td>
                    </tr>
                  ))}
                  {!analytics?.attendanceByCourse?.length ? (
                    <tr><td colSpan={2} className="py-8 text-center text-slate-400">No attendance data yet.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}
        </div>
      </div>
    </AppShell>
  )
}

export default AdminDashboard
