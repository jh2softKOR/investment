import { useEffect, useMemo, useState } from 'react'
import { fetchWithProxies } from '../utils/proxyFetch'
import FearGreedIndex from './FearGreedIndex'
import TradingViewChart from './TradingViewChart'

const priceProviders = ['yahoo', 'binance', 'gateio', 'fmp'] as const
type PriceProvider = (typeof priceProviders)[number]

const createProviderStatusState = (initial: 'idle' | 'loading' | 'error' = 'loading') =>
  Object.fromEntries(priceProviders.map((provider) => [provider, initial])) as Record<
    PriceProvider,
    'idle' | 'loading' | 'error'
  >

const createProviderMessageState = (initial: string | null = null) =>
  Object.fromEntries(priceProviders.map((provider) => [provider, initial])) as Record<
    PriceProvider,
    string | null
  >

type AssetConfig = {
  id: string
  title: string
  subtitle: string
  chartSymbol: string
  priceSource?: {
    provider: PriceProvider
    symbol: string
  }
  formatOptions?: Intl.NumberFormatOptions
  tags?: string[]
}

type PriceInfo = {
  price: number | null
  changePercent: number | null
}

const assets: AssetConfig[] = [
  {
    id: 'nasdaq',
    title: '나스닥 종합지수',
    subtitle: '미국 기술주의 흐름을 가늠하는 대표 지수',
    chartSymbol: 'NASDAQ:IXIC',
    priceSource: { provider: 'yahoo', symbol: '^IXIC' },
    formatOptions: { maximumFractionDigits: 2 },
    tags: ['미 증시', '인덱스'],
  },
  {
    id: 'dow',
    title: '다우존스 산업평균',
    subtitle: '전통 우량주 중심의 벤치마크 지수',
    chartSymbol: 'DJI',
    priceSource: { provider: 'yahoo', symbol: '^DJI' },
    formatOptions: { maximumFractionDigits: 2 },
    tags: ['미 증시', '인덱스'],
  },
  {
    id: 'btc',
    title: '비트코인 (BTC)',
    subtitle: '디지털 자산 시장의 방향성 지표',
    chartSymbol: 'BITSTAMP:BTCUSD',
    priceSource: { provider: 'binance', symbol: 'BTCUSDT' },
    formatOptions: { maximumFractionDigits: 0 },
    tags: ['코인', '주요 코인'],
  },
  {
    id: 'eth',
    title: '이더리움 (ETH)',
    subtitle: '스마트 컨트랙트 생태계의 핵심 자산',
    chartSymbol: 'BITSTAMP:ETHUSD',
    priceSource: { provider: 'binance', symbol: 'ETHUSDT' },
    formatOptions: { maximumFractionDigits: 0 },
    tags: ['코인'],
  },
  {
    id: 'xrp',
    title: '리플 (XRP)',
    subtitle: '국경 간 송금 네트워크 기반 디지털 자산',
    chartSymbol: 'BITSTAMP:XRPUSD',
    priceSource: { provider: 'binance', symbol: 'XRPUSDT' },
    formatOptions: { maximumFractionDigits: 4 },
    tags: ['코인'],
  },
  {
    id: 'bgsc',
    title: '벅스 (BGSC) 선물',
    subtitle: 'BGSC 페르페추얼 스왑 (15분 봉 기본)',
    chartSymbol: 'GATEIO:BGSCUSDT.P',
    priceSource: { provider: 'gateio', symbol: 'BGSC_USDT' },
    tags: ['코인 선물', '파생상품'],
  },
]

const baseFormatOptions: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
}

const parseNumericValue = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }

    const cleaned = trimmed.replace(/[,%()]/g, '')
    if (!cleaned) {
      return null
    }

    const parsed = Number.parseFloat(cleaned)
    return Number.isNaN(parsed) ? null : parsed
  }

  return null
}

const usdKrwSymbol = 'KRW=X' as const

