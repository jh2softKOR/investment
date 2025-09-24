
import { useEffect, useMemo, useState } from 'react'
import { shouldUseLiveCalendarData } from '../utils/liveDataFlags'

type ViewMode = 'daily' | 'weekly'
type ScopeFilter = 'upcoming' | 'previous'
type ImportanceFilter = 'all' | 'high' | 'medium' | 'low'

type EconomicEvent = {
  id: string
  title: string
  datetime: Date
  impact: 'High' | 'Medium' | 'Low' | 'Holiday' | 'None'
  actual?: string
  previous?: string
  forecast?: string
  category?: string | null
}

type CalendarApiEvent = {
  id?: string | null
  title?: string | null
  category?: string | null
  datetime?: string | null
  importance?: string | null
  importanceValue?: number | null
  actual?: string | number | null
  previous?: string | number | null
  forecast?: string | number | null
}

type CalendarApiMeta = {
  source?: string | null
  country?: string | null
  scope?: string | null
  startDate?: string | null
  endDate?: string | null
  windowDays?: number | null
  importanceLevels?: number[] | null
  importanceLabels?: string[] | null
  requestedAt?: string | null
  cache?: { hit?: boolean | null; ttlSeconds?: number | null } | null
}

type CalendarApiResponse = {
  meta?: CalendarApiMeta | null
  events?: CalendarApiEvent[] | null
}

type CalendarMetaState = {
  sourceLabel: string
  scope: 'upcoming' | 'previous' | 'range' | 'custom'
  startDate: string | null
  endDate: string | null
  importanceLabels: string[]
  requestedAt: Date | null
  cacheHit: boolean
  windowDays: number | null
}

type FallbackEventTemplate = {
  id: string
  title: string
  dayOffset: number
  utcHour: number
  utcMinute: number
  impact: EconomicEvent['impact']
  actual?: string
  forecast?: string
  previous?: string
}

const fallbackTemplates: FallbackEventTemplate[] = [
  {
    id: 'ism-manufacturing-pmi',
    title: 'ISM 제조업 PMI',
    dayOffset: 0,
    utcHour: 14,
    utcMinute: 0,
    impact: 'High',
    forecast: '52.0',
    previous: '52.4',
  },
  {
    id: 'jolts-job-openings',
    title: 'JOLTs 구인건수',
    dayOffset: 1,
    utcHour: 14,
    utcMinute: 0,
    impact: 'Medium',
    forecast: '8.8M',
    previous: '8.9M',
  },
  {
    id: 'adp-employment',
    title: 'ADP 민간 고용',
    dayOffset: 2,
    utcHour: 12,
    utcMinute: 15,
    impact: 'Medium',
    forecast: '165K',
    previous: '172K',
  },
  {
    id: 'ism-services-pmi',
    title: 'ISM 비제조업 PMI',
    dayOffset: 3,
    utcHour: 14,
    utcMinute: 0,
    impact: 'High',
    forecast: '53.1',
    previous: '52.7',
  },
  {
    id: 'initial-jobless-claims',
    title: '주간 신규 실업수당 청구건수',
    dayOffset: 4,
    utcHour: 12,
    utcMinute: 30,
    impact: 'Medium',
    forecast: '219K',
    previous: '220K',
  },
  {
    id: 'nonfarm-payrolls',
    title: '비농업부문 고용지표 (NFP)',
    dayOffset: 5,
    utcHour: 12,
    utcMinute: 30,
    impact: 'High',
    forecast: '175K',
    previous: '187K',
  },
]

const formatNumber = (value?: string | number | null) => {
  if (value === null || value === undefined) {
    return undefined
  }

  const stringified = typeof value === 'number' ? value.toString() : `${value}`
  const cleaned = stringified.replace(/&nbsp;/gi, ' ').trim()
  if (!cleaned) {
    return undefined
  }

  const lowered = cleaned.toLowerCase()
  if (['n/a', 'na', 'tba', 'tentative', '-', '--'].includes(lowered)) {
    return undefined
  }

  return cleaned
}

const mapImpactFromApi = (event: CalendarApiEvent): EconomicEvent['impact'] => {
  if (typeof event.importanceValue === 'number') {
    if (event.importanceValue >= 3) {
      return 'High'
    }
    if (event.importanceValue === 2) {
      return 'Medium'
    }
    if (event.importanceValue === 1) {
      return 'Low'
    }
  }

  const lowered = (event.importance ?? '').toLowerCase()
  if (lowered.includes('high') || lowered.includes('높')) {
    return 'High'
  }
  if (lowered.includes('medium') || lowered.includes('중')) {
    return 'Medium'
  }
  if (lowered.includes('low') || lowered.includes('낮')) {
    return 'Low'
  }
  if (lowered.includes('holiday')) {
    return 'Holiday'
  }
  return 'None'
}

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(date)

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)

