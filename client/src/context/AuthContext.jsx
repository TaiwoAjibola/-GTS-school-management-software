import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import apiClient from '../api/client'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('sams_token'))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchMe = async () => {
    try {
      const response = await apiClient.get('/auth/me')
      setUser({
        id: response.data.id,
        fullName: response.data.full_name,
        email: response.data.email,
        role: response.data.role,
        matricNo: response.data.matric_no,
      })
    } catch {
      setToken(null)
      setUser(null)
      localStorage.removeItem('sams_token')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (token) {
      localStorage.setItem('sams_token', token)
      fetchMe()
    } else {
      setLoading(false)
    }
  }, [token])

  const login = async (email, password) => {
    const response = await apiClient.post('/auth/login', { email, password })
    setToken(response.data.token)
    setUser(response.data.user)
    localStorage.setItem('sams_token', response.data.token)
    return response.data
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('sams_token')
  }

  const value = useMemo(
    () => ({ token, user, loading, login, logout, refresh: fetchMe }),
    [token, user, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
