import { useEffect, useState } from 'react'
import { fetchUsdKrwFromExchangeRateHost, fetchYahooQuotes } from '../utils/marketData'
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

      const resolveStatus = (info: PriceInfo | null) => {
        if (!info) {
          return 'error'
        }

        return info.price !== null || info.changePercent !== null ? 'idle' : 'error'
      }

      try {
        const quotes = await fetchYahooQuotes([usdKrwSymbol])
        if (!active) {
          return
        }

        const info = quotes[usdKrwSymbol] ?? null
        if (info && (info.price !== null || info.changePercent !== null)) {
          setRate(info)
          setStatus('idle')
          return
        }
      } catch (error) {
        console.warn('Yahoo 환율 기본 소스 로딩 실패, 대체 소스를 시도합니다.', error)
      }

      try {
        const fallbackInfo = await fetchUsdKrwFromExchangeRateHost()
        if (!active) {
          return
        }

        setRate(fallbackInfo)
        setStatus(resolveStatus(fallbackInfo))
        if (!fallbackInfo) {
          throw new Error('대체 환율 정보가 비어 있습니다.')
        }
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
      <span className="exchange-rate-title">원/달러 환율</span>
      <span aria-hidden="true" className="exchange-rate-separator">
        ·
      </span>
      <span className="exchange-rate-value">{resolvedPriceLabel}</span>
      {changeLabel ? (
        <span className={changeClass}>{changeLabel}</span>
      ) : (
        <span className={changeClass}>{fallbackChangeLabel}</span>
      )}
      <span className="visually-hidden">KRW=X · 1분 간격 자동 갱신</span>
    </div>
  )
}

export default ExchangeRateTicker
