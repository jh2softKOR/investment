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

const formatNumber = (value?: string | number | null) => {
  if (value === null || value === undefined) {
    return undefined
  }

  const stringified = typeof value === 'number' ? value.toString() : value
  if (stringified.trim() === '') {
    return undefined
  }

  return stringified
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

const EconomicCalendar = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('daily')
  const [events, setEvents] = useState<EconomicEvent[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadEconomicEvents = async () => {
      setStatus('loading')
      try {
        const { start, end } = getRange()
        const apiKey = import.meta.env.VITE_FMP_KEY || 'demo'
        const url = new URL('https://financialmodelingprep.com/api/v3/economic_calendar')
        url.searchParams.set('from', start)
        url.searchParams.set('to', end)
        url.searchParams.set('apikey', apiKey)

        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) {
          throw new Error('응답이 올바르지 않습니다.')
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

        setEvents(filtered)
        setStatus('idle')
        setLastUpdated(new Date())
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return
        }
        console.error(error)
        setStatus('error')
      }
    }

    loadEconomicEvents()

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
