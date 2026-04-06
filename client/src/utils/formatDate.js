export const fmtDate = (d) => {
  if (!d) return '—'
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const fmtDateRange = (start, end) => {
  const s = fmtDate(start)
  const e = fmtDate(end)
  if (!start && !end) return '—'
  if (!start) return `Until ${e}`
  if (!end) return `From ${s}`
  return `${s} – ${e}`
}
