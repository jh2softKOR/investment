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

type ExchangeRateHostResponse = {
  success?: boolean
  rates?: Record<string, number | string | null>
  base?: string
}

type YahooQuoteEntry = {
  symbol?: string
  regularMarketPrice?: number | string | null
  regularMarketChangePercent?: number | string | null
  regularMarketChange?: number | string | null
  regularMarketPreviousClose?: number | string | null
}

type YahooQuoteResponse = {
  quoteResponse?: {
    result?: YahooQuoteEntry[]
  }
}

type YahooProxyQuoteEntry = {
  symbol?: string
  price?: number | string | null
  prevClose?: number | string | null
  change?: number | string | null
  changePct?: number | string | null
}

type UnknownRecord = Record<string, unknown>

type InvestingQuoteResponse = {
  data?: unknown
  quote?: unknown
  quotes?: unknown
  instrument?: unknown
  financialData?: unknown
}

const investingPriceKeys = [
  'last',
  'last_price',
  'lastPrice',
  'last_close',
  'lastClose',
  'price',
  'last_value',
  'lastValue',
  'close',
  'ltp',
  'value',
  'trade_price',
] as const

const investingChangePercentKeys = [
  'changePct',
  'change_pct',
  'changePercentage',
  'change_percentage',
  'changePercent',
  'change_percent',
  'pctChange',
  'pct_change',
  'change_percent_number',
  'change_percentage_number',
] as const

const investingChangeKeys = [
  'change',
  'day_change',
  'change_value',
  'change_value_number',
] as const

const investingPreviousCloseKeys = [
  'prevClose',
  'previousClose',
  'prev_close',
  'previous_close',
  'last_close',
  'lastClose',
] as const

const findInvestingQuoteCandidate = (input: unknown, visited = new Set<unknown>()): UnknownRecord | null => {
  if (!input || typeof input !== 'object') {
    return null
  }

  if (visited.has(input)) {
    return null
  }
  visited.add(input)

  if (Array.isArray(input)) {
    for (const item of input) {
      const found = findInvestingQuoteCandidate(item, visited)
      if (found) {
        return found
      }
    }
    return null
  }

  const record = input as UnknownRecord
  const keys = Object.keys(record)
  const hasPriceKey = keys.some((key) => investingPriceKeys.includes(key as (typeof investingPriceKeys)[number]))
  if (hasPriceKey) {
    return record
  }

  for (const value of Object.values(record)) {
    const found = findInvestingQuoteCandidate(value, visited)
    if (found) {
      return found
    }
  }

  return null
}

const pickInvestingValue = (entry: UnknownRecord, keys: readonly string[]) => {
  for (const key of keys) {
    if (!(key in entry)) {
      continue
    }
    const value = entry[key]
    const parsed = parseNumericValue(value)
    if (parsed !== null) {
      return parsed
    }
  }
  return null
}

const parseInvestingQuoteEntry = (entry: UnknownRecord | null): PriceInfo | null => {
  if (!entry) {
    return null
  }

  const price = pickInvestingValue(entry, investingPriceKeys)

  let changePercent = pickInvestingValue(entry, investingChangePercentKeys)

  if (changePercent === null) {
    const change = pickInvestingValue(entry, investingChangeKeys)
    if (change !== null) {
      const previousClose = pickInvestingValue(entry, investingPreviousCloseKeys)

      if (previousClose !== null && previousClose !== 0) {
        changePercent = (change / previousClose) * 100
      } else if (price !== null) {
        const inferredPrevious = price - change
        if (inferredPrevious !== 0) {
          changePercent = (change / inferredPrevious) * 100
        }
      }
    }
  }

  if (price === null && changePercent === null) {
    return null
  }

  return {
    price,
    changePercent,
  }
}

const fetchJsonWithProxiesFirst = async <T>(url: URL): Promise<T> => {
  const response = await fetchWithProxies(url)

  if (!response.ok) {
    throw new Error(`요청 실패 (status: ${response.status})`)
  }

  return (await response.json()) as T
}

