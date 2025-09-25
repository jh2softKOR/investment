import { useEffect, useMemo, useState } from 'react'

type RangeOption = 'day' | 'week'
type ImportanceOption = 'high' | 'medium' | 'low'

type CalendarApiEvent = {
  id: string
  title: string
  category: string | null
  country: string | null
  datetime: string
  importance: 'High' | 'Medium' | 'Low' | 'None'
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

type CalendarApiMeta = {
  source?: string
  startDate?: string
  endDate?: string
  requestedAt?: string
  importanceLabels?: string[]
  cache?: { hit?: boolean }
}

type CalendarApiResponse = {
  meta?: CalendarApiMeta
  events?: CalendarApiEvent[]
}

type CalendarMeta = {
  source: string
  startDate: string
  endDate: string
  requestedAt: string
  importanceLabels: string[]
  cacheHit: boolean
}

type CalendarRow = {
  id: string
  timeLabel: string
  title: string
  url: string | null
  details: string[]
  actual: string
  actualTone: 'up' | 'down' | null
  forecast: string
  previous: string
  importanceValue: 0 | 1 | 2 | 3
  importanceLabel: string
}

const TZ_OFFSET = 9
const API_ENDPOINT = '/api/trading-economics/calendar'

const importanceOptions: { value: ImportanceOption; label: string }[] = [
  { value: 'high', label: '높음' },
  { value: 'medium', label: '보통' },
  { value: 'low', label: '낮음' },
]

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

const toKSTDate = (iso?: string | null) => {
  if (!iso) return null
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return null
  return new Date(parsed.getTime() + TZ_OFFSET * 60 * 60 * 1000)
}

const formatKSTLabel = (iso?: string | null) => {
  const date = toKSTDate(iso)
  if (!date) return '—'

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${month}/${day} ${hours}:${minutes}`
}

const formatMetaTimestamp = (iso?: string | null) => {
  const label = formatKSTLabel(iso ?? undefined)
  return label === '—' ? '—' : `${label} KST`
}

const formatDateRange = (start?: string | null, end?: string | null) => {
  if (!start || !end) return '—'
  return `${start} ~ ${end}`
}

const toNullable = (value?: string | number | null) => {
  if (value === null || value === undefined) return null
  const text = typeof value === 'number' ? value.toString() : value
  const trimmed = text.trim()
  if (!trimmed || trimmed.toLowerCase() === 'null') return null
  return trimmed
}

const translateImportance = (label?: string | null) => {
  switch ((label ?? '').toLowerCase()) {
    case 'high':
      return '높음'
    case 'medium':
      return '보통'
    case 'low':
      return '낮음'
    default:
      return '정보없음'
  }
}

const normalizeImportanceValue = (value?: number | null, label?: string | null): 0 | 1 | 2 | 3 => {
  if (value === 3) return 3
  if (value === 2) return 2
  if (value === 1) return 1

  const lowered = (label ?? '').toLowerCase()
  if (lowered === 'high') return 3
  if (lowered === 'medium') return 2
  if (lowered === 'low') return 1
  return 0
}

const pillClass = (importance: number | null | undefined) => {
  if (importance && importance >= 3) return 'pill pill--high'
  if (importance === 2) return 'pill pill--med'
  if (importance === 1) return 'pill pill--low'
  return 'pill pill--none'
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
  const [importanceFilter, setImportanceFilter] = useState<ImportanceOption[]>(['high'])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<CalendarRow[]>([])
  const [meta, setMeta] = useState<CalendarMeta | null>(null)
  const [refreshIndex, setRefreshIndex] = useState(0)

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()
    const { d1, d2 } = getRange(range)

    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      start: d1,
      end: d2,
      scope: 'custom',
      window: range === 'day' ? '1' : '7',
    })

    if (importanceFilter.length > 0 && importanceFilter.length < importanceOptions.length) {
      params.set('importance', importanceFilter.join(','))
    }

    const fetchCalendar = async () => {
      try {
        const response = await fetch(`${API_ENDPOINT}?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const payload = (await response.json()) as CalendarApiResponse

        if (!isActive) return

        const calendarEvents = Array.isArray(payload.events) ? payload.events : []
        const rows = calendarEvents.map<CalendarRow>((event) => {
          const timeLabel = formatKSTLabel(event.datetime)
          const actual = sanitize(event.actual)
          const forecast = sanitize(event.forecast)
          const previous = sanitize(event.previous)
          const importanceValue = normalizeImportanceValue(event.importanceValue, event.importance)
          const category = toNullable(event.category)
          const reference = toNullable(event.reference)
          const unit = toNullable(event.unit)
          const source = toNullable(event.source)
          const updatedAt = toNullable(event.updatedAt)
          const updatedAtLabelRaw = updatedAt ? formatKSTLabel(updatedAt) : null
          const updatedAtLabel = updatedAtLabelRaw && updatedAtLabelRaw !== '—' ? updatedAtLabelRaw : null
          const url = toNullable(event.url)

          const details = [
            category ?? null,
            reference ? `기준 ${reference}` : null,
            unit ? `단위 ${unit}` : null,
            source ? `출처 ${source}` : null,
            updatedAtLabel ? `갱신 ${updatedAtLabel}` : null,
          ].filter((item): item is string => item !== null)

          return {
            id: event.id,
            timeLabel,
            title: sanitize(event.title),
            url: url ?? null,
            details,
            actual,
            actualTone: detectTone(actual),
            forecast,
            previous,
            importanceValue,
            importanceLabel: translateImportance(event.importance),
          }
        })

        setEvents(rows)

        const metaPayload = payload.meta ?? {}
        setMeta({
          source: metaPayload.source ?? 'Trading Economics',
          startDate: metaPayload.startDate ?? d1,
          endDate: metaPayload.endDate ?? d2,
          requestedAt: metaPayload.requestedAt ?? new Date().toISOString(),
          importanceLabels: metaPayload.importanceLabels ?? [],
          cacheHit: Boolean(metaPayload.cache?.hit),
        })
      } catch (err) {
        if (!isActive || controller.signal.aborted) {
          return
        }
        if (err instanceof Error) {
          setError(err.message.includes('Failed to fetch') ? '서버에 연결할 수 없습니다. 백엔드 프록시가 실행 중인지 확인해주세요.' : err.message)
        } else {
          setError('알 수 없는 오류가 발생했습니다.')
        }
        setEvents([])
        setMeta(null)
      } finally {
        if (isActive) {
          setLoading(false)
        }
      }
    }

    fetchCalendar()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [range, importanceFilter, refreshIndex])

  const toggleImportance = (value: ImportanceOption) => {
    setImportanceFilter((prev) => {
      const exists = prev.includes(value)
      if (exists) {
        return prev.filter((item) => item !== value)
      }
      const next = [...prev, value]
      const ordered = importanceOptions
        .map((option) => option.value)
        .filter((option) => next.includes(option))
      return ordered
    })
  }

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
        <td>
          <div className="ecal__title">
            {event.url ? (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ecal__title-link"
              >
                {event.title}
              </a>
            ) : (
              <span className="ecal__title-text">{event.title}</span>
            )}
            {event.details.length > 0 && (
              <div className="ecal__title-meta">
                {event.details.map((detail, index) => (
                  <span key={`${event.id}-detail-${index}`}>{detail}</span>
                ))}
              </div>
            )}
          </div>
        </td>
        <td className={event.actualTone ? `ecal__value ${event.actualTone}` : undefined}>{event.actual}</td>
        <td>{event.forecast}</td>
        <td>{event.previous}</td>
        <td>
          <span className={pillClass(event.importanceValue)}>
            {event.importanceLabel}
          </span>
        </td>
      </tr>
    ))
  }, [events, error, loading])

  const metaImportanceSummary = useMemo(() => {
    if (!meta || meta.importanceLabels.length === 0) {
      return importanceFilter.length === 0 || importanceFilter.length === importanceOptions.length
        ? '전체'
        : importanceFilter
            .map((option) => importanceOptions.find((item) => item.value === option)?.label ?? option)
            .join(', ')
    }
    return meta.importanceLabels.map((label) => translateImportance(label)).join(', ')
  }, [importanceFilter, meta])

  return (
    <section className="calendar-widget-card" aria-labelledby="economic-calendar-heading">
      <div className="ecal" id="usd-calendar">
        <header className="ecal__header">
          <div className="ecal__heading">
            <h2 id="economic-calendar-heading">미국 경제지표 캘린더</h2>
            <div className="ecal__meta" aria-live="polite">
              <span>조회 기간: {formatDateRange(meta?.startDate, meta?.endDate)}</span>
              <span>중요도: {metaImportanceSummary}</span>
              <span>갱신: {formatMetaTimestamp(meta?.requestedAt)}</span>
              {meta?.cacheHit ? <span>데이터 소스 캐시 사용</span> : null}
            </div>
          </div>
          <div className="ecal__controls">
            <div className="ecal__filters" role="group" aria-label="중요도 필터">
              {importanceOptions.map((option) => {
                const isActive = importanceFilter.includes(option.value)
                return (
                  <button
                    key={option.value}
                    type="button"
                    className="ecal__filter-btn"
                    aria-pressed={isActive}
                    onClick={() => toggleImportance(option.value)}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
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
          <small>
            Source: {meta?.source ?? 'Trading Economics'} · 조회 기간 {formatDateRange(meta?.startDate, meta?.endDate)} ·{' '}
            {meta?.cacheHit ? '캐시 데이터 기반' : '실시간 요청'} · 기준 시각 {formatMetaTimestamp(meta?.requestedAt)}
          </small>
        </footer>
      </div>
    </section>
  )
}

export default EconomicCalendar
