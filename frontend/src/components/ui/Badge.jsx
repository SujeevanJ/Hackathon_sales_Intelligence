const EVENT_TYPE_STYLES = {
  'Funding':          'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  'Leadership Change':'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  'Hiring Surge':     'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  'Acquisition':      'bg-purple-500/15 text-purple-400 border border-purple-500/30',
  'Merger':           'bg-purple-500/15 text-purple-400 border border-purple-500/30',
  'AI Adoption':      'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
  'Cloud Migration':  'bg-sky-500/15 text-sky-400 border border-sky-500/30',
  'Expansion':        'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  'Product Launch':   'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
  'Partnership':      'bg-violet-500/15 text-violet-400 border border-violet-500/30',
  'Layoff':           'bg-red-500/15 text-red-400 border border-red-500/30',
}

const PRIORITY_STYLES = {
  'High':   'bg-red-500/15 text-red-400 border border-red-500/25',
  'Medium': 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  'Low':    'bg-slate-500/15 text-slate-400 border border-slate-500/25',
}

const STATUS_STYLES = {
  'New':            'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  'Assigned':       'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  'Outreach Sent':  'bg-violet-500/15 text-violet-400 border border-violet-500/30',
  'Closed':         'bg-slate-500/15 text-slate-400 border border-slate-500/30',
}

export function EventTypeBadge({ type, size = 'sm' }) {
  const styles = EVENT_TYPE_STYLES[type] || 'bg-slate-500/15 text-slate-400 border border-slate-500/30'
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
  return (
    <span className={`inline-flex items-center rounded font-medium font-mono ${sizeClass} ${styles}`}>
      {type}
    </span>
  )
}

export function PriorityBadge({ priority, size = 'sm' }) {
  const styles = PRIORITY_STYLES[priority] || PRIORITY_STYLES['Low']
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
  return (
    <span className={`inline-flex items-center rounded font-medium font-mono ${sizeClass} ${styles}`}>
      {priority}
    </span>
  )
}

export function StatusBadge({ status, size = 'sm' }) {
  const styles = STATUS_STYLES[status] || STATUS_STYLES['New']
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'
  return (
    <span className={`inline-flex items-center rounded font-medium font-mono ${sizeClass} ${styles}`}>
      {status}
    </span>
  )
}

export function IndustryBadge({ industry }) {
  return (
    <span className="inline-flex items-center rounded text-xs px-2 py-0.5 font-mono bg-slate-700/60 text-slate-300 border border-slate-600/40">
      {industry}
    </span>
  )
}
