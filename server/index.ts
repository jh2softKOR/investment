import cors from 'cors'
import express from 'express'
import calendarRouter from './calendarRouter'
import consultationRouter from './consultationRouter'

const app = express()

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ?.split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0)

if (allowedOrigins && allowedOrigins.length > 0) {
  app.use(cors({ origin: allowedOrigins }))
} else {
  app.use(cors())
}
app.use(express.json())

app.get('/healthz', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api/trading-economics/calendar', calendarRouter)
app.use('/api/consultations', consultationRouter)

const yahooSymbols = ['GC=F', 'SI=F', 'CL=F', 'USDKRW=X'] as const

type YahooQuoteEntry = {
  symbol?: string
  regularMarketPrice?: number | string | null
  regularMarketPreviousClose?: number | string | null
  regularMarketChange?: number | string | null
  regularMarketChangePercent?: number | string | null
}

type YahooQuoteResponse = {
  quoteResponse?: {
    result?: YahooQuoteEntry[]
  }
}

const parseNumeric = (value: unknown) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }

    const parsed = Number.parseFloat(trimmed)
    return Number.isNaN(parsed) ? null : parsed
  }

  return null
}

app.get('/api/quotes', async (_req, res) => {
  try {
    const url = new URL('https://query1.finance.yahoo.com/v7/finance/quote')
    url.searchParams.set('symbols', yahooSymbols.join(','))

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Yahoo Finance 응답 오류 (status: ${response.status})`)
    }

    const payload = (await response.json()) as YahooQuoteResponse
    const results = payload.quoteResponse?.result ?? []

    const mapped = results
      .filter((entry): entry is YahooQuoteEntry & { symbol: string } => Boolean(entry?.symbol))
      .map((entry) => {
        const price = parseNumeric(entry.regularMarketPrice)
        const previousClose = parseNumeric(entry.regularMarketPreviousClose)
        const change = parseNumeric(entry.regularMarketChange)

        let changePercent = parseNumeric(entry.regularMarketChangePercent)
        if (changePercent === null && change !== null && previousClose !== null && previousClose !== 0) {
          changePercent = (change / previousClose) * 100
        }

        return {
          symbol: entry.symbol,
          price,
          prevClose: previousClose,
          change,
          changePct: changePercent,
        }
      })

    res.json(mapped)
  } catch (error) {
    const message = error instanceof Error ? error.message : '시세 데이터를 불러오지 못했습니다.'
    console.error('Yahoo Finance 시세 조회 실패', error)
    res.status(500).json({ error: message })
  }
})

const port = Number.parseInt(process.env.PORT ?? process.env.SERVER_PORT ?? '4174', 10)

if (!Number.isFinite(port) || port <= 0) {
  throw new Error('유효한 서버 포트를 확인할 수 없습니다. PORT 환경 변수를 설정하세요.')
}

app.listen(port, () => {
  console.log(`Trading Economics 캘린더 프록시 서버가 ${port} 포트에서 실행 중입니다.`)
})

export default app
