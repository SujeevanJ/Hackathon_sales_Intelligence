import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  Zap,
  FileText,
  BarChart3,
  Radar,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  { label: 'Dashboard',    path: '/dashboard',  icon: LayoutDashboard },
  { label: 'Companies',    path: '/companies',  icon: Building2 },
  { label: 'Triggers',     path: '/triggers',   icon: Zap },
  { label: 'Outreach',     path: '/outreach',   icon: FileText },
  { label: 'Analytics',    path: '/analytics',  icon: BarChart3 },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const { user, logout } = useAuth()

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 z-40
        ${collapsed ? 'w-16' : 'w-56'}`}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className={`flex items-center h-14 border-b border-slate-800 px-4 flex-shrink-0 ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
          <Radar size={15} className="text-white" />
        </div>
        {!collapsed && (
          <span className="text-sm font-bold text-slate-100 whitespace-nowrap">
            Relanto <span className="text-emerald-400">Intel</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto" aria-label="Navigation links">
        <ul className="space-y-0.5 px-2">
          {NAV_ITEMS.map(({ label, path, icon: Icon }) => {
            const isActive = location.pathname.startsWith(path)
            return (
              <li key={path}>
                <NavLink
                  to={path}
                  aria-label={label}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group
                    ${isActive
                      ? 'bg-emerald-500/15 text-emerald-400 border-l-2 border-emerald-500 pl-[10px]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }
                    ${collapsed ? 'justify-center' : ''}`}
                >
                  <Icon size={17} className="flex-shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User */}
      <div className={`border-t border-slate-800 p-3 flex-shrink-0 ${collapsed ? 'flex flex-col items-center gap-3' : 'flex items-center justify-between'}`}>
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 font-mono font-bold text-white text-xs">
            {user?.username ? user.username.slice(0, 2).toUpperCase() : 'U'}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-300 truncate">{user?.username || 'User'}</p>
              <p className="text-xs text-slate-500 truncate font-mono">Sales Rep</p>
            </div>
          )}
        </div>
        <button
          onClick={logout}
          aria-label="Logout"
          className={`p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors ${collapsed ? '' : ''}`}
          title="Logout"
        >
          <LogOut size={15} />
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors z-50"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  )
}
