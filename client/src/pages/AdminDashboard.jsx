import { useEffect, useState } from 'react'
import { BarChart3, BookOpen, ClipboardCheck, Users } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/ui/Card'
import apiClient from '../api/client'

const navItems = [
  { to: '/admin/overview', label: 'Overview', icon: BarChart3 },
  { to: '/admin/students', label: 'Students', icon: Users },
  { to: '/admin/courses', label: 'Courses', icon: BookOpen },
  { to: '/admin/attendance', label: 'Attendance', icon: ClipboardCheck },
]

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
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card title="Total Students" value={analytics?.totalStudents || 0} />
        <Card title="Total Courses" value={analytics?.totalCourses || 0} />
        <Card title="Attendance Sessions" value={analytics?.totalSessions || 0} />
        <Card title="System Health" value="Operational" />
      </div>

      {section === 'overview' ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Attendance Analytics</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr><th>Course</th><th>Total Attendance Marks</th></tr>
            </thead>
            <tbody>
              {analytics?.attendanceByCourse?.map((course) => (
                <tr key={course.id} className="border-t border-slate-200">
                  <td className="py-2">{course.title}</td>
                  <td>{course.total_attendance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {section === 'students' ? (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Create Student</h3>
            <form onSubmit={createStudent} className="mt-4 grid gap-3">
              <input className="border border-slate-300 rounded-lg px-3 py-2" placeholder="Full name" value={form.fullName} onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))} required />
              <input className="border border-slate-300 rounded-lg px-3 py-2" placeholder="Email" type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} required />
              <input className="border border-slate-300 rounded-lg px-3 py-2" placeholder="Phone" value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} required />
              <select className="border border-slate-300 rounded-lg px-3 py-2" value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
                <option>Active</option>
                <option>Graduating</option>
                <option>Alumni</option>
              </select>
              <button className="bg-slate-900 text-white rounded-lg py-2">Create Student</button>
            </form>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Students</h3>
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr><th>Name</th><th>Matric</th><th>Status</th></tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-t border-slate-200">
                    <td className="py-2">{student.full_name}</td>
                    <td>{student.matric_no}</td>
                    <td>{student.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {section === 'courses' ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Courses</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr><th>Title</th><th>Duration</th><th>Min Attendance</th></tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id} className="border-t border-slate-200">
                  <td className="py-2">{course.title}</td>
                  <td>{course.duration_weeks} weeks</td>
                  <td>{course.min_attendance_required}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {section === 'attendance' ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-auto">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Attendance By Course</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr><th>Course</th><th>Total Attendance Marks</th></tr>
            </thead>
            <tbody>
              {analytics?.attendanceByCourse?.map((course) => (
                <tr key={course.id} className="border-t border-slate-200">
                  <td className="py-2">{course.title}</td>
                  <td>{course.total_attendance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </AppShell>
  )
}

export default AdminDashboard
