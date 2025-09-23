import { fetchWithProxies } from './proxyFetch'

type PriceInfo = {
  price: number | null
  changePercent: number | null
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

const yahooQuoteEndpoints = [
  'https://query2.finance.yahoo.com/v7/finance/quote',
  'https://query1.finance.yahoo.com/v7/finance/quote',
]

const fetchYahooQuotes = async (symbols: string[]): Promise<Record<string, PriceInfo>> => {
  if (!symbols.length) {
    return {}
  }

  let lastError: unknown = null

  for (let index = 0; index < yahooQuoteEndpoints.length; index += 1) {
    const endpoint = yahooQuoteEndpoints[index]
    const url = new URL(endpoint)
    url.searchParams.set('symbols', symbols.join(','))

    try {
      const response = await fetchWithProxies(url)
      if (!response.ok) {
        throw new Error(`Yahoo Finance 응답 오류 (status: ${response.status})`)
      }

      const data = await response.json()
      const results = (data?.quoteResponse?.result ?? []) as Array<{
        symbol?: string
        regularMarketPrice?: number | string | null
        regularMarketChangePercent?: number | string | null
      }>

      if (!results.length) {
        lastError = new Error('Yahoo Finance 응답에 유효한 결과가 없습니다.')
        continue
      }

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
    } catch (error) {
      lastError = error
    }
  }

  if (lastError instanceof Error) {
    throw lastError
  }

  throw new Error('Yahoo Finance 시세를 불러오지 못했습니다.')
}

type ExchangeRateHostResponse = {
  success?: boolean
  rates?: Record<string, number | string | null>
  base?: string
}

const fetchJsonWithProxiesFirst = async <T>(url: URL): Promise<T> => {
  const response = await fetchWithProxies(url)

  if (!response.ok) {
    throw new Error(`요청 실패 (status: ${response.status})`)
  }

  return (await response.json()) as T
}

const fetchUsdKrwFromExchangeRateHost = async (): Promise<PriceInfo | null> => {
  const latestUrl = new URL('https://api.exchangerate.host/latest')
  latestUrl.searchParams.set('base', 'USD')
  latestUrl.searchParams.set('symbols', 'KRW')

  const previousUrl = new URL('https://api.exchangerate.host/yesterday')
  previousUrl.searchParams.set('base', 'USD')
  previousUrl.searchParams.set('symbols', 'KRW')

  try {
    const [latestData, previousData] = await Promise.all([
      fetchJsonWithProxiesFirst<ExchangeRateHostResponse>(latestUrl),
      fetchJsonWithProxiesFirst<ExchangeRateHostResponse>(previousUrl),
    ])

    const latestRate = parseNumericValue(latestData?.rates?.KRW)
    const previousRate = parseNumericValue(previousData?.rates?.KRW)

    if (latestRate === null && previousRate === null) {
      return null
    }

    let changePercent: number | null = null
    if (latestRate !== null && previousRate !== null && previousRate !== 0) {
      changePercent = ((latestRate - previousRate) / previousRate) * 100
    }

    return {
      price: latestRate,
      changePercent,
    }
  } catch (error) {
    console.warn('ExchangeRate.host 환율 로딩 실패, 오픈 소스 환율 데이터셋을 시도합니다.', error)
  }

  return fetchUsdKrwFromFawazDataset()
}

type FawazCurrencyResponse = {
  date?: string
  krw?: number | string | null
}

const fetchUsdKrwFromFawazDataset = async (): Promise<PriceInfo | null> => {
  const latestUrl = new URL(
    'https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/usd/krw.json'
  )

  let latestPayload: FawazCurrencyResponse

  try {
    latestPayload = await fetchJsonWithProxiesFirst<FawazCurrencyResponse>(latestUrl)
  } catch (error) {
    console.error('오픈 소스 환율 데이터셋 조회 실패', error)
    return null
  }
  const latestRate = parseNumericValue(latestPayload?.krw)

  if (latestRate === null) {
    return null
  }

  let previousRate: number | null = null
  const latestDateValue = latestPayload?.date

  if (latestDateValue) {
    const parsed = new Date(latestDateValue)
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setDate(parsed.getDate() - 1)
      const previousIso = parsed.toISOString().slice(0, 10)

      try {
        const previousUrl = new URL(
          `https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/${previousIso}/currencies/usd/krw.json`
        )
        const previousPayload = await fetchJsonWithProxiesFirst<FawazCurrencyResponse>(previousUrl)
        previousRate = parseNumericValue(previousPayload?.krw)
      } catch (error) {
        console.warn('환율 보조 데이터셋 전일 정보 조회 실패', error)
      }
    }
  }

  let changePercent: number | null = null
  if (previousRate !== null && previousRate !== 0) {
    changePercent = ((latestRate - previousRate) / previousRate) * 100
  }

  return {
    price: latestRate,
    changePercent,
  }
}

