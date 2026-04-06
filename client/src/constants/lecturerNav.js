import { BookOpen, ClipboardCheck, GraduationCap, SquarePen, UserPlus, Users, Layers } from 'lucide-react'

export const lecturerNavItems = [
  { to: '/lecturer/courses', label: 'Courses', icon: BookOpen },
  { to: '/lecturer/students', label: 'Students', icon: Users },
  { to: '/lecturer/batches', label: 'Batches', icon: Layers },
  { to: '/lecturer/enrollment', label: 'Enrollment', icon: UserPlus },
  { to: '/lecturer/attendance', label: 'Attendance', icon: ClipboardCheck },
  { to: '/lecturer/results', label: 'Results', icon: GraduationCap },
  { to: '/lecturer/graduation', label: 'Graduation', icon: GraduationCap },
  { to: '/lecturer/assignments', label: 'Assignments', icon: SquarePen },
]
