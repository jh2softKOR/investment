import { useEffect, useMemo, useState } from 'react'

type ViewMode = 'daily' | 'weekly'

type EconomicEvent = {
  id: string
  title: string
  datetime: Date
  impact: 'High' | 'Medium' | 'Low' | 'Holiday' | 'None'
  actual?: string
  previous?: string
  forecast?: string
}

type ApiEconomicEvent = {
  id?: string
  event?: string
  title?: string
  country?: string
  currency?: string
  importance?: string
  impact?: string
  actual?: string | number | null
  previous?: string | number | null
  estimate?: string | number | null
  consensus?: string | number | null
  forecast?: string | number | null
  date?: string
}

type ForexFactoryEvent = {
  id?: string | number
  title?: string
  country?: string
  currency?: string
  impact?: string
  actual?: string | number | null
  previous?: string | number | null
  forecast?: string | number | null
  estimate?: string | number | null
  consensus?: string | number | null
  date?: string
  time?: string
  timestamp?: string | number
  datetime?: string
}

type ForexFactoryResponse =
  | ForexFactoryEvent[]
  | {
      rows?: ForexFactoryEvent[][]
      events?: ForexFactoryEvent[]
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

const FMP_ENDPOINT = 'https://financialmodelingprep.com/api/v3/economic_calendar'
const FOREX_FACTORY_ENDPOINT = 'https://cdn-nfs.faireconomy.media/ff_calendar_thisweek.json'

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

const normalizeImpact = (impact?: string): EconomicEvent['impact'] => {
  const lowered = (impact ?? '').toLowerCase()
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

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).format(date)
}

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)

const getRange = () => {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  const format = (value: Date) => value.toISOString().slice(0, 10)
  return { start: format(start), end: format(end) }
}

const toMilliseconds = (timestamp?: number | string | null) => {
  if (timestamp === null || timestamp === undefined) {
    return undefined
  }

  const numeric = typeof timestamp === 'string' ? Number(timestamp) : timestamp
  if (!Number.isFinite(numeric)) {
    return undefined
  }

  return numeric > 1e12 ? numeric : numeric * 1000
}

