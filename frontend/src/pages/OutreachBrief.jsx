import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Calendar, Globe, AlertTriangle, CheckCircle,
  Clock, Target, Send, Archive, Printer, ChevronRight,
  Briefcase, MessageSquare, Tag, Loader2, Mail, Link, Phone,
  Edit3, Save, X, ShieldCheck, RotateCcw
} from 'lucide-react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { EventTypeBadge, StatusBadge } from '../components/ui/Badge'
import { Avatar } from '../components/ui/Avatar'
import { ScoreRing } from '../components/ui/ScoreRing'
import { CopyButton } from '../components/ui/CopyButton'
import { Heatmap } from '../components/ui/Heatmap'

import { useApiData } from '../hooks/useApiData'
import {
  getTriggers, getCompanies, getOutreachByTrigger,
  updateOutreachBrief, submitForApproval
} from '../services/api'
import { transformTrigger, buildCompaniesMap } from '../services/transform'
import { useAuth } from '../context/AuthContext'

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

// Approval status badge
function ApprovalBadge({ status }) {
  const map = {
    'Draft':            'bg-slate-500/20 text-slate-300 border-slate-500/40',
    'Pending Approval': 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    'Approved':         'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    'Rejected':         'bg-red-500/20 text-red-300 border-red-500/40',
    'Sent':             'bg-violet-500/20 text-violet-300 border-violet-500/40',
  }
  const icons = {
    'Draft':            <Edit3 size={10} />,
    'Pending Approval': <Clock size={10} />,
    'Approved':         <ShieldCheck size={10} />,
    'Rejected':         <X size={10} />,
    'Sent':             <CheckCircle size={10} />,
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono border ${map[status] || map['Draft']}`}>
      {icons[status]} {status || 'Draft'}
    </span>
  )
}

export default function OutreachBrief() {
  const { triggerId } = useParams()
  const navigate = useNavigate()
  const { token, user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [outreachBrief, setOutreachBrief] = useState(null)
  const [activeTab, setActiveTab] = useState('email')

  // Editable fields
  const [editMode, setEditMode] = useState(false)
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editLinkedin, setEditLinkedin] = useState('')
  const [editWhatsapp, setEditWhatsapp] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [actionMsg, setActionMsg] = useState(null) // { type: 'success'|'error', text }

  const { data: rawCompanies, loading: cLoading } = useApiData(getCompanies)
  const { data: rawTriggers, loading: tLoading } = useApiData(getTriggers)

  useEffect(() => {
    async function fetchOutreach() {
      if (!triggerId) return
      try {
        const brief = await getOutreachByTrigger(token, triggerId)
        setOutreachBrief(brief)
        setEditSubject(brief.subject || '')
        setEditBody(brief.body || '')
        setEditLinkedin(brief.linkedin_draft || '')
        setEditWhatsapp(brief.whatsapp_draft || '')
      } catch (e) {
        console.error('Could not fetch outreach brief', e)
      }
    }
    fetchOutreach()
  }, [triggerId, token])

  const trigger = useMemo(() => {
    if (cLoading || tLoading) return null
    const cmap = buildCompaniesMap(rawCompanies || [])
    const rt = (rawTriggers || []).find(t => t.id === Number(triggerId))
    if (!rt) return null
    return transformTrigger(rt, cmap)
  }, [rawTriggers, rawCompanies, cLoading, tLoading, triggerId])

  // ── Actions ──────────────────────────────────────────────────────────────

  async function handleSaveEdits() {
    if (!outreachBrief) return
    setSaving(true)
    try {
      const updated = await updateOutreachBrief(token, outreachBrief.id, {
        subject: editSubject,
        body: editBody,
        linkedin_draft: editLinkedin,
        whatsapp_draft: editWhatsapp,
      })
      setOutreachBrief(updated)
      setEditMode(false)
      showMsg('success', 'Changes saved successfully.')
    } catch (e) {
      showMsg('error', 'Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmitForApproval() {
    if (!outreachBrief) return
    setSubmitting(true)
    try {
      const updated = await submitForApproval(token, outreachBrief.id)
      setOutreachBrief(updated)
      showMsg('success', 'Brief submitted for manager approval.')
    } catch (e) {
      showMsg('error', e.message || 'Could not submit for approval.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleCancelEdit() {
    // Restore original values
    setEditSubject(outreachBrief?.subject || '')
    setEditBody(outreachBrief?.body || '')
    setEditLinkedin(outreachBrief?.linkedin_draft || '')
    setEditWhatsapp(outreachBrief?.whatsapp_draft || '')
    setEditMode(false)
  }

  function showMsg(type, text) {
    setActionMsg({ type, text })
    setTimeout(() => setActionMsg(null), 4000)
  }

  const approvalStatus = outreachBrief?.approval_status || 'Draft'
  const canEdit = !isAdmin && ['Draft', 'Rejected'].includes(approvalStatus)
  const canSubmit = !isAdmin && ['Draft', 'Rejected'].includes(approvalStatus) && !editMode
  const isPending = approvalStatus === 'Pending Approval'

  // Current content to display (edit mode shows live edits, otherwise shows saved)
  const displaySubject   = editMode ? editSubject   : (outreachBrief?.subject        || 'Drafting...')
  const displayBody      = editMode ? editBody      : (outreachBrief?.body           || 'Drafting email...')
  const displayLinkedin  = editMode ? editLinkedin  : (outreachBrief?.linkedin_draft || 'Drafting...')
  const displayWhatsapp  = editMode ? editWhatsapp  : (outreachBrief?.whatsapp_draft || 'Drafting...')

  // ── Loading / not-found states ────────────────────────────────────────────

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

        {/* Action feedback toast */}
        {actionMsg && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 border ${
            actionMsg.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : 'bg-red-500/15 text-red-300 border-red-500/30'
          }`}>
            {actionMsg.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
            {actionMsg.text}
          </div>
        )}

        {/* Rejection notice */}
        {approvalStatus === 'Rejected' && outreachBrief?.rejected_reason && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm border bg-red-500/10 text-red-300 border-red-500/30">
            <p className="font-semibold flex items-center gap-2 mb-1"><X size={14} /> Brief was rejected by manager</p>
            <p className="text-xs text-red-400 font-mono">Reason: {outreachBrief.rejected_reason}</p>
            <p className="text-xs text-slate-400 mt-1">Please revise the content below and resubmit for approval.</p>
          </div>
        )}

        {/* Pending notice */}
        {isPending && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm border bg-amber-500/10 text-amber-300 border-amber-500/30 flex items-center gap-2">
            <Clock size={14} />
            This brief is awaiting manager approval. Editing is locked until reviewed.
          </div>
        )}

        {/* Approved notice */}
        {approvalStatus === 'Approved' && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm border bg-emerald-500/10 text-emerald-300 border-emerald-500/30 flex items-center gap-2">
            <ShieldCheck size={14} />
            This brief has been approved by a manager and is ready to send.
          </div>
        )}

        {/* Header block */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-6 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <Avatar name={trigger.companyName} size="xl" />
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <EventTypeBadge type={trigger.eventType} size="md" />
                  <StatusBadge status={trigger.status} size="md" />
                  <ApprovalBadge status={approvalStatus} />
                </div>
                <h1 className="text-xl font-bold text-slate-100 leading-tight mb-2 max-w-2xl">
                  {trigger.headline}
                </h1>
                <div className="flex items-center gap-4 text-xs text-slate-500 font-mono flex-wrap">
                  <span className="flex items-center gap-1"><Calendar size={11} />Detected {timeAgo(trigger.timestamp)}</span>
                  <span className="flex items-center gap-1"><Globe size={11} />Source: {trigger.source}</span>
                  <span className="flex items-center gap-1"><Tag size={11} />Assigned to {trigger.assignedTo}</span>
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
              <p className="text-sm text-slate-300 leading-relaxed mb-4 whitespace-pre-wrap">
                {trigger.articleContent || trigger.summary || 'No detailed context available.'}
              </p>
              {trigger.entities?.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 font-mono mb-2">DETECTED ENTITIES</p>
                  <div className="flex flex-wrap gap-1.5">
                    {trigger.entities.map(e => (
                      <span key={e} className="px-2 py-0.5 rounded text-xs font-mono bg-blue-500/10 text-blue-300 border border-blue-500/20">{e}</span>
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
                    <AlertTriangle size={10} className="text-amber-400" />PAIN POINTS IDENTIFIED
                  </p>
                  <ul className="space-y-1.5">
                    {trigger.painPoints.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                        <AlertTriangle size={11} className="text-amber-400 mt-0.5 flex-shrink-0" />{p}
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
                      <span key={s} className="px-2.5 py-1 rounded text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </Section>

            {/* Outreach Recommendations */}
            <Section title="Outreach Recommendations" icon={MessageSquare} accent="cyan">
              {/* Contact info */}
              <div className="mb-5">
                <p className="text-xs text-slate-500 font-mono mb-2">TARGET CONTACT</p>
                <div className="bg-slate-900/60 border border-slate-700/40 rounded-lg px-4 py-3 flex items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{outreachBrief?.contact_name || 'Loading...'}</p>
                    <p className="text-xs text-slate-400">{outreachBrief?.contact_role || '...'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">{outreachBrief?.contact_email || '...'}</p>
                    {outreachBrief?.contact_phone && (
                      <p className="text-xs text-slate-400 mt-0.5">{outreachBrief.contact_phone}</p>
                    )}
                    {outreachBrief?.contact_linkedin && (
                      <a href={outreachBrief.contact_linkedin} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline">LinkedIn Profile</a>
                    )}
                  </div>
                </div>

                {/* Edit/Save toolbar — only for sales reps on Draft/Rejected briefs */}
                {canEdit && (
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-slate-500 font-mono">AI-GENERATED CONTENT</p>
                    {!editMode ? (
                      <button
                        onClick={() => setEditMode(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 transition-colors"
                      >
                        <Edit3 size={11} /> Edit Draft
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCancelEdit}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 border border-slate-600/50 hover:bg-slate-700 transition-colors"
                        >
                          <X size={11} /> Cancel
                        </button>
                        <button
                          onClick={handleSaveEdits}
                          disabled={saving}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                        >
                          {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                          Save Changes
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Channel Tabs */}
                <div className="flex items-center gap-2 mb-4 border-b border-slate-700/50 pb-2">
                  {[
                    { key: 'email',    label: 'Email',    icon: Mail,  active: 'bg-emerald-500/20 text-emerald-400' },
                    { key: 'linkedin', label: 'LinkedIn', icon: Link,  active: 'bg-blue-500/20 text-blue-400' },
                    { key: 'whatsapp', label: 'WhatsApp', icon: Phone, active: 'bg-green-500/20 text-green-400' },
                  ].map(({ key, label, icon: Icon, active }) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        activeTab === key ? active : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <Icon size={14} />{label}
                    </button>
                  ))}
                </div>

                {/* Email tab */}
                {activeTab === 'email' && (
                  <div className="animate-in fade-in zoom-in-95 duration-200">
                    <p className="text-xs text-slate-500 font-mono mb-2">SUBJECT LINE</p>
                    {editMode ? (
                      <input
                        value={editSubject}
                        onChange={e => setEditSubject(e.target.value)}
                        className="w-full bg-slate-900/60 border border-blue-500/40 rounded-lg px-4 py-2.5 text-xs text-slate-200 font-mono mb-4 focus:outline-none focus:border-blue-400"
                      />
                    ) : (
                      <div className="bg-slate-900/60 border border-slate-700/40 rounded-lg px-4 py-3 mb-4">
                        <code className="text-xs text-slate-300 font-mono">{displaySubject}</code>
                      </div>
                    )}
                    <p className="text-xs text-slate-500 font-mono mb-2">EMAIL BODY</p>
                    <textarea
                      value={displayBody}
                      onChange={editMode ? e => setEditBody(e.target.value) : undefined}
                      readOnly={!editMode}
                      rows={8}
                      className={`w-full bg-slate-900/60 border rounded-lg px-4 py-3 text-sm text-slate-300 font-mono leading-relaxed resize-none focus:outline-none transition-colors ${
                        editMode
                          ? 'border-blue-500/40 focus:border-blue-400 cursor-text'
                          : 'border-slate-700/40 cursor-default'
                      }`}
                    />
                  </div>
                )}

                {/* LinkedIn tab */}
                {activeTab === 'linkedin' && (
                  <div className="animate-in fade-in zoom-in-95 duration-200">
                    <p className="text-xs text-slate-500 font-mono mb-2">LINKEDIN DRAFT</p>
                    <textarea
                      value={displayLinkedin}
                      onChange={editMode ? e => setEditLinkedin(e.target.value) : undefined}
                      readOnly={!editMode}
                      rows={7}
                      className={`w-full bg-slate-900/60 border rounded-lg px-4 py-3 text-sm text-slate-300 font-mono leading-relaxed resize-none focus:outline-none transition-colors ${
                        editMode
                          ? 'border-blue-500/40 focus:border-blue-400'
                          : 'border-blue-500/40'
                      }`}
                    />
                    <p className="text-[10px] text-slate-500 font-mono mt-1">⚠️ Copy and paste manually to avoid LinkedIn restrictions.</p>
                  </div>
                )}

                {/* WhatsApp tab */}
                {activeTab === 'whatsapp' && (
                  <div className="animate-in fade-in zoom-in-95 duration-200">
                    <p className="text-xs text-slate-500 font-mono mb-2">WHATSAPP DRAFT</p>
                    <textarea
                      value={displayWhatsapp}
                      onChange={editMode ? e => setEditWhatsapp(e.target.value) : undefined}
                      readOnly={!editMode}
                      rows={6}
                      className={`w-full bg-slate-900/60 border rounded-lg px-4 py-3 text-sm text-slate-300 font-mono leading-relaxed resize-none focus:outline-none transition-colors ${
                        editMode
                          ? 'border-green-500/40 focus:border-green-400'
                          : 'border-green-500/40'
                      }`}
                    />
                    {outreachBrief?.contact_phone
                      ? <p className="text-[10px] text-green-400 font-mono mt-1 flex items-center gap-1"><CheckCircle size={10} /> Phone detected. Ready to send.</p>
                      : <p className="text-[10px] text-amber-400 font-mono mt-1 flex items-center gap-1"><AlertTriangle size={10} /> No phone number available.</p>
                    }
                  </div>
                )}
              </div>

              {/* Follow-up timeline */}
              <div>
                <p className="text-xs text-slate-500 font-mono mb-2">FOLLOW-UP TIMELINE</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-500 w-12 flex-shrink-0">Day 1</span>
                    <div className="flex-1 h-px bg-slate-700" />
                    <span className="text-xs text-slate-400 flex-1">Send personalized outreach email</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-500 w-12 flex-shrink-0">Day 4</span>
                    <div className="flex-1 h-px bg-slate-700" />
                    <span className="text-xs text-slate-400 flex-1">LinkedIn connection request</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-500 w-12 flex-shrink-0">Day 7</span>
                    <div className="flex-1 h-px bg-slate-700" />
                    <span className="text-xs text-slate-400 flex-1">Follow-up with case study</span>
                  </div>
                </div>
              </div>
            </Section>
          </div>

          {/* Right: 1/3 */}
          <div className="space-y-5">
            {/* Score */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 text-center">
              <ScoreRing score={trigger.opportunityScore} size={96} />
              <p className="text-sm font-semibold text-slate-200 mt-3">Opportunity Score</p>
              <p className="text-xs text-slate-500 mt-1">
                {trigger.opportunityScore >= 80 ? 'High priority — act now' :
                 trigger.opportunityScore >= 60 ? 'Medium priority' : 'Monitor for now'}
              </p>
            </div>

            {/* Approval status card */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Approval Status</h4>
              <div className="flex items-center justify-between mb-3">
                <ApprovalBadge status={approvalStatus} />
              </div>
              <div className="space-y-1.5 text-xs font-mono text-slate-500">
                {['Draft', 'Pending Approval', 'Approved', 'Sent'].map((step, i) => {
                  const steps = ['Draft', 'Pending Approval', 'Approved', 'Sent']
                  const currentIdx = steps.indexOf(approvalStatus === 'Rejected' ? 'Draft' : approvalStatus)
                  const isDone = i < currentIdx
                  const isCurrent = i === currentIdx
                  return (
                    <div key={step} className={`flex items-center gap-2 ${isCurrent ? 'text-emerald-400' : isDone ? 'text-slate-400' : 'text-slate-600'}`}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isCurrent ? 'bg-emerald-400' : isDone ? 'bg-slate-500' : 'bg-slate-700'}`} />
                      {step}
                      {isCurrent && ' ←'}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Outreach Readiness Score card */}
            {outreachBrief && (
              <div className={`rounded-xl border p-4 ${
                outreachBrief.passed_threshold
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Outreach Readiness Score
                  </h4>
                  <span className={`text-lg font-bold font-mono ${
                    outreachBrief.passed_threshold ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {outreachBrief.outreach_score != null ? `${outreachBrief.outreach_score}/100` : '—'}
                  </span>
                </div>

                {/* Green / Red status pill */}
                <div className={`flex items-center gap-2 mb-3 px-3 py-1.5 rounded-lg text-xs font-semibold w-fit ${
                  outreachBrief.passed_threshold
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-red-500/20 text-red-300 border border-red-500/40'
                }`}>
                  {outreachBrief.passed_threshold
                    ? <><CheckCircle size={11} /> GREEN — Outreach Eligible</>
                    : <><AlertTriangle size={11} /> RED — Below Threshold (60)</>
                  }
                </div>

                {/* Score breakdown bars */}
                {outreachBrief.score_breakdown && (
                  <div className="space-y-2">
                    {[
                      { label: 'Trigger Confidence', key: 'confidence', weight: '40%' },
                      { label: 'Company Priority',   key: 'priority',   weight: '20%' },
                      { label: 'Signal Recency',      key: 'recency',    weight: '20%' },
                      { label: 'Data Completeness',   key: 'completeness', weight: '20%' },
                    ].map(({ label, key, weight }) => {
                      const val = outreachBrief.score_breakdown[key] ?? 0
                      return (
                        <div key={key}>
                          <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-0.5">
                            <span>{label} <span className="text-slate-600">({weight})</span></span>
                            <span>{val}/100</span>
                          </div>
                          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                val >= 75 ? 'bg-emerald-500' :
                                val >= 50 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${val}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {!outreachBrief.passed_threshold && (
                  <p className="text-[10px] text-red-400 font-mono mt-3">
                    ⚠ Approval blocked until score ≥ 60. Improve contact data or wait for a fresher signal.
                  </p>
                )}
              </div>
            )}

            {/* Timing intelligence */}
            <Section title="Timing Intelligence" icon={Clock} accent="amber">
              <div className="space-y-3 mb-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-400 font-mono mb-0.5">BEST WINDOW</p>
                  <p className="text-sm font-semibold text-emerald-300">9:30 AM Local Time</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-400 font-mono mb-0.5">AVOID</p>
                  <p className="text-xs text-red-300">Weekends, Late Nights</p>
                </div>
              </div>
              <Heatmap weekGrid={trigger.weekGrid || []} size="sm" />
            </Section>

            {/* Signal details */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Signal Details</h4>
              {[
                { label: 'Company',  value: trigger.companyName },
                { label: 'Event',    value: trigger.eventType },
                { label: 'Industry', value: trigger.industry },
                { label: 'Source',   value: trigger.source },
                { label: 'Status',   value: trigger.status },
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
          {outreachBrief?.edited_by && <span className="ml-2 text-blue-400">· Human Reviewed</span>}
        </p>
        <div className="flex items-center gap-2">
          <CopyButton text={displayBody} label="Copy Brief" />
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700/60 text-slate-300 border border-slate-600/50 hover:bg-slate-600/60 transition-colors"
          >
            <Printer size={12} />
            Export PDF
          </button>

          {/* Submit for Approval — sales rep only, Draft/Rejected status */}
          {canSubmit && (
            <button
              onClick={handleSubmitForApproval}
              disabled={submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Submit for Approval
            </button>
          )}

          {/* Pending label */}
          {isPending && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <Clock size={12} /> Awaiting Approval
            </span>
          )}

          {/* Approved — ready to send */}
          {approvalStatus === 'Approved' && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <ShieldCheck size={12} /> Approved — Ready to Send
            </span>
          )}

          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700/60 text-slate-400 border border-slate-600/50 hover:bg-slate-600/60 transition-colors">
            <Archive size={12} />
            Archive
          </button>
        </div>
      </div>
    </div>
  )
}
