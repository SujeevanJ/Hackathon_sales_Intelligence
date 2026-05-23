const HOURS = ['8am','9am','10am','11am','12pm','1pm','2pm','3pm','4pm','5pm']

// score: 0 = none, 1 = low, 2 = best
const SLOT_COLORS = {
  0: 'bg-slate-800/40',
  1: 'bg-emerald-900/40 border-emerald-800/40',
  2: 'bg-emerald-500/30 border-emerald-500/40',
}

export function Heatmap({ weekGrid, size = 'md' }) {
  const cellSize = size === 'sm' ? 'w-5 h-4' : 'w-7 h-5'

  return (
    <div className="font-mono">
      {/* Hour labels */}
      <div className="flex items-center mb-1">
        <div className="w-8" />
        {HOURS.map(h => (
          <div key={h} className={`${cellSize} flex items-center justify-center text-slate-600 text-xs`}>
            {h.replace('am','').replace('pm','')}
          </div>
        ))}
      </div>

      {weekGrid.map((row) => (
        <div key={row.day} className="flex items-center mb-0.5">
          {/* Day label */}
          <div className="w-8 text-xs text-slate-500 font-mono">{row.day}</div>
          {/* Slots */}
          {row.slots.map((val, i) => (
            <div
              key={i}
              title={`${row.day} ${HOURS[i]}: ${val === 2 ? 'Best window' : val === 1 ? 'Good window' : 'Not recommended'}`}
              className={`${cellSize} ${SLOT_COLORS[val]} border rounded-sm mr-0.5 transition-opacity`}
            />
          ))}
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-emerald-500/30 border border-emerald-500/40" />
          <span>Best</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-emerald-900/40 border border-emerald-800/40" />
          <span>Good</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-slate-800/40" />
          <span>Avoid</span>
        </div>
      </div>
    </div>
  )
}
