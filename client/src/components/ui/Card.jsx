const ACCENTS = {
  gold: 'bg-gold-50 text-gold-700',
  sky: 'bg-sky-50 text-sky-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  rose: 'bg-rose-50 text-rose-700',
  slate: 'bg-slate-100 text-slate-600',
}

export function Card({
  title,
  subtitle,
  action,
  value,
  icon,
  accent = 'gold',
  hint,
  children,
  className = '',
  bodyClassName = '',
}) {
  // Stat-tile mode: used for metric cards (title + value)
  if (value !== undefined) {
    return (
      <div className={`stat ${className}`}>
        <div className="flex items-center gap-4">
          {icon ? (
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${ACCENTS[accent] || ACCENTS.gold}`}>
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="stat-label">{title}</p>
            <p className="stat-value">{value}</p>
            {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
          </div>
        </div>
      </div>
    )
  }

  // Content-card mode
  return (
    <section className={`card ${className}`}>
      {title || action ? (
        <div className="flex items-start justify-between gap-2 px-5 py-4">
          <div>
            {title ? <h3 className="card-title">{title}</h3> : null}
            {subtitle ? <p className="section-sub">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className={`px-5 pb-5 ${title || action ? 'pt-0' : 'pt-5'} ${bodyClassName}`}>{children}</div>
    </section>
  )
}

export default Card
