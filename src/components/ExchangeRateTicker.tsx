import { useEffect, useState } from 'react'
import { fetchFmpQuotes, fetchUsdKrwFromExchangeRateHost, fetchYahooQuotes } from '../utils/marketData'
import type { PriceInfo } from '../utils/marketData'

const usdKrwSymbol = 'KRW=X' as const
const wtiSymbol = 'CL=F' as const

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
  const [rateStatus, setRateStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [oilStatus, setOilStatus] = useState<'idle' | 'loading' | 'error'>('loading')

  const fmpApiKey = import.meta.env.VITE_FMP_KEY?.trim()

  useEffect(() => {
    let active = true

    const loadRate = async (showLoading = false) => {
      if (!active) {
        return
      }

      if (showLoading) {
        setRateStatus('loading')
        setOilStatus('loading')
      }

      const resolveStatus = (info: PriceInfo | null) => {
        if (!info) {
          return 'error'
        }

        return info.price !== null || info.changePercent !== null ? 'idle' : 'error'
      }

      const symbols = [usdKrwSymbol, wtiSymbol] as const
      let quotes: Record<string, PriceInfo> = {}

      try {
        quotes = await fetchYahooQuotes([...symbols])
        if (!active) {
          return
        }

        const yahooRate = quotes[usdKrwSymbol] ?? null
        const yahooOil = quotes[wtiSymbol] ?? null

        if (yahooRate && (yahooRate.price !== null || yahooRate.changePercent !== null)) {
          setRate(yahooRate)
          setRateStatus('idle')
        }

        if (yahooOil && (yahooOil.price !== null || yahooOil.changePercent !== null)) {
          setOil(yahooOil)
          setOilStatus('idle')
        }
      } catch (error) {
        console.warn('Yahoo 시세 기본 소스 로딩 실패, 대체 소스를 시도합니다.', error)
      }

      const resolveRateFallback = async () => {
        try {
          const fallbackInfo = await fetchUsdKrwFromExchangeRateHost()
          if (!active) {
            return
          }

          setRate(fallbackInfo)
          setRateStatus(resolveStatus(fallbackInfo))
          if (!fallbackInfo) {
            throw new Error('대체 환율 정보가 비어 있습니다.')
          }
        } catch (error) {
          console.error('원/달러 환율 로딩 실패', error)
          if (!active) {
            return
          }

          setRate(null)
          setRateStatus('error')
        }
      }

      const resolveOilFallback = async () => {
        try {
          const fallbackQuotes = await fetchFmpQuotes([wtiSymbol], fmpApiKey)
          if (!active) {
            return
          }

          const fallbackInfo = fallbackQuotes[wtiSymbol] ?? null
          setOil(fallbackInfo)
          setOilStatus(resolveStatus(fallbackInfo))
          if (!fallbackInfo) {
            throw new Error('대체 국제 유가 정보가 비어 있습니다.')
          }
        } catch (error) {
          console.error('국제 유가 로딩 실패', error)
          if (!active) {
            return
          }

          setOil(null)
          setOilStatus('error')
        }
      }

      const nextRate = quotes[usdKrwSymbol] ?? null
      if (!nextRate || (nextRate.price === null && nextRate.changePercent === null)) {
        await resolveRateFallback()
      }

      const nextOil = quotes[wtiSymbol] ?? null
      if (!nextOil || (nextOil.price === null && nextOil.changePercent === null)) {
        await resolveOilFallback()
      }
    }

    loadRate(true)
    const interval = window.setInterval(() => loadRate(false), 60_000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [fmpApiKey])

  const buildTickerView = (
    info: PriceInfo | null,
    status: 'idle' | 'loading' | 'error',
    priceFormatter: (value: number | null | undefined) => string | null
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

    return { resolvedPriceLabel, changeLabel, changeClass, fallbackChangeLabel }
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

  const rateView = buildTickerView(rate, rateStatus, formatPrice)
  const oilView = buildTickerView(oil, oilStatus, oilFormatter)

  const containerState =
    rateStatus === 'loading' || oilStatus === 'loading'
      ? 'loading'
      : rateStatus === 'error' && oilStatus === 'error'
        ? 'error'
        : 'idle'

  return (
    <div className="exchange-rate-ticker" aria-live="polite" data-state={containerState}>
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
        <span className="visually-hidden">CL=F · 1분 간격 자동 갱신</span>
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
        <span className="visually-hidden">KRW=X · 1분 간격 자동 갱신</span>
      </div>
    </div>
  )
}

export default ExchangeRateTicker
