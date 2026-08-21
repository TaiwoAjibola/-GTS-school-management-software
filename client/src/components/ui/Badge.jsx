const TONES = {
  gold: 'badge-gold',
  sky: 'badge-sky',
  emerald: 'badge-emerald',
  rose: 'badge-rose',
  amber: 'badge-amber',
  slate: 'badge-slate',
}

export default function Badge({ tone = 'slate', dot = false, children, className = '' }) {
  return (
    <span className={`badge ${TONES[tone] || TONES.slate} ${className}`}>
      {dot ? <span className="badge-dot" /> : null}
      {children}
    </span>
  )
}
