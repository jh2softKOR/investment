import { Fragment, useEffect, useMemo, useState } from 'react'

type CalendarImportance = 'High' | 'Medium' | 'Low' | 'None'

type TradingEconomicsCalendarEvent = {
  id: string
  title: string
  category: string | null
  country: string | null
  datetime: string
  importance: CalendarImportance
  importanceValue: 1 | 2 | 3 | null
  actual: string | null
  previous: string | null
  forecast: string | null
  reference: string | null
  source: string | null
  unit: string | null
  updatedAt: string | null
  url: string | null
}

type CalendarMeta = {
  source: string
  country: string | null
  scope: string
  startDate: string
  endDate: string
  windowDays: number
  importanceLabels: string[]
  requestedAt: string
}

type CalendarApiResponse = {
  meta: CalendarMeta
  events: TradingEconomicsCalendarEvent[]
}

type CalendarRange = 'daily' | 'weekly'

type GroupedCalendarEvents = {
  key: string
  label: string
  events: TradingEconomicsCalendarEvent[]
}

const API_ENDPOINT = '/api/trading-economics/calendar'
const IMPORTANCE_LEVELS = [3, 2, 1]
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false">
    <path
      d="M7 2a1 1 0 0 0-1 1v1H5a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3h-1V3a1 1 0 1 0-2 0v1H8V3a1 1 0 0 0-1-1zm12 6H5v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1zm-9.75 3.5a.75.75 0 0 1 .743.648L10 12.25v1.5a.75.75 0 0 1-1.493.102L8.5 13.75v-1.5a.75.75 0 0 1 .75-.75zm5 0a.75.75 0 0 1 .743.648L15 12.25v1.5a.75.75 0 0 1-1.493.102L13.5 13.75v-1.5a.75.75 0 0 1 .75-.75z"
      fill="currentColor"
    />
  </svg>
)

const formatDateLabel = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
})

const formatDateKey = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const formatTimeLabel = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const getKstStartOfTodayUtc = () => {
  const now = new Date()
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000
  const kstMs = utcMs + KST_OFFSET_MS
  const kstDate = new Date(kstMs)
  const startOfKst = Date.UTC(kstDate.getUTCFullYear(), kstDate.getUTCMonth(), kstDate.getUTCDate())
  const startOfKstUtcMs = startOfKst - KST_OFFSET_MS
  return new Date(startOfKstUtcMs)
}

const buildCalendarUrl = (windowDays: number) => {
  const params = new URLSearchParams({
    scope: 'upcoming',
    window: String(windowDays),
    importance: IMPORTANCE_LEVELS.join(','),
  })

  const base = import.meta.env.VITE_CALENDAR_API_BASE?.trim()
  if (base) {
    const baseUrl = base.endsWith('/') ? base.slice(0, -1) : base
    return `${baseUrl}${API_ENDPOINT}?${params.toString()}`
  }

  return `${API_ENDPOINT}?${params.toString()}`
}

const importanceLabelMap: Record<CalendarImportance, string> = {
  High: '높음',
  Medium: '중간',
  Low: '낮음',
  None: '정보 없음',
}

const importanceClassMap: Record<CalendarImportance, string> = {
  High: 'importance-high',
  Medium: 'importance-medium',
  Low: 'importance-low',
  None: 'importance-none',
}

