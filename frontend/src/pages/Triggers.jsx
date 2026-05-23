import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { SlidersHorizontal, TrendingUp, Clock, ExternalLink, ArrowUpDown, Loader2 } from 'lucide-react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { EventTypeBadge, StatusBadge } from '../components/ui/Badge'
import { Avatar } from '../components/ui/Avatar'
import { ScoreRing } from '../components/ui/ScoreRing'
import { SearchInput } from '../components/ui/SearchInput'

import { useApiData } from '../hooks/useApiData'
import { getTriggers, getCompanies } from '../services/api'
import { transformTrigger, buildCompaniesMap } from '../services/transform'

const EVENT_TYPES = ['Funding', 'Leadership Change', 'Hiring Surge', 'Expansion', 'AI Adoption', 'Acquisition', 'Partnership', 'Product Launch', 'Cloud Migration']
const STATUSES    = ['New', 'Assigned', 'Outreach Sent', 'Closed']

function timeAgo(ts) {
  if (!ts) return 'Unknown'
  const diff = Date.now() - new Date(ts).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function Triggers() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [selectedTypes, setSelectedTypes] = useState([])
  const [selectedStatuses, setSelectedStatuses] = useState([])
  const [minScore, setMinScore] = useState(0)
  const [sortBy, setSortBy] = useState('newest')

  const toggleFilter = (set, setter, val) => {
    setter(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val])
  }

  const { data: rawCompanies, loading: cLoading, error: cError } = useApiData(getCompanies)
  const { data: rawTriggers, loading: tLoading, error: tError } = useApiData(getTriggers)

  const triggers = useMemo(() => {
    const cmap = buildCompaniesMap(rawCompanies || [])
    return (rawTriggers || []).map(rt => transformTrigger(rt, cmap))
  }, [rawTriggers, rawCompanies])

  const filtered = useMemo(() => {
    let list = triggers.filter(t => {
      if (selectedTypes.length && !selectedTypes.includes(t.eventType)) return false
      if (selectedStatuses.length && !selectedStatuses.includes(t.status)) return false
      if (t.opportunityScore < minScore) return false
      if (search && !t.companyName?.toLowerCase().includes(search.toLowerCase()) && !t.headline?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })

    if (sortBy === 'newest') list = [...list].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    if (sortBy === 'score') list = [...list].sort((a, b) => b.opportunityScore - a.opportunityScore)
    if (sortBy === 'company') list = [...list].sort((a, b) => a.companyName.localeCompare(b.companyName))

    return list
  }, [search, selectedTypes, selectedStatuses, minScore, sortBy, triggers])

  // Summary stats
  const thisWeek = triggers.filter(t => t.timestamp && Date.now() - new Date(t.timestamp) < 7 * 86400000).length
  const avgScore = triggers.length > 0 ? Math.round(triggers.reduce((a, b) => a + b.opportunityScore, 0) / triggers.length) : 0
  const typeCounts = EVENT_TYPES.map(type => ({
    type, count: triggers.filter(t => t.eventType === type).length,
  })).filter(x => x.count > 0)
  const maxCount = typeCounts.length > 0 ? Math.max(...typeCounts.map(x => x.count)) : 1

  if (cLoading || tLoading) {
    return (
      <PageWrapper className="flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500 w-8 h-8" />
      </PageWrapper>
    )
  }

  if (cError || tError) {
    return (
      <PageWrapper className="flex items-center justify-center">
        <div className="text-center text-red-500">Failed to load data: {cError || tError}</div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Trigger Event Explorer</h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">{filtered.length} of {triggers.length} events</p>
        </div>
        <div className="flex items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search triggers..." className="w-56" />
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:bg-slate-700/60 transition-colors"
          >
            <SlidersHorizontal size={13} />
            Filters
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 mb-5 flex items-stretch gap-6 flex-wrap">
        <div className="text-center">
          <p className="text-2xl font-bold font-mono text-emerald-400">{thisWeek}</p>
          <p className="text-xs text-slate-500 mt-0.5">This week</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold font-mono text-blue-400">{avgScore}</p>
          <p className="text-xs text-slate-500 mt-0.5">Avg score</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold font-mono text-amber-400">{triggers.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Total triggers</p>
        </div>
        <div className="flex-1 min-w-48">
          <p className="text-xs text-slate-500 mb-2 font-mono">By type</p>
          <div className="space-y-1">
            {typeCounts.length > 0 ? typeCounts.map(({ type, count }) => (
              <div key={type} className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-500 w-28 truncate">{type}</span>
                <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-slate-400 w-4 text-right">{count}</span>
              </div>
            )) : <div className="text-xs text-slate-500">No data</div>}
          </div>
        </div>
      </div>

      <div className="flex gap-5">
        {/* Filter sidebar */}
        {sidebarOpen && (
          <div className="w-52 flex-shrink-0 space-y-5">
            {/* Event Type */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Event Type</h4>
              <div className="space-y-1.5">
                {EVENT_TYPES.map(type => (
                  <label key={type} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(type)}
                      onChange={() => toggleFilter(selectedTypes, setSelectedTypes, type)}
                      className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 checked:bg-emerald-500 checked:border-emerald-500 accent-emerald-500"
                    />
                    <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Status</h4>
              <div className="space-y-1.5">
                {STATUSES.map(s => (
                  <label key={s} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedStatuses.includes(s)}
                      onChange={() => toggleFilter(selectedStatuses, setSelectedStatuses, s)}
                      className="w-3.5 h-3.5 accent-emerald-500"
                    />
                    <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">{s}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Score range */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Min Score: <span className="text-emerald-400">{minScore}</span>
              </h4>
              <input
                type="range" min="0" max="90" step="10"
                value={minScore} onChange={e => setMinScore(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-xs font-mono text-slate-600 mt-1">
                <span>0</span><span>50</span><span>90</span>
              </div>
            </div>

            {(selectedTypes.length > 0 || selectedStatuses.length > 0 || minScore > 0) && (
              <button
                onClick={() => { setSelectedTypes([]); setSelectedStatuses([]); setMinScore(0) }}
                className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 min-w-0">
          {/* Sort bar */}
          <div className="flex items-center gap-2 mb-4">
            <ArrowUpDown size={12} className="text-slate-500" />
            <span className="text-xs text-slate-500 font-mono">Sort:</span>
            {[['newest', 'Newest'], ['score', 'Score'], ['company', 'Company']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setSortBy(val)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  sortBy === val ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Cards grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {filtered.map((trigger, i) => (
              <div
                key={trigger.id}
                className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-xl p-4 card-hover cursor-pointer opacity-0"
                style={{ animation: `fadeSlideIn 0.4s ease-out ${Math.min(i, 9) * 40}ms forwards` }}
                onClick={() => navigate(`/outreach/${trigger.id}`)}
              >
                <div className="flex items-start gap-3 mb-3">
                  <Avatar name={trigger.companyName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-slate-200">{trigger.companyName}</span>
                      <ScoreRing score={trigger.opportunityScore} size={38} />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <EventTypeBadge type={trigger.eventType} />
                      <StatusBadge status={trigger.status} />
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-300 font-medium line-clamp-1 mb-1">{trigger.headline}</p>
                <p className="text-xs text-slate-500 line-clamp-2 mb-3">{trigger.summary}</p>

                <div className="flex items-center justify-between text-xs text-slate-600 font-mono">
                  <span className="flex items-center gap-1">
                    <ExternalLink size={10} />
                    {trigger.source}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {timeAgo(trigger.timestamp)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-20 text-slate-500">
              <TrendingUp size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">No triggers found</p>
              <button className="mt-2 text-xs text-emerald-400 hover:text-emerald-300" onClick={() => { setSelectedTypes([]); setSelectedStatuses([]); setMinScore(0) }}>
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}
