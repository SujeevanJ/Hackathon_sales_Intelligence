import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, X, Clock, CheckCircle, AlertTriangle,
  Loader2, Building2, User, Mail, ChevronRight, Eye
} from 'lucide-react'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Avatar } from '../components/ui/Avatar'
import { useAuth } from '../context/AuthContext'
import {
  getPendingApprovals, approveOutreachBrief,
  rejectOutreachBrief, getCompanies, getTriggers
} from '../services/api'
import { buildCompaniesMap, transformTrigger } from '../services/transform'

function timeAgo(ts) {
  if (!ts) return 'Unknown'
  const diff = Date.now() - new Date(ts).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function ReviewQueue() {
  const navigate = useNavigate()
  const { token, user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [briefs, setBriefs] = useState([])
  const [companies, setCompanies] = useState({})
  const [triggers, setTriggers] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState({}) // { [briefId]: true/false }

  // Reject modal state
  const [rejectModal, setRejectModal] = useState(null) // { briefId, companyName }
  const [rejectReason, setRejectReason] = useState('')

  // Toast
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!isAdmin) return
    loadAll()
  }, [token, isAdmin])

  async function loadAll() {
    setLoading(true)
    try {
      const [pendingRes, companiesRes, triggersRes] = await Promise.all([
        getPendingApprovals(token),
        getCompanies(token),
        getTriggers(token),
      ])
      setBriefs(pendingRes || [])
      setCompanies(buildCompaniesMap(companiesRes || []))
      setTriggers(triggersRes || [])
    } catch (e) {
      showToast('error', 'Failed to load pending approvals.')
    } finally {
      setLoading(false)
    }
  }

  function getTriggerForBrief(brief) {
    const raw = triggers.find(t => t.id === brief.trigger_id)
    if (!raw) return null
    return transformTrigger(raw, companies)
  }

  async function handleApprove(brief) {
    setActionLoading(prev => ({ ...prev, [brief.id]: true }))
    try {
      await approveOutreachBrief(token, brief.id)
      setBriefs(prev => prev.filter(b => b.id !== brief.id))
      showToast('success', `Approved outreach for ${companies[brief.company_id]?.name || 'company'}.`)
    } catch (e) {
      showToast('error', e.message || 'Approval failed.')
    } finally {
      setActionLoading(prev => ({ ...prev, [brief.id]: false }))
    }
  }

  function openRejectModal(brief) {
    setRejectReason('')
    setRejectModal({ briefId: brief.id, companyName: companies[brief.company_id]?.name || 'Company' })
  }

  async function handleReject() {
    if (!rejectReason.trim()) return
    const { briefId, companyName } = rejectModal
    setActionLoading(prev => ({ ...prev, [briefId]: true }))
    try {
      await rejectOutreachBrief(token, briefId, rejectReason.trim())
      setBriefs(prev => prev.filter(b => b.id !== briefId))
      setRejectModal(null)
      showToast('success', `Rejected brief for ${companyName}. Sales rep will be notified.`)
    } catch (e) {
      showToast('error', e.message || 'Rejection failed.')
    } finally {
      setActionLoading(prev => ({ ...prev, [briefId]: false }))
    }
  }

  function showToast(type, text) {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4500)
  }

  // ── Access guard ──────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <ShieldCheck size={40} className="text-slate-600 mb-4" />
          <p className="text-slate-300 font-semibold mb-1">Access Restricted</p>
          <p className="text-sm text-slate-500">This page is only accessible to managers and admins.</p>
        </div>
      </PageWrapper>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageWrapper>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck size={20} className="text-amber-400" />
            Outreach Approval Queue
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Review AI-generated outreach briefs before they are sent to prospects.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-lg text-xs font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
            {briefs.length} pending
          </span>
          <button
            onClick={loadAll}
            className="px-3 py-1.5 rounded-lg text-xs text-slate-400 border border-slate-700 hover:bg-slate-800 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mb-5 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 border ${
          toast.type === 'success'
            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            : 'bg-red-500/15 text-red-300 border-red-500/30'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          {toast.text}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-emerald-500 w-7 h-7" />
        </div>
      )}

      {/* Empty state */}
      {!loading && briefs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <CheckCircle size={40} className="text-emerald-500 mb-4" />
          <p className="text-slate-300 font-semibold mb-1">All caught up!</p>
          <p className="text-sm text-slate-500">No outreach briefs are pending approval right now.</p>
        </div>
      )}

      {/* Brief cards */}
      {!loading && briefs.length > 0 && (
        <div className="space-y-4">
          {briefs.map(brief => {
            const trigger = getTriggerForBrief(brief)
            const company = companies[brief.company_id]
            const isActing = actionLoading[brief.id]

            return (
              <div
                key={brief.id}
                className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5 hover:border-slate-600/70 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: company + brief info */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <Avatar name={company?.name || 'C'} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold text-slate-100">{company?.name || `Company #${brief.company_id}`}</span>
                        {trigger && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/15 text-blue-300 border border-blue-500/20">
                            {trigger.eventType}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                          <Clock size={9} /> Pending Approval
                        </span>
                      </div>

                      {/* Subject */}
                      <p className="text-xs text-slate-300 font-mono mb-2 truncate">
                        <span className="text-slate-500">Subject: </span>{brief.subject}
                      </p>

                      {/* Meta row */}
                      <div className="flex items-center gap-4 text-xs text-slate-500 font-mono flex-wrap">
                        {brief.contact_name && (
                          <span className="flex items-center gap-1">
                            <User size={10} /> {brief.contact_name} · {brief.contact_role}
                          </span>
                        )}
                        {brief.contact_email && (
                          <span className="flex items-center gap-1">
                            <Mail size={10} /> {brief.contact_email}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock size={10} /> Submitted {timeAgo(brief.created_at)}
                        </span>
                        {brief.edited_by && (
                          <span className="text-blue-400 flex items-center gap-1">
                            ✎ Human edited
                          </span>
                        )}
                      </div>

                      {/* Email body preview */}
                      <div className="mt-3 bg-slate-900/50 border border-slate-700/40 rounded-lg px-3 py-2.5">
                        <p className="text-xs text-slate-500 font-mono mb-1">EMAIL PREVIEW</p>
                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                          {brief.body}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Right: action buttons */}
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => navigate(`/outreach/${brief.trigger_id}`)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-700/60 text-slate-300 border border-slate-600/50 hover:bg-slate-600/60 transition-colors"
                    >
                      <Eye size={12} /> View Full
                    </button>
                    <button
                      onClick={() => handleApprove(brief)}
                      disabled={isActing}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                    >
                      {isActing ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                      Approve
                    </button>
                    <button
                      onClick={() => openRejectModal(brief)}
                      disabled={isActing}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors disabled:opacity-50"
                    >
                      <X size={12} /> Reject
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100 mb-1 flex items-center gap-2">
              <X size={15} className="text-red-400" />
              Reject Brief — {rejectModal.companyName}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              The sales rep will be notified and can revise the brief before resubmitting.
            </p>
            <label className="block text-xs text-slate-400 font-mono mb-2">REASON FOR REJECTION *</label>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={4}
              placeholder="e.g. Tone is too pushy, wrong contact person, subject line needs work..."
              className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 font-mono resize-none focus:outline-none focus:border-red-400 mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 rounded-lg text-xs text-slate-400 border border-slate-600 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || actionLoading[rejectModal.briefId]}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 transition-colors disabled:opacity-40"
              >
                {actionLoading[rejectModal.briefId]
                  ? <Loader2 size={11} className="animate-spin" />
                  : <X size={11} />}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  )
}
