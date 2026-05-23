import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'

/**
 * Generic data fetching hook with:
 * - Loading / error / data states
 * - Automatic retry when token changes
 * - Manual refresh via refetch()
 */
export function useApiData(fetcher, deps = []) {
  const { token } = useAuth()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetcher(token)
      setData(result)
    } catch (e) {
      console.error('API fetch failed:', e.message)
      setData(null)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [token, ...deps])

  useEffect(() => { fetch_() }, [fetch_])

  return { data, loading, error, refetch: fetch_ }
}
