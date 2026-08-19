import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import apiClient from '../api/client'
import gtsLogo from '../assets/logo/gts logo.svg'

const WIDTH_MAP = { full: 'col-span-12', half: 'col-span-6', third: 'col-span-4' }

const PublicFormPage = () => {
  const { slug } = useParams()
  const [form, setForm] = useState(null)
  const [fields, setFields] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [formData, setFormData] = useState({})
  const [availability, setAvailability] = useState({})

  useEffect(() => {
    const fetchForm = async () => {
      try {
        const res = await apiClient.get(`/forms/public/${slug}`)
        setForm(res.data)
        setFields(res.data.fields || [])
        const initial = {}
        res.data.fields.forEach(f => {
          initial[f.id] = f.field_type === 'checkbox' ? false : ''
        })
        setFormData(initial)
        if (res.data.fields.some(f => f.field_type === 'availability')) {
          apiClient.get(`/forms/public/${slug}/availability`).then(avRes => setAvailability(avRes.data)).catch(() => {})
        }
      } catch (err) {
        setError(err?.response?.data?.message || 'Form not found or closed')
      } finally {
        setLoading(false)
      }
    }
    fetchForm()
  }, [slug])

  const isFieldVisible = (field) => {
    if (!field.field_conditions) return true
    const { fieldId, operator, value } = field.field_conditions
    if (!fieldId) return true
    const controlValue = formData[fieldId]
    switch (operator) {
      case 'equals': return String(controlValue) === String(value)
      case 'not_equals': return String(controlValue) !== String(value)
      case 'contains': return String(controlValue || '').includes(value || '')
      case 'is_checked': return !!controlValue
      default: return true
    }
  }

  const visibleFields = useMemo(() => fields.filter(isFieldVisible), [fields, formData])

  const groupedFields = useMemo(() => {
    const groups = {}
    for (const f of visibleFields) {
      const section = f.section || '__default'
      if (!groups[section]) groups[section] = []
      groups[section].push(f)
    }
    return groups
  }, [visibleFields])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      let submitterName = formData.submitter_name || ''
      let submitterEmail = formData.submitter_email || ''

      if (form.maps_to_student) {
        const nameField = fields.find(f => f.maps_to_column === 'full_name')
        const emailField = fields.find(f => f.maps_to_column === 'email')
        if (nameField && formData[nameField.id]) submitterName = formData[nameField.id]
        if (emailField && formData[emailField.id]) submitterEmail = formData[emailField.id]
      }

      await apiClient.post('/forms/submit', {
        slug,
        data: formData,
        submitterName,
        submitterEmail,
      })
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to submit form')
    } finally {
      setSubmitting(false)
    }
  }

  const handleChange = (fieldId, value) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }))
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading form...</p>
        </div>
      </div>
    )
  }

  if (error && !form) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 p-4">
        <div className="max-w-md w-full text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900">Form Unavailable</h1>
          <p className="text-slate-500 mt-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 text-sm font-semibold text-sky-600 hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 p-4">
        <div className="max-w-md w-full text-center bg-white p-10 rounded-3xl shadow-sm border border-slate-200 animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Thank You!</h1>
          <p className="text-slate-500 mt-2">Your response has been successfully submitted.</p>
          <button
            onClick={() => setSubmitted(false)}
            className="mt-8 bg-slate-900 text-white px-8 py-3 rounded-2xl text-sm font-semibold hover:bg-slate-800 transition-all"
          >
            Submit another response
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Form Header */}
          <div className="bg-slate-900 p-8 text-white">
            <div className="flex items-center gap-4">
              <img src={gtsLogo} alt="GTS Logo" className="h-12 w-12 rounded-lg object-contain bg-white p-1" />
              <div>
                <h1 className="text-2xl font-bold">{form.title}</h1>
                {form.description && <p className="mt-2 text-slate-300 text-sm leading-relaxed">{form.description}</p>}
              </div>
            </div>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-8">
            {form.status !== 'active' && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2 mb-6">
                <AlertCircle className="w-4 h-4" />
                This form is not accepting submissions right now. Please check back later.
              </div>
            )}
            {Object.entries(groupedFields).map(([sectionName, sectionFields]) => (
              <div key={sectionName} className={sectionName !== '__default' ? 'mb-8' : ''}>
                {sectionName !== '__default' && (
                  <h2 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">{sectionName}</h2>
                )}
                <div className="grid grid-cols-12 gap-4">
                  {sectionFields.map((field) => (
                    <div key={field.id} className={`${WIDTH_MAP[field.width] || 'col-span-12'} space-y-1.5`}>
                      <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                        {field.label}
                        {field.required && <span className="text-red-500">*</span>}
                      </label>

                      {field.field_type === 'availability' ? (
                        <div className="space-y-3">
                          <div className="border border-sky-100 bg-sky-50 rounded-xl px-4 py-3 text-sm text-sky-800">
                            Pick a time slot below. Each slot holds a limited number of bookings.
                          </div>
                          {(() => {
                            const info = availability[field.id] || {}
                            const options = field.options || []
                            const bookedMap = info.booked || {}
                            const byDate = {}
                            for (const opt of options) {
                              const key = opt.date || 'No date'
                              if (!byDate[key]) byDate[key] = []
                              byDate[key].push(opt)
                            }
                            return Object.entries(byDate).map(([dateLabel, slots]) => (
                              <div key={dateLabel} className="space-y-2">
                                <p className="text-sm font-semibold text-slate-800 capitalize">
                                  {dateLabel === 'No date' ? dateLabel : new Date(dateLabel).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {slots.map((opt) => {
                                    const booked = Number(bookedMap[opt.value] || 0)
                                    const capacity = Number(opt.capacity || 1)
                                    const full = booked >= capacity
                                    const selected = formData[field.id] === opt.value
                                    const timeLabel = `${opt.start || '—'} – ${opt.end || '—'}`
                                    return (
                                      <button
                                        key={opt.value}
                                        type="button"
                                        disabled={full}
                                        onClick={() => handleChange(field.id, opt.value)}
                                        className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
                                          selected
                                            ? 'border-sky-600 bg-sky-600 text-white shadow-sm'
                                            : full
                                            ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                                            : 'border-slate-200 bg-white hover:border-sky-400'
                                        }`}
                                      >
                                        <span className="block font-semibold">{timeLabel}</span>
                                        {opt.label ? (
                                          <span className={`block text-xs mt-0.5 ${selected ? 'text-sky-100' : full ? 'text-slate-300' : 'text-slate-500'}`}>
                                            {opt.label}
                                          </span>
                                        ) : null}
                                        <span className={`block text-xs mt-0.5 ${selected ? 'text-sky-100' : full ? 'text-slate-300' : 'text-slate-500'}`}>
                                          {full ? 'Fully booked' : `${capacity - booked} remaining`}
                                        </span>
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            ))
                          })()}
                        </div>
                      ) : field.field_type === 'textarea' ? (
                        <textarea
                          required={field.required}
                          placeholder={field.placeholder}
                          value={formData[field.id] || ''}
                          onChange={(e) => handleChange(field.id, e.target.value)}
                          rows={4}
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                        />
                      ) : field.field_type === 'select' ? (
                        <select
                          required={field.required}
                          value={formData[field.id] || ''}
                          onChange={(e) => handleChange(field.id, e.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all appearance-none bg-white"
                        >
                          <option value="">Select an option</option>
                          {field.options?.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : field.field_type === 'multiselect' ? (
                        <select
                          multiple
                          required={field.required}
                          value={formData[field.id] || []}
                          onChange={(e) => {
                            const selected = Array.from(e.target.selectedOptions, o => o.value)
                            handleChange(field.id, selected)
                          }}
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                        >
                          {field.options?.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : field.field_type === 'checkbox' ? (
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={!!formData[field.id]}
                            onChange={(e) => handleChange(field.id, e.target.checked)}
                            className="w-5 h-5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                          <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">
                            {field.placeholder || 'Yes'}
                          </span>
                        </label>
                      ) : field.field_type === 'radio' ? (
                        <div className="space-y-2">
                          {field.options?.map(opt => (
                            <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                              <input
                                type="radio"
                                name={`field_${field.id}`}
                                value={opt.value}
                                checked={formData[field.id] === opt.value}
                                onChange={(e) => handleChange(field.id, e.target.value)}
                                className="w-4 h-4 text-slate-900 focus:ring-slate-900"
                              />
                              <span className="text-sm text-slate-600">{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      ) : field.field_type === 'phone' ? (
                        <input
                          type="tel"
                          required={field.required}
                          placeholder={field.placeholder}
                          value={formData[field.id] || ''}
                          onChange={(e) => handleChange(field.id, e.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                        />
                      ) : (
                        <input
                          type={field.field_type === 'number' ? 'number' : field.field_type === 'email' ? 'email' : field.field_type === 'date' ? 'date' : 'text'}
                          required={field.required}
                          placeholder={field.placeholder}
                          value={formData[field.id] || ''}
                          onChange={(e) => handleChange(field.id, e.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2 mt-6">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="pt-6">
              <button
                type="submit"
                disabled={submitting || form.status !== 'active'}
                className="w-full bg-slate-900 text-white rounded-2xl py-4 font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {form.status !== 'active'
                  ? 'Submissions Closed'
                  : submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : 'Submit Response'}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          Powered by Grace Theological Seminary (GTS)
        </p>
      </div>
    </div>
  )
}

export default PublicFormPage