const fetchStooqQuotes = async (symbols: string[]): Promise<Record<string, PriceInfo>> => {
  if (!symbols.length) {
    return {}
  }

  const results = await Promise.all(
    symbols.map(async (symbol) => {
      const url = new URL('https://stooq.com/q/l/')
      url.searchParams.set('s', symbol)
      url.searchParams.set('f', 'sd2t2ohlcv')
      url.searchParams.set('h', '1')
      url.searchParams.set('e', 'csv')

      const response = await fetchWithProxies(url)
      if (!response.ok) {
        throw new Error(`Stooq ${symbol} 시세 응답 오류`)
      }

      const text = await response.text()
      const lines = text.trim().split(/\r?\n/)
      if (lines.length < 2) {
        return null
      }

      const dataLine = lines[1]
      const columns = dataLine.split(',')
      if (columns.length < 7) {
        return null
      }

      const closeValue = parseNumericValue(columns[6])

      return {
        symbol,
        info: {
          price: closeValue,
          changePercent: null,
        },
      }
    })
  )

  const mapped: Record<string, PriceInfo> = {}
  results.forEach((entry) => {
    if (!entry || !entry.symbol) {
      return
    }
    mapped[entry.symbol] = entry.info
  })

  return mapped
}

const stooqWtiSymbol = 'cl.f' as const

const fetchWtiFromStooq = async (): Promise<PriceInfo | null> => {
  try {
    const quotes = await fetchStooqQuotes([stooqWtiSymbol])
    return quotes[stooqWtiSymbol] ?? null
  } catch (error) {
    console.error('Stooq 국제 유가 데이터 조회 실패', error)
  }

  return null
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
        throw new Error(`Gate.io ${symbol} 시세 응답 오류`)
      }

      const data = (await response.json()) as Array<{
        contract?: string
        last?: string
        change_percentage?: string
      }>

      const entry = data.find((item) => item.contract === symbol)
      if (!entry) {
        return null
      }

      const toNumber = (input?: string) => {
        if (!input) {
          return null
        }
        const parsed = Number.parseFloat(input)
        return Number.isNaN(parsed) ? null : parsed
      }

      return {
        symbol,
        price: toNumber(entry.last),
        changePercent: toNumber(entry.change_percentage),
      }
    })
  )

  const mapped: Record<string, PriceInfo> = {}
  results.forEach((item) => {
    if (!item) {
      return
    }
    mapped[item.symbol] = {
      price: item.price ?? null,
      changePercent: item.changePercent ?? null,
    }
  })

  return mapped
}

const fetchFmpQuotes = async (
  symbols: string[],
  apiKey?: string
): Promise<Record<string, PriceInfo>> => {
  if (!symbols.length) {
    return {}
  }

  const trimmedKey = apiKey?.trim()
  const resolvedKey = trimmedKey && trimmedKey.length > 0 ? trimmedKey : 'demo'

  const encodedSymbols = symbols.map((symbol) => encodeURIComponent(symbol))
  const url = new URL(
    `https://financialmodelingprep.com/api/v3/quote/${encodedSymbols.join(',')}`
  )
  url.searchParams.set('apikey', resolvedKey)

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json, text/plain, */*' },
    credentials: 'omit',
  })

  if (!response.ok) {
    if (!trimmedKey) {
      console.warn(
        `Financial Modeling Prep 공개 키(demo) 요청 실패 (status: ${response.status}). ` +
          '환경 변수 VITE_FMP_KEY에 유효한 API 키를 설정하면 더 안정적으로 데이터를 수신할 수 있습니다.'
      )
      return {}
    }

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

export type { PriceInfo }
export {
  fetchBinanceQuotes,
  fetchFmpQuotes,
  fetchGateIoQuotes,
  fetchStooqQuotes,
  fetchWtiFromStooq,
  fetchUsdKrwFromExchangeRateHost,
  fetchYahooQuotes,
  parseNumericValue,
}
