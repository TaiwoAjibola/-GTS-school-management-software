export default function PageHeader({ title, subtitle, icon, actions, className = '' }) {
  return (
    <header className={`page-header shrink-0 ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        {icon ? (
          <div className="ico h-11 w-11 text-gold-700" aria-hidden="true">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <h1 className="page-title truncate">{title}</h1>
          {subtitle ? <p className="page-sub">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  )
}
