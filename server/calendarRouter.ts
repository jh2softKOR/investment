import { Router } from 'express'
import { fetchTradingEconomicsCalendar, mapImportanceLabel } from './tradingEconomicsClient'

class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const MIN_WINDOW_DAYS = 1
const MAX_WINDOW_DAYS = 31
const DEFAULT_WINDOW_DAYS = 7

const parseScope = (raw: unknown): 'upcoming' | 'previous' | 'range' => {
  if (typeof raw !== 'string') {
    return 'upcoming'
  }

  const normalized = raw.trim().toLowerCase()
  if (normalized === 'previous' || normalized === 'past') {
    return 'previous'
  }
  if (normalized === 'range' || normalized === 'all') {
    return 'range'
  }
  return 'upcoming'
}

const parseWindowDays = (raw: unknown): number => {
  if (typeof raw !== 'string') {
    return DEFAULT_WINDOW_DAYS
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_WINDOW_DAYS
  }

  if (parsed < MIN_WINDOW_DAYS) {
    return MIN_WINDOW_DAYS
  }

  if (parsed > MAX_WINDOW_DAYS) {
    return MAX_WINDOW_DAYS
  }

  return parsed
}

const parseDateInput = (raw: unknown): Date | null => {
  if (typeof raw !== 'string') {
    return null
  }

  const trimmed = raw.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null
  }

  const [year, month, day] = trimmed.split('-').map((segment) => Number.parseInt(segment, 10))
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(parsed.getTime())) {
    return null
  }
  return parsed
}

const startOfDayUtc = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))

const addDays = (value: Date, amount: number) => {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + amount)
  return next
}

const formatDate = (value: Date) => value.toISOString().slice(0, 10)

const parseImportanceParam = (raw: unknown) => {
  if (raw === undefined || raw === null) {
    return [] as number[]
  }

  const rawParts = Array.isArray(raw) ? raw : `${raw}`.split(',')
  const normalized = new Set<number>()

  for (const part of rawParts) {
    const trimmed = part.trim()
    if (!trimmed) {
      continue
    }

    const lowered = trimmed.toLowerCase()
    if (['high', '높음', 'highly'].includes(lowered) || trimmed === '3') {
      normalized.add(3)
      continue
    }
    if (['medium', '중간', '중', 'med'].includes(lowered) || trimmed === '2') {
      normalized.add(2)
      continue
    }
    if (['low', '낮음', 'lowly'].includes(lowered) || trimmed === '1') {
      normalized.add(1)
    }
  }

  return Array.from(normalized).sort()
}

type DerivedQuery = {
  startDate: string
  endDate: string
  windowDays: number
  scope: 'upcoming' | 'previous' | 'range' | 'custom'
  importanceLevels: number[]
  rawImportance: string | null
}

const deriveQuery = (query: Record<string, unknown>): DerivedQuery => {
  const scope = parseScope(query.scope)
  const windowDays = parseWindowDays(query.window)
  const startInput = parseDateInput(query.start)
  const endInput = parseDateInput(query.end)
  const importanceLevels = parseImportanceParam(query.importance)

  let appliedScope: DerivedQuery['scope'] = scope

  const now = startOfDayUtc(new Date())

  const rangeFromInputs = () => {
    if (startInput && endInput) {
      if (startInput.getTime() > endInput.getTime()) {
        throw new HttpError(400, 'start 날짜가 end 날짜보다 늦을 수 없습니다.')
      }
      appliedScope = 'custom'
      return { start: startOfDayUtc(startInput), end: startOfDayUtc(endInput) }
    }

    if (startInput) {
      appliedScope = 'custom'
      return {
        start: startOfDayUtc(startInput),
        end: addDays(startOfDayUtc(startInput), windowDays - 1),
      }
    }

    if (endInput) {
      appliedScope = 'custom'
      return {
        start: addDays(startOfDayUtc(endInput), -(windowDays - 1)),
        end: startOfDayUtc(endInput),
      }
    }

    return null
  }

  const fromInputs = rangeFromInputs()
  if (fromInputs) {
    return {
      startDate: formatDate(fromInputs.start),
      endDate: formatDate(fromInputs.end),
      windowDays,
      scope: appliedScope,
      importanceLevels,
      rawImportance: typeof query.importance === 'string' ? query.importance : null,
    }
  }

  if (scope === 'previous') {
    const endDate = addDays(now, -1)
    const startDate = addDays(endDate, -(windowDays - 1))
    return {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      windowDays,
      scope,
      importanceLevels,
      rawImportance: typeof query.importance === 'string' ? query.importance : null,
    }
  }

  if (scope === 'range') {
    const half = Math.floor(windowDays / 2)
    const startDate = addDays(now, -half)
    const endDate = addDays(startDate, windowDays - 1)
    return {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      windowDays,
      scope,
      importanceLevels,
      rawImportance: typeof query.importance === 'string' ? query.importance : null,
    }
  }

  const startDate = now
  const endDate = addDays(now, windowDays - 1)
  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    windowDays,
    scope,
    importanceLevels,
    rawImportance: typeof query.importance === 'string' ? query.importance : null,
  }
}

const calendarRouter = Router()

calendarRouter.get('/', async (req, res) => {
  try {
    const derived = deriveQuery(req.query as Record<string, unknown>)

    const result = await fetchTradingEconomicsCalendar({
      startDate: derived.startDate,
      endDate: derived.endDate,
      importanceLevels: derived.importanceLevels,
    })

    const importanceLabels =
      derived.importanceLevels.length > 0
        ? derived.importanceLevels.map((level) => mapImportanceLabel(level).label)
        : ['High', 'Medium', 'Low']

    res.json({
      meta: {
        source: 'Trading Economics',
        country: 'United States',
        scope: derived.scope,
        startDate: derived.startDate,
        endDate: derived.endDate,
        windowDays: derived.windowDays,
        importanceLevels: derived.importanceLevels,
        importanceLabels,
        requestedAt: new Date().toISOString(),
        cache: {
          hit: result.cacheHit,
          ttlSeconds: Math.round(result.cacheExpiresInMs / 1000),
        },
        upstream: {
          url: result.upstreamUrl,
          importance: derived.rawImportance,
        },
      },
      events: result.events,
    })
  } catch (error) {
    console.error('Trading Economics 캘린더 데이터를 불러오는 데 실패했습니다.', error)
    const status = error instanceof HttpError ? error.status : 502
    const message = error instanceof Error ? error.message : '요청을 처리할 수 없습니다.'
    res.status(status).json({
      error: message,
    })
  }
})

export default calendarRouter
