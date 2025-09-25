import { useCallback, useEffect, useMemo, useState } from 'react'

type RangeOption = 'day' | 'week'

type TradingEconomicsEvent = {
  DateUTC?: string
  Date?: string
  Country?: string
  Event?: string
  EventName?: string
  Actual?: string
  Forecast?: string
  Previous?: string
  Importance?: number
  Impact?: number
}

type CalendarRow = {
  id: string
  timeLabel: string
  title: string
  actual: string
  actualTone: 'up' | 'down' | null
  forecast: string
  previous: string
  importance: number
}

const COUNTRY = 'united states'
const IMPORTANCE = 3
const TZ_OFFSET = 9
const API_KEY = 'guest:guest'
const BASE_URL = 'https://api.tradingeconomics.com/calendar'

const formatDate = (date: Date) => date.toISOString().slice(0, 10)

const getRange = (type: RangeOption) => {
  const now = new Date()
  const start = new Date(now)
  const end = new Date(now)

  if (type === 'week') {
    const day = (now.getDay() + 6) % 7 // Monday = 0
    start.setDate(now.getDate() - day)
    end.setDate(start.getDate() + 6)
  }

  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)

  return { d1: formatDate(start), d2: formatDate(end) }
}

const toKSTDate = (iso?: string) => {
  if (!iso) return null
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return null
  return new Date(parsed.getTime() + TZ_OFFSET * 60 * 60 * 1000)
}

const formatKSTLabel = (iso?: string) => {
  const date = toKSTDate(iso)
  if (!date) return '—'

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${month}/${day} ${hours}:${minutes}`
}

const pillClass = (importance: number) => {
  if (importance >= 3) return 'pill pill--high'
  if (importance === 2) return 'pill pill--med'
  return 'pill pill--low'
}

const sanitize = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

const detectTone = (value: string) => {
  if (!value || value === '—') return null
  if (/[+▲↑]/.test(value) && !/[-▼↓]/.test(value)) return 'up'
  if (/-|[▼↓]/.test(value)) return 'down'
  return null
}

const EconomicCalendar = () => {
  const [range, setRange] = useState<RangeOption>('week')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<CalendarRow[]>([])
  const [refreshIndex, setRefreshIndex] = useState(0)

  const fetchCalendar = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { d1, d2 } = getRange(range)
    const params = new URLSearchParams({
      country: COUNTRY,
      importance: String(IMPORTANCE),
      d1,
      d2,
      c: API_KEY,
    })

    try {
      const response = await fetch(`${BASE_URL}?${params.toString()}`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data: TradingEconomicsEvent[] = await response.json()
      const rows = (data ?? [])
        .filter((item) => (item.Country ?? '').toLowerCase().includes(COUNTRY))
        .sort((a, b) => {
          const aDate = new Date(a.DateUTC ?? a.Date ?? 0).getTime()
          const bDate = new Date(b.DateUTC ?? b.Date ?? 0).getTime()
          return aDate - bDate
        })
        .map<CalendarRow>((item, index) => {
          const timeLabel = formatKSTLabel(item.DateUTC ?? item.Date)
          const actual = sanitize(item.Actual)
          const forecast = sanitize(item.Forecast)
          const previous = sanitize(item.Previous)
          const importance = Number(item.Importance ?? item.Impact ?? 0)
          return {
            id: `${item.DateUTC ?? item.Date ?? 'unknown'}-${item.Event ?? item.EventName ?? index}`,
            timeLabel,
            title: sanitize(item.Event ?? item.EventName ?? '—'),
            actual,
            actualTone: detectTone(actual),
            forecast,
            previous,
            importance,
          }
        })

      setEvents(rows)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message.includes('Failed to fetch') ? '네트워크 또는 CORS 설정을 확인해주세요.' : err.message)
      } else {
        setError('알 수 없는 오류가 발생했습니다.')
      }
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    fetchCalendar()
  }, [fetchCalendar, refreshIndex])

  const bodyContent = useMemo(() => {
    if (loading) {
      return (
        <tr>
          <td colSpan={6} className="ecal__empty">
            로딩 중…
          </td>
        </tr>
      )
    }

    if (error) {
      return (
        <tr>
          <td colSpan={6} className="ecal__empty">
            데이터를 불러오지 못했습니다. {error}
          </td>
        </tr>
      )
    }

    if (events.length === 0) {
      return (
        <tr>
          <td colSpan={6} className="ecal__empty">
            표시할 이벤트가 없습니다.
          </td>
        </tr>
      )
    }

    return events.map((event) => (
      <tr key={event.id}>
        <td>{event.timeLabel}</td>
        <td>{event.title}</td>
        <td className={event.actualTone ? `ecal__value ${event.actualTone}` : undefined}>{event.actual}</td>
        <td>{event.forecast}</td>
        <td>{event.previous}</td>
        <td>
          <span className={pillClass(event.importance)}>
            {event.importance >= 3 ? '높음' : event.importance === 2 ? '보통' : '낮음'}
          </span>
        </td>
      </tr>
    ))
  }, [events, error, loading])

  return (
    <section className="calendar-widget-card" aria-labelledby="economic-calendar-heading">
      <div className="ecal" id="usd-calendar">
        <header className="ecal__header">
          <h2 id="economic-calendar-heading">미국 경제지표 캘린더</h2>
          <div className="ecal__controls">
            <label htmlFor="calendar-range" className="visually-hidden">
              조회 범위 선택
            </label>
            <select
              id="calendar-range"
              value={range}
              onChange={(event) => setRange(event.target.value as RangeOption)}
              disabled={loading}
            >
              <option value="day">오늘</option>
              <option value="week">이번 주</option>
            </select>
            <button type="button" onClick={() => setRefreshIndex((value) => value + 1)} disabled={loading}>
              {loading ? '새로고침 중…' : '새로고침'}
            </button>
          </div>
        </header>

        <div className="ecal__tablewrap">
          <table className="ecal__table">
            <thead>
              <tr>
                <th scope="col">시간 (KST)</th>
                <th scope="col">지표</th>
                <th scope="col">실제</th>
                <th scope="col">예상</th>
                <th scope="col">이전</th>
                <th scope="col">중요도</th>
              </tr>
            </thead>
            <tbody>{bodyContent}</tbody>
          </table>
        </div>

        <footer className="ecal__footer">
          <small>Source: Trading Economics</small>
        </footer>
      </div>
    </section>
  )
}

export default EconomicCalendar