const parseMetalsLiveEntry = (
  entry: unknown,
  metalKey: string,
): { price: number | null; changePercent: number | null } => {
  if (entry === null || entry === undefined) {
    return { price: null, changePercent: null }
  }

  if (typeof entry === 'number' || typeof entry === 'string') {
    return { price: parseNumericValue(entry), changePercent: null }
  }

  if (Array.isArray(entry)) {
    let price: number | null = null
    let changePercent: number | null = null

    for (let index = entry.length - 1; index >= 0; index -= 1) {
      const value = parseNumericValue(entry[index])
      if (value === null) {
        continue
      }

      if (price === null) {
        price = value
        continue
      }

      if (changePercent === null) {
        changePercent = value
        break
      }
    }

    return { price, changePercent }
  }

  const record = entry as Record<string, unknown>
  const priceKeys = [
    metalKey,
    'price',
    'spot',
    'value',
    'ask',
    'bid',
    'close',
    'last',
    'lastPrice',
    'current',
  ] as const

  let price: number | null = null
  for (const key of priceKeys) {
    price = parseNumericValue(record[key])
    if (price !== null) {
      break
    }
  }

  const changePercentKeys = [
    'changePercent',
    'change_percent',
    'changePct',
    'pctChange',
    'percentChange',
    'percent_change',
  ] as const

  let changePercent: number | null = null
  for (const key of changePercentKeys) {
    changePercent = parseNumericValue(record[key])
    if (changePercent !== null) {
      break
    }
  }

  if (changePercent === null) {
    const changeKeys = ['change', 'delta', 'diff'] as const
    const previousKeys = [
      'previous',
      'previousClose',
      'prevClose',
      'prev',
      'open',
      'lastClose',
    ] as const

    let change: number | null = null
    for (const key of changeKeys) {
      change = parseNumericValue(record[key])
      if (change !== null) {
        break
      }
    }

    if (change !== null) {
      for (const key of previousKeys) {
        const previous = parseNumericValue(record[key])
        if (previous !== null && previous !== 0) {
          changePercent = (change / previous) * 100
          break
        }
      }
    }
  }

  if (price === null) {
    const numericValues = Object.values(record)
      .map((value) => parseNumericValue(value))
      .filter((value): value is number => value !== null)

    if (numericValues.length > 0) {
      price = numericValues[numericValues.length - 1]
    }
  }

  return { price, changePercent }
}

const parseMetalsLiveResponse = (payload: unknown, metalKey: string): PriceInfo | null => {
  if (Array.isArray(payload)) {
    const mapped = payload
      .map((entry) => parseMetalsLiveEntry(entry, metalKey))
      .filter((entry) => entry.price !== null)

    if (mapped.length === 0) {
      return null
    }

    const latest = mapped[mapped.length - 1]
    if (latest.price === null) {
      return null
    }

    let { changePercent } = latest
    if (changePercent === null) {
      for (let index = mapped.length - 2; index >= 0; index -= 1) {
        const previous = mapped[index]
        if (previous.price !== null && previous.price !== 0) {
          changePercent = ((latest.price - previous.price) / previous.price) * 100
          break
        }
      }
    }

    return { price: latest.price, changePercent }
  }

  const parsed = parseMetalsLiveEntry(payload, metalKey)
  if (parsed.price === null) {
    return null
  }

  return parsed
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

const buildStooqSymbolVariants = (symbol: string) => {
  const trimmed = symbol.trim()
  const variants: string[] = []
  const pushUnique = (candidate: string | null | undefined) => {
    if (!candidate) {
      return
    }
    const normalized = candidate.trim()
    if (!normalized) {
      return
    }
    if (!variants.includes(normalized)) {
      variants.push(normalized)
    }
  }

  const lower = trimmed.toLowerCase()
  pushUnique(trimmed)
  pushUnique(lower)

  if (trimmed.startsWith('^')) {
    const withoutCaret = trimmed.slice(1)
    const lowerWithoutCaret = lower.slice(1)
    pushUnique(withoutCaret)
    pushUnique(lowerWithoutCaret)
    pushUnique(`${lowerWithoutCaret}.us`)
  } else {
    pushUnique(`${lower}.us`)
  }

  return variants
}

const parseStooqCsvPayload = (payload: string): PriceInfo | null => {
  const trimmed = payload.trim()
  if (!trimmed) {
    return null
  }

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) {
    return null
  }

  const header = lines[0].split(',').map((entry) => entry.trim().toLowerCase())
  const closeIndex = header.findIndex((entry) => entry === 'close' || entry === 'c')
  const resolvedCloseIndex = closeIndex >= 0 ? closeIndex : 4

  const parseRow = (line: string) =>
    line
      .split(',')
      .map((entry) => entry.trim())

  const dataRows = lines.slice(1)
  const latestRow = parseRow(dataRows[dataRows.length - 1])
  const previousRow = dataRows.length > 1 ? parseRow(dataRows[dataRows.length - 2]) : null

  if (resolvedCloseIndex >= latestRow.length) {
    return null
  }

  const latestClose = parseNumericValue(latestRow[resolvedCloseIndex])
  const previousClose =
    previousRow && resolvedCloseIndex < previousRow.length
      ? parseNumericValue(previousRow[resolvedCloseIndex])
      : null

  let changePercent: number | null = null
  if (
    latestClose !== null &&
    previousClose !== null &&
    previousClose !== 0 &&
    Number.isFinite(previousClose)
  ) {
    changePercent = ((latestClose - previousClose) / previousClose) * 100
  }

  if (latestClose === null && changePercent === null) {
    return null
  }

  return {
    price: latestClose,
    changePercent,
  }
}

