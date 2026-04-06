const Card = ({ title, value, subtitle }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
    <p className="text-sm text-slate-500">{title}</p>
    <p className="text-2xl font-semibold mt-2 text-slate-900">{value}</p>
    {subtitle ? <p className="text-xs text-slate-500 mt-1">{subtitle}</p> : null}
  </div>
)

export default Card
