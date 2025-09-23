import { useEffect, useMemo, useState } from 'react'
import { fetchWithProxies } from '../utils/proxyFetch'

type FearGreedEntry = {
  value: number
  classification: string
  timestamp: Date
}

type Tone = 'extreme-greed' | 'greed' | 'neutral' | 'fear' | 'extreme-fear'

type FearGreedIndexProps = {
  className?: string
}

const classificationMap: Record<string, { label: string; tone: Tone }> = {
  'extreme greed': { label: '극단적 탐욕', tone: 'extreme-greed' },
  greed: { label: '탐욕', tone: 'greed' },
  neutral: { label: '중립', tone: 'neutral' },
  fear: { label: '공포', tone: 'fear' },
  'extreme fear': { label: '극단적 공포', tone: 'extreme-fear' },
}

const toneColors: Record<Tone, { stroke: string; fill: string }> = {
  'extreme-greed': { stroke: '#22c55e', fill: 'rgba(34, 197, 94, 0.15)' },
  greed: { stroke: '#84cc16', fill: 'rgba(132, 204, 22, 0.16)' },
  neutral: { stroke: '#38bdf8', fill: 'rgba(56, 189, 248, 0.18)' },
  fear: { stroke: '#f97316', fill: 'rgba(249, 115, 22, 0.18)' },
  'extreme-fear': { stroke: '#f87171', fill: 'rgba(248, 113, 113, 0.18)' },
}

const chartConfig = {
  width: 280,
  height: 120,
  paddingX: 12,
  paddingY: 10,
}

const formatUpdatedAt = (value: Date | null) => {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

const resolveTone = (entry: FearGreedEntry | null): { label: string; tone: Tone } => {
  if (!entry) {
    return { label: '데이터 없음', tone: 'neutral' }
  }

  const mapped = classificationMap[entry.classification.toLowerCase()]
  if (mapped) {
    return mapped
  }

  if (entry.value >= 75) {
    return { label: '극단적 탐욕', tone: 'extreme-greed' }
  }
  if (entry.value >= 55) {
    return { label: '탐욕', tone: 'greed' }
  }
  if (entry.value > 45) {
    return { label: '중립', tone: 'neutral' }
  }
  if (entry.value > 25) {
    return { label: '공포', tone: 'fear' }
  }
  return { label: '극단적 공포', tone: 'extreme-fear' }
}

const buildChartPaths = (history: FearGreedEntry[]) => {
  if (history.length === 0) {
    return { linePath: '', areaPath: '', latestPoint: null, baselineY: chartConfig.height - chartConfig.paddingY }
  }

  const ascending = [...history].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  )
  const points = ascending.map((entry, index) => {
    const ratio = ascending.length > 1 ? index / (ascending.length - 1) : 0.5
    const x = chartConfig.paddingX + ratio * (chartConfig.width - chartConfig.paddingX * 2)
    const clampedValue = Math.min(100, Math.max(0, entry.value))
    const yRange = chartConfig.height - chartConfig.paddingY * 2
    const y = chartConfig.height - chartConfig.paddingY - (clampedValue / 100) * yRange
    return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) }
  })

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
    .join(' ')

  const baselineY = chartConfig.height - chartConfig.paddingY
  const areaPath = `${points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
    .join(' ')} L${points[points.length - 1].x},${baselineY} L${points[0].x},${baselineY} Z`

  return { linePath, areaPath, latestPoint: points[points.length - 1], baselineY }
}

const parseFearGreedResponse = (payload: unknown): FearGreedEntry[] => {
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    return []
  }

  const entries = Array.isArray((payload as { data?: unknown }).data)
    ? ((payload as { data: unknown[] }).data as Array<{
        value?: string
        value_classification?: string
        timestamp?: string | number
      }>)
    : []

  return entries
    .map((item) => {
      const value = typeof item.value === 'string' ? Number.parseFloat(item.value) : Number(item.value)
      if (!Number.isFinite(value)) {
        return null
      }

      const timestampSource = item.timestamp
      const numericTimestamp =
        typeof timestampSource === 'number'
          ? timestampSource
          : typeof timestampSource === 'string'
            ? Number.parseInt(timestampSource, 10)
            : NaN

      const timestamp = Number.isFinite(numericTimestamp)
        ? new Date(numericTimestamp * 1000)
        : new Date(typeof timestampSource === 'string' ? timestampSource : '')

      if (Number.isNaN(timestamp.getTime())) {
        return null
      }

      const classification =
        typeof item.value_classification === 'string' && item.value_classification.trim().length > 0
          ? item.value_classification.trim()
          : 'Neutral'

      return {
        value,
        classification,
        timestamp,
      }
    })
    .filter((entry): entry is FearGreedEntry => Boolean(entry))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

const fetchFearGreedHistory = async (): Promise<FearGreedEntry[]> => {
  const url = new URL('https://api.alternative.me/fng/')
  url.searchParams.set('limit', '30')
  url.searchParams.set('format', 'json')

  const response = await fetchWithProxies(url)
  if (!response.ok) {
    throw new Error('Fear & Greed Index 응답 오류')
  }

  const payload = await response.json()
  return parseFearGreedResponse(payload)
}

