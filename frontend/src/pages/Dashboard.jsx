import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, TrendingUp, ExternalLink, X, Radio, Loader2 } from 'lucide-react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { EventTypeBadge, PriorityBadge } from '../components/ui/Badge'
import { Avatar } from '../components/ui/Avatar'
import { ScoreRing } from '../components/ui/ScoreRing'
import { SearchInput } from '../components/ui/SearchInput'

// Live hooks
import { useApiData } from '../hooks/useApiData'
import { getTriggers, getCompanies } from '../services/api'
import { transformTrigger, transformCompany, buildCompaniesMap, enrichCompaniesWithTriggerCounts } from '../services/transform'

const EVENT_TYPES = ['All', 'Funding', 'Leadership Change', 'Hiring Surge', 'Expansion', 'AI Adoption', 'Acquisition', 'Partnership', 'Product Launch', 'Cloud Migration']
const PRIORITIES  = ['All', 'High', 'Medium', 'Low']

function timeAgo(ts) {
  if (!ts) return 'Unknown'
  const diff = Date.now() - new Date(ts).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return `${Math.floor(diff / 60000)}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function TriggerCard({ trigger, index, onView }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div
      className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-xl p-5 card-hover opacity-0"
      style={{ animation: `fadeSlideIn 0.4s ease-out ${index * 60}ms forwards` }}
    >
      <div className="flex items-start gap-4">
        <Avatar name={trigger.companyName} size="md" />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-100">{trigger.companyName}</span>
              <EventTypeBadge type={trigger.eventType} />
              <PriorityBadge priority={trigger.priority} />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <ScoreRing score={trigger.opportunityScore} size={44} />
              <button
                onClick={() => setDismissed(true)}
                aria-label="Dismiss trigger"
                className="p-1 text-slate-600 hover:text-slate-400 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <h3 className="text-sm font-medium text-slate-200 mb-1.5 leading-snug line-clamp-1">
            {trigger.headline}
          </h3>

          <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-3">
            {trigger.summary}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
              <span className="flex items-center gap-1">
                <ExternalLink size={10} />
                {trigger.source}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={10} />
                {timeAgo(trigger.timestamp)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onView(trigger.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
              >
                View Outreach Brief
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PriorityAccountRow({ company }) {
  const hasRecentActivity = new Date(company.lastSignalAt) > new Date(Date.now() - 86400000)
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-800 last:border-0">
      <div className="relative">
        <Avatar name={company.name} size="sm" />
        {hasRecentActivity && (
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-200 truncate">{company.name}</p>
        <p className="text-xs text-slate-500 font-mono truncate">{company.industry}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs font-mono font-bold text-emerald-400">{company.activeTriggersCount}</p>
        <p className="text-xs text-slate-600">signals</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [activeType, setActiveType] = useState('All')
  const [activePriority, setActivePriority] = useState('All')

  // Live Data fetching
  const { data: rawCompanies, loading: cLoading, error: cError } = useApiData(getCompanies)
  const { data: rawTriggers, loading: tLoading, error: tError } = useApiData(getTriggers)

  // Transform live data to UI format
  const { triggers, companies } = useMemo(() => {
    const cmap = buildCompaniesMap(rawCompanies || [])
    const t = (rawTriggers || []).map(rt => transformTrigger(rt, cmap))
    let c = (rawCompanies || []).map(transformCompany)
    c = enrichCompaniesWithTriggerCounts(c, t)

    return { triggers: t, companies: c }
  }, [rawTriggers, rawCompanies])

  const filtered = useMemo(() => {
    return triggers.filter(t => {
      const matchType = activeType === 'All' || t.eventType === activeType
      const matchPriority = activePriority === 'All' || t.priority === activePriority
      const matchSearch = !search ||
        t.companyName?.toLowerCase().includes(search.toLowerCase()) ||
        t.headline?.toLowerCase().includes(search.toLowerCase())
      return matchType && matchPriority && matchSearch
    })
  }, [search, activeType, activePriority, triggers])

  const topCompanies = [...companies]
    .sort((a, b) => b.activeTriggersCount - a.activeTriggersCount)
    .slice(0, 5)

  const topTimings = companies
    .flatMap(c => (c.timingRecommendations || []).slice(0, 1).map(t => ({ ...t, company: c.name })))
    .slice(0, 4)

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
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Intelligence Feed</h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">{filtered.length} signals matching filters</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-1.5">
          <Radio size={12} className={"text-emerald-400"} />
          Monitoring {companies.length} accounts
        </div>
      </div>

      <div className="flex gap-6">
        {/* LEFT: Trigger Feed */}
        <div className="flex-1 min-w-0">
          {/* Filter bar */}
          <div className="mb-4 space-y-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Search companies, events..." className="w-full" />

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500 font-mono">Type:</span>
              {EVENT_TYPES.slice(0, 7).map(type => (
                <button
                  key={type}
                  onClick={() => setActiveType(type)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    activeType === type
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:bg-slate-700/60'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-mono">Priority:</span>
              {PRIORITIES.map(p => (
                <button
                  key={p}
                  onClick={() => setActivePriority(p)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    activePriority === p
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:bg-slate-700/60'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Cards */}
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <TrendingUp size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No signals match your filters</p>
              </div>
            ) : (
              filtered.map((trigger, i) => (
                <TriggerCard
                  key={trigger.id}
                  trigger={trigger}
                  index={i}
                  onView={(id) => navigate(`/outreach/${id}`)}
                />
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Priority panel */}
        <div className="w-72 flex-shrink-0 space-y-4 hidden lg:block">
          {/* Priority accounts */}
          <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingUp size={12} className="text-emerald-400" />
              Priority Accounts
            </h3>
            {topCompanies.length > 0 ? topCompanies.map(c => (
              <PriorityAccountRow key={c.id} company={c} />
            )) : <div className="text-xs text-slate-500">No accounts</div>}
          </div>

          {/* Outreach timing */}
          <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-xl p-4 relative overflow-hidden">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Clock size={12} className="text-emerald-400" />
              Optimal Outreach Windows
            </h3>
            
            <div className="absolute inset-0 z-10 bg-slate-900/80 backdrop-blur-[2px] flex flex-col items-center justify-center pt-8 text-center">
              <Clock size={20} className="text-amber-500/50 mb-2" />
              <p className="text-xs font-semibold text-slate-200">Timing Engine</p>
              <p className="text-[10px] text-slate-400 mt-1">Coming in v2</p>
            </div>
            
            <div className="space-y-3 opacity-30 blur-[1px] pointer-events-none">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-slate-700/60 border border-slate-600/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock size={12} className="text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-200 truncate">Example Corp</p>
                  <p className="text-xs text-slate-400 font-mono">Tuesday: 10:00 AM</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Today's Summary</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'New signals', value: triggers.length, color: 'text-emerald-400' },
                { label: 'High priority', value: triggers.filter(t=>t.priority==='High').length, color: 'text-amber-400' },
                { label: 'Avg score', value: triggers.length > 0 ? Math.round(triggers.reduce((a,b)=>a+b.opportunityScore,0)/triggers.length) : 0, color: 'text-blue-400' },
                { label: 'Accounts', value: companies.length, color: 'text-slate-300' },
              ].map(s => (
                <div key={s.label} className="bg-slate-700/30 rounded-lg p-3 text-center">
                  <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
