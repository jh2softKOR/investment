import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import {
  fetchFmpQuotes,
  fetchGoldSpotFromMetalsLive,
  fetchSilverSpotFromMetalsLive,
  fetchUsdKrwFromExchangeRateHost,
  fetchWtiFromStooqCsv,
  fetchYahooProxyQuotes,
  parseNumericValue,
} from '../utils/marketData'
import {
  fallbackExchangeNotice,
  fallbackGold,
  fallbackSilver,
  fallbackUsdKrw,
  fallbackWti,
} from '../utils/fallbackData'
import type { PriceInfo } from '../utils/marketData'
import { shouldUseLiveTickerData } from '../utils/liveDataFlags'

const wtiSymbol = 'CL=F' as const
const goldSymbol = 'GC=F' as const
const silverSymbol = 'SI=F' as const
const customTickerEndpoint = (import.meta.env.VITE_CUSTOM_TICKER_URL ?? '/data/custom-ticker.json')
  .trim()

type CustomTickerKey = 'usdKrw' | 'wti' | 'gold' | 'silver'

type CustomTickerEntry = {
  price?: number | string | null
  changePercent?: number | string | null
  change?: number | string | null
  previousClose?: number | string | null
}

type CustomTickerPayload = Partial<Record<CustomTickerKey, CustomTickerEntry>>

let customTickerCache: CustomTickerPayload | null = null
let customTickerFetchInFlight: Promise<CustomTickerPayload | null> | null = null
let customTickerUnavailable = false

const loadCustomTickerPayload = async (): Promise<CustomTickerPayload | null> => {
  if (!customTickerEndpoint) {
    customTickerUnavailable = true
    return null
  }

  if (customTickerCache) {
    return customTickerCache
  }

  if (customTickerUnavailable) {
    return null
  }

  if (customTickerFetchInFlight) {
    return customTickerFetchInFlight
  }

  customTickerFetchInFlight = (async () => {
    try {
      const response = await fetch(customTickerEndpoint, {
        cache: 'no-store',
        credentials: 'omit',
      })

      if (!response.ok) {
        console.warn(
          `사용자 지정 시세 (${customTickerEndpoint}) 응답 오류 (status: ${response.status})`
        )
        customTickerUnavailable = true
        return null
      }

      const data = (await response.json()) as unknown
      if (!data || typeof data !== 'object') {
        console.warn('사용자 지정 시세 데이터 구조가 올바르지 않습니다.')
        customTickerUnavailable = true
        return null
      }

      customTickerCache = data as CustomTickerPayload
      return customTickerCache
    } catch (error) {
      console.error('사용자 지정 시세 데이터 로딩 실패', error)
      return null
    } finally {
      customTickerFetchInFlight = null
    }
  })()

  const payload = await customTickerFetchInFlight
  if (!payload) {
    customTickerUnavailable = true
  }

  return payload
}

const resolveCustomTickerEntry = async (key: CustomTickerKey): Promise<PriceInfo | null> => {
  const payload = await loadCustomTickerPayload()
  if (!payload) {
    return null
  }

  const entry = payload[key]
  if (!entry || typeof entry !== 'object') {
    return null
  }

  const price = parseNumericValue(entry.price)
  let changePercent = parseNumericValue(entry.changePercent)

  if (changePercent === null) {
    const change = parseNumericValue(entry.change)
    const previousClose = parseNumericValue(entry.previousClose)

    if (change !== null && previousClose !== null && previousClose !== 0) {
      changePercent = (change / previousClose) * 100
    }
  }

  if (price === null && changePercent === null) {
    return null
  }

  return { price, changePercent }
}

