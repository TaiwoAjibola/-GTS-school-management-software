import { BookOpen, ClipboardCheck, GraduationCap, SquarePen, UserPlus, Users, Layers, UserCog, Settings, FileText, BarChart3, UserCheck, Library } from 'lucide-react'

export const lecturerNavItems = [
  { to: '/lecturer/courses', label: 'Courses', icon: BookOpen },
  { to: '/lecturer/students', label: 'Students', icon: Users },
  { to: '/lecturer/batches', label: 'Batches', icon: Layers },
  { to: '/lecturer/enrollment', label: 'Enrollment', icon: UserPlus },
  { to: '/lecturer/attendance', label: 'Attendance', icon: ClipboardCheck },
  { to: '/lecturer/results', label: 'Results', icon: GraduationCap },
  { to: '/lecturer/graduation', label: 'Graduation', icon: GraduationCap },
  { to: '/lecturer/assignments', label: 'Assignments', icon: SquarePen },
  { to: '/lecturer/forms', label: 'Forms', icon: FileText },
  { to: '/lecturer/prospective-students', label: 'Prospective', icon: UserCheck },
  { to: '/lecturer/reports', label: 'Reports', icon: BarChart3 },
  { to: '/lecturer/book-ministry', label: 'Book Ministry', icon: Library },
  { to: '/lecturer/lecturers', label: 'Lecturers', icon: UserCog },
  { to: '/lecturer/settings', label: 'Settings', icon: Settings },
]
