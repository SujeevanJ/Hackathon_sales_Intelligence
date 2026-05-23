import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, RefreshCw, Play, Loader2, X, AlertTriangle, Zap, CheckCircle } from 'lucide-react'
import { SearchInput } from '../ui/SearchInput'
import { useState, useRef, useEffect, useMemo } from 'react'
import { runScraper, getTriggers, getCompanies } from '../../services/api'
import { useApiData } from '../../hooks/useApiData'
import { transformTrigger, buildCompaniesMap } from '../../services/transform'

const PAGE_TITLES = {
  '/dashboard': 'Intelligence Feed',
  '/companies': 'Account Intelligence',
  '/triggers':  'Trigger Explorer',
  '/outreach':  'Outreach Brief',
  '/analytics': 'Analytics',
}

function timeAgo(ts) {
  if (!ts) return 'Just now'
  const diff = Date.now() - new Date(ts).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return `${Math.floor(diff / 60000)}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function Header({ onSearch, searchValue }) {
  const location = useLocation()
  const navigate = useNavigate()
  const title = Object.entries(PAGE_TITLES).find(([k]) => location.pathname.startsWith(k))?.[1] || 'Sales Intelligence'
  
  const [scraping, setScraping] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const notifRef = useRef(null)

  // Fetch live triggers for notifications
  const { data: rawCompanies } = useApiData(getCompanies)
  const { data: rawTriggers, refetch } = useApiData(getTriggers)

  const triggers = useMemo(() => {
    const cmap = buildCompaniesMap(rawCompanies || [])
    return (rawTriggers || []).map(rt => transformTrigger(rt, cmap))
  }, [rawTriggers, rawCompanies])

  // Notifications = Newest triggers (e.g. status New or just top 5 recent)
  const notifications = useMemo(() => {
    return [...triggers]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5)
  }, [triggers])

  const notifCount = triggers.filter(t => t.status === 'New').length || notifications.length

  // Click outside to close notifications
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false)
      }
    }
    if (showNotifications) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showNotifications])

  const handleRunScraper = async () => {
    setScraping(true)
    try {
      await runScraper()
      await refetch() // Refresh data after scraping
      setShowNotifications(true) // Open notifs to show new signals
    } catch (e) {
      console.error('Failed to run scraper', e)
    } finally {
      setScraping(false)
    }
  }

  const handleNotificationClick = (triggerId) => {
    setShowNotifications(false)
    navigate(`/outreach/${triggerId}`)
  }

  return (
    <header className="h-14 bg-slate-900/90 backdrop-blur border-b border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30">
      {/* Page title */}
      <div>
        <h1 className="text-sm font-semibold text-slate-100">{title}</h1>
        <p className="text-xs text-slate-500 font-mono">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {onSearch && (
          <SearchInput
            value={searchValue}
            onChange={onSearch}
            placeholder="Search triggers, companies..."
            className="w-64 hidden md:block"
          />
        )}

        {/* Run Scraper Button */}
        <button
          onClick={handleRunScraper}
          disabled={scraping}
          aria-label="Run live scraper"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
        >
          {scraping ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          {scraping ? 'Scraping...' : 'Run Scraper'}
        </button>

        <button
          onClick={() => { refetch(); window.location.reload() }}
          aria-label="Refresh data"
          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          title="Refresh intelligence feed"
        >
          <RefreshCw size={15} />
        </button>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label={`${notifCount} notifications`}
            className={`p-2 rounded-lg transition-colors ${
              showNotifications ? 'bg-slate-800 text-slate-200' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Bell size={15} />
            {notifCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full border border-slate-900" />
            )}
          </button>

          {/* Notification Panel */}
          {showNotifications && (
            <div 
              className="absolute right-0 top-full mt-2 w-80 bg-slate-800 border border-slate-700/60 rounded-xl shadow-2xl overflow-hidden z-50"
              style={{ animation: 'fadeSlideIn 0.2s ease-out' }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60 bg-slate-800/80">
                <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Zap size={12} className="text-emerald-400" />
                  Recent Signals
                </h3>
                <span className="text-xs font-mono text-emerald-400">{notifCount} New</span>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-slate-500 text-sm">
                    No recent signals detected.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700/40">
                    {notifications.map((notif, i) => (
                      <div 
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif.id)}
                        className="px-4 py-3 hover:bg-slate-700/30 cursor-pointer transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold text-slate-200 group-hover:text-emerald-400 transition-colors truncate">
                            {notif.companyName}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">
                            {timeAgo(notif.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          <span className="font-medium text-slate-300">{notif.eventType}:</span> {notif.headline}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="px-4 py-2 border-t border-slate-700/60 bg-slate-800/80 text-center">
                <button 
                  onClick={() => { setShowNotifications(false); navigate('/triggers') }}
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                >
                  View all triggers
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700/50">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-mono text-slate-400">LIVE</span>
        </div>
      </div>
    </header>
  )
}
