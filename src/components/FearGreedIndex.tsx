import { useEffect, useMemo, useState } from 'react'
import { fetchWithProxies } from '../utils/proxyFetch'
import { parseNumericValue } from '../utils/marketData'
import {
  fallbackFearGreedNotice,
  getFallbackFearGreedHistory,
} from '../utils/fallbackData'
import { shouldUseLiveSentimentData } from '../utils/liveDataFlags'

type FearGreedEntry = {
  value: number
  classification: string
  timestamp: Date
}

type Tone = 'extreme-greed' | 'greed' | 'neutral' | 'fear' | 'extreme-fear'

type FearGreedVariant = 'us-market' | 'crypto'

type FearGreedIndexProps = {
  className?: string
  variant?: FearGreedVariant
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

const variantMetadata: Record<
  FearGreedVariant,
  { title: string; subtitle: string; sourceNote: string }
> = {
  'us-market': {
    title: '미국 증시 공포·탐욕 지수',
    subtitle: 'CNN Business Fear & Greed Index',
    sourceNote: '데이터 출처: CNN Business · 주식시장 투자심리 지수',
  },
  crypto: {
    title: '코인 공포·탐욕 지수',
    subtitle: 'Alternative.me Crypto Fear & Greed Index',
    sourceNote: '데이터 출처: Alternative.me · 비트코인 기반 투자심리 지수',
  },
}

const chartConfig = {
  width: 280,
  height: 120,
  paddingX: 12,
  paddingY: 10,
}

const normalizeUsIndexValue = (value: number) =>
  Number.isFinite(value) ? Math.round(value) : value

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

const resolveToneByValue = (value: number): { label: string; tone: Tone } => {
  if (!Number.isFinite(value)) {
    return { label: '데이터 없음', tone: 'neutral' }
  }

  if (value >= 75) {
    return { label: '극단적 탐욕', tone: 'extreme-greed' }
  }
  if (value >= 55) {
    return { label: '탐욕', tone: 'greed' }
  }
  if (value > 45) {
    return { label: '중립', tone: 'neutral' }
  }
  if (value > 25) {
    return { label: '공포', tone: 'fear' }
  }
  return { label: '극단적 공포', tone: 'extreme-fear' }
}

const resolveTone = (entry: FearGreedEntry | null): { label: string; tone: Tone } => {
  if (!entry) {
    return { label: '데이터 없음', tone: 'neutral' }
  }

  const computed = resolveToneByValue(entry.value)
  const classificationKey = entry.classification.trim().toLowerCase()
  const mapped = classificationMap[classificationKey]

  if (mapped && mapped.tone === computed.tone) {
    return mapped
  }

  return computed
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

const parseTimestampValue = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null
    }
    const normalized = value > 1_000_000_000_000 ? value : value * 1000
    const date = new Date(normalized)
    return Number.isNaN(date.getTime()) ? null : date
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }
    if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
      const numeric = Number.parseFloat(trimmed)
      return parseTimestampValue(numeric)
    }
    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  return null
}

const parseCryptoFearGreedResponse = (payload: unknown): FearGreedEntry[] => {
  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    return []
  }

  const entries = Array.isArray((payload as { data?: unknown }).data)
    ? ((payload as { data: unknown[] }).data as Array<{
        value?: unknown
        value_classification?: string
        timestamp?: unknown
      }>)
    : []

  return entries
    .map((item) => {
      const value = parseNumericValue(item.value)
      if (value === null) {
        return null
      }

      const timestamp = parseTimestampValue(item.timestamp)
      if (!timestamp) {
        return null
      }

      const classification =
        typeof item.value_classification === 'string' && item.value_classification.trim().length > 0
          ? item.value_classification.trim()
          : resolveToneByValue(value).label

      return {
        value,
        classification,
        timestamp,
      }
    })
    .filter((entry): entry is FearGreedEntry => Boolean(entry))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}