const requestStooqQuote = async (requestSymbol: string): Promise<PriceInfo | null> => {
  const url = new URL('https://stooq.com/q/d/l/')
  url.searchParams.set('s', requestSymbol)
  url.searchParams.set('i', 'd')

  const response = await fetchWithProxies(url)
  if (!response.ok) {
    throw new Error(`Stooq ${requestSymbol} 시세 응답 오류 (status: ${response.status})`)
  }

  const text = await response.text()
  return parseStooqCsvPayload(text)
}

const fetchStooqQuotes = async (symbols: string[]): Promise<Record<string, PriceInfo>> => {
  if (!symbols.length) {
    return {}
  }

  const results = await Promise.all(
    symbols.map(async (symbol) => {
      const variants = buildStooqSymbolVariants(symbol)
      let lastError: unknown = null

      for (const variant of variants) {
        try {
          const info = await requestStooqQuote(variant)
          if (info) {
            return { symbol, info }
          }
        } catch (error) {
          lastError = error
        }
      }

      if (lastError) {
        console.warn(
          `Stooq ${symbol} 데이터 조회 실패, 시도한 심볼: ${variants.join(', ')}`,
          lastError
        )
      }

      return null
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

const fetchWtiFromStooqCsv = async (): Promise<PriceInfo | null> => {
  const url = new URL('https://stooq.com/q/l/')
  url.searchParams.set('s', 'cl.f')
  url.searchParams.set('f', 'sd2t2ohlcv')
  url.searchParams.set('h', '')
  url.searchParams.set('e', 'csv')

  try {
    const response = await fetchWithProxies(url, {
      headers: { Accept: 'text/csv, text/plain, */*' },
    })

    if (!response.ok) {
      throw new Error(`Stooq CSV 응답 오류 (status: ${response.status})`)
    }

    const text = await response.text()
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))

    if (lines.length < 2) {
      return null
    }

    const headers = lines[0].split(',').map((column) => column.trim().toLowerCase())
    const values = lines[1].split(',').map((value) => value.trim())

    const columnMap = new Map<string, string>()
    headers.forEach((header, index) => {
      columnMap.set(header, values[index] ?? '')
    })

    const close = parseNumericValue(columnMap.get('close'))
    const open = parseNumericValue(columnMap.get('open'))

    let changePercent: number | null = null
    if (close !== null && open !== null && open !== 0) {
      changePercent = ((close - open) / open) * 100
    }

    if (close === null) {
      return null
    }

    return { price: close, changePercent }
  } catch (error) {
    console.error('Stooq CSV 국제 유가 데이터 조회 실패', error)
  }

  return null
}

const fetchMetalsLiveSpot = async (metal: 'gold' | 'silver'): Promise<PriceInfo | null> => {
  const url = new URL(`https://api.metals.live/v1/spot/${metal}`)

  try {
    const response = await fetchWithProxies(url)

    if (!response.ok) {
      throw new Error(`Metals.live ${metal} 응답 오류 (status: ${response.status})`)
    }

    const text = await response.text()
    if (!text) {
      return null
    }

    let payload: unknown
    try {
      payload = JSON.parse(text)
    } catch (error) {
      console.error(`Metals.live ${metal} JSON 파싱 실패`, error)
      return null
    }

    return parseMetalsLiveResponse(payload, metal)
  } catch (error) {
    console.error(`Metals.live ${metal} 데이터 조회 실패`, error)
  }

  return null
}

const fetchGoldSpotFromMetalsLive = () => fetchMetalsLiveSpot('gold')

const fetchSilverSpotFromMetalsLive = () => fetchMetalsLiveSpot('silver')

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

const investingRequestHeaders = {
  Accept: 'application/json, text/plain, */*',
  'X-Requested-With': 'XMLHttpRequest',
}

const fetchInvestingQuote = async (symbol: string): Promise<{ symbol: string; info: PriceInfo } | null> => {
  const url = new URL(`https://api.investing.com/api/financialdata/${symbol}`)
  url.searchParams.set('locale', 'ko_KR')
  url.searchParams.set('lang', 'ko')

  try {
    const response = await fetchWithProxies(url, { headers: investingRequestHeaders })
    if (!response.ok) {
      throw new Error(`Investing.com ${symbol} 응답 오류 (status: ${response.status})`)
    }

    const payload = (await response.json()) as InvestingQuoteResponse
    const candidate =
      findInvestingQuoteCandidate(payload?.data) ??
      findInvestingQuoteCandidate(payload?.quote) ??
      findInvestingQuoteCandidate(payload?.quotes) ??
      findInvestingQuoteCandidate(payload?.financialData) ??
      findInvestingQuoteCandidate(payload)

    const info = parseInvestingQuoteEntry(candidate)
    if (!info) {
      throw new Error('시세 데이터가 포함되지 않은 응답입니다.')
    }

    return { symbol, info }
  } catch (error) {
    console.error(`Investing.com ${symbol} 시세 조회 실패`, error)
  }

  return null
}

const fetchInvestingQuotes = async (symbols: string[]): Promise<Record<string, PriceInfo>> => {
  if (!symbols.length) {
    return {}
  }

  const results = await Promise.all(symbols.map((symbol) => fetchInvestingQuote(symbol)))

  const mapped: Record<string, PriceInfo> = {}
  results.forEach((entry) => {
    if (!entry) {
      return
    }
    mapped[entry.symbol] = entry.info
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

const mapYahooQuoteEntries = (
  entries: YahooQuoteEntry[] | null | undefined
): Record<string, PriceInfo> => {
  const mapped: Record<string, PriceInfo> = {}

  entries?.forEach((entry) => {
    if (!entry?.symbol) {
      return
    }

    const price =
      parseNumericValue(entry.regularMarketPrice) ??
      parseNumericValue(entry.regularMarketPreviousClose)

    let changePercent = parseNumericValue(entry.regularMarketChangePercent)

    if (changePercent === null) {
      const change = parseNumericValue(entry.regularMarketChange)
      const previousClose = parseNumericValue(entry.regularMarketPreviousClose)

      if (change !== null && previousClose !== null && previousClose !== 0) {
        changePercent = (change / previousClose) * 100
      }
    }

    mapped[entry.symbol] = {
      price,
      changePercent,
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
    throw new Error(`Yahoo Finance 응답 오류 (status: ${response.status})`)
  }

  const payload = (await response.json()) as YahooQuoteResponse
  return mapYahooQuoteEntries(payload?.quoteResponse?.result)
}

const fetchYahooProxyQuotesFromLocal = async (): Promise<Record<string, PriceInfo>> => {
  const response = await fetch('/api/quotes', {
    cache: 'no-store',
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error(`로컬 Yahoo Finance 프록시 응답 오류 (status: ${response.status})`)
  }

  const payload = (await response.json()) as YahooProxyQuoteEntry[]

  const mapped: Record<string, PriceInfo> = {}
  payload.forEach((entry) => {
    if (!entry?.symbol) {
      return
    }

    const price = parseNumericValue(entry.price)
    const previousClose = parseNumericValue(entry.prevClose)
    let changePercent = parseNumericValue(entry.changePct)

    if (changePercent === null) {
      const change = parseNumericValue(entry.change)

      if (change !== null && previousClose !== null && previousClose !== 0) {
        changePercent = (change / previousClose) * 100
      }
    }

    mapped[entry.symbol] = {
      price,
      changePercent,
    }
  })

  return mapped
}

const fetchYahooProxyQuotes = async (): Promise<Record<string, PriceInfo>> => {
  return await fetchYahooProxyQuotesFromLocal()
}

export type { PriceInfo }
export {
  fetchBinanceQuotes,
  fetchGoldSpotFromMetalsLive,
  fetchFmpQuotes,
  fetchYahooProxyQuotes,
  fetchGateIoQuotes,
  fetchInvestingQuotes,
  fetchSilverSpotFromMetalsLive,
  fetchStooqQuotes,
  fetchWtiFromStooqCsv,
  fetchUsdKrwFromExchangeRateHost,
  fetchYahooQuotes,
  parseNumericValue,
}
