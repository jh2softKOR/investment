const disabledValues = new Set(['0', 'false', 'off', 'no', 'disabled'])
const enabledValues = new Set(['1', 'true', 'on', 'yes', 'enabled'])

const parseBooleanFlag = (raw: string | undefined | null): boolean | null => {
  if (raw === null || raw === undefined) {
    return null
  }

  const normalized = raw.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (disabledValues.has(normalized)) {
    return false
  }

  if (enabledValues.has(normalized)) {
    return true
  }

  return null
}

const defaultLiveFallback = (() => {
  const explicitDefault = parseBooleanFlag(import.meta.env.VITE_DEFAULT_LIVE_DATA)
  if (explicitDefault !== null) {
    return explicitDefault
  }

  return true
})()

const resolveLiveDataFlag = (raw: string | undefined, fallback: boolean): boolean => {
  const parsed = parseBooleanFlag(raw)
  if (parsed !== null) {
    return parsed
  }

  return fallback
}

const shouldUseLiveMarketData = () =>
  resolveLiveDataFlag(import.meta.env.VITE_ENABLE_LIVE_MARKET_DATA, defaultLiveFallback)

const shouldUseLiveTickerData = () => {
  const explicit = parseBooleanFlag(import.meta.env.VITE_ENABLE_LIVE_TICKER_DATA)
  if (explicit !== null) {
    return explicit
  }

  return shouldUseLiveMarketData()
}

const shouldUseLiveNewsData = () =>
  resolveLiveDataFlag(import.meta.env.VITE_ENABLE_LIVE_NEWS_DATA, defaultLiveFallback)

const shouldUseLiveCalendarData = () =>
  resolveLiveDataFlag(import.meta.env.VITE_ENABLE_LIVE_CALENDAR_DATA, defaultLiveFallback)

const shouldUseLiveSentimentData = () =>
  resolveLiveDataFlag(import.meta.env.VITE_ENABLE_LIVE_SENTIMENT_DATA, defaultLiveFallback)

export {
  shouldUseLiveCalendarData,
  shouldUseLiveMarketData,
  shouldUseLiveNewsData,
  shouldUseLiveSentimentData,
  shouldUseLiveTickerData,
}