const FearGreedIndex = ({ className }: FearGreedIndexProps) => {
  const [history, setHistory] = useState<FearGreedEntry[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading')

  useEffect(() => {
    let active = true

    const loadHistory = async (showLoading = false) => {
      if (showLoading) {
        setStatus('loading')
      }

      try {
        const entries = await fetchFearGreedHistory()
        if (!active) {
          return
        }

        if (entries.length === 0) {
          setHistory([])
          setStatus('error')
          return
        }

        setHistory(entries)
        setStatus('idle')
      } catch (error) {
        console.error('Fear & Greed Index 로딩 실패', error)
        if (!active) {
          return
        }

        setStatus('error')
      }
    }

    loadHistory(true)
    const interval = window.setInterval(() => loadHistory(false), 10 * 60_000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  const latestEntry = history[0] ?? null
  const previousEntry = history[1] ?? null
  const delta = useMemo(() => {
    if (!latestEntry || !previousEntry) {
      return null
    }

    const diff = latestEntry.value - previousEntry.value
    if (!Number.isFinite(diff)) {
      return null
    }

    return Number(diff.toFixed(1))
  }, [latestEntry, previousEntry])

  const sentiment = resolveTone(latestEntry)
  const colors = toneColors[sentiment.tone]

  const chartMetrics = useMemo(() => buildChartPaths(history), [history])
  const gradientId = useMemo(
    () => `fearGreedGradient-${Math.random().toString(36).slice(2, 9)}`,
    []
  )

  const deltaLabel = delta === null ? null : `${delta > 0 ? '+' : delta < 0 ? '' : ''}${delta}`
  const deltaClass = delta === null ? null : delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral'
  const deltaSymbol = delta === null ? null : delta > 0 ? '▲' : delta < 0 ? '▼' : '―'

  const containerClassName = className
    ? `fear-greed-card ${className}`
    : 'fear-greed-card'

  return (
    <aside className={containerClassName} aria-live="polite">
      <div className="fear-greed-header">
        <div>
          <span className="fear-greed-title">미국 증시 공포·탐욕 지수</span>
          <div className="fear-greed-value-row">
            <strong className="fear-greed-value">{latestEntry ? latestEntry.value : '-'}</strong>
            <span className={`fear-greed-badge ${sentiment.tone}`}>{sentiment.label}</span>
          </div>
        </div>
        {deltaLabel && deltaSymbol && deltaClass && (
          <span className={`fear-greed-delta ${deltaClass}`}>
            {deltaSymbol} {deltaLabel}
          </span>
        )}
      </div>

      {status === 'loading' ? (
        <div className="fear-greed-status">지수를 불러오는 중입니다...</div>
      ) : status === 'error' ? (
        <div className="fear-greed-status">지수 데이터를 불러오지 못했습니다.</div>
      ) : (
        <>
          <div className="fear-greed-chart" aria-hidden="true">
            <svg
              viewBox={`0 0 ${chartConfig.width} ${chartConfig.height}`}
              role="img"
              focusable="false"
            >
              <defs>
                <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={colors.stroke} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={colors.stroke} stopOpacity="0" />
                </linearGradient>
              </defs>
              {[25, 50, 75].map((mark) => {
                const y =
                  chartConfig.height -
                  chartConfig.paddingY -
                  (mark / 100) * (chartConfig.height - chartConfig.paddingY * 2)
                return (
                  <line
                    key={mark}
                    x1={chartConfig.paddingX}
                    x2={chartConfig.width - chartConfig.paddingX}
                    y1={y}
                    y2={y}
                    className="fear-greed-grid"
                  />
                )
              })}
              {chartMetrics.areaPath && (
                <path
                  d={chartMetrics.areaPath}
                  fill={`url(#${gradientId})`}
                  className="fear-greed-area"
                />
              )}
              {chartMetrics.linePath && (
                <path
                  d={chartMetrics.linePath}
                  stroke={colors.stroke}
                  className="fear-greed-line"
                />
              )}
              {chartMetrics.latestPoint && (
                <circle
                  cx={chartMetrics.latestPoint.x}
                  cy={chartMetrics.latestPoint.y}
                  r={4}
                  fill={colors.stroke}
                  className="fear-greed-dot"
                />
              )}
              <line
                x1={chartConfig.paddingX}
                x2={chartConfig.width - chartConfig.paddingX}
                y1={chartMetrics.baselineY}
                y2={chartMetrics.baselineY}
                className="fear-greed-baseline"
              />
            </svg>
          </div>
          <div className="fear-greed-scale">
            <span>0 공포</span>
            <span>50 중립</span>
            <span>100 탐욕</span>
          </div>
        </>
      )}

      <div className="fear-greed-meta">
        <span>업데이트: {formatUpdatedAt(latestEntry?.timestamp ?? null)}</span>
        <span>지난 30일 추세</span>
      </div>
    </aside>
  )
}

export default FearGreedIndex
