const ProgressBar = ({ value = 0 }) => {
  const safe = Math.max(0, Math.min(100, value))
  return (
    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
      <div className="h-2 bg-slate-900 rounded-full transition-all duration-300" style={{ width: `${safe}%` }} />
    </div>
  )
}

export default ProgressBar