const createFallbackEvents = (base: Date) => {
  const utcStart = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()))

  return fallbackTemplates.map((template) => {
    const eventDate = new Date(utcStart)
    eventDate.setUTCDate(utcStart.getUTCDate() + template.dayOffset)
    eventDate.setUTCHours(template.utcHour, template.utcMinute, 0, 0)

    return {
      id: `fallback-${template.id}-${eventDate.toISOString()}`,
      title: template.title,
      datetime: eventDate,
      impact: template.impact,
      actual: template.actual ? formatNumber(template.actual) : undefined,
      previous: template.previous ? formatNumber(template.previous) : undefined,
      forecast: template.forecast ? formatNumber(template.forecast) : undefined,
    }
  })
}

const toScopeLabel = (scope: CalendarMetaState['scope']) => {
  if (scope === 'previous') {
    return '발표 완료'
  }
  if (scope === 'range') {
    return '기간 지정'
  }
  if (scope === 'custom') {
    return '사용자 지정'
  }
  return '발표 예정'
}

const toImportanceLabel = (label: string) => {
  const lowered = label.toLowerCase()
  if (lowered.includes('high')) {
    return '높음'
  }
  if (lowered.includes('medium')) {
    return '보통'
  }
  if (lowered.includes('low')) {
    return '낮음'
  }
  return '정보'
}

const normalizeMeta = (
  meta: CalendarApiMeta | null,
  fallbackScope: ScopeFilter,
  windowDays: number,
): CalendarMetaState => {
  const normalizedScopeRaw = (meta?.scope ?? fallbackScope).toString().toLowerCase()
  const normalizedScope: CalendarMetaState['scope'] = ['previous', 'range', 'custom'].includes(normalizedScopeRaw)
    ? (normalizedScopeRaw as CalendarMetaState['scope'])
    : 'upcoming'

  const requestedAt = meta?.requestedAt ? new Date(meta.requestedAt) : new Date()
  const validRequestedAt = Number.isNaN(requestedAt.getTime()) ? null : requestedAt

  const importanceLabels =
    meta?.importanceLabels && meta.importanceLabels.length > 0
      ? meta.importanceLabels
      : ['High', 'Medium', 'Low']

  return {
    sourceLabel: meta?.source?.trim() || 'Trading Economics',
    scope: normalizedScope === 'upcoming' ? fallbackScope : normalizedScope,
    startDate: meta?.startDate ?? null,
    endDate: meta?.endDate ?? null,
    importanceLabels,
    requestedAt: validRequestedAt,
    cacheHit: Boolean(meta?.cache?.hit),
    windowDays: meta?.windowDays ?? windowDays,
  }
}

const formatNotice = (meta: CalendarMetaState | null) => {
  if (!meta) {
    return null
  }

  const rangeText = (() => {
    if (meta.startDate && meta.endDate) {
      if (meta.startDate === meta.endDate) {
        return meta.startDate
      }
      return `${meta.startDate} ~ ${meta.endDate}`
    }
    return '날짜 범위 미지정'
  })()

  const importanceText = meta.importanceLabels.length > 0
    ? meta.importanceLabels.map(toImportanceLabel).join(', ')
    : '전체'

  const parts = [
    `${meta.sourceLabel} API (${toScopeLabel(meta.scope)})`,
    `조회 기간 ${rangeText}`,
    `중요도 ${importanceText}`,
  ]

  if (meta.cacheHit) {
    parts.push('캐시 데이터 사용')
  }

  return parts.join(' · ')
}

const buildApiBase = () => {
  const raw = import.meta.env.VITE_CALENDAR_API_BASE_URL?.trim()
  if (!raw) {
    return ''
  }
  return raw.replace(/\/+$/, '')
}