const parseForexFactoryDate = (event: ForexFactoryEvent) => {
  const fromTimestamp = toMilliseconds(event.timestamp)
  if (fromTimestamp) {
    const fromEpoch = new Date(fromTimestamp)
    if (!Number.isNaN(fromEpoch.getTime())) {
      return fromEpoch
    }
  }

  const direct = event.datetime ?? event.date
  if (direct) {
    const parsed = new Date(direct)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  if (event.date) {
    const baseYear = new Date().getFullYear()
    const combined = `${event.date} ${baseYear} ${event.time ?? '00:00'}`
    const parsed = new Date(combined)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return undefined
}

const mapForexFactoryEvents = (data: ForexFactoryEvent[]): EconomicEvent[] => {
  const mapped: EconomicEvent[] = []

  for (const item of data) {
    const country = (item.country ?? item.currency ?? '').toString().toLowerCase()
    if (!(country.includes('united states') || country.includes('us') || country.includes('usd'))) {
      continue
    }

    const parsedDate = parseForexFactoryDate(item)
    if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
      continue
    }

    mapped.push({
      id: `forex-${item.id ?? `${item.title}-${parsedDate.toISOString()}`}`,
      title: item.title ?? '미정 지표',
      datetime: parsedDate,
      impact: normalizeImpact(item.impact),
      actual: formatNumber(item.actual),
      previous: formatNumber(item.previous),
      forecast: formatNumber(item.forecast ?? item.estimate ?? item.consensus),
    })
  }

  return mapped.sort((a, b) => a.datetime.getTime() - b.datetime.getTime())
}

const flattenForexFactoryResponse = (rawData: ForexFactoryResponse): ForexFactoryEvent[] => {
  if (Array.isArray(rawData)) {
    return rawData
  }

  const candidates: ForexFactoryEvent[] = []
  if (Array.isArray(rawData.events)) {
    candidates.push(...rawData.events)
  }
  if (Array.isArray(rawData.rows)) {
    for (const row of rawData.rows) {
      if (Array.isArray(row)) {
        candidates.push(...row)
      }
    }
  }

  return candidates
}

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

const EconomicCalendar = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('daily')
  const [events, setEvents] = useState<EconomicEvent[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadEconomicEvents = async () => {
      setStatus('loading')
      setNotice(null)
      try {
        const { start, end } = getRange()
        const apiKey = import.meta.env.VITE_FMP_KEY?.trim()
        const shouldUseFmp = apiKey && apiKey.toLowerCase() !== 'demo'

        if (shouldUseFmp) {
          const url = new URL(FMP_ENDPOINT)
          url.searchParams.set('from', start)
          url.searchParams.set('to', end)
          url.searchParams.set('apikey', apiKey)

          const response = await fetch(url, { signal: controller.signal })
          if (!response.ok) {
            throw new Error('Financial Modeling Prep 응답이 올바르지 않습니다.')
          }

          const rawData: ApiEconomicEvent[] = await response.json()
          const filtered = (rawData || [])
            .filter((item) => {
              const country = (item.country ?? '').toLowerCase()
              const currency = (item.currency ?? '').toLowerCase()
              return country.includes('united states') || country.includes('us') || currency.includes('usd')
            })
            .map((item) => {
              const dateString = item.date ?? ''
              const normalizedDate = dateString.replace(' ', 'T')
              const parsedDate = new Date(normalizedDate)

              return {
                id: item.id ?? `${item.event}-${dateString}-${Math.random()}`,
                title: item.event ?? item.title ?? '미정 지표',
                datetime: parsedDate,
                impact: normalizeImpact(item.importance ?? item.impact),
                actual: formatNumber(item.actual),
                previous: formatNumber(item.previous),
                forecast: formatNumber(item.forecast ?? item.estimate ?? item.consensus),
              }
            })
            .filter((event) => !Number.isNaN(event.datetime.getTime()))
            .sort((a, b) => a.datetime.getTime() - b.datetime.getTime())

          if (controller.signal.aborted) {
            return
          }

          if (filtered.length > 0) {
            setEvents(filtered)
            setStatus('idle')
            setLastUpdated(new Date())
            setNotice(null)
            return
          }
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error(error)
        }
      }

      try {
        const response = await fetch(FOREX_FACTORY_ENDPOINT, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error('ForexFactory 공개 캘린더 응답이 올바르지 않습니다.')
        }

        const rawData: ForexFactoryResponse = await response.json()
        const flattened = mapForexFactoryEvents(flattenForexFactoryResponse(rawData))

        if (controller.signal.aborted) {
          return
        }

        if (flattened.length > 0) {
          setEvents(flattened)
          setStatus('idle')
          setLastUpdated(new Date())
          setNotice('ForexFactory 공개 캘린더 데이터를 기반으로 일정을 표시하고 있습니다.')
          return
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error(error)
        }
      }

      if (controller.signal.aborted) {
        return
      }

      const fallbackEvents = createFallbackEvents(new Date())
      setEvents(fallbackEvents)
      setStatus('idle')
      setLastUpdated(new Date())
      setNotice('실시간 경제 캘린더 API에 연결할 수 없어 대표적인 USD 지표 예시 데이터를 표시합니다.')
    }

    loadEconomicEvents().catch((error) => {
      if ((error as Error).name === 'AbortError') {
        return
      }
      console.error(error)
      setStatus('error')
    })

    return () => controller.abort()
  }, [])

  const todayKey = useMemo(() => {
    const now = new Date()
    return now.toISOString().slice(0, 10)
  }, [])

  const filteredEvents = useMemo(() => {
    if (viewMode === 'weekly') {
      return events
    }

    return events.filter((event) => event.datetime.toISOString().slice(0, 10) === todayKey)
  }, [events, todayKey, viewMode])

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
          <h2 id="economic-calendar-heading">USD 주요 경제 지표 캘린더</h2>
          <span>Investing.com의 달력을 참고한 미국 달러 핵심 이벤트를 모았습니다.</span>
        </div>
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
      </div>

      {status === 'error' && (
        <div className="status-banner" role="alert">
          경제 지표를 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.
        </div>
      )}

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
        Investing.com 경제 캘린더를 참고하여 미국 달러(USD)에 영향을 미치는 주요 이벤트만 정리했습니다.
        {lastUpdated && ` 마지막 갱신: ${new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(lastUpdated)} 기준`}
      </p>
    </section>
  )
}

export default EconomicCalendar
