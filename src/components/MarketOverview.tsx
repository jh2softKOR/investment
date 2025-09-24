import { useEffect, useMemo, useState } from 'react'
import FearGreedIndex from './FearGreedIndex'
import YieldSpreadCard from './YieldSpreadCard'
import TradingViewChart from './TradingViewChart'
import {
  fetchBinanceQuotes,
  fetchFmpQuotes,
  fetchGateIoQuotes,
  fetchStooqQuotes,
  fetchYahooQuotes,
} from '../utils/marketData'
import {
  fallbackMarketNotice,
  fallbackMarketPartialNotice,
  fallbackMarketPrices,
} from '../utils/fallbackData'
import type { PriceInfo } from '../utils/marketData'

const priceProviders = ['stooq', 'binance', 'gateio', 'fmp', 'yahoo'] as const
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

const providerDisplayNames: Record<PriceProvider, string> = {
  stooq: 'Stooq',
  binance: 'Binance',
  gateio: 'Gate.io',
  fmp: 'Financial Modeling Prep',
  yahoo: 'Yahoo Finance',
}

type PriceSource = {
  provider: PriceProvider
  symbol: string
}

type AssetConfig = {
  id: string
  title: string
  subtitle: string
  chartSymbol: string
  priceSources: PriceSource[]
  formatOptions?: Intl.NumberFormatOptions
  tags?: string[]
}

const assets: AssetConfig[] = [
  {
    id: 'nasdaq',
    title: '나스닥 종합지수',
    subtitle: '미국 기술주의 흐름을 가늠하는 대표 지수',
    chartSymbol: 'NASDAQ:IXIC',
    priceSources: [
      { provider: 'stooq', symbol: '^IXIC' },
      { provider: 'fmp', symbol: '^IXIC' },
      { provider: 'yahoo', symbol: '^IXIC' },
    ],
    formatOptions: { maximumFractionDigits: 2 },
    tags: ['미 증시', '인덱스'],
  },
  {
    id: 'dow',
    title: '다우존스 산업평균',
    subtitle: '전통 우량주 중심의 벤치마크 지수',
    chartSymbol: 'DJI',
    priceSources: [
      { provider: 'stooq', symbol: '^DJI' },
      { provider: 'fmp', symbol: '^DJI' },
      { provider: 'yahoo', symbol: '^DJI' },
    ],
    formatOptions: { maximumFractionDigits: 2 },
    tags: ['미 증시', '인덱스'],
  },
  {
    id: 'btc',
    title: '비트코인 (BTC)',
    subtitle: '디지털 자산 시장의 방향성 지표',
    chartSymbol: 'BITSTAMP:BTCUSD',
    priceSources: [{ provider: 'binance', symbol: 'BTCUSDT' }],
    formatOptions: { maximumFractionDigits: 0 },
    tags: ['코인', '주요 코인'],
  },
  {
    id: 'eth',
    title: '이더리움 (ETH)',
    subtitle: '스마트 컨트랙트 생태계의 핵심 자산',
    chartSymbol: 'BITSTAMP:ETHUSD',
    priceSources: [{ provider: 'binance', symbol: 'ETHUSDT' }],
    formatOptions: { maximumFractionDigits: 0 },
    tags: ['코인'],
  },
  {
    id: 'xrp',
    title: '리플 (XRP)',
    subtitle: '국경 간 송금 네트워크 기반 디지털 자산',
    chartSymbol: 'BITSTAMP:XRPUSD',
    priceSources: [{ provider: 'binance', symbol: 'XRPUSDT' }],
    formatOptions: { maximumFractionDigits: 4 },
    tags: ['코인'],
  },
  {
    id: 'bgsc',
    title: '벅스 (BGSC) 선물',
    subtitle: 'BGSC 페르페추얼 스왑 (15분 봉 기본)',
    chartSymbol: 'GATEIO:BGSCUSDT.P',
    priceSources: [{ provider: 'gateio', symbol: 'BGSC_USDT' }],
    tags: ['코인 선물', '파생상품'],
  },
]

const createAssetProviderState = () =>
  Object.fromEntries(assets.map((asset) => [asset.id, null])) as Record<string, PriceProvider | null>

const baseFormatOptions: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
}