const combineBaseAndPath = (base: string, path: string) => {
  if (!base) {
    return path
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalizedPath}`
}

const EconomicCalendar = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('weekly')
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('upcoming')
  const [importanceFilter, setImportanceFilter] = useState<ImportanceFilter>('high')
  const [events, setEvents] = useState<EconomicEvent[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [calendarMeta, setCalendarMeta] = useState<CalendarMetaState | null>(null)
  const useLiveCalendar = shouldUseLiveCalendarData()
  const calendarApiBase = useMemo(buildApiBase, [])

  const todayKey = useMemo(() => {
    const now = new Date()
    return now.toISOString().slice(0, 10)
  }, [])

  useEffect(() => {
    if (!useLiveCalendar) {
      const fallbackBase = new Date()
      setEvents(createFallbackEvents(fallbackBase))
      setStatus('idle')
      setLastUpdated(fallbackBase)
      setCalendarMeta(null)
      setNotice('실시간 경제 캘린더 API 사용이 비활성화되어 대표적인 USD 지표 예시 데이터를 표시합니다.')
      return
    }

    const controller = new AbortController()

    const loadTradingEconomicsCalendar = async () => {
      setStatus('loading')
      setNotice(null)

      const windowDays = viewMode === 'weekly' ? 7 : 1
      const params = new URLSearchParams()
      params.set('scope', scopeFilter)
      params.set('window', windowDays.toString())
      if (importanceFilter !== 'all') {
        params.set('importance', importanceFilter)
      }

      const endpoint = combineBaseAndPath(calendarApiBase, '/api/trading-economics/calendar')
      const requestUrl = `${endpoint}?${params.toString()}`

      const response = await fetch(requestUrl, { signal: controller.signal })
      if (!response.ok) {
        throw new Error('Trading Economics 캘린더 API 요청에 실패했습니다.')
      }

      const data = (await response.json()) as CalendarApiResponse
      const rawEvents = Array.isArray(data.events) ? data.events : []
      const normalizedEvents: EconomicEvent[] = []

      for (const item of rawEvents) {
        if (!item || !item.datetime) {
          continue
        }
        const parsedDate = new Date(item.datetime)
        if (Number.isNaN(parsedDate.getTime())) {
          continue
        }

        normalizedEvents.push({
          id: item.id ?? `${item.title ?? '미정 지표'}-${item.datetime}`,
          title: item.title ?? '미정 지표',
          datetime: parsedDate,
          impact: mapImpactFromApi(item),
          actual: formatNumber(item.actual),
          previous: formatNumber(item.previous),
          forecast: formatNumber(item.forecast),
          category: item.category ?? null,
        })
      }

      normalizedEvents.sort((a, b) => a.datetime.getTime() - b.datetime.getTime())

      const metaState = normalizeMeta(data.meta ?? null, scopeFilter, windowDays)

      setEvents(normalizedEvents)
      setStatus('idle')
      setCalendarMeta(metaState)
      setNotice(formatNotice(metaState))
      setLastUpdated(metaState.requestedAt ?? new Date())
    }

    loadTradingEconomicsCalendar().catch((error) => {
      if ((error as Error).name === 'AbortError') {
        return
      }
      console.error('Trading Economics 캘린더 데이터를 불러오지 못했습니다.', error)
      const fallbackBase = new Date()
      setEvents(createFallbackEvents(fallbackBase))
      setStatus('error')
      setCalendarMeta(null)
      setNotice('Trading Economics API에 연결할 수 없어 대표적인 USD 지표 예시 데이터를 표시합니다.')
      setLastUpdated(fallbackBase)
    })

    return () => controller.abort()
  }, [calendarApiBase, importanceFilter, scopeFilter, useLiveCalendar, viewMode])

  const filteredEvents = useMemo(() => {
    if (viewMode === 'weekly') {
      return events
    }

    if (calendarMeta) {
      const targetKey = scopeFilter === 'previous' ? calendarMeta.endDate ?? todayKey : calendarMeta.startDate ?? todayKey
      return events.filter((event) => event.datetime.toISOString().slice(0, 10) === targetKey)
    }

    return events.filter((event) => event.datetime.toISOString().slice(0, 10) === todayKey)
  }, [calendarMeta, events, scopeFilter, todayKey, viewMode])

  const renderImpact = (impact: EconomicEvent['impact']) => {
    if (impact === 'None' || impact === 'Holiday') {
      return <span className="impact-chip impact-low">정보</span>
    }

    const impactClass =
      impact === 'High' ? 'impact-high' : impact === 'Medium' ? 'impact-medium' : 'impact-low'

    const label =
      impact === 'High' ? '높음' : impact === 'Medium' ? '보통' : impact === 'Low' ? '낮음' : '정보'

    return <span className={`impact-chip ${impactClass}`}>{label}</span>
  }

  return (
    <section className="section" aria-labelledby="economic-calendar-heading">
      <div className="section-header">
        <div>
          <h2 id="economic-calendar-heading" className="section-title">
            <span className="section-title-icon calendar" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false" role="img">
                <path
                  d="M7 3a1 1 0 0 1 2 0v1h6V3a1 1 0 1 1 2 0v1h1.5A2.5 2.5 0 0 1 21 6.5v12A2.5 2.5 0 0 1 18.5 21h-13A2.5 2.5 0 0 1 3 18.5v-12A2.5 2.5 0 0 1 5.5 4H7V3Zm11.5 6h-13a.5.5 0 0 0-.5.5v9a1.5 1.5 0 0 0 1.5 1.5h12A1.5 1.5 0 0 0 20 18.5v-9a.5.5 0 0 0-.5-.5Zm-13-2h13V6.5A1.5 1.5 0 0 0 18 5h-.5v1a1 1 0 1 1-2 0V5H8v1a1 1 0 0 1-2 0V5H5.5A1.5 1.5 0 0 0 4 6.5V7Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <span className="section-title-text">
              USD 주요 경제 지표 캘린더  (Trading Economics 데이터를 기반으로 미국 달러 핵심 이벤트를 확인하세요.)
            </span>
          </h2>
        </div>
        <div className="calendar-controls" role="group" aria-label="경제 캘린더 보기 옵션">
          <div className="segmented-control" role="tablist" aria-label="기간 선택">
            {(['daily', 'weekly'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={mode === viewMode ? 'active' : ''}
                onClick={() => setViewMode(mode)}
                role="tab"
                aria-selected={mode === viewMode}
              >
                {mode === 'daily' ? '일간 지표' : '주간 보기'}
              </button>
            ))}
          </div>
          <div className="calendar-filter">
            <span className="calendar-filter-label" aria-hidden="true">
              범위
            </span>
            <div className="segmented-control" role="tablist" aria-label="이벤트 범위 선택">
              {(['upcoming', 'previous'] as ScopeFilter[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={option === scopeFilter ? 'active' : ''}
                  onClick={() => setScopeFilter(option)}
                  role="tab"
                  aria-selected={option === scopeFilter}
                >
                  {option === 'upcoming' ? '예정' : '발표됨'}
                </button>
              ))}
            </div>
          </div>
          <div className="calendar-filter">
            <span className="calendar-filter-label" aria-hidden="true">
              중요도
            </span>
            <div className="segmented-control importance" role="tablist" aria-label="중요도 필터">
              {(['all', 'high', 'medium', 'low'] as ImportanceFilter[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  className={level === importanceFilter ? 'active' : ''}
                  onClick={() => setImportanceFilter(level)}
                  role="tab"
                  aria-selected={level === importanceFilter}
                >
                  {level === 'all'
                    ? '전체'
                    : level === 'high'
                      ? '높음'
                      : level === 'medium'
                        ? '보통'
                        : '낮음'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      {status === 'loading' ? (
        <div className="status-banner" role="status">
          경제 캘린더 데이터를 불러오는 중입니다...
        </div>
      ) : (
        <div>
          {notice && (
            <div className="status-banner" role="status">
              {notice}
            </div>
          )}
          {filteredEvents.length > 0 ? (
            <table className="calendar-table">
              <thead>
                <tr>
                  <th scope="col">일시</th>
                  <th scope="col">지표</th>
                  <th scope="col">발표치</th>
                  <th scope="col">예상치</th>
                  <th scope="col">이전치</th>
                  <th scope="col">영향도</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <div>{formatDate(event.datetime)}</div>
                      <div>{formatTime(event.datetime)}</div>
                    </td>
                    <td>{event.title}</td>
                    <td>{event.actual ?? '-'}</td>
                    <td>{event.forecast ?? '-'}</td>
                    <td>{event.previous ?? '-'}</td>
                    <td>{renderImpact(event.impact)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="table-empty">표시할 이벤트가 없습니다. 휴일일 가능성이 있습니다.</div>
          )}
        </div>
      )}

      <p className="helper-text">
        Trading Economics API를 통해 미국(USD)에 영향을 주는 주요 이벤트를 불러옵니다. 상단 필터로 예정/발표
        상태와 중요도를 조정할 수 있습니다.
        {lastUpdated &&
          ` 마지막 갱신: ${new Intl.DateTimeFormat('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
          }).format(lastUpdated)} 기준`}
      </p>
    </section>
  )
}

export default EconomicCalendar
