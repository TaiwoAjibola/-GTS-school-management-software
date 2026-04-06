import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import LecturerDashboard from './pages/LecturerDashboard'
import CoursePage from './pages/CoursePage'
import StudentProfilePage from './pages/StudentProfilePage'
import StudentDashboard from './pages/StudentDashboard'
import EnrollmentPage from './pages/EnrollmentPage'
import NotFoundPage from './pages/NotFoundPage'

const HomeRedirect = () => {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'admin') return <Navigate to="/lecturer/courses" replace />
  if (user.role === 'lecturer') return <Navigate to="/lecturer/courses" replace />
  return <Navigate to="/student/courses" replace />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/*" element={<Navigate to="/lecturer/courses" replace />} />
      <Route
        path="/lecturer/courses/:courseId"
        element={
          <ProtectedRoute roles={['lecturer', 'admin']}>
            <CoursePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lecturer/enrollment"
        element={
          <ProtectedRoute roles={['lecturer', 'admin']}>
            <EnrollmentPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lecturer/students/:studentId"
        element={
          <ProtectedRoute roles={['lecturer', 'admin']}>
            <StudentProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lecturer/*"
        element={
          <ProtectedRoute roles={['lecturer', 'admin']}>
            <LecturerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/*"
        element={
          <ProtectedRoute roles={['student']}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default App
