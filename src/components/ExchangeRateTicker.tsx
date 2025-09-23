import { useEffect, useState } from 'react'
import { fetchYahooQuotes } from '../utils/marketData'
import type { PriceInfo } from '../utils/marketData'

const usdKrwSymbol = 'KRW=X' as const

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
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading')

  useEffect(() => {
    let active = true

    const loadRate = async (showLoading = false) => {
      if (!active) {
        return
      }

      if (showLoading) {
        setStatus('loading')
      }

      try {
        const quotes = await fetchYahooQuotes([usdKrwSymbol])
        if (!active) {
          return
        }

        const info = quotes[usdKrwSymbol] ?? null
        const hasValue = info && (info.price !== null || info.changePercent !== null)
        setRate(info)
        setStatus(hasValue ? 'idle' : 'error')
      } catch (error) {
        console.error('원/달러 환율 로딩 실패', error)
        if (!active) {
          return
        }

        setRate(null)
        setStatus('error')
      }
    }

    loadRate(true)
    const interval = window.setInterval(() => loadRate(false), 60_000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  const priceLabel = formatPrice(rate?.price)
  const resolvedPriceLabel =
    priceLabel ?? (status === 'loading' ? '불러오는 중' : status === 'error' ? '수신 실패' : '데이터 없음')

  const changeLabel = formatChange(rate?.changePercent)
  const changeClass = changeLabel
    ? rate && rate.changePercent !== null && rate.changePercent !== undefined
      ? rate.changePercent >= 0
        ? 'exchange-rate-change up'
        : 'exchange-rate-change down'
      : 'exchange-rate-change'
    : 'exchange-rate-change placeholder'

  const fallbackChangeLabel = status === 'loading' ? '불러오는 중' : status === 'error' ? '수신 실패' : '데이터 없음'

  return (
    <div className="exchange-rate-ticker" aria-live="polite" data-state={status}>
      <div className="exchange-rate-header">
        <span className="exchange-rate-title">원/달러 환율</span>
        <span className="exchange-rate-subtitle">KRW=X · 실시간</span>
      </div>
      <div className="exchange-rate-body">
        <strong className="exchange-rate-value">{resolvedPriceLabel}</strong>
        {changeLabel ? (
          <span className={changeClass}>{changeLabel}</span>
        ) : (
          <span className={changeClass}>{fallbackChangeLabel}</span>
        )}
      </div>
      <span className="exchange-rate-meta">야후 파이낸스 · 1분 간격 자동 갱신</span>
    </div>
  )
}

export default ExchangeRateTicker