const formatPrice = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return null
  }

  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    minimumFractionDigits: value >= 1000 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const formatChange = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return null
  }

  const formatted = value.toFixed(2)
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatted}%`
}

const ExchangeRateTicker = () => {
  const [rate, setRate] = useState<PriceInfo | null>(null)
  const [oil, setOil] = useState<PriceInfo | null>(null)
  const [gold, setGold] = useState<PriceInfo | null>(null)
  const [silver, setSilver] = useState<PriceInfo | null>(null)
  const [rateStatus, setRateStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [oilStatus, setOilStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [goldStatus, setGoldStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [silverStatus, setSilverStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [rateFallback, setRateFallback] = useState(false)
  const [oilFallback, setOilFallback] = useState(false)
  const [goldFallback, setGoldFallback] = useState(false)
  const [silverFallback, setSilverFallback] = useState(false)
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null)

  const fmpApiKey = import.meta.env.VITE_FMP_KEY?.trim()
  const useLiveTickerData = shouldUseLiveTickerData()

  useEffect(() => {
    if (!useLiveTickerData) {
      setRate(fallbackUsdKrw)
      setOil(fallbackWti)
      setGold(fallbackGold)
      setSilver(fallbackSilver)
      setRateStatus('idle')
      setOilStatus('idle')
      setGoldStatus('idle')
      setSilverStatus('idle')
      setRateFallback(true)
      setOilFallback(true)
      setGoldFallback(true)
      setSilverFallback(true)
      setFallbackNotice(fallbackExchangeNotice)
      return
    }

    setRateFallback(false)
    setOilFallback(false)
    setGoldFallback(false)
    setSilverFallback(false)
    setFallbackNotice(null)

    let active = true

    const hasMeaningfulInfo = (info: PriceInfo | null) =>
      Boolean(info && (info.price !== null || info.changePercent !== null))

    const applyRateFallback = () => {
      setRate(fallbackUsdKrw)
      setRateStatus('idle')
      setRateFallback(true)
    }

    type CommodityConfig = {
      symbol: string
      label: string
      fallbackInfo: PriceInfo
      setInfo: Dispatch<SetStateAction<PriceInfo | null>>
      setStatus: Dispatch<SetStateAction<'idle' | 'loading' | 'error'>>
      setFallback: Dispatch<SetStateAction<boolean>>
      fetchers: Array<{ name: string; loader: () => Promise<PriceInfo | null> }>
    }

    const resolveRate = async (
      showLoading: boolean,
      proxyQuotes: Record<string, PriceInfo> | null
    ) => {
      if (!active) {
        return
      }

      if (showLoading) {
        setRateStatus('loading')
      }

      const rateFetchers: Array<{ name: string; loader: () => Promise<PriceInfo | null> }> = [
        {
          name: 'Yahoo Finance 프록시',
          loader: async () => proxyQuotes?.[rateSymbol] ?? null,
        },
        { name: '사용자 지정 데이터', loader: () => resolveCustomTickerEntry('usdKrw') },
        { name: 'ExchangeRate.host', loader: () => fetchUsdKrwFromExchangeRateHost() },
      ]

      for (const fetcher of rateFetchers) {
        try {
          const info = await fetcher.loader()
          if (!active) {
            return
          }

          if (hasMeaningfulInfo(info)) {
            setRate(info)
            setRateStatus('idle')
            setRateFallback(false)
            return
          }

          if (info) {
            setRate(info)
          }
        } catch (error) {
          console.error(`원/달러 환율 ${fetcher.name} 로딩 실패`, error)
        }
      }

      if (!active) {
        return
      }

      setRateStatus('error')
      applyRateFallback()
    }

    const resolveCommodity = async (
      showLoading: boolean,
      config: CommodityConfig,
      proxyQuotes: Record<string, PriceInfo> | null
    ) => {
      if (!active) {
        return
      }

      if (showLoading) {
        config.setStatus('loading')
      }

      const applyCommodityFallback = () => {
        config.setInfo(config.fallbackInfo)
        config.setStatus('idle')
        config.setFallback(true)
      }

      const updateIfValid = (info: PriceInfo | null) => {
        if (!active) {
          return false
        }

        if (hasMeaningfulInfo(info)) {
          config.setInfo(info)
          config.setStatus('idle')
          config.setFallback(false)
          return true
        }

        return false
      }

      let lastAttempt: PriceInfo | null = null

      const fetchers: Array<{ name: string; loader: () => Promise<PriceInfo | null> }> = [
        {
          name: 'Yahoo Finance 프록시',
          loader: async () => proxyQuotes?.[config.symbol] ?? null,
        },
        ...config.fetchers,
      ]

      for (const fetcher of fetchers) {
        let result: PriceInfo | null = null

        try {
          result = await fetcher.loader()
        } catch (error) {
          console.error(`${config.label} ${fetcher.name} 로딩 실패`, error)
        }

        if (!active) {
          return
        }

        if (result) {
          lastAttempt = result
        }

        if (updateIfValid(result)) {
          return
        }

        const warningMessage = result
          ? `${config.label} ${fetcher.name} 데이터가 충분하지 않습니다. 추가 소스를 시도합니다.`
          : `${config.label} ${fetcher.name} 데이터를 가져오지 못했습니다. 추가 소스를 시도합니다.`
        console.warn(warningMessage)
      }

      if (!active) {
        return
      }

      if (lastAttempt) {
        config.setInfo(lastAttempt)
      }

      config.setStatus('error')
      applyCommodityFallback()
    }

    const resolveOil = (
      showLoading: boolean,
      proxyQuotes: Record<string, PriceInfo> | null
    ) =>
      resolveCommodity(showLoading, {
        symbol: wtiSymbol,
        label: '국제 유가 (WTI)',
        fallbackInfo: fallbackWti,
        setInfo: setOil,
        setStatus: setOilStatus,
        setFallback: setOilFallback,
        fetchers: [
          {
            name: '사용자 지정 데이터',
            loader: () => resolveCustomTickerEntry('wti'),
          },
          {
            name: 'Stooq CSV',
            loader: () => fetchWtiFromStooqCsv(),
          },
          {
            name: 'Financial Modeling Prep',
            loader: async () => {
              const quotes = await fetchFmpQuotes([wtiSymbol], fmpApiKey)
              return quotes[wtiSymbol] ?? null
            },
          },
        ],
      }, proxyQuotes)

    const resolveGold = (
      showLoading: boolean,
      proxyQuotes: Record<string, PriceInfo> | null
    ) =>
      resolveCommodity(showLoading, {
        symbol: goldSymbol,
        label: '국제 금 (Gold)',
        fallbackInfo: fallbackGold,
        setInfo: setGold,
        setStatus: setGoldStatus,
        setFallback: setGoldFallback,
        fetchers: [
          {
            name: '사용자 지정 데이터',
            loader: () => resolveCustomTickerEntry('gold'),
          },
          {
            name: 'Metals.live',
            loader: () => fetchGoldSpotFromMetalsLive(),
          },
          {
            name: 'Financial Modeling Prep',
            loader: async () => {
              const quotes = await fetchFmpQuotes([goldSymbol], fmpApiKey)
              return quotes[goldSymbol] ?? null
            },
          },
        ],
      }, proxyQuotes)

    const resolveSilver = (
      showLoading: boolean,
      proxyQuotes: Record<string, PriceInfo> | null
    ) =>
      resolveCommodity(showLoading, {
        symbol: silverSymbol,
        label: '국제 은 (Silver)',
        fallbackInfo: fallbackSilver,
        setInfo: setSilver,
        setStatus: setSilverStatus,
        setFallback: setSilverFallback,
        fetchers: [
          {
            name: '사용자 지정 데이터',
            loader: () => resolveCustomTickerEntry('silver'),
          },
          {
            name: 'Metals.live',
            loader: () => fetchSilverSpotFromMetalsLive(),
          },
          {
            name: 'Financial Modeling Prep',
            loader: async () => {
              const quotes = await fetchFmpQuotes([silverSymbol], fmpApiKey)
              return quotes[silverSymbol] ?? null
            },
          },
        ],
      }, proxyQuotes)

    const loadAll = async (showLoading: boolean) => {
      let proxyQuotes: Record<string, PriceInfo> | null = null

      try {
        proxyQuotes = await fetchYahooProxyQuotes()
      } catch (error) {
        console.error('Yahoo Finance 프록시 시세 로딩 실패', error)
      }

      await Promise.all([
        resolveRate(showLoading, proxyQuotes),
        resolveOil(showLoading, proxyQuotes),
        resolveGold(showLoading, proxyQuotes),
        resolveSilver(showLoading, proxyQuotes),
      ])
    }

    loadAll(true)
    const interval = window.setInterval(() => {
      void loadAll(false)
    }, 60_000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [fmpApiKey, useLiveTickerData])

  useEffect(() => {
    if (rateFallback || oilFallback || goldFallback || silverFallback) {
      setFallbackNotice(fallbackExchangeNotice)
    } else {
      setFallbackNotice(null)
    }
  }, [goldFallback, oilFallback, rateFallback, silverFallback])

  const buildTickerView = (
    info: PriceInfo | null,
    status: 'idle' | 'loading' | 'error',
    priceFormatter: (value: number | null | undefined) => string | null,
    options?: { fallbackLabel?: string | null; isFallback?: boolean }
  ) => {
    const priceLabel = priceFormatter(info?.price)
    const resolvedPriceLabel =
      priceLabel ?? (status === 'loading' ? '불러오는 중' : status === 'error' ? '수신 실패' : '데이터 없음')

    const changeLabel = formatChange(info?.changePercent)
    const changeClass = changeLabel
      ? info && info.changePercent !== null && info.changePercent !== undefined
        ? info.changePercent >= 0
          ? 'exchange-rate-change up'
          : 'exchange-rate-change down'
        : 'exchange-rate-change'
      : 'exchange-rate-change placeholder'

    const fallbackChangeLabel =
      status === 'loading' ? '불러오는 중' : status === 'error' ? '수신 실패' : '데이터 없음'

    const hintLabel = options?.isFallback
      ? options.fallbackLabel ?? '참고용'
      : null

    return { resolvedPriceLabel, changeLabel, changeClass, fallbackChangeLabel, hintLabel }
  }

  const oilFormatter = (value: number | null | undefined) => {
    if (value === null || value === undefined) {
      return null
    }

    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const rateView = buildTickerView(rate, rateStatus, formatPrice, {
    isFallback: rateFallback,
    fallbackLabel: '참고용',
  })
  const goldView = buildTickerView(gold, goldStatus, oilFormatter, {
    isFallback: goldFallback,
    fallbackLabel: '참고용',
  })
  const silverView = buildTickerView(silver, silverStatus, oilFormatter, {
    isFallback: silverFallback,
    fallbackLabel: '참고용',
  })
  const oilView = buildTickerView(oil, oilStatus, oilFormatter, {
    isFallback: oilFallback,
    fallbackLabel: '참고용',
  })

  const tickerStatuses = [rateStatus, oilStatus, goldStatus, silverStatus]
  const containerState = tickerStatuses.some((status) => status === 'loading')
    ? 'loading'
    : tickerStatuses.every((status) => status === 'error')
      ? 'error'
      : 'idle'

  return (
    <div className="exchange-rate-ticker" aria-live="polite" data-state={containerState}>
      <div className="exchange-rate-row">
        <span className="exchange-rate-title">국제 금 (Gold)</span>
        <span aria-hidden="true" className="exchange-rate-separator">
          ·
        </span>
        <span className="exchange-rate-value">{goldView.resolvedPriceLabel}</span>
        {goldView.changeLabel ? (
          <span className={goldView.changeClass}>{goldView.changeLabel}</span>
        ) : (
          <span className={goldView.changeClass}>{goldView.fallbackChangeLabel}</span>
        )}
        {goldView.hintLabel && <span className="exchange-rate-hint">{goldView.hintLabel}</span>}
        <span className="visually-hidden">Metals.live Gold · 1분 간격 자동 갱신</span>
      </div>

      <div className="exchange-rate-row">
        <span className="exchange-rate-title">국제 은 (Silver)</span>
        <span aria-hidden="true" className="exchange-rate-separator">
          ·
        </span>
        <span className="exchange-rate-value">{silverView.resolvedPriceLabel}</span>
        {silverView.changeLabel ? (
          <span className={silverView.changeClass}>{silverView.changeLabel}</span>
        ) : (
          <span className={silverView.changeClass}>{silverView.fallbackChangeLabel}</span>
        )}
        {silverView.hintLabel && <span className="exchange-rate-hint">{silverView.hintLabel}</span>}
        <span className="visually-hidden">Metals.live Silver · 1분 간격 자동 갱신</span>
      </div>

      <div className="exchange-rate-row">
        <span className="exchange-rate-title">국제 유가 (WTI)</span>
        <span aria-hidden="true" className="exchange-rate-separator">
          ·
        </span>
        <span className="exchange-rate-value">{oilView.resolvedPriceLabel}</span>
        {oilView.changeLabel ? (
          <span className={oilView.changeClass}>{oilView.changeLabel}</span>
        ) : (
          <span className={oilView.changeClass}>{oilView.fallbackChangeLabel}</span>
        )}
        {oilView.hintLabel && <span className="exchange-rate-hint">{oilView.hintLabel}</span>}
        <span className="visually-hidden">WTI Stooq CSV · 1분 간격 자동 갱신</span>
      </div>

      <div className="exchange-rate-row">
        <span className="exchange-rate-title">원/달러 환율</span>
        <span aria-hidden="true" className="exchange-rate-separator">
          ·
        </span>
        <span className="exchange-rate-value">{rateView.resolvedPriceLabel}</span>
        {rateView.changeLabel ? (
          <span className={rateView.changeClass}>{rateView.changeLabel}</span>
        ) : (
          <span className={rateView.changeClass}>{rateView.fallbackChangeLabel}</span>
        )}
        {rateView.hintLabel && <span className="exchange-rate-hint">{rateView.hintLabel}</span>}
        <span className="visually-hidden">KRW=X · 1분 간격 자동 갱신</span>
      </div>
      {fallbackNotice && <div className="exchange-rate-notice">{fallbackNotice}</div>}
    </div>
  )
}

export default ExchangeRateTicker