const MarketOverview = () => {
  const [prices, setPrices] = useState<Record<string, PriceInfo>>({})
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [providerStatuses, setProviderStatuses] = useState(() => createProviderStatusState('loading'))
  const [providerMessages, setProviderMessages] = useState(() => createProviderMessageState())
  const [usdKrw, setUsdKrw] = useState<PriceInfo | null>(null)
  const [usdKrwStatus, setUsdKrwStatus] = useState<'idle' | 'loading' | 'error'>('loading')

  const fmpApiKey = import.meta.env.VITE_FMP_KEY?.trim() ?? ''

  const yahooSymbols = useMemo(
    () => assets.filter((asset) => asset.priceSource?.provider === 'yahoo').map((asset) => asset.priceSource!.symbol),
    []
  )

  const binanceSymbols = useMemo(
    () => assets.filter((asset) => asset.priceSource?.provider === 'binance').map((asset) => asset.priceSource!.symbol),
    []
  )

  const gateIoSymbols = useMemo(
    () => assets.filter((asset) => asset.priceSource?.provider === 'gateio').map((asset) => asset.priceSource!.symbol),
    []
  )

  const fmpSymbols = useMemo(
    () => assets.filter((asset) => asset.priceSource?.provider === 'fmp').map((asset) => asset.priceSource!.symbol),
    []
  )

  useEffect(() => {
    let active = true

    const loadPrices = async () => {
      const tasks: Array<{
        provider: PriceProvider
        promise: Promise<Record<string, PriceInfo>>
      }> = []
      const missingProviders: PriceProvider[] = []

      const yahooTaskSymbols = Array.from(new Set([...yahooSymbols, usdKrwSymbol]))

      if (yahooTaskSymbols.length) {
        tasks.push({ provider: 'yahoo', promise: fetchYahooQuotes(yahooTaskSymbols) })
      }
      if (binanceSymbols.length) {
        tasks.push({ provider: 'binance', promise: fetchBinanceQuotes(binanceSymbols) })
      }
      if (gateIoSymbols.length) {
        tasks.push({ provider: 'gateio', promise: fetchGateIoQuotes(gateIoSymbols) })
      }
      if (fmpSymbols.length) {
        if (fmpApiKey) {
          tasks.push({ provider: 'fmp', promise: fetchFmpQuotes(fmpSymbols, fmpApiKey) })
        } else {
          missingProviders.push('fmp')
        }
      }

      if (!tasks.length) {
        if (active) {
          setStatus(missingProviders.length ? 'error' : 'idle')
          setPrices({})
          setUsdKrw(null)
          setUsdKrwStatus('error')
          const nextStatuses = createProviderStatusState('idle')
          missingProviders.forEach((provider) => {
            nextStatuses[provider] = 'error'
          })
          setProviderStatuses(nextStatuses)

          const nextMessages = createProviderMessageState()
          missingProviders.forEach((provider) => {
            nextMessages[provider] = 'API 키 필요'
          })
          setProviderMessages(nextMessages)
        }
        return
      }

      setStatus('loading')
      if (tasks.some((task) => task.provider === 'yahoo')) {
        setUsdKrwStatus('loading')
      }
      setProviderStatuses((prev) => {
        const next = { ...prev }
        tasks.forEach(({ provider }) => {
          next[provider] = 'loading'
        })
        missingProviders.forEach((provider) => {
          next[provider] = 'error'
        })
        return next
      })
      setProviderMessages((prev) => {
        const next = { ...prev }
        tasks.forEach(({ provider }) => {
          next[provider] = null
        })
        missingProviders.forEach((provider) => {
          next[provider] = 'API 키 필요'
        })
        return next
      })

      try {
        const settled = await Promise.allSettled(tasks.map((task) => task.promise))

        if (!active) {
          return
        }

        const providerResults: Partial<Record<PriceProvider, Record<string, PriceInfo>>> = {}
        const nextProviderStatuses: Partial<Record<PriceProvider, 'idle' | 'error'>> = {}
        const providerErrorMessages: Partial<Record<PriceProvider, string | null>> = {}
        let hasSuccess = false

        settled.forEach((result, index) => {
          const provider = tasks[index].provider
          if (result.status === 'fulfilled') {
            providerResults[provider] = result.value
            nextProviderStatuses[provider] = 'idle'
            providerErrorMessages[provider] = null
            hasSuccess = true
          } else {
            console.error(`Failed to load ${provider} quotes`, result.reason)
            nextProviderStatuses[provider] = 'error'
            providerErrorMessages[provider] = '수신 실패'
          }
        })

        setProviderStatuses((prev) => ({ ...prev, ...nextProviderStatuses }))
        setProviderMessages((prev) => ({ ...prev, ...providerErrorMessages }))
        setStatus(hasSuccess ? 'idle' : 'error')

        if (!hasSuccess) {
          setPrices({})
          setUsdKrw(null)
          setUsdKrwStatus('error')
          return
        }

        const aggregated: Record<string, PriceInfo> = {}

        assets.forEach((asset) => {
          const source = asset.priceSource
          if (!source) {
            return
          }

          const providerMap = providerResults[source.provider]
          const info = providerMap?.[source.symbol]
          if (info) {
            aggregated[asset.id] = info
          }
        })

        setPrices(aggregated)

        const yahooMap = providerResults.yahoo
        if (yahooMap) {
          const nextUsdKrw = yahooMap[usdKrwSymbol] ?? null
          const hasUsdKrwValue =
            nextUsdKrw && (nextUsdKrw.price !== null || nextUsdKrw.changePercent !== null)
          setUsdKrw(nextUsdKrw ?? null)
          setUsdKrwStatus(hasUsdKrwValue ? 'idle' : 'error')
        } else if (nextProviderStatuses.yahoo === 'error') {
          setUsdKrw(null)
          setUsdKrwStatus('error')
        }
      } catch (error) {
        console.error(error)
        if (!active) {
          return
        }

        setStatus('error')
        setProviderStatuses((prev) => {
          const next = { ...prev }
          tasks.forEach(({ provider }) => {
            next[provider] = 'error'
          })
          return next
        })
        setProviderMessages((prev) => {
          const next = { ...prev }
          tasks.forEach(({ provider }) => {
            next[provider] = '수신 실패'
          })
          return next
        })
        setPrices({})
        setUsdKrw(null)
        setUsdKrwStatus('error')
      }
    }

    loadPrices()
    const interval = window.setInterval(loadPrices, 60_000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [binanceSymbols, fmpApiKey, fmpSymbols, gateIoSymbols, yahooSymbols])

  const formatPrice = (value: number | null, options?: Intl.NumberFormatOptions) => {
    if (value === null || value === undefined) {
      return '-'
    }

    return new Intl.NumberFormat('ko-KR', { ...baseFormatOptions, ...options }).format(value)
  }

  const formatChange = (value: number | null) => {
    if (value === null || value === undefined) {
      return null
    }

    const formatted = value.toFixed(2)
    const sign = value > 0 ? '+' : ''
    return `${sign}${formatted}%`
  }

  const getFallbackLabel = (provider?: PriceProvider) => {
    if (!provider) {
      return status === 'loading' ? '불러오는 중' : status === 'error' ? '수신 실패' : '데이터 없음'
    }

    const message = providerMessages[provider]
    if (message) {
      return message
    }

    const providerStatus = providerStatuses[provider]
    if (providerStatus === 'loading') {
      return '불러오는 중'
    }
    if (providerStatus === 'error') {
      return '수신 실패'
    }
    return '데이터 없음'
  }

  const usdKrwFallbackLabel = getFallbackLabel('yahoo')
  const usdKrwPriceLabel =
    usdKrw?.price !== null && usdKrw?.price !== undefined
      ? new Intl.NumberFormat('ko-KR', {
          style: 'currency',
          currency: 'KRW',
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(usdKrw.price)
      : usdKrwFallbackLabel

  const usdKrwChangeLabel =
    usdKrw?.changePercent !== null && usdKrw?.changePercent !== undefined
      ? formatChange(usdKrw.changePercent)
      : null
  const usdKrwChangeClass =
    usdKrw?.changePercent !== null && usdKrw?.changePercent !== undefined
      ? usdKrw.changePercent >= 0
        ? 'usd-krw-change up'
        : 'usd-krw-change down'
      : 'usd-krw-change'

  return (
    <section className="section" aria-labelledby="market-overview-heading">
      <div className="section-header">
        <div>
          <h2 id="market-overview-heading">주요 지수 · 코인 실시간 차트</h2>
          <span>15분 봉 기준으로 실시간 흐름과 가격 변동을 확인하세요.</span>
        </div>
      </div>

      <div className="market-top-row">
        <FearGreedIndex className="prominent" />
        <div
          className="usd-krw-card"
          role="complementary"
          aria-live="polite"
          aria-busy={usdKrwStatus === 'loading'}
          data-state={usdKrwStatus}
        >
          <div className="usd-krw-header">
            <span className="usd-krw-title">원/달러 환율</span>
            <span className="usd-krw-subtitle">KRW=X · 1 USD 기준</span>
          </div>
          <div className="usd-krw-value-row">
            <strong className="usd-krw-value">{usdKrwPriceLabel}</strong>
            {usdKrwChangeLabel ? (
              <span className={usdKrwChangeClass}>{usdKrwChangeLabel}</span>
            ) : (
              <span className="usd-krw-change placeholder">{usdKrwFallbackLabel}</span>
            )}
          </div>
          <p className="usd-krw-meta">
            서울 외환시장 실시간 환율 · 야후 파이낸스 · 1분 단위 자동 갱신
          </p>
        </div>
      </div>

      <div className="market-summary" aria-live="polite">
        {assets.map((asset) => {
          const price = prices[asset.id]?.price ?? null
          const changePercent = prices[asset.id]?.changePercent ?? null
          const changeLabel = formatChange(changePercent)
          const fallbackLabel = getFallbackLabel(asset.priceSource?.provider)
          const summaryPriceLabel =
            price !== null ? formatPrice(price, asset.formatOptions) : fallbackLabel
          const summaryChangeLabel = changeLabel ?? fallbackLabel
          const summaryState =
            changePercent === null ? 'neutral' : changePercent >= 0 ? 'up' : 'down'

          return (
            <div className={`market-summary-item ${summaryState}`} key={asset.id}>
              <span className="market-summary-name">{asset.title}</span>
              <div className="market-summary-metrics">
                <span className="market-summary-price">{summaryPriceLabel}</span>
                <span className="market-summary-change">{summaryChangeLabel}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="chart-grid">
        {assets.map((asset) => {
          const price = prices[asset.id]?.price ?? null
          const changePercent = prices[asset.id]?.changePercent ?? null
          const changeLabel = formatChange(changePercent)
          const fallbackLabel = getFallbackLabel(asset.priceSource?.provider)
          const changeClass = changePercent !== null ? (changePercent >= 0 ? 'change up' : 'change down') : 'change'

          return (
            <article className="chart-card" key={asset.id}>
              <div className="chart-card-header">
                <div>
                  <h3>{asset.title}</h3>
                  <p className="asset-subtitle">{asset.subtitle}</p>
                </div>
                <div className="price-row">
                  <span>
                    {price !== null ? formatPrice(price, asset.formatOptions) : fallbackLabel}
                  </span>
                  {changeLabel ? (
                    <span className={changeClass}>{changeLabel}</span>
                  ) : (
                    <span className="change">{fallbackLabel}</span>
                  )}
                </div>
                {asset.tags && asset.tags.length > 0 && (
                  <div className="asset-tags">
                    {asset.tags.map((tag) => (
                      <span key={tag}>#{tag}</span>
                    ))}
                  </div>
                )}
                {!asset.priceSource && <p className="helper-text">실시간 가격 데이터 제공 준비 중입니다.</p>}
              </div>
              <TradingViewChart symbol={asset.chartSymbol} interval="15" />
            </article>
          )
        })}
      </div>
    </section>
  )
}

const fetchFmpQuotes = async (
  symbols: string[],
  apiKey: string
): Promise<Record<string, PriceInfo>> => {
  if (!symbols.length || !apiKey) {
    return {}
  }

  const encodedSymbols = symbols.map((symbol) => encodeURIComponent(symbol))
  const url = new URL(
    `https://financialmodelingprep.com/api/v3/quote/${encodedSymbols.join(',')}`
  )
  url.searchParams.set('apikey', apiKey)

  const response = await fetchWithProxies(url)
  if (!response.ok) {
    throw new Error('Financial Modeling Prep 시세 응답 오류')
  }

  const data = (await response.json()) as Array<{
    symbol?: string
    price?: number | string | null
    changesPercentage?: number | string | null
  }>

  const mapped: Record<string, PriceInfo> = {}
  data.forEach((item) => {
    if (!item.symbol) {
      return
    }

    mapped[item.symbol] = {
      price: parseNumericValue(item.price),
      changePercent: parseNumericValue(item.changesPercentage),
    }
  })

  return mapped
}

const fetchYahooQuotes = async (symbols: string[]): Promise<Record<string, PriceInfo>> => {
  if (!symbols.length) {
    return {}
  }

  const url = new URL('https://query1.finance.yahoo.com/v7/finance/quote')
  url.searchParams.set('symbols', symbols.join(','))

  const response = await fetchWithProxies(url)
  if (!response.ok) {
    throw new Error('Yahoo Finance 응답 오류')
  }

  const data = await response.json()
  const results = (data?.quoteResponse?.result ?? []) as Array<{
    symbol?: string
    regularMarketPrice?: number | string | null
    regularMarketChangePercent?: number | string | null
  }>

  const mapped: Record<string, PriceInfo> = {}
  results.forEach((item) => {
    if (!item.symbol) {
      return
    }

    const price = parseNumericValue(item.regularMarketPrice)
    const changePercent = parseNumericValue(item.regularMarketChangePercent)

    mapped[item.symbol] = {
      price,
      changePercent,
    }
  })
  return mapped
}

const fetchBinanceQuotes = async (symbols: string[]): Promise<Record<string, PriceInfo>> => {
  if (!symbols.length) {
    return {}
  }

  const url = new URL('https://api.binance.com/api/v3/ticker/24hr')
  url.searchParams.set('symbols', JSON.stringify(symbols))
  const headers = { Accept: 'application/json, text/plain, */*' }

  const mapTickers = (
    entries: Array<{ symbol: string; lastPrice?: string; priceChangePercent?: string }>
  ) => {
    const toNumber = (input?: string) => {
      if (!input) {
        return null
      }
      const parsed = Number.parseFloat(input)
      return Number.isNaN(parsed) ? null : parsed
    }

    const mapped: Record<string, PriceInfo> = {}
    entries.forEach((item) => {
      mapped[item.symbol] = {
        price: toNumber(item.lastPrice),
        changePercent: toNumber(item.priceChangePercent),
      }
    })
    return mapped
  }

  try {
    const directResponse = await fetch(url.toString(), {
      headers,
      credentials: 'omit',
    })
    if (directResponse.ok) {
      const payload = (await directResponse.json()) as Array<{
        symbol: string
        lastPrice?: string
        priceChangePercent?: string
      }>
      return mapTickers(payload)
    }
    console.warn(`Binance 직접 응답 상태 코드: ${directResponse.status}`)
  } catch (error) {
    console.warn('Binance 직접 요청 실패, 프록시로 재시도합니다.', error)
  }

  const response = await fetchWithProxies(url, { headers })
  if (!response.ok) {
    throw new Error('Binance 응답 오류')
  }

  const data = (await response.json()) as Array<{
    symbol: string
    lastPrice?: string
    priceChangePercent?: string
  }>

  return mapTickers(data)
}

const fetchGateIoQuotes = async (symbols: string[]): Promise<Record<string, PriceInfo>> => {
  if (!symbols.length) {
    return {}
  }

  const results = await Promise.all(
    symbols.map(async (symbol) => {
      const url = new URL('https://api.gateio.ws/api/v4/futures/usdt/tickers')
      url.searchParams.set('contract', symbol)

      const response = await fetchWithProxies(url)
      if (!response.ok) {
        throw new Error('Gate.io 응답 오류')
      }

      const payload = (await response.json()) as Array<{
        contract?: string
        last?: string
        change_percentage?: string
      }> | {
        contract?: string
        last?: string
        change_percentage?: string
      }

      const ticker = Array.isArray(payload)
        ? payload.find((item) => item.contract === symbol) ?? payload[0]
        : payload.contract === symbol || !payload.contract
          ? payload
          : null

      const price = ticker?.last ? Number.parseFloat(ticker.last) : null
      const changePercent = ticker?.change_percentage ? Number.parseFloat(ticker.change_percentage) : null

      return [symbol, { price, changePercent }] as const
    })
  )

  return Object.fromEntries(results)
}

export default MarketOverview