const parseUsFearGreedResponse = (payload: unknown): FearGreedEntry[] => {
  if (!payload || typeof payload !== 'object') {
    return []
  }

  const entries: FearGreedEntry[] = []
  const addEntry = (valueRaw: unknown, ratingRaw: unknown, timestampRaw: unknown) => {
    const value = parseNumericValue(valueRaw)
    if (value === null) {
      return
    }
    const normalizedValue = normalizeUsIndexValue(value)
    const timestamp = parseTimestampValue(timestampRaw)
    if (!timestamp) {
      return
    }
    const classification =
      typeof ratingRaw === 'string' && ratingRaw.trim().length > 0
        ? ratingRaw.trim()
        : resolveToneByValue(normalizedValue).label
    entries.push({
      value: normalizedValue,
      classification,
      timestamp,
    })
  }

  const root = payload as Record<string, unknown>
  const latestSection =
    root.fear_and_greed && typeof root.fear_and_greed === 'object'
      ? (root.fear_and_greed as Record<string, unknown>)
      : null

  if (latestSection) {
    const timestampCandidate =
      latestSection.timestamp ??
      latestSection.last_updated ??
      latestSection.last_update ??
      latestSection.updated ??
      Date.now()

    addEntry(latestSection.score, latestSection.rating, timestampCandidate)

    const previousKeys = ['previous_close', 'previous_1_week', 'previous_1_month', 'previous_1_year'] as const
    previousKeys.forEach((key) => {
      const section = latestSection[key]
      if (section && typeof section === 'object') {
        const sectionRecord = section as Record<string, unknown>
        addEntry(sectionRecord.score, sectionRecord.rating, sectionRecord.timestamp)
      }
    })
  }

  const historicalContainer =
    root.fear_and_greed_historical && typeof root.fear_and_greed_historical === 'object'
      ? (root.fear_and_greed_historical as Record<string, unknown>)
      : null

  const historicalData = Array.isArray(historicalContainer?.data)
    ? (historicalContainer!.data as Array<{ x?: unknown; y?: unknown; rating?: unknown }>)
    : []

  historicalData.forEach((item) => {
    addEntry(item.y, item.rating, item.x)
  })

  const deduplicated = new Map<number, FearGreedEntry>()
  entries.forEach((entry) => {
    const key = entry.timestamp.getTime()
    if (!Number.isFinite(key)) {
      return
    }

    const existing = deduplicated.get(key)
    if (!existing) {
      deduplicated.set(key, entry)
      return
    }

    const existingClassification = existing.classification.trim().toLowerCase()
    const incomingClassification = entry.classification.trim().toLowerCase()

    if (!existingClassification && incomingClassification) {
      deduplicated.set(key, entry)
      return
    }

    if (!classificationMap[existingClassification] && classificationMap[incomingClassification]) {
      deduplicated.set(key, entry)
    }
  })

  return Array.from(deduplicated.values()).sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  )
}

const fetchCryptoFearGreedHistory = async (): Promise<FearGreedEntry[]> => {
  const url = new URL('https://api.alternative.me/fng/')
  url.searchParams.set('limit', '30')
  url.searchParams.set('format', 'json')

  const response = await fetchWithProxies(url)
  if (!response.ok) {
    throw new Error('Crypto Fear & Greed Index 응답 오류')
  }

  const payload = await response.json()
  return parseCryptoFearGreedResponse(payload)
}

const fetchUsFearGreedHistory = async (): Promise<FearGreedEntry[]> => {
  const url = new URL('https://production.dataviz.cnn.io/index/fearandgreed/graphdata')

  const response = await fetchWithProxies(url)
  if (!response.ok) {
    throw new Error('CNN Fear & Greed Index 응답 오류')
  }

  const payload = await response.json()
  return parseUsFearGreedResponse(payload)
}

const fetchFearGreedHistory = async (variant: FearGreedVariant): Promise<FearGreedEntry[]> => {
  if (variant === 'crypto') {
    return fetchCryptoFearGreedHistory()
  }
  return fetchUsFearGreedHistory()
}

const FearGreedIndex = ({ className, variant = 'us-market' }: FearGreedIndexProps) => {
  const [history, setHistory] = useState<FearGreedEntry[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [notice, setNotice] = useState<string | null>(null)
  const useLiveSentiment = shouldUseLiveSentimentData()

  useEffect(() => {
    if (!useLiveSentiment) {
      const fallbackHistory = getFallbackFearGreedHistory(variant)
      setHistory(fallbackHistory)
      setStatus('idle')
      setNotice(fallbackHistory.length ? fallbackFearGreedNotice : null)
      return
    }

    let active = true

    const loadHistory = async (showLoading = false) => {
      if (!active) {
        return
      }

      if (showLoading) {
        setStatus('loading')
        setHistory([])
        setNotice(null)
      }

      const applyFallback = () => {
        const fallbackHistory = getFallbackFearGreedHistory(variant)
        if (fallbackHistory.length === 0) {
          setHistory([])
          setStatus('error')
          setNotice(null)
          return
        }

        setHistory(fallbackHistory)
        setStatus('idle')
        setNotice(fallbackFearGreedNotice)
      }

      try {
        const entries = await fetchFearGreedHistory(variant)
        if (!active) {
          return
        }

        if (entries.length === 0) {
          applyFallback()
          return
        }

        setHistory(entries)
        setStatus('idle')
        setNotice(null)
      } catch (error) {
        console.error(`Fear & Greed Index (${variant}) 로딩 실패`, error)
        if (!active) {
          return
        }

        applyFallback()
      }
    }

    loadHistory(true)
    const interval = window.setInterval(() => loadHistory(false), 10 * 60_000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [useLiveSentiment, variant])

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
  const officialClassificationLabel = latestEntry
    ? classificationMap[latestEntry.classification.trim().toLowerCase()]?.label ?? latestEntry.classification
    : null

  const metadata = variantMetadata[variant]
  const baseClassName = `fear-greed-card variant-${variant}`
  const containerClassName = className ? `${baseClassName} ${className}` : baseClassName

  return (
    <aside className={containerClassName} aria-live="polite">
      <div className="fear-greed-header">
        <div>
          <span className="fear-greed-title">{metadata.title}</span>
          {metadata.subtitle && (
            <span className="fear-greed-subtitle">{metadata.subtitle}</span>
          )}
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

      {notice && <p className="fear-greed-notice">{notice}</p>}

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
        <span>공식 분류: {officialClassificationLabel ?? '-'}</span>
        <span>{metadata.sourceNote}</span>
      </div>
    </aside>
  )
}

export default FearGreedIndex
