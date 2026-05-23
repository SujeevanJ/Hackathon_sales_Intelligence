import { useMemo } from 'react'
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import { TrendingUp, Building2, Zap, FileText, BarChart3, Loader2 } from 'lucide-react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { StatCard } from '../components/ui/StatCard'

import { useApiData } from '../hooks/useApiData'
import { getTriggers, getCompanies } from '../services/api'
import { transformTrigger, transformCompany, buildCompaniesMap, enrichCompaniesWithTriggerCounts } from '../services/transform'

const DONUT_COLORS = ['#10b981','#3b82f6','#f59e0b','#f97316','#8b5cf6','#06b6d4','#60a5fa','#a855f7']

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs font-mono text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-mono font-bold" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

export default function Analytics() {
  const { data: rawCompanies, loading: cLoading, error: cError } = useApiData(getCompanies)
  const { data: rawTriggers, loading: tLoading, error: tError } = useApiData(getTriggers)

  const { triggers, companies } = useMemo(() => {
    const cmap = buildCompaniesMap(rawCompanies || [])
    const t = (rawTriggers || []).map(rt => transformTrigger(rt, cmap))
    let c = (rawCompanies || []).map(transformCompany)
    c = enrichCompaniesWithTriggerCounts(c, t)
    return { triggers: t, companies: c }
  }, [rawTriggers, rawCompanies])

  const analytics = useMemo(() => {
    // 1. Triggers by Type
    const typeMap = {}
    triggers.forEach(t => { typeMap[t.eventType] = (typeMap[t.eventType] || 0) + 1 })
    const triggersByType = Object.entries(typeMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, color: DONUT_COLORS[i % DONUT_COLORS.length] }))

    // 2. Top Accounts
    const topAccountsBySignals = [...companies]
      .sort((a, b) => b.activeTriggersCount - a.activeTriggersCount)
      .slice(0, 5)
      .map(c => ({ company: c.name, signals: c.activeTriggersCount }))

    // 3. Triggers over time (Group by day)
    const timeMap = {}
    triggers.forEach(t => {
      const d = new Date(t.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      timeMap[d] = (timeMap[d] || 0) + 1
    })
    const triggersOverTime = Object.entries(timeMap)
      .map(([date, count]) => ({ date, count }))
      .slice(-7) // Last 7 days

    return { triggersByType, topAccountsBySignals, triggersOverTime }
  }, [triggers, companies])

  const { triggersOverTime, triggersByType, topAccountsBySignals } = analytics

  const avgScore = triggers.length ? Math.round(triggers.reduce((a,b)=>a+b.opportunityScore,0)/triggers.length) : 0
  const highPriority = triggers.filter(t => t.opportunityScore >= 80).length
  const medPriority = triggers.filter(t => t.opportunityScore >= 60 && t.opportunityScore < 80).length
  const lowPriority = triggers.filter(t => t.opportunityScore < 60).length

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
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Intelligence Analytics</h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">Live Data · All accounts</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Accounts Monitored"
          value={companies.length.toString()}
          subtext={`${companies.filter(c=>c.activeTriggersCount>0).length} active enterprise targets`}
          icon={Building2}
          color="emerald"
          trend={12}
        />
        <StatCard
          label="Total Triggers"
          value={triggers.length.toString()}
          subtext="Detected in pipeline"
          icon={Zap}
          color="amber"
          trend={71}
        />
        <StatCard
          label="Briefs Generated"
          value={highPriority.toString()}
          subtext="High priority targets"
          icon={FileText}
          color="blue"
          trend={33}
        />
        <StatCard
          label="Avg Opp. Score"
          value={avgScore.toString()}
          subtext="Across all triggers"
          icon={BarChart3}
          color="cyan"
          trend={10}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
        {/* Line chart: triggers over time */}
        <div className="xl:col-span-2 bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Triggers Over Time</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">Daily signal detection count</p>
            </div>
            <TrendingUp size={14} className="text-emerald-400" />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            {triggersOverTime.length > 0 ? (
              <AreaChart data={triggersOverTime} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="triggerGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'IBM Plex Mono' }} tickLine={false} interval={4} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Triggers"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#triggerGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#10b981', stroke: '#0d1117', strokeWidth: 2 }}
                />
              </AreaChart>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">No timeline data available</div>
            )}
          </ResponsiveContainer>
        </div>

        {/* Donut: by type */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-1">By Event Type</h3>
          <p className="text-xs text-slate-500 font-mono mb-4">All-time distribution</p>
          <ResponsiveContainer width="100%" height={140}>
            {triggersByType.length > 0 ? (
              <PieChart>
                <Pie
                  data={triggersByType}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {triggersByType.map((entry, i) => (
                    <Cell key={i} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-xs">No event data</div>
            )}
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-3 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
            {triggersByType.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.color }} />
                <span className="text-xs text-slate-400 flex-1 truncate">{t.name}</span>
                <span className="text-xs font-mono text-slate-400">{t.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Bar chart: top accounts */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-1">Top Accounts by Signal Activity</h3>
          <p className="text-xs text-slate-500 font-mono mb-4">Total signals detected per account</p>
          <ResponsiveContainer width="100%" height={220}>
            {topAccountsBySignals.length > 0 ? (
              <BarChart data={topAccountsBySignals} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={false} />
                <YAxis dataKey="company" type="category" tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'IBM Plex Mono' }} tickLine={false} axisLine={false} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="signals" name="Signals" radius={[0, 4, 4, 0]}>
                  {topAccountsBySignals.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#10b981' : i < 3 ? '#3b82f6' : '#2d3748'} />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">No account data available</div>
            )}
          </ResponsiveContainer>
        </div>

        {/* Score distribution */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-200 mb-1">Opportunity Score Distribution</h3>
          <p className="text-xs text-slate-500 font-mono mb-4">Across all {triggers.length} detected triggers</p>
          <div className="space-y-3">
            {[
              { label: 'High (80–100)', count: highPriority, color: 'bg-emerald-500', pct: triggers.length > 0 ? Math.round((highPriority/triggers.length)*100) : 0 },
              { label: 'Medium (60–79)', count: medPriority, color: 'bg-amber-500', pct: triggers.length > 0 ? Math.round((medPriority/triggers.length)*100) : 0 },
              { label: 'Low (0–59)', count: lowPriority, color: 'bg-slate-600', pct: triggers.length > 0 ? Math.round((lowPriority/triggers.length)*100) : 0 },
            ].map(({ label, count, color, pct }) => (
              <div key={label}>
                <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                  <span>{label}</span>
                  <span>{count} triggers · {pct}%</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%`, transition: 'width 1s ease-out' }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { label: 'High ROI deals', value: highPriority, color: 'text-emerald-400' },
              { label: 'In progress', value: medPriority, color: 'text-amber-400' },
              { label: 'Monitoring', value: lowPriority, color: 'text-slate-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-700/40 rounded-lg p-3 text-center">
                <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
