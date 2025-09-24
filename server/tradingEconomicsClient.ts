type RawTradingEconomicsEvent = {
  CalendarId?: number | string
  Category?: string | null
  Country?: string | null
  Date?: string | null
  Event?: string | null
  Importance?: number | string | null
  Reference?: string | null
  Actual?: string | number | null
  Previous?: string | number | null
  Forecast?: string | number | null
  Source?: string | null
  Time?: string | null
  Unit?: string | null
  Updated?: string | null
  URL?: string | null
}

type TradingEconomicsCalendarEvent = {
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

type FetchCalendarOptions = {
  startDate: string
  endDate: string
  importanceLevels: number[]
}

type CalendarFetchResult = {
  events: TradingEconomicsCalendarEvent[]
  upstreamUrl: string
  cacheHit: boolean
  cacheExpiresInMs: number
}

type CacheEntry = {
  expiresAt: number
  payload: {
    events: TradingEconomicsCalendarEvent[]
    upstreamUrl: string
  }
}

const COUNTRY = 'united states'
const DEFAULT_CACHE_TTL_MS = 60_000
const MAX_CACHE_ENTRIES = 32
const cache = new Map<string, CacheEntry>()

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const parsePositiveInteger = (raw: string | undefined): number | null => {
  if (!raw) {
    return null
  }
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value) || value <= 0) {
    return null
  }
  return value
}

const resolveCacheTtl = () => {
  const fromMs = parsePositiveInteger(process.env.TRADING_ECONOMICS_CACHE_TTL_MS)
  if (fromMs) {
    return clamp(fromMs, 5_000, 10 * 60_000)
  }

  const fromSeconds = parsePositiveInteger(process.env.TRADING_ECONOMICS_CACHE_TTL_SECONDS)
  if (fromSeconds) {
    return clamp(fromSeconds * 1000, 5_000, 10 * 60_000)
  }

  return DEFAULT_CACHE_TTL_MS
}

const CACHE_TTL_MS = resolveCacheTtl()

const getApiCredential = () => {
  const direct = process.env.TRADING_ECONOMICS_API_KEY ?? process.env.TRADING_ECONOMICS_KEY
  const trimmed = direct?.trim()
  if (trimmed) {
    return trimmed
  }
  return 'guest:guest'
}

const getApiBaseUrl = () => {
  const fromEnv = process.env.TRADING_ECONOMICS_API_BASE_URL ?? process.env.TRADING_ECONOMICS_BASE_URL
  const trimmed = fromEnv?.trim()
  if (trimmed) {
    return trimmed.endsWith('/') ? trimmed : `${trimmed}/`
  }
  return 'https://api.tradingeconomics.com/'
}

const normalizeTime = (raw: string | null | undefined) => {
  if (!raw) {
    return null
  }

  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (match) {
    const hours = match[1].padStart(2, '0')
    const minutes = match[2]
    const seconds = match[3] ?? '00'
    return `${hours}:${minutes}:${seconds}`
  }

  return trimmed
}

const parseDateTime = (rawDate: string | null | undefined, rawTime: string | null | undefined) => {
  if (!rawDate) {
    return null
  }

  const trimmedDate = rawDate.trim()
  if (!trimmedDate) {
    return null
  }

  const datePart = trimmedDate.includes('T') ? trimmedDate.split('T')[0] ?? trimmedDate : trimmedDate
  const normalizedTime = normalizeTime(rawTime)

  const candidates: string[] = []
  if (normalizedTime) {
    candidates.push(`${datePart}T${normalizedTime}`)
  }
  candidates.push(trimmedDate)

  for (const candidate of candidates) {
    const parsed = new Date(candidate)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
  }

  const fallback = new Date(datePart)
  if (!Number.isNaN(fallback.getTime())) {
    return fallback.toISOString()
  }

  return null
}

const sanitizeValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null
    }
    return value.toString()
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const lowered = trimmed.toLowerCase()
  if (['n/a', 'na', 'tba', 'tentative', '-', '--', ''].includes(lowered)) {
    return null
  }

  return trimmed
}

const mapImportanceLabel = (importance: number | string | null | undefined): {
  value: 1 | 2 | 3 | null
  label: 'High' | 'Medium' | 'Low' | 'None'
} => {
  if (importance === null || importance === undefined) {
    return { value: null, label: 'None' }
  }

  const numeric = typeof importance === 'string' ? Number.parseInt(importance, 10) : importance
  if (numeric >= 3) {
    return { value: 3, label: 'High' }
  }

  if (numeric === 2) {
    return { value: 2, label: 'Medium' }
  }

  if (numeric === 1) {
    return { value: 1, label: 'Low' }
  }

  return { value: null, label: 'None' }
}

