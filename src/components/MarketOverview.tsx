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
import type { PriceInfo } from '../utils/marketData'

const priceProviders = ['yahoo', 'binance', 'gateio', 'fmp', 'stooq'] as const
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
  yahoo: 'Yahoo Finance',
  binance: 'Binance',
  gateio: 'Gate.io',
  fmp: 'Financial Modeling Prep',
  stooq: 'Stooq',
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
      { provider: 'yahoo', symbol: '^IXIC' },
      { provider: 'stooq', symbol: '^IXIC' },
      { provider: 'fmp', symbol: '^IXIC' },
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
      { provider: 'yahoo', symbol: '^DJI' },
      { provider: 'stooq', symbol: '^DJI' },
      { provider: 'fmp', symbol: '^DJI' },
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

const MarketOverview = () => {
  const [prices, setPrices] = useState<Record<string, PriceInfo>>({})
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [providerStatuses, setProviderStatuses] = useState(() => createProviderStatusState('loading'))
  const [providerMessages, setProviderMessages] = useState(() => createProviderMessageState())
  const [assetProviders, setAssetProviders] = useState(() => createAssetProviderState())

  const fmpApiKey = import.meta.env.VITE_FMP_KEY?.trim() ?? ''

  const providerSymbols = useMemo(() => {
    const symbolSets: Record<PriceProvider, Set<string>> = {
      yahoo: new Set<string>(),
      binance: new Set<string>(),
      gateio: new Set<string>(),
      fmp: new Set<string>(),
      stooq: new Set<string>(),
    }

    assets.forEach((asset) => {
      asset.priceSources.forEach((source) => {
        symbolSets[source.provider].add(source.symbol)
      })
    })

    return {
      yahoo: Array.from(symbolSets.yahoo),
      binance: Array.from(symbolSets.binance),
      gateio: Array.from(symbolSets.gateio),
      fmp: Array.from(symbolSets.fmp),
      stooq: Array.from(symbolSets.stooq),
    }
  }, [])

  const yahooSymbols = providerSymbols.yahoo
  const binanceSymbols = providerSymbols.binance
  const gateIoSymbols = providerSymbols.gateio
  const fmpSymbols = providerSymbols.fmp
  const stooqSymbols = providerSymbols.stooq

  useEffect(() => {
    let active = true

    const loadPrices = async () => {
      const tasks: Array<{
        provider: PriceProvider
        promise: Promise<Record<string, PriceInfo>>
      }> = []
      const disabledProviders: PriceProvider[] = []
      if (yahooSymbols.length) {
        tasks.push({ provider: 'yahoo', promise: fetchYahooQuotes(yahooSymbols) })
      }
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

      if (!tasks.length) {
        if (active) {
          setStatus('idle')
          setPrices({})
          setProviderStatuses(createProviderStatusState('idle'))
          setProviderMessages(createProviderMessageState())
          setAssetProviders(createAssetProviderState())
        }
        return
      }

      setStatus('loading')
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

        setPrices(aggregated)
        setAssetProviders(resolvedProviders)
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
        setStatus(hasSuccess ? 'idle' : 'error')

        if (!hasSuccess) {
          return
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
          disabledProviders.forEach((provider) => {
            next[provider] = 'API 키 미설정'
          })
          return next
        })
        setPrices({})
        setAssetProviders(createAssetProviderState())
      }
    }

    loadPrices()
    const interval = window.setInterval(loadPrices, 60_000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [binanceSymbols, fmpApiKey, fmpSymbols, gateIoSymbols, stooqSymbols, yahooSymbols])

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
          <h2 id="market-overview-heading">주요 지수 · 코인 실시간 차트</h2>
          <span>15분 봉 기준으로 실시간 흐름과 가격 변동을 확인하세요.</span>
        </div>
      </div>

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
          const summaryPriceLabel =
            price !== null ? formatPrice(price, asset.formatOptions) : fallbackLabel
          const summaryChangeLabel = changeLabel
            ? changeLabel
            : price !== null
              ? resolvedProvider && fallbackLabel !== '데이터 없음'
                ? fallbackLabel
                : '데이터 없음'
              : fallbackLabel
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
          const resolvedProvider = assetProviders[asset.id]
          const fallbackProvider = resolvedProvider ?? asset.priceSources[0]?.provider
          const fallbackLabel = getFallbackLabel(fallbackProvider)
          const changeClass = changePercent !== null ? (changePercent >= 0 ? 'change up' : 'change down') : 'change'
          const fallbackChangeLabel = changeLabel
            ? changeLabel
            : price !== null
              ? resolvedProvider && fallbackLabel !== '데이터 없음'
                ? fallbackLabel
                : '데이터 없음'
              : fallbackLabel

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
