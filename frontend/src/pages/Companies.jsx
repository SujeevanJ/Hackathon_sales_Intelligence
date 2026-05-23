import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Globe, MapPin, Clock, ChevronRight, X, Zap, Link, CheckCircle, Circle, Loader2 } from 'lucide-react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Avatar } from '../components/ui/Avatar'
import { PriorityBadge, EventTypeBadge, StatusBadge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { SearchInput } from '../components/ui/SearchInput'

// Live hooks
import { useApiData } from '../hooks/useApiData'
import { getTriggers, getCompanies } from '../services/api'
import { transformTrigger, transformCompany, buildCompaniesMap, enrichCompaniesWithTriggerCounts } from '../services/transform'

function timeAgo(ts) {
  if (!ts) return 'Unknown'
  const diff = Date.now() - new Date(ts).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return `${Math.floor(diff / 60000)}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function AddCompanyModal({ isOpen, onClose }) {
  const [form, setForm] = useState({ name: '', website: '', industry: '', priority: 'Medium', monitorUrl: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Target Company" size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Company Name *</label>
            <input
              type="text" value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. Meesho"
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Website</label>
            <input
              type="url" value={form.website} onChange={e => set('website', e.target.value)}
              placeholder="https://..."
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Industry</label>
            <input
              type="text" value={form.industry} onChange={e => set('industry', e.target.value)}
              placeholder="e.g. E-Commerce"
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-medium">Priority</label>
            <select
              value={form.priority} onChange={e => set('priority', e.target.value)}
              className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-slate-500"
            >
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 font-medium">Monitoring Source URL</label>
          <input
            type="url" value={form.monitorUrl} onChange={e => set('monitorUrl', e.target.value)}
            placeholder="Google News RSS, careers page, press release URL..."
            className="w-full bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-500"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors">
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition-colors"
          >
            Add Company
          </button>
        </div>
      </div>
    </Modal>
  )
}

function DetailPanel({ company, allTriggers, onClose, onViewBrief }) {
  if (!company) return null
  const companyTriggers = allTriggers.filter(t => t.companyId === company.id)

  return (
    <div
      className="fixed right-0 top-0 h-screen w-96 bg-slate-900 border-l border-slate-800 z-40 overflow-y-auto shadow-2xl"
      style={{ animation: 'fadeSlideIn 0.25s ease-out' }}
    >
      <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar name={company.name} size="md" />
          <div>
            <h3 className="text-sm font-semibold text-slate-100">{company.name}</h3>
            <p className="text-xs text-slate-500 font-mono">{company.industry}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors">
          <X size={15} />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Meta */}
        <div className="space-y-2">
          {[
            { icon: MapPin, label: company.hqLocation },
            { icon: Clock, label: company.timezoneOffset },
            { icon: Globe, label: company.website },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-xs text-slate-400">
              <Icon size={12} className="text-slate-500 flex-shrink-0" />
              <span className="font-mono truncate">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-1">
            <PriorityBadge priority={company.priority} />
            <span className={`flex items-center gap-1 text-xs font-mono ${company.isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
              {company.isActive ? <CheckCircle size={11} /> : <Circle size={11} />}
              {company.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Monitoring sources */}
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Monitoring Sources</h4>
          <div className="space-y-1.5">
            {company.monitoringUrls.map((s, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-2">
                <Link size={11} className="text-slate-500 flex-shrink-0" />
                <span className="text-xs text-slate-400 truncate flex-1">{s.type}</span>
                <span className="text-xs text-slate-600 font-mono">→</span>
              </div>
            ))}
          </div>
        </div>

        {/* Trigger timeline */}
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Zap size={11} className="text-emerald-400" />
            Trigger History
          </h4>
          {companyTriggers.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-4">No triggers detected yet</p>
          ) : (
            <div className="space-y-3">
              {companyTriggers.map((trigger, i) => (
                <div key={trigger.id} className="relative pl-5">
                  {/* Timeline line */}
                  {i < companyTriggers.length - 1 && (
                    <div className="absolute left-1.5 top-5 bottom-0 w-px bg-slate-700" />
                  )}
                  {/* Dot */}
                  <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-emerald-500/30 border border-emerald-500/60 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  </div>

                  <div className="bg-slate-800/60 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <EventTypeBadge type={trigger.eventType} />
                      <span className="text-xs text-slate-500 font-mono">{timeAgo(trigger.timestamp)}</span>
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-2 mb-2">{trigger.headline}</p>
                    <button
                      onClick={() => onViewBrief(trigger.id)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
                    >
                      View brief <ChevronRight size={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timing */}
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Best Outreach Windows</h4>
          <div className="relative">
            <div className="absolute inset-0 z-10 bg-slate-900/80 backdrop-blur-[1px] flex flex-col items-center justify-center rounded border border-slate-700/50 py-2">
              <p className="text-[10px] font-semibold text-slate-300">Timing Engine</p>
              <p className="text-[9px] text-slate-500">Coming in v2</p>
            </div>
            <div className="space-y-2 opacity-30 blur-[1px] pointer-events-none">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-500 w-12">Tuesday</span>
                <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `80%` }} />
                </div>
                <span className="text-xs font-mono text-slate-400">10:00</span>
                <span className="text-xs font-mono text-emerald-400 w-6 text-right">80</span>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => companyTriggers[0] && onViewBrief(companyTriggers[0].id)}
          disabled={companyTriggers.length === 0}
          className="w-full py-2.5 rounded-lg text-sm font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Generate Outreach Brief
        </button>
      </div>
    </div>
  )
}

export default function Companies() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [sortBy, setSortBy] = useState('priority')

  const { data: rawCompanies, loading: cLoading, error: cError } = useApiData(getCompanies)
  const { data: rawTriggers, loading: tLoading, error: tError } = useApiData(getTriggers)

  const { triggers, companies } = useMemo(() => {
    const cmap = buildCompaniesMap(rawCompanies || [])
    const t = (rawTriggers || []).map(rt => transformTrigger(rt, cmap))
    let c = (rawCompanies || []).map(transformCompany)
    c = enrichCompaniesWithTriggerCounts(c, t)
    return { triggers: t, companies: c }
  }, [rawTriggers, rawCompanies])

  const filtered = useMemo(() => {
    return companies
      .filter(c =>
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.industry.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name)
        if (sortBy === 'triggers') return b.activeTriggersCount - a.activeTriggersCount
        const po = { High: 0, Medium: 1, Low: 2 }
        return po[a.priority] - po[b.priority]
      })
  }, [search, sortBy, companies])

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
    <>
      <PageWrapper>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Account Intelligence Hub</h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{companies.length} monitored enterprise accounts</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
          >
            <Plus size={14} />
            Add Company
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search companies..." className="w-72" />
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="font-mono">Sort:</span>
            {['priority', 'triggers', 'name'].map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-2.5 py-1 rounded capitalize transition-colors ${
                  sortBy === s
                    ? 'bg-slate-700 text-slate-200'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-xl overflow-hidden">
          <table className="w-full" role="table" aria-label="Company accounts table">
            <thead>
              <tr className="border-b border-slate-700/60">
                {['Company', 'Industry', 'Priority', 'Last Signal', 'Active Triggers', 'Status'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3 font-mono">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(company => (
                <tr
                  key={company.id}
                  onClick={() => setSelected(company.id === selected?.id ? null : company)}
                  className={`border-b border-slate-700/30 cursor-pointer transition-colors last:border-0
                    ${selected?.id === company.id ? 'bg-emerald-500/5 border-l-2 border-l-emerald-500' : 'hover:bg-slate-700/30'}`}
                  aria-selected={selected?.id === company.id}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={company.name} size="sm" />
                      <div>
                        <p className="text-sm font-medium text-slate-200">{company.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{company.website}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 font-mono">{company.industry}</td>
                  <td className="px-4 py-3"><PriorityBadge priority={company.priority} /></td>
                  <td className="px-4 py-3 text-xs text-slate-400 font-mono">{timeAgo(company.lastSignalAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-bold font-mono ${company.activeTriggersCount > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {company.activeTriggersCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${company.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                      <span className={`text-xs font-mono ${company.isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {company.isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No companies found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PageWrapper>

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          company={selected}
          allTriggers={triggers}
          onClose={() => setSelected(null)}
          onViewBrief={(id) => navigate(`/outreach/${id}`)}
        />
      )}

      <AddCompanyModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  )
}
