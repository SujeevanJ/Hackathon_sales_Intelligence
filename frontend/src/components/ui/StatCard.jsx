export function StatCard({ label, value, subtext, icon: Icon, trend, color = 'emerald' }) {
  const colorMap = {
    emerald: 'text-emerald-400 bg-emerald-500/10',
    blue:    'text-blue-400 bg-blue-500/10',
    amber:   'text-amber-400 bg-amber-500/10',
    cyan:    'text-cyan-400 bg-cyan-500/10',
    violet:  'text-violet-400 bg-violet-500/10',
  }

  const trendColor = trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-red-400' : 'text-slate-400'
  const trendSymbol = trend > 0 ? '↑' : trend < 0 ? '↓' : '–'

  return (
    <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-xl p-5 card-hover">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">{label}</span>
        {Icon && (
          <div className={`p-2 rounded-lg ${colorMap[color]}`}>
            <Icon size={14} className={colorMap[color].split(' ')[0]} />
          </div>
        )}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold text-slate-100 font-mono leading-none">{value}</span>
        {trend !== undefined && (
          <span className={`text-sm font-mono mb-0.5 ${trendColor}`}>
            {trendSymbol}{Math.abs(trend)}%
          </span>
        )}
      </div>
      {subtext && (
        <p className="text-xs text-slate-500 mt-1.5 font-sans">{subtext}</p>
      )}
    </div>
  )
}