const EconomicCalendar = () => {
  const [range, setRange] = useState<CalendarRange>('weekly')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [events, setEvents] = useState<TradingEconomicsCalendarEvent[]>([])
  const [meta, setMeta] = useState<CalendarMeta | null>(null)

  const windowDays = range === 'daily' ? 1 : 7

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    const load = async () => {
      setStatus('loading')
      setErrorMessage(null)

      try {
        const response = await fetch(buildCalendarUrl(windowDays), { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`캘린더 데이터를 불러오지 못했습니다. (status=${response.status})`)
        }

        const payload = (await response.json()) as CalendarApiResponse
        if (cancelled) {
          return
        }

        const receivedEvents = Array.isArray(payload.events) ? payload.events : []
        setEvents(receivedEvents)
        setMeta(payload.meta ?? null)
        setStatus('idle')
      } catch (error) {
        if (cancelled) {
          return
        }

        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }

        console.error('미국 경제지표 캘린더 로드 실패:', error)
        setStatus('error')
        setEvents([])
        setMeta(null)
        setErrorMessage(error instanceof Error ? error.message : '요청을 처리할 수 없습니다.')
      }
    }

    load()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [windowDays])

  const upcomingEvents = useMemo(() => {
    if (!events.length) {
      return [] as TradingEconomicsCalendarEvent[]
    }

    const cutoff = getKstStartOfTodayUtc().getTime()
    return events.filter((event) => {
      const eventTime = new Date(event.datetime).getTime()
      return Number.isFinite(eventTime) && eventTime >= cutoff
    })
  }, [events])

  const groupedEvents = useMemo(() => {
    if (!upcomingEvents.length) {
      return [] as GroupedCalendarEvents[]
    }

    const groups: GroupedCalendarEvents[] = []
    const dateMap = new Map<string, GroupedCalendarEvents>()

    upcomingEvents.forEach((event) => {
      const eventDate = new Date(event.datetime)
      const key = formatDateKey.format(eventDate)
      const label = formatDateLabel.format(eventDate)

      if (!dateMap.has(key)) {
        const group: GroupedCalendarEvents = { key, label, events: [] }
        dateMap.set(key, group)
        groups.push(group)
      }

      dateMap.get(key)?.events.push(event)
    })

    return groups
  }, [upcomingEvents])

  const rangeLabel = range === 'daily' ? '오늘 이후 1일' : '오늘 이후 7일'

  const metaRangeLabel = useMemo(() => {
    if (!meta) {
      return null
    }

    if (meta.startDate === meta.endDate) {
      return `표시 범위: ${meta.startDate}`
    }

    return `표시 범위: ${meta.startDate} ~ ${meta.endDate}`
  }, [meta])

  return (
    <section className="section economic-calendar" aria-labelledby="economic-calendar-heading">
      <div className="section-header">
        <div className="section-title">
          <span className="section-title-icon">
            <CalendarIcon />
          </span>
          <div className="section-title-text">
            <h2 id="economic-calendar-heading">미국 경제지표 캘린더</h2>
          </div>
        </div>
        <div className="calendar-controls" role="group" aria-label="캘린더 조회 기간 선택">
          <span className="calendar-filter-label">조회 범위</span>
          <div className="segmented-control">
            <button
              type="button"
              className={range === 'daily' ? 'active' : ''}
              onClick={() => setRange('daily')}
            >
              일간
            </button>
            <button
              type="button"
              className={range === 'weekly' ? 'active' : ''}
              onClick={() => setRange('weekly')}
            >
              주간
            </button>
          </div>
        </div>
      </div>

      <p className="calendar-helper">Investing.com 위젯 대신 Trading Economics 데이터를 활용하여 오늘 이후 예정된 주요 지표만 제공합니다.</p>

      {metaRangeLabel ? <p className="calendar-meta">{metaRangeLabel}</p> : null}

      {status === 'error' ? (
        <div className="status-banner" role="status">
          {errorMessage ?? '미국 경제지표 정보를 불러오는 중 오류가 발생했습니다.'}
        </div>
      ) : null}

      <div className="calendar-table-wrapper" aria-live="polite">
        {status === 'loading' ? (
          <div className="table-empty">미국 경제지표를 불러오는 중입니다...</div>
        ) : null}

        {status !== 'loading' && groupedEvents.length === 0 ? (
          <div className="table-empty">선택한 기간에 표시할 예정 지표가 없습니다.</div>
        ) : null}

        {groupedEvents.length > 0 ? (
          <table className="calendar-table" aria-label={`미국 경제지표 ${rangeLabel}`}>
            <thead>
              <tr>
                <th scope="col">일자</th>
                <th scope="col">시간 (KST)</th>
                <th scope="col">지표</th>
                <th scope="col">실제</th>
                <th scope="col">예상</th>
                <th scope="col">이전</th>
                <th scope="col">중요도</th>
              </tr>
            </thead>
            <tbody>
              {groupedEvents.map((group) => (
                <Fragment key={group.key}>
                  <tr className="calendar-date-row">
                    <th colSpan={7} scope="colgroup">
                      <div className="calendar-date-label">
                        <span>{group.label}</span>
                        <span className="calendar-date-count">{group.events.length}건</span>
                      </div>
                    </th>
                  </tr>
                  {group.events.map((event) => {
                    const eventDate = new Date(event.datetime)
                    const timeLabel = formatTimeLabel.format(eventDate)
                    const displayTitle = event.title || '미정 지표'
                    const categoryLabel = event.category && event.category !== displayTitle ? event.category : null
                    const importanceClass = importanceClassMap[event.importance]
                    const importanceLabel = importanceLabelMap[event.importance]

                    return (
                      <tr key={event.id}>
                        <td data-title="일자">{group.label}</td>
                        <td data-title="시간">{timeLabel}</td>
                        <td data-title="지표">
                          <div className="calendar-event">
                            <span className="calendar-event-title">{displayTitle}</span>
                            {categoryLabel ? (
                              <span className="calendar-event-category">{categoryLabel}</span>
                            ) : null}
                          </div>
                        </td>
                        <td data-title="실제">{event.actual ?? '—'}</td>
                        <td data-title="예상">{event.forecast ?? '—'}</td>
                        <td data-title="이전">{event.previous ?? '—'}</td>
                        <td data-title="중요도">
                          <span className={`importance-pill ${importanceClass}`}>{importanceLabel}</span>
                        </td>
                      </tr>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      <footer className="calendar-footer">
        <small>
          데이터 출처: Trading Economics · 국가: United States · 시간대: 한국 표준시 (KST, UTC+9)
          {meta?.source ? ` · API: ${meta.source}` : ''}
        </small>
      </footer>
    </section>
  )
}

export default EconomicCalendar
