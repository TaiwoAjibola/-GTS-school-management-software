import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import apiClient from '../api/client'
import gtsLogo from '../assets/logo/gts logo.svg'

export default function PublicQuizPage() {
  const { token } = useParams()
  const [meta, setMeta] = useState(null)
  const [accessCode, setAccessCode] = useState('')
  const [quiz, setQuiz] = useState(null)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(true)
  const [unlocking, setUnlocking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const res = await apiClient.get(`/exams/public/${token}`)
        if (!cancelled) setMeta(res.data)
      } catch (err) {
        if (!cancelled) setError(err?.response?.data?.message || 'Quiz not found')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [token])

  const unlock = async (e) => {
    e.preventDefault()
    if (!accessCode.trim()) return
    setUnlocking(true)
    setError('')
    try {
      const res = await apiClient.post(`/exams/public/${token}/unlock`, { accessCode: accessCode.trim() })
      setQuiz(res.data)
      if (res.data.already_submitted) {
        setDone({ message: 'You have already submitted this quiz. Your result will be emailed when the lecturer releases it.' })
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Invalid access code')
    } finally {
      setUnlocking(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!quiz?.questions?.length) return
    const unanswered = quiz.questions.filter((q) => !answers[q.id])
    if (unanswered.length) {
      setError(`Please answer all questions (${unanswered.length} remaining)`)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await apiClient.post(`/exams/public/${token}/submit`, {
        accessCode: accessCode.trim(),
        answers,
      })
      setDone(res.data)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to submit quiz')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Loading quiz…</p>
      </div>
    )
  }

  if (error && !meta) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
          <img src={gtsLogo} alt="GTS" className="h-12 mx-auto mb-4" />
          <p className="text-rose-600 font-medium">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <img src={gtsLogo} alt="GTS" className="h-10" />
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold">GTS Online Quiz</p>
            <p className="text-sm text-slate-500">{meta?.course_title}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{meta?.title || quiz?.title}</h1>
            {(meta?.description || quiz?.description) ? (
              <p className="text-sm text-slate-600 mt-2">{meta?.description || quiz?.description}</p>
            ) : null}
            {(meta?.due_date || quiz?.due_date) ? (
              <p className="text-xs text-slate-400 mt-1">Due {meta?.due_date || quiz?.due_date}</p>
            ) : null}
          </div>

          {done ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-center">
              <p className="font-semibold text-emerald-800">Submitted</p>
              <p className="text-sm text-emerald-700 mt-1">
                {done.message || 'Your answers were saved. Results will be emailed when the lecturer releases them.'}
              </p>
            </div>
          ) : !quiz ? (
            <form onSubmit={unlock} className="space-y-4">
              <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                Enter the Access ID from your exam email to unlock the questions.
              </div>
              <label className="block text-sm text-slate-700">
                Access ID
                <input
                  className="mt-1 w-full border border-slate-200 rounded-xl px-4 py-3 text-lg font-mono tracking-widest uppercase focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"
                  placeholder="e.g. AB12CD34"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  autoFocus
                  required
                />
              </label>
              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              <button
                type="submit"
                disabled={unlocking || !accessCode.trim()}
                className="w-full bg-slate-900 text-white rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
              >
                {unlocking ? 'Unlocking…' : 'Unlock Quiz'}
              </button>
            </form>
          ) : (
            <form onSubmit={submit} className="space-y-6">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Signed in as <strong className="text-slate-900">{quiz.student_name}</strong>
                <span className="text-slate-400"> · {quiz.questions?.length || 0} questions</span>
              </div>

              {(quiz.questions || []).map((q, idx) => (
                <div key={q.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-slate-900">
                    <span className="text-slate-400 mr-2">Q{idx + 1}.</span>
                    {q.question_text}
                  </p>
                  <div className="space-y-2">
                    {(q.options || []).map((opt) => {
                      const selected = answers[q.id] === opt.key
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.key }))}
                          className={`w-full text-left rounded-xl border px-3 py-2.5 text-sm transition-all flex items-start gap-3 ${
                            selected
                              ? 'border-sky-600 bg-sky-50 text-sky-900'
                              : 'border-slate-200 bg-white hover:border-sky-300'
                          }`}
                        >
                          <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                            selected ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {opt.key}
                          </span>
                          <span className="pt-1">{opt.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}

              {error ? <p className="text-sm text-rose-600">{error}</p> : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-slate-900 text-white rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit Quiz'}
              </button>
              <p className="text-xs text-center text-slate-400">You can only submit once. Score is stored and emailed later.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
