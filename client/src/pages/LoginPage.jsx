import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const LoginPage = () => {
  const { login, user, loading } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [warmingUp, setWarmingUp] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  // Navigate once the user state is actually committed — avoids the race
  // condition where navigate() runs before React commits setUser().
  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'student') navigate('/student/courses', { replace: true })
      else navigate('/lecturer/courses', { replace: true })
    }
  }, [user, loading, navigate])

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    setWarmingUp(false)
    setRetryCount(0)

    // Intercept auth context retries to show warming-up UI
    let attempt = 0
    const origLogin = () => login(form.email, form.password)

    const delays = [2000, 4000, 6000, 8000]
    try {
      // Mirror the retry loop from AuthContext so we can update UI per attempt
      let lastError
      for (attempt = 0; attempt <= delays.length; attempt++) {
        try {
          await login(form.email, form.password)
          return // success — navigation handled by useEffect
        } catch (err) {
          const isNetworkError = !err.response
          if (!isNetworkError || attempt === delays.length) throw err
          lastError = err
          setWarmingUp(true)
          setRetryCount(attempt + 1)
          await new Promise((resolve) => setTimeout(resolve, delays[attempt]))
        }
      }
      throw lastError
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Login failed. Please try again.')
    } finally {
      setSubmitting(false)
      setWarmingUp(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h1 className="text-2xl font-semibold text-slate-900">SAMS Login</h1>
        <p className="text-sm text-slate-500 mt-1">Sign in as Lecturer or Student</p>

        <div className="mt-6 space-y-4">
          <input
            type="email"
            required
            placeholder="Email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {warmingUp ? (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
              Server is waking up... (attempt {retryCount}/4)
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-slate-900 text-white rounded-lg py-2 font-medium hover:bg-slate-800 transition-colors disabled:opacity-60"
          >
            {warmingUp ? `Retrying... (${retryCount}/4)` : submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default LoginPage
