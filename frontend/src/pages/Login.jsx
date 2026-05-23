import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Radar, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const DEMO_USERS = [
  { label: 'Admin',      username: 'admin',      role: 'Full access — all triggers' },
  { label: 'Sales Rep 1', username: 'sales_rep1', role: 'Sees own assigned triggers only' },
  { label: 'Sales Rep 2', username: 'sales_rep2', role: 'Sees own assigned triggers only' },
]

export default function Login() {
  const { login, loading, error, isAuthenticated } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('Hackathon2026!')
  const [showPwd,  setShowPwd]  = useState(false)

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    await login(username, password)
  }

  const quickLogin = async (u) => {
    setUsername(u)
    await login(u, 'Hackathon2026!')
  }

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500 rounded-2xl mb-4 shadow-lg shadow-emerald-500/25">
            <Radar size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Relanto Intel</h1>
          <p className="text-sm text-slate-500 mt-1 font-mono">Sales Intelligence Platform</p>
        </div>

        {/* Login card */}
        <div className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-xl p-6 shadow-2xl">
          <h2 className="text-sm font-semibold text-slate-300 mb-5">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin / sales_rep1 / sales_rep2"
                required
                autoComplete="username"
                className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition-colors font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-3 py-2.5 pr-10 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-400 font-mono">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username}
              className="w-full py-2.5 rounded-lg text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Quick login */}
          <div className="mt-5 pt-4 border-t border-slate-700/50">
            <p className="text-xs text-slate-500 font-mono mb-3">QUICK LOGIN (password: Hackathon2026!)</p>
            <div className="space-y-2">
              {DEMO_USERS.map(u => (
                <button
                  key={u.username}
                  onClick={() => quickLogin(u.username)}
                  disabled={loading}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-700/40 border border-slate-600/40 hover:bg-slate-700/80 transition-colors group disabled:opacity-50"
                >
                  <div className="text-left">
                    <p className="text-xs font-medium text-slate-300 font-mono">{u.username}</p>
                    <p className="text-xs text-slate-500">{u.role}</p>
                  </div>
                  <span className="text-xs text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-4 font-mono">
          Relanto Sales Intelligence · Hackathon 2026
        </p>
      </div>
    </div>
  )
}
