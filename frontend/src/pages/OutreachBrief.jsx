import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Calendar, Globe, AlertTriangle, CheckCircle,
  Clock, Target, Send, Archive, Printer, ChevronRight,
  Briefcase, MessageSquare, Tag, Loader2
} from 'lucide-react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { EventTypeBadge, StatusBadge } from '../components/ui/Badge'
import { Avatar } from '../components/ui/Avatar'
import { ScoreRing } from '../components/ui/ScoreRing'
import { CopyButton } from '../components/ui/CopyButton'
import { Heatmap } from '../components/ui/Heatmap'

import { useApiData } from '../hooks/useApiData'
import { getTriggers, getCompanies } from '../services/api'
import { transformTrigger, buildCompaniesMap } from '../services/transform'

function timeAgo(ts) {
  if (!ts) return 'Unknown'
  const diff = Date.now() - new Date(ts).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function Section({ title, icon: Icon, children, accent = 'emerald' }) {
  const accentMap = {
    emerald: 'border-emerald-500/40 bg-emerald-500/5',
    blue: 'border-blue-500/40 bg-blue-500/5',
    amber: 'border-amber-500/40 bg-amber-500/5',
    cyan: 'border-cyan-500/40 bg-cyan-500/5',
  }
  return (
    <div className={`bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 border-l-2 ${accentMap[accent]}`}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-4">
        {Icon && <Icon size={15} className={`text-${accent}-400`} />}
        {title}
      </h3>
      {children}
    </div>
  )
}

export default function OutreachBrief() {
  const { triggerId } = useParams()
  const navigate = useNavigate()
  const [narrative, setNarrative] = useState('')
  const [markedSent, setMarkedSent] = useState(false)

  const { data: rawCompanies, loading: cLoading } = useApiData(getCompanies)
  const { data: rawTriggers, loading: tLoading } = useApiData(getTriggers)

  const trigger = useMemo(() => {
    if (cLoading || tLoading) return null
    const cmap = buildCompaniesMap(rawCompanies || [])
    const rt = (rawTriggers || []).find(t => t.id === Number(triggerId))
    if (!rt) return null
    return transformTrigger(rt, cmap)
  }, [rawTriggers, rawCompanies, cLoading, tLoading, triggerId])

  useEffect(() => {
    if (trigger && !narrative) {
      setNarrative(trigger.outreachNarrative)
    }
  }, [trigger])

  if (cLoading || tLoading) {
    return (
      <PageWrapper className="flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-500 w-8 h-8" />
      </PageWrapper>
    )
  }

  if (!trigger) {
    return (
      <PageWrapper>
        <div className="text-center py-20">
          <p className="text-slate-400 mb-4">Trigger event not found.</p>
          <button onClick={() => navigate('/triggers')} className="text-emerald-400 hover:text-emerald-300 text-sm">
            ← Back to Triggers
          </button>
        </div>
      </PageWrapper>
    )
  }

  return (
    <div className="pb-24">
      <PageWrapper>
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-6"
        >
          <ArrowLeft size={14} />
          Back
        </button>

        {/* Header block */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <Avatar name={trigger.companyName} size="xl" />
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <EventTypeBadge type={trigger.eventType} size="md" />
                  <StatusBadge status={trigger.status} size="md" />
                </div>
                <h1 className="text-xl font-bold text-slate-100 leading-tight mb-2 max-w-2xl">
                  {trigger.headline}
                </h1>
                <div className="flex items-center gap-4 text-xs text-slate-500 font-mono flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar size={11} />
                    Detected {timeAgo(trigger.timestamp)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Globe size={11} />
                    Source: {trigger.source}
                  </span>
                  <span className="flex items-center gap-1">
                    <Tag size={11} />
                    Assigned to {trigger.assignedTo}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 text-center">
              <ScoreRing score={trigger.opportunityScore} size={80} />
              <p className="text-xs text-slate-500 mt-1 font-mono">Opp. Score</p>
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">
          {/* Left: 2/3 */}
          <div className="xl:col-span-2 space-y-5">
            {/* Business context */}
            <Section title="Business Context" icon={Briefcase} accent="blue">
              <p className="text-sm text-slate-300 leading-relaxed mb-4 whitespace-pre-wrap">{trigger.articleContent || trigger.summary || 'No detailed context available.'}</p>
              {/* Entities */}
              {trigger.entities?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 font-mono mb-2">DETECTED ENTITIES</p>
                  <div className="flex flex-wrap gap-1.5">
                    {trigger.entities.map(e => (
                      <span key={e} className="px-2 py-0.5 rounded text-xs font-mono bg-blue-500/10 text-blue-300 border border-blue-500/20">
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Section>

            {/* Opportunity analysis */}
            <Section title="Opportunity Analysis" icon={Target} accent="emerald">
              <p className="text-sm text-slate-300 leading-relaxed mb-4">{trigger.businessImpact || 'Impact analysis pending.'}</p>

              {trigger.painPoints?.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-slate-500 font-mono mb-2 flex items-center gap-1">
                    <AlertTriangle size={10} className="text-amber-400" />
                    PAIN POINTS IDENTIFIED
                  </p>
                  <ul className="space-y-1.5">
                    {trigger.painPoints.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                        <AlertTriangle size={11} className="text-amber-400 mt-0.5 flex-shrink-0" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {trigger.relantoServices?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 font-mono mb-2">RELANTO CAPABILITY MATCH</p>
                  <div className="flex flex-wrap gap-1.5">
                    {trigger.relantoServices.map(s => (
                      <span key={s} className="px-2.5 py-1 rounded text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Section>

            {/* Outreach recommendations */}
            <Section title="Outreach Recommendations" icon={MessageSquare} accent="cyan">
              <div className="relative">
                {/* Coming Soon Overlay */}
                <div className="absolute inset-0 z-10 bg-slate-900/80 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-lg border border-slate-700/50">
                  <MessageSquare size={24} className="text-cyan-500/50 mb-3" />
                  <p className="text-sm font-semibold text-slate-200">Outreach Engine</p>
                  <p className="text-xs text-slate-400 mt-1">Backend service not yet connected (Coming in v2)</p>
                </div>
                
                <div className="opacity-30 pointer-events-none blur-[1px]">
                  {/* Subject lines */}
                  <div className="mb-5">
                    <p className="text-xs text-slate-500 font-mono mb-2">SUGGESTED SUBJECT LINES</p>
                    <div className="space-y-2">
                      <div className="bg-slate-900/60 border border-slate-700/40 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
                        <code className="text-xs text-slate-300 flex-1 font-mono leading-relaxed">Relevant to your recent event — Relanto's perspective</code>
                      </div>
                    </div>
                  </div>

                  {/* Narrative */}
                  <div className="mb-5">
                    <p className="text-xs text-slate-500 font-mono mb-2">OUTREACH NARRATIVE</p>
                    <textarea
                      value="Drafting email..."
                      readOnly
                      rows={4}
                      className="w-full bg-slate-900/60 border border-slate-700/40 rounded-lg px-4 py-3 text-sm text-slate-300 font-mono leading-relaxed resize-none"
                    />
                  </div>

                  {/* Follow-up */}
                  <div>
                    <p className="text-xs text-slate-500 font-mono mb-2">FOLLOW-UP TIMELINE</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-500 w-12 flex-shrink-0">Day 1</span>
                        <div className="flex-1 h-px bg-slate-700" />
                        <span className="text-xs text-slate-400 flex-1">Send personalized outreach email</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Section>
          </div>

          {/* Right: 1/3 */}
          <div className="space-y-5">
            {/* Score detail */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 text-center">
              <ScoreRing score={trigger.opportunityScore} size={96} />
              <p className="text-sm font-semibold text-slate-200 mt-3">Opportunity Score</p>
              <p className="text-xs text-slate-500 mt-1">
                {trigger.opportunityScore >= 80 ? 'High priority — act now' :
                 trigger.opportunityScore >= 60 ? 'Medium priority' : 'Monitor for now'}
              </p>
            </div>

            {/* Timing intelligence */}
            <Section title="Timing Intelligence" icon={Clock} accent="amber">
              <div className="relative">
                <div className="absolute inset-0 z-10 bg-slate-900/80 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-lg border border-slate-700/50 p-4 text-center">
                  <Clock size={24} className="text-amber-500/50 mb-3" />
                  <p className="text-sm font-semibold text-slate-200">Timing Engine</p>
                  <p className="text-xs text-slate-400 mt-1">Backend service not yet connected (Coming in v2)</p>
                </div>
                
                <div className="opacity-30 pointer-events-none blur-[1px]">
                  <div className="space-y-3 mb-4">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                      <p className="text-xs text-slate-400 font-mono mb-0.5">BEST WINDOW</p>
                      <p className="text-sm font-semibold text-emerald-300">TBD</p>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      <p className="text-xs text-slate-400 font-mono mb-0.5">AVOID</p>
                      <p className="text-xs text-red-300">TBD</p>
                    </div>
                  </div>

                  <Heatmap weekGrid={trigger.weekGrid || []} size="sm" />
                </div>
              </div>
            </Section>

            {/* Quick facts */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Signal Details</h4>
              {[
                { label: 'Company', value: trigger.companyName },
                { label: 'Event', value: trigger.eventType },
                { label: 'Industry', value: trigger.industry },
                { label: 'Source', value: trigger.source },
                { label: 'Status', value: trigger.status },
                { label: 'Assigned', value: trigger.assignedTo },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-slate-700/30 last:border-0">
                  <span className="text-xs text-slate-500 font-mono">{label}</span>
                  <span className="text-xs text-slate-300 font-mono">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PageWrapper>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-56 right-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 px-6 py-3 flex items-center justify-between z-30">
        <p className="text-xs text-slate-500 font-mono">
          Outreach brief for <span className="text-slate-300">{trigger.companyName}</span> · {trigger.eventType}
        </p>
        <div className="flex items-center gap-2">
          <CopyButton text={narrative} label="Copy Brief" />
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700/60 text-slate-300 border border-slate-600/50 hover:bg-slate-600/60 transition-colors"
          >
            <Printer size={12} />
            Export PDF
          </button>
          <button
            onClick={() => setMarkedSent(!markedSent)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              markedSent
                ? 'bg-violet-500/20 text-violet-400 border-violet-500/40'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
            }`}
          >
            {markedSent ? <CheckCircle size={12} /> : <Send size={12} />}
            {markedSent ? 'Sent ✓' : 'Mark as Sent'}
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700/60 text-slate-400 border border-slate-600/50 hover:bg-slate-600/60 transition-colors">
            <Archive size={12} />
            Archive
          </button>
        </div>
      </div>
    </div>
  )
}
