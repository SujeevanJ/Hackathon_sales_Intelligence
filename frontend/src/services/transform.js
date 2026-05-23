/**
 * Transform backend API responses into the shape the UI components expect.
 * Backend field names use snake_case; frontend uses camelCase.
 */

// Priority from confidence score
function scoreToPriority(score) {
  if (score >= 0.8) return 'High'
  if (score >= 0.5) return 'Medium'
  return 'Low'
}

// Derive a fake source label from source_type
function sourceTypeLabel(sourceType) {
  const map = {
    'Google News RSS': 'Google News',
    'Careers Page': 'Careers Portal',
    'Press Release': 'Press Releases',
    'RSS Feed': 'RSS Feed',
  }
  return map[sourceType] || sourceType || 'AI Detection'
}

/**
 * Transform a backend TriggerEvent object → UI TriggerEvent shape
 * Requires companiesMap: { [companyId]: Company } for name lookups
 */
export function transformTrigger(t, companiesMap = {}) {
  const company = companiesMap[t.company_id] || {}
  const score = Math.round((t.confidence_score || 0) * 100)

  return {
    // Core IDs
    id: t.id,
    companyId: t.company_id,
    articleId: t.article_id,

    // Company info
    companyName: company.name || `Company #${t.company_id}`,
    industry: company.industry || 'Unknown',

    // Event data
    eventType: t.event_type || 'Unknown',
    headline: t.summary?.slice(0, 120) || 'Trigger event detected',
    summary: t.summary || '',
    businessImpact: t.business_impact || '',
    source: sourceTypeLabel(t.source_type),
    sourceUrl: '#',

    // Scores & status
    opportunityScore: score,
    confidence_score: t.confidence_score,
    status: t.status || 'New',
    priority: scoreToPriority(t.confidence_score || 0),
    assignedTo: t.assigned_to_id ? `sales_rep${t.assigned_to_id}` : 'Unassigned',

    // Timestamps
    timestamp: t.created_at,

    // Outreach brief fields (enriched from backend where available)
    relantoServices: t.recommended_service ? [t.recommended_service] : [],
    painPoints: [],
    entities: [],
    suggestedSubjectLines: [
      `Following up on recent ${t.event_type} — a conversation worth having`,
      `${company.name || 'Your company'}'s ${t.event_type}: how Relanto can help`,
      `Relevant to your recent ${t.event_type} — Relanto's perspective`,
    ],
    outreachNarrative: generateNarrative(t, company),
    talkingPoints: generateTalkingPoints(t),
    followUpTimeline: [
      { day: 'Day 1', action: 'Send personalized outreach email' },
      { day: 'Day 3', action: 'Follow up via LinkedIn' },
      { day: 'Day 7', action: 'Call attempt if no response' },
      { day: 'Day 14', action: 'Share relevant Relanto case study' },
    ],
    timingRecommendation: 'Tuesday–Thursday, 10:00–11:30 AM IST',
    avoidPeriods: 'Monday mornings, Friday afternoons',
    weekGrid: defaultWeekGrid(),

    // Flag to indicate this came from live backend
    isLive: true,
  }
}

function generateNarrative(trigger, company) {
  const name = company.name || 'your organization'
  const service = trigger.recommended_service || 'our platform engineering services'
  return `Hi,

We noticed a significant development at ${name} — ${trigger.summary || 'a strategic trigger event'}.

This kind of signal often creates specific execution challenges that require specialized external support. At Relanto, we specialize in ${service} and have helped companies in similar situations achieve their goals faster.

I'd love to share how we've helped comparable organizations navigate this phase. Would 20 minutes work this week?

Best regards,
Relanto Sales Team`
}

function generateTalkingPoints(trigger) {
  return [
    `Reference the detected event: ${trigger.event_type}`,
    `Ask about their current execution capacity and timelines`,
    `Position Relanto as a specialized partner, not a generic vendor`,
    `Share a relevant case study from a comparable company`,
    `End with a specific, time-bounded ask — e.g. 20-minute call this week`,
  ]
}

function defaultWeekGrid() {
  return [
    { day: 'Mon', slots: [0, 0, 0, 1, 1, 0, 0, 0, 0, 0] },
    { day: 'Tue', slots: [0, 0, 1, 2, 2, 1, 0, 0, 0, 0] },
    { day: 'Wed', slots: [0, 0, 1, 2, 1, 0, 0, 0, 0, 0] },
    { day: 'Thu', slots: [0, 0, 1, 2, 1, 0, 0, 0, 0, 0] },
    { day: 'Fri', slots: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0] },
  ]
}

/**
 * Transform a backend Company object → UI Company shape
 */
export function transformCompany(c) {
  return {
    id: c.id,
    name: c.name || 'Unknown',
    industry: c.industry || 'Unknown',
    hqLocation: c.hq_location || 'Unknown',
    timezone: c.timezone || 'Asia/Kolkata',
    timezoneOffset: 'IST (UTC+5:30)',
    priority: c.priority || 'Medium',
    website: c.website || '#',
    employeeCount: 'N/A',
    revenue: 'N/A',
    description: `${c.name} — monitored enterprise account.`,
    monitoringUrls: buildMonitoringUrls(c),
    activeTriggersCount: 0, // will be updated after trigger fetch
    lastSignalAt: new Date().toISOString(),
    isActive: c.is_active !== false,
    timingRecommendations: [
      { day: 'Tuesday', window: '10:00–11:30 AM IST', score: 82 },
      { day: 'Wednesday', window: '9:30–11:00 AM IST', score: 78 },
    ],
    contacts: [],
    isLive: true,
  }
}

function buildMonitoringUrls(c) {
  const urls = []
  if (c.news_rss) urls.push({ type: 'Google News RSS', url: c.news_rss })
  if (c.careers_url) urls.push({ type: 'Careers Page', url: c.careers_url })
  if (c.public_sources) {
    c.public_sources.forEach(s => {
      urls.push({ type: s.source_name || s.source_type, url: s.url })
    })
  }
  return urls
}

/**
 * Build a companiesMap: { [id]: transformedCompany } for quick lookups
 */
export function buildCompaniesMap(companies) {
  return companies.reduce((acc, c) => {
    acc[c.id] = c
    return acc
  }, {})
}

/**
 * Merge trigger counts into companies
 */
export function enrichCompaniesWithTriggerCounts(companies, triggers) {
  const counts = triggers.reduce((acc, t) => {
    acc[t.companyId] = (acc[t.companyId] || 0) + 1
    return acc
  }, {})

  return companies.map(c => ({
    ...c,
    activeTriggersCount: counts[c.id] || 0,
    lastSignalAt: triggers
      .filter(t => t.companyId === c.id)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]?.timestamp
      || c.lastSignalAt,
  }))
}