const buildCalendarUrl = (options: FetchCalendarOptions) => {
  const base = getApiBaseUrl()
  const pathSegments = [
    'calendar',
    'country',
    encodeURIComponent(COUNTRY),
    options.startDate,
    options.endDate,
  ]
  const url = new URL(pathSegments.join('/'), base)
  const credential = getApiCredential()

  url.searchParams.set('c', credential)
  url.searchParams.set('format', 'json')

  if (options.importanceLevels.length > 0) {
    const normalized = [...new Set(options.importanceLevels.filter((level) => level >= 1 && level <= 3))]
    if (normalized.length > 0) {
      url.searchParams.set('importance', normalized.join(','))
    }
  }

  return url
}

const cleanupCache = () => {
  const now = Date.now()
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(key)
    }
  }

  if (cache.size <= MAX_CACHE_ENTRIES) {
    return
  }

  const overflow = cache.size - MAX_CACHE_ENTRIES
  if (overflow <= 0) {
    return
  }

  const keysToRemove: string[] = []
  const iterator = cache.keys()
  for (let i = 0; i < overflow; i += 1) {
    const next = iterator.next()
    if (next.done) {
      break
    }
    keysToRemove.push(next.value)
  }

  for (const key of keysToRemove) {
    cache.delete(key)
  }
}

const getCacheKey = (options: FetchCalendarOptions) =>
  JSON.stringify({
    start: options.startDate,
    end: options.endDate,
    importance: [...options.importanceLevels].sort(),
  })

const fetchWithTimeout = async (input: URL, init?: RequestInit, timeoutMs = 10_000) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    })
    return response
  } finally {
    clearTimeout(timeout)
  }
}

const fetchTradingEconomicsCalendar = async (
  options: FetchCalendarOptions,
): Promise<CalendarFetchResult> => {
  cleanupCache()

  const cacheKey = getCacheKey(options)
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return {
      events: cached.payload.events,
      upstreamUrl: cached.payload.upstreamUrl,
      cacheHit: true,
      cacheExpiresInMs: cached.expiresAt - Date.now(),
    }
  }

  const url = buildCalendarUrl(options)

  const response = await fetchWithTimeout(url, undefined, 12_000)
  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(
      `Trading Economics API 요청이 실패했습니다. (status=${response.status}) ${errorBody || ''}`.trim(),
    )
  }

  const rawData = (await response.json()) as unknown

  if (!Array.isArray(rawData)) {
    throw new Error('Trading Economics API 응답 형식이 올바르지 않습니다.')
  }

  const normalized: TradingEconomicsCalendarEvent[] = []
  for (const item of rawData as RawTradingEconomicsEvent[]) {
    const { label, value } = mapImportanceLabel(item.Importance ?? null)

    const datetime = parseDateTime(item.Date ?? null, item.Time ?? null)
    if (!datetime) {
      continue
    }

    const title = sanitizeValue(item.Event ?? item.Category ?? null) ?? '미정 지표'

    normalized.push({
      id:
        item.CalendarId !== null && item.CalendarId !== undefined
          ? String(item.CalendarId)
          : `${title}-${datetime}`,
      title,
      category: sanitizeValue(item.Category ?? null),
      country: sanitizeValue(item.Country ?? null),
      datetime,
      importance: label,
      importanceValue: value,
      actual: sanitizeValue(item.Actual ?? null),
      previous: sanitizeValue(item.Previous ?? null),
      forecast: sanitizeValue(item.Forecast ?? null),
      reference: sanitizeValue(item.Reference ?? null),
      source: sanitizeValue(item.Source ?? null),
      unit: sanitizeValue(item.Unit ?? null),
      updatedAt: sanitizeValue(item.Updated ?? null),
      url: sanitizeValue(item.URL ?? null),
    })
  }

  normalized.sort((a, b) => (a.datetime < b.datetime ? -1 : a.datetime > b.datetime ? 1 : 0))

  const payload = { events: normalized, upstreamUrl: url.toString() }
  const expiresAt = Date.now() + CACHE_TTL_MS
  cache.set(cacheKey, { expiresAt, payload })

  return {
    events: normalized,
    upstreamUrl: url.toString(),
    cacheHit: false,
    cacheExpiresInMs: CACHE_TTL_MS,
  }
}

export {
  fetchTradingEconomicsCalendar,
  mapImportanceLabel,
}
export type {
  CalendarFetchResult,
  FetchCalendarOptions,
  RawTradingEconomicsEvent,
  TradingEconomicsCalendarEvent,
}
