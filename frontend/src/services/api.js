const BASE = '/api'

function authHeader(token) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function handleResponse(res) {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Auth ──────────────────────────────────────────────
export async function login(username, password) {
  const form = new FormData()
  form.append('username', username)
  form.append('password', password)
  const res = await fetch(`${BASE}/auth/login`, { method: 'POST', body: form })
  return handleResponse(res)
}

export async function getMe(token) {
  const res = await fetch(`${BASE}/auth/me`, { headers: authHeader(token) })
  return handleResponse(res)
}

// ── Triggers ─────────────────────────────────────────
export async function getTriggers(token, skip = 0, limit = 100) {
  const res = await fetch(`${BASE}/triggers/?skip=${skip}&limit=${limit}`, {
    headers: authHeader(token),
  })
  return handleResponse(res)
}

// ── Companies ─────────────────────────────────────────
export async function getCompanies(token, skip = 0, limit = 100) {
  const res = await fetch(`${BASE}/companies/?skip=${skip}&limit=${limit}`, {
    headers: authHeader(token),
  })
  return handleResponse(res)
}

export async function getCompany(token, companyId) {
  const res = await fetch(`${BASE}/companies/${companyId}`, {
    headers: authHeader(token),
  })
  return handleResponse(res)
}

export async function getCompanyTriggers(token, companyId) {
  const res = await fetch(`${BASE}/companies/${companyId}/triggers`, {
    headers: authHeader(token),
  })
  return handleResponse(res)
}

// ── Scraper ───────────────────────────────────────────
export async function runScraper() {
  const res = await fetch(`${BASE}/scraper/run`, { method: 'POST' })
  return handleResponse(res)
}

// ── Seed ──────────────────────────────────────────────
export async function seedDatabase() {
  const res = await fetch(`${BASE}/seed`, { method: 'POST' })
  return handleResponse(res)
}

// ── Health check ─────────────────────────────────────
export async function healthCheck() {
  try {
    const res = await fetch('/', { signal: AbortSignal.timeout(3000) })
    return res.ok
  } catch {
    return false
  }
}
