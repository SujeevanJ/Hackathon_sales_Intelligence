import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Send, Users, Building2, ChevronRight, BarChart3, Mail } from 'lucide-react'
import { getOutreaches, getOutreachStats } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Avatar } from '../components/ui/Avatar'

function StatCard({ title, value, icon: Icon, color = 'emerald' }) {
  const colorMap = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  }
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg border ${colorMap[color]}`}>
          <Icon size={18} />
        </div>
        <h3 className="text-sm font-medium text-slate-400">{title}</h3>
      </div>
      <p className="text-2xl font-bold text-slate-100">{value}</p>
    </div>
  )
}

export default function Outreaches() {
  const [outreaches, setOutreaches] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const { token } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchData() {
      try {
        const [outreachData, statsData] = await Promise.all([
          getOutreaches(token),
          getOutreachStats(token)
        ])
        setOutreaches(outreachData)
        setStats(statsData)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [token])

  if (loading) {
    return (
      <PageWrapper className="flex items-center justify-center">
        <div className="text-slate-400">Loading Outreach Data...</div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Outreach Operations</h1>
          <p className="text-sm text-slate-400 mt-1">Monitor automated AI-generated email campaigns.</p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <StatCard title="Total Outreaches Sent" value={stats?.total_outreaches || 0} icon={Send} color="emerald" />
        <StatCard title="Unique Target Roles" value={stats?.by_persona?.length || 0} icon={Users} color="purple" />
        <StatCard title="Companies Targeted" value={stats?.by_company?.length || 0} icon={Building2} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Outreach List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Mail size={18} className="text-emerald-400" />
            Recent Outreaches
          </h2>
          {outreaches.length === 0 ? (
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-8 text-center text-slate-400">
              No outreaches found. Let the system run to generate campaigns!
            </div>
          ) : (
            outreaches.map((outreach) => (
              <div 
                key={outreach.id} 
                className="bg-slate-800/60 border border-slate-700/50 hover:border-emerald-500/50 transition-colors rounded-xl p-5 cursor-pointer flex items-center justify-between"
                onClick={() => navigate(`/outreach/${outreach.trigger_id}`)}
              >
                <div className="flex items-center gap-4">
                  <Avatar name={outreach.contact_name || "Contact"} size="lg" />
                  <div>
                    <h3 className="text-base font-semibold text-slate-200">
                      {outreach.contact_name || "Unknown Contact"} <span className="text-slate-500 text-sm font-normal">({outreach.persona})</span>
                    </h3>
                    <p className="text-sm text-slate-400 mt-1 truncate max-w-md">
                      Subject: {outreach.subject}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 font-mono">
                      Sent to: {outreach.contact_email || "N/A"}
                    </p>
                  </div>
                </div>
                <div className="text-slate-500">
                  <ChevronRight size={20} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Col: Analytics Breakdown */}
        <div className="space-y-6">
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
             <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
               <BarChart3 size={16} className="text-emerald-400" />
               Target Personas Breakdown
             </h2>
             <div className="space-y-3">
               {stats?.by_persona?.map((p, idx) => (
                 <div key={idx} className="flex items-center justify-between">
                   <span className="text-sm text-slate-400">{p.name}</span>
                   <span className="text-sm font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">{p.value}</span>
                 </div>
               ))}
             </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-5">
             <h2 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
               <Building2 size={16} className="text-emerald-400" />
               Top Targeted Companies
             </h2>
             <div className="space-y-3">
               {stats?.by_company?.slice(0,5).map((c, idx) => (
                 <div key={idx} className="flex items-center justify-between">
                   <span className="text-sm text-slate-400 truncate max-w-[150px]">{c.name}</span>
                   <span className="text-sm font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">{c.value}</span>
                 </div>
               ))}
             </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
