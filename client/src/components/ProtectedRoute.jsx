import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-slate-600">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (roles?.length && !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return children
}

export default ProtectedRoute