const createAssetFallbackState = () =>
  Object.fromEntries(assets.map((asset) => [asset.id, false])) as Record<string, boolean>

const MarketOverview = () => {
  const [prices, setPrices] = useState<Record<string, PriceInfo>>({})
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [providerStatuses, setProviderStatuses] = useState(() => createProviderStatusState('loading'))
  const [providerMessages, setProviderMessages] = useState(() => createProviderMessageState())
  const [assetProviders, setAssetProviders] = useState(() => createAssetProviderState())
  const [assetFallbacks, setAssetFallbacks] = useState(() => createAssetFallbackState())
  const [notice, setNotice] = useState<string | null>(null)

  const fmpApiKey = import.meta.env.VITE_FMP_KEY?.trim() ?? ''

  const providerSymbols = useMemo(() => {
    const symbolSets = Object.fromEntries(
      priceProviders.map((provider) => [provider, new Set<string>()])
    ) as Record<PriceProvider, Set<string>>

    assets.forEach((asset) => {
      asset.priceSources.forEach((source) => {
        symbolSets[source.provider]?.add(source.symbol)
      })
    })

    return Object.fromEntries(
      priceProviders.map((provider) => [provider, Array.from(symbolSets[provider])])
    ) as Record<PriceProvider, string[]>
  }, [])
  const binanceSymbols = providerSymbols.binance
  const gateIoSymbols = providerSymbols.gateio
  const fmpSymbols = providerSymbols.fmp
  const stooqSymbols = providerSymbols.stooq
  const yahooSymbols = providerSymbols.yahoo

  useEffect(() => {
    let active = true

    const loadPrices = async () => {
      const tasks: Array<{
        provider: PriceProvider
        promise: Promise<Record<string, PriceInfo>>
      }> = []
      const disabledProviders: PriceProvider[] = []
      if (binanceSymbols.length) {
        tasks.push({ provider: 'binance', promise: fetchBinanceQuotes(binanceSymbols) })
      }
      if (gateIoSymbols.length) {
        tasks.push({ provider: 'gateio', promise: fetchGateIoQuotes(gateIoSymbols) })
      }
      if (stooqSymbols.length) {
        tasks.push({ provider: 'stooq', promise: fetchStooqQuotes(stooqSymbols) })
      }
      if (fmpSymbols.length) {
        if (fmpApiKey) {
          tasks.push({ provider: 'fmp', promise: fetchFmpQuotes(fmpSymbols, fmpApiKey) })
        } else {
          disabledProviders.push('fmp')
        }
      }
      if (yahooSymbols.length) {
        tasks.push({ provider: 'yahoo', promise: fetchYahooQuotes(yahooSymbols) })
      }

      if (!tasks.length) {
        if (active) {
          setStatus('idle')
          setPrices({})
          setProviderStatuses(createProviderStatusState('idle'))
          setProviderMessages(createProviderMessageState())
          setAssetProviders(createAssetProviderState())
          setAssetFallbacks(createAssetFallbackState())
          setNotice(null)
        }
        return
      }

      setStatus('loading')
      setNotice(null)
      setProviderStatuses((prev) => {
        const next = { ...prev }
        tasks.forEach(({ provider }) => {
          next[provider] = 'loading'
        })
        disabledProviders.forEach((provider) => {
          next[provider] = 'idle'
        })
        return next
      })
      setProviderMessages((prev) => {
        const next = { ...prev }
        tasks.forEach(({ provider }) => {
          next[provider] = null
        })
        disabledProviders.forEach((provider) => {
          next[provider] = 'API 키 미설정'
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
        const providerSuccessMessages: Partial<Record<PriceProvider, string | null>> = {}
        let hasSuccess = false

        settled.forEach((result, index) => {
          const provider = tasks[index].provider
          if (result.status === 'fulfilled') {
            providerResults[provider] = result.value
            nextProviderStatuses[provider] = 'idle'
            hasSuccess = true
          } else {
            console.error(`Failed to load ${provider} quotes`, result.reason)
            nextProviderStatuses[provider] = 'error'
            providerErrorMessages[provider] = '수신 실패'
          }
        })

        setProviderStatuses((prev) => ({ ...prev, ...nextProviderStatuses }))

        const aggregated: Record<string, PriceInfo> = {}
        const resolvedProviders = createAssetProviderState()
        const fallbackFlags = createAssetFallbackState()

        assets.forEach((asset) => {
          let fallbackChange: number | null = null
          let fallbackChangeProvider: PriceProvider | null = null

          for (const source of asset.priceSources) {
            const providerMap = providerResults[source.provider]
            const info = providerMap?.[source.symbol]
            if (!info) {
              continue
            }

            const hasPrice = info.price !== null && info.price !== undefined
            const hasChange = info.changePercent !== null && info.changePercent !== undefined

            if (hasPrice) {
              const mergedChange = hasChange ? info.changePercent : fallbackChange
              aggregated[asset.id] = {
                price: info.price,
                changePercent: mergedChange ?? null,
              }
              resolvedProviders[asset.id] = source.provider
              providerSuccessMessages[source.provider] = `${providerDisplayNames[source.provider]} 데이터 수신`
              break
            }

            if (hasChange && fallbackChange === null) {
              fallbackChange = info.changePercent
              fallbackChangeProvider = source.provider
            }
          }

          if (!(asset.id in aggregated) && fallbackChange !== null) {
            aggregated[asset.id] = { price: null, changePercent: fallbackChange }
            if (fallbackChangeProvider) {
              resolvedProviders[asset.id] = fallbackChangeProvider
              providerSuccessMessages[fallbackChangeProvider] = `${providerDisplayNames[fallbackChangeProvider]} 데이터 수신`
            }
          }
        })

        if (!hasSuccess) {
          const fallbackAggregated: Record<string, PriceInfo> = {}
          assets.forEach((asset) => {
            const fallbackInfo = fallbackMarketPrices[asset.id]
            if (fallbackInfo) {
              fallbackAggregated[asset.id] = fallbackInfo
              fallbackFlags[asset.id] = true
            }
          })

          setPrices(fallbackAggregated)
          setAssetProviders(createAssetProviderState())
          setProviderStatuses(createProviderStatusState('idle'))
          const fallbackMessages = createProviderMessageState('참고용 데이터')
          disabledProviders.forEach((provider) => {
            fallbackMessages[provider] = 'API 키 미설정'
          })
          setProviderMessages(fallbackMessages)
          setAssetFallbacks(fallbackFlags)
          setStatus('idle')
          setNotice(fallbackMarketNotice)
          return
        }

        let fallbackInjected = false
        assets.forEach((asset) => {
          if (!(asset.id in aggregated)) {
            const fallbackInfo = fallbackMarketPrices[asset.id]
            if (fallbackInfo) {
              aggregated[asset.id] = fallbackInfo
              fallbackFlags[asset.id] = true
              fallbackInjected = true
            }
          }
        })

        setPrices(aggregated)
        setAssetProviders(resolvedProviders)
        setAssetFallbacks(fallbackFlags)
        setProviderMessages((prev) => {
          const next = { ...prev }
          tasks.forEach(({ provider }) => {
            if (providerErrorMessages[provider] !== undefined) {
              next[provider] = providerErrorMessages[provider]
            } else if (providerSuccessMessages[provider] !== undefined) {
              next[provider] = providerSuccessMessages[provider]
            } else {
              next[provider] = null
            }
          })
          disabledProviders.forEach((provider) => {
            next[provider] = 'API 키 미설정'
          })
          return next
        })
        setStatus('idle')
        setNotice(fallbackInjected ? fallbackMarketPartialNotice : null)
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
          disabledProviders.forEach((provider) => {
            next[provider] = 'API 키 미설정'
          })
          return next
        })
        setPrices({})
        setAssetProviders(createAssetProviderState())
        setAssetFallbacks(createAssetFallbackState())
        setNotice(null)
      }
    }

    loadPrices()
    const interval = window.setInterval(loadPrices, 60_000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [binanceSymbols, fmpApiKey, fmpSymbols, gateIoSymbols, stooqSymbols])

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

  return (
    <section className="section" aria-labelledby="market-overview-heading">
      <div className="section-header">
        <div>
          <h2 id="market-overview-heading" className="section-title">
            <span className="section-title-icon markets" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false" role="img">
                <path
                  d="M4 5a1 1 0 0 0-1 1v12h14a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1V6a3 3 0 0 1 3-3h14a1 1 0 1 1 0 2H5a1 1 0 0 0-1 1Zm3.75 8.25 2.1-2.8 2.35 3.13a1 1 0 0 0 1.56.03l3.66-4.17a1 1 0 1 0-1.5-1.32l-2.94 3.35-2.33-3.11a1 1 0 0 0-1.6.03l-2.1 2.8-1.04-1.3a1 1 0 1 0-1.54 1.26l1.8 2.25a1 1 0 0 0 1.58-.35Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <span className="section-title-text">주요 지수 · 코인 실시간 차트</span>
          </h2>
          <span>15분 봉 기준으로 실시간 흐름과 가격 변동을 확인하세요.</span>
        </div>
      </div>

      {notice && (
        <div className="status-banner" role="status">
          {notice}
        </div>
      )}

      <div className="market-top-row">
        <FearGreedIndex className="prominent" variant="us-market" />
        <FearGreedIndex variant="crypto" />
        <YieldSpreadCard />
      </div>

      <div className="market-summary" aria-live="polite">
        {assets.map((asset) => {
          const price = prices[asset.id]?.price ?? null
          const changePercent = prices[asset.id]?.changePercent ?? null
          const changeLabel = formatChange(changePercent)
          const resolvedProvider = assetProviders[asset.id]
          const fallbackProvider = resolvedProvider ?? asset.priceSources[0]?.provider
          const fallbackLabel = getFallbackLabel(fallbackProvider)
          const isFallbackAsset = assetFallbacks[asset.id] ?? false
          const summaryPriceLabel =
            price !== null ? formatPrice(price, asset.formatOptions) : fallbackLabel
          const fallbackChangeText =
            price !== null
              ? isFallbackAsset
                ? '참고용'
                : resolvedProvider && fallbackLabel !== '데이터 없음'
                  ? fallbackLabel
                  : '데이터 없음'
              : fallbackLabel
          const summaryChangeLabel = changeLabel ?? fallbackChangeText
          const summaryState =
            changePercent === null ? 'neutral' : changePercent >= 0 ? 'up' : 'down'

          return (
            <div className={`market-summary-item ${summaryState}`} key={asset.id}>
              <span className="market-summary-name">{asset.title}</span>
              <div className="market-summary-metrics">
                <div className="price-with-tag">
                  <span className="market-summary-price">{summaryPriceLabel}</span>
                  {isFallbackAsset && <span className="data-fallback-tag">참고용</span>}
                </div>
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
          const resolvedProvider = assetProviders[asset.id]
          const fallbackProvider = resolvedProvider ?? asset.priceSources[0]?.provider
          const fallbackLabel = getFallbackLabel(fallbackProvider)
          const isFallbackAsset = assetFallbacks[asset.id] ?? false
          const changeClass = changePercent !== null ? (changePercent >= 0 ? 'change up' : 'change down') : 'change'
          const fallbackChangeText =
            price !== null
              ? isFallbackAsset
                ? '참고용'
                : resolvedProvider && fallbackLabel !== '데이터 없음'
                  ? fallbackLabel
                  : '데이터 없음'
              : fallbackLabel
          const fallbackChangeLabel = changeLabel ?? fallbackChangeText

          return (
            <article className="chart-card" key={asset.id}>
              <div className="chart-card-header">
                <div>
                  <h3>{asset.title}</h3>
                  <p className="asset-subtitle">{asset.subtitle}</p>
                </div>
                <div className="price-row">
                  <div className="price-with-tag">
                    <span>
                      {price !== null ? formatPrice(price, asset.formatOptions) : fallbackLabel}
                    </span>
                    {isFallbackAsset && <span className="data-fallback-tag">참고용</span>}
                  </div>
                  {changeLabel ? (
                    <span className={changeClass}>{changeLabel}</span>
                  ) : (
                    <span className="change">{fallbackChangeLabel}</span>
                  )}
                </div>
                {asset.tags && asset.tags.length > 0 && (
                  <div className="asset-tags">
                    {asset.tags.map((tag) => (
                      <span key={tag}>#{tag}</span>
                    ))}
                  </div>
                )}
                {asset.priceSources.length === 0 && (
                  <p className="helper-text">실시간 가격 데이터 제공 준비 중입니다.</p>
                )}
              </div>
              <TradingViewChart symbol={asset.chartSymbol} interval="15" />
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default MarketOverview
