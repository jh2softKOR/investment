import { useEffect, useState } from 'react'
import { fetchFmpQuotes, fetchUsdKrwFromExchangeRateHost, fetchWtiFromStooq } from '../utils/marketData'
import type { PriceInfo } from '../utils/marketData'

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

    const hasMeaningfulInfo = (info: PriceInfo | null) =>
      Boolean(info && (info.price !== null || info.changePercent !== null))

    const resolveRate = async (showLoading: boolean) => {
      if (!active) {
        return
      }

      if (showLoading) {
        setRateStatus('loading')
      }

      try {
        const info = await fetchUsdKrwFromExchangeRateHost()
        if (!active) {
          return
        }

        if (hasMeaningfulInfo(info)) {
          setRate(info)
          setRateStatus('idle')
          return
        }

        console.error('원/달러 환율 데이터가 비어 있습니다.')
        setRate(info)
      } catch (error) {
        console.error('원/달러 환율 로딩 실패', error)
        if (!active) {
          return
        }

        setRate(null)
      }

      if (!active) {
        return
      }

      setRateStatus('error')
    }

    const resolveOil = async (showLoading: boolean) => {
      if (!active) {
        return
      }

      if (showLoading) {
        setOilStatus('loading')
      }

      const updateIfValid = (info: PriceInfo | null) => {
        if (hasMeaningfulInfo(info)) {
          setOil(info)
          setOilStatus('idle')
          return true
        }

        return false
      }

      let lastAttempt: PriceInfo | null = null

      try {
        const stooqInfo = await fetchWtiFromStooq()
        if (!active) {
          return
        }

        lastAttempt = stooqInfo
        if (updateIfValid(stooqInfo)) {
          return
        }

        if (stooqInfo) {
          console.warn('Stooq 국제 유가 데이터가 충분하지 않습니다. 추가 소스를 시도합니다.')
        } else {
          console.warn('Stooq 국제 유가 데이터를 가져오지 못했습니다. 추가 소스를 시도합니다.')
        }
      } catch (error) {
        console.error('Stooq 국제 유가 로딩 실패', error)
      }

      if (!active) {
        return
      }

      setOilStatus('loading')

      try {
        const fallbackQuotes = await fetchFmpQuotes([wtiSymbol], fmpApiKey)
        if (!active) {
          return
        }

        const fallbackInfo = fallbackQuotes[wtiSymbol] ?? null
        lastAttempt = fallbackInfo ?? lastAttempt

        if (updateIfValid(fallbackInfo)) {
          return
        }

        console.warn('Financial Modeling Prep 국제 유가 데이터가 유효하지 않습니다.')
      } catch (error) {
        console.error('Financial Modeling Prep 국제 유가 로딩 실패', error)
      }

      if (!active) {
        return
      }

      setOil(lastAttempt)
      setOilStatus('error')
    }

    const loadAll = async (showLoading: boolean) => {
      await Promise.all([resolveRate(showLoading), resolveOil(showLoading)])
    }

    loadAll(true)
    const interval = window.setInterval(() => {
      void loadAll(false)
    }, 60_000)

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
