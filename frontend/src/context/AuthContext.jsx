import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as api from '../services/api'

const AuthContext = createContext(null)

const TOKEN_KEY = 'relanto_token'
const USER_KEY  = 'relanto_user'

export function AuthProvider({ children }) {
  const [token, setToken]   = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user,  setUser]    = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // Validate stored token on mount
  useEffect(() => {
    if (token && !user) {
      api.getMe(token)
        .then(setUser)
        .catch(() => logout())
    }
  }, [])

  const login = useCallback(async (username, password) => {
    setLoading(true)
    setError('')
    try {
      const data = await api.login(username, password)
      const jwt  = data.access_token
      setToken(jwt)
      localStorage.setItem(TOKEN_KEY, jwt)

      const me = await api.getMe(jwt)
      setUser(me)
      localStorage.setItem(USER_KEY, JSON.stringify(me))
      return true
    } catch (e) {
      setError('Invalid username or password')
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }, [])

  return (
    <AuthContext.Provider value={{ token, user, login, logout, loading, error, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
