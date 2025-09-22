import { useEffect, useMemo, useState } from 'react'
import TradingViewChart from './TradingViewChart'

type PriceProvider = 'yahoo' | 'binance' | 'gateio'

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
    chartSymbol: 'BINGX:BGSCUSDT.P',
    priceSource: { provider: 'gateio', symbol: 'BGSC_USDT' },
    tags: ['코인 선물', '파생상품'],
  },
]

const baseFormatOptions: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
}

const MarketOverview = () => {
  const [prices, setPrices] = useState<Record<string, PriceInfo>>({})
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading')

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

  useEffect(() => {
    let active = true

    const loadPrices = async () => {
      setStatus('loading')
      try {
        const [yahooResults, binanceResults, gateIoResults] = await Promise.all([
          fetchYahooQuotes(yahooSymbols),
          fetchBinanceQuotes(binanceSymbols),
          fetchGateIoQuotes(gateIoSymbols),
        ])

        if (!active) {
          return
        }

        const result: Record<string, PriceInfo> = {}

        assets.forEach((asset) => {
          if (!asset.priceSource) {
            return
          }

          const { provider, symbol } = asset.priceSource
          let providerMap: Record<string, PriceInfo>
          if (provider === 'yahoo') {
            providerMap = yahooResults
          } else if (provider === 'binance') {
            providerMap = binanceResults
          } else {
            providerMap = gateIoResults
          }
          const info = providerMap[symbol]
          if (info) {
            result[asset.id] = info
          }
        })

        setPrices(result)
        setStatus('idle')
      } catch (error) {
        console.error(error)
        if (active) {
          setStatus('error')
        }
      }
    }

    loadPrices()
    const interval = window.setInterval(loadPrices, 60_000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [binanceSymbols, gateIoSymbols, yahooSymbols])

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

  return (
    <section className="section" aria-labelledby="market-overview-heading">
      <div className="section-header">
        <div>
          <h2 id="market-overview-heading">주요 지수 · 코인 실시간 차트</h2>
          <span>15분 봉 기준으로 실시간 흐름과 가격 변동을 확인하세요.</span>
        </div>
      </div>

      {status === 'error' && (
        <div className="status-banner" role="alert">
          가격 정보를 불러오는 중 문제가 발생했습니다. 네트워크 상태를 확인해주세요.
        </div>
      )}

      <div className="chart-grid">
        {assets.map((asset) => {
          const price = prices[asset.id]?.price ?? null
          const changePercent = prices[asset.id]?.changePercent ?? null
          const changeLabel = formatChange(changePercent)
          const changeClass = changePercent !== null ? (changePercent >= 0 ? 'change up' : 'change down') : 'change'

          return (
            <article className="chart-card" key={asset.id}>
              <div className="chart-card-header">
                <div>
                  <h3>{asset.title}</h3>
                  <p className="asset-subtitle">{asset.subtitle}</p>
                </div>
                <div className="price-row">
                  <span>{formatPrice(price, asset.formatOptions)}</span>
                  {changeLabel ? <span className={changeClass}>{changeLabel}</span> : <span className="change">-</span>}
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

const fetchYahooQuotes = async (symbols: string[]): Promise<Record<string, PriceInfo>> => {
  if (!symbols.length) {
    return {}
  }

  const url = new URL('https://query1.finance.yahoo.com/v7/finance/quote')
  url.searchParams.set('symbols', symbols.join(','))

  const response = await fetch(url.toString())
  if (!response.ok) {
    throw new Error('Yahoo Finance 응답 오류')
  }

  const data = await response.json()
  const results = (data?.quoteResponse?.result ?? []) as Array<{
    symbol: string
    regularMarketPrice?: number
    regularMarketChangePercent?: number
  }>

  const mapped: Record<string, PriceInfo> = {}
  results.forEach((item) => {
    mapped[item.symbol] = {
      price: typeof item.regularMarketPrice === 'number' ? item.regularMarketPrice : null,
      changePercent:
        typeof item.regularMarketChangePercent === 'number' ? item.regularMarketChangePercent : null,
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

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Binance 응답 오류')
  }

  const data = (await response.json()) as Array<{
    symbol: string
    lastPrice?: string
    priceChangePercent?: string
  }>

  const mapped: Record<string, PriceInfo> = {}
  data.forEach((item) => {
    mapped[item.symbol] = {
      price: item.lastPrice ? Number.parseFloat(item.lastPrice) : null,
      changePercent: item.priceChangePercent ? Number.parseFloat(item.priceChangePercent) : null,
    }
  })
  return mapped
}

const fetchGateIoQuotes = async (symbols: string[]): Promise<Record<string, PriceInfo>> => {
  if (!symbols.length) {
    return {}
  }

  const results = await Promise.all(
    symbols.map(async (symbol) => {
      const url = new URL('https://api.gateio.ws/api/v4/futures/usdt/tickers')
      url.searchParams.set('contract', symbol)

      const response = await fetch(url.toString())
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
