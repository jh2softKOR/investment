import type { PriceInfo } from './marketData'

type FearGreedVariant = 'us-market' | 'crypto'

type FearGreedFallbackEntry = {
  value: number
  classification: string
  timestamp: string
}

type NewsFallbackEntry = {
  id: string
  title: string
  summary: string
  url: string
  source: string
  publishedAt: string
}

const fallbackUsdKrw: PriceInfo = {
  price: 1332.45,
  changePercent: -0.28,
}

const fallbackWti: PriceInfo = {
  price: 78.92,
  changePercent: 0.73,
}

const fallbackMarketPrices: Record<string, PriceInfo> = {
  nasdaq: { price: 15882.35, changePercent: 0.65 },
  dow: { price: 38650.12, changePercent: 0.42 },
  btc: { price: 67850.0, changePercent: 1.12 },
  eth: { price: 3580.0, changePercent: -0.45 },
  xrp: { price: 0.52, changePercent: 0.88 },
  bgsc: { price: 0.183, changePercent: -2.15 },
}

const fallbackMarketNotice =
  '실시간 시세 수신에 실패하여 최근 종가 기준 참고용 데이터를 표시합니다.'

const fallbackMarketPartialNotice =
  '일부 종목 시세는 최근 종가 기준 참고용 데이터입니다.'

const fallbackExchangeNotice =
  '실시간 환율/유가 연결이 원활하지 않아 최근 종가 기준 참고용 데이터를 제공합니다.'

const fallbackFearGreedNotice =
  '실시간 공포·탐욕 지수를 불러오지 못해 최근 공개 수치를 참고용으로 제공합니다.'

const fallbackNewsNotice =
  '실시간 뉴스 공급자 연결이 원활하지 않아 주요 헤드라인 예시를 제공합니다.'

const fallbackFearGreedHistory: Record<FearGreedVariant, FearGreedFallbackEntry[]> = {
  'us-market': [
    { value: 68, classification: 'Greed', timestamp: '2025-03-02T14:30:00Z' },
    { value: 66, classification: 'Greed', timestamp: '2025-03-01T14:30:00Z' },
    { value: 62, classification: 'Greed', timestamp: '2025-02-28T14:30:00Z' },
    { value: 58, classification: 'Greed', timestamp: '2025-02-27T14:30:00Z' },
    { value: 55, classification: 'Greed', timestamp: '2025-02-26T14:30:00Z' },
    { value: 52, classification: 'Neutral', timestamp: '2025-02-25T14:30:00Z' },
    { value: 48, classification: 'Neutral', timestamp: '2025-02-24T14:30:00Z' },
  ],
  crypto: [
    { value: 72, classification: 'Greed', timestamp: '2025-03-02T00:00:00Z' },
    { value: 70, classification: 'Greed', timestamp: '2025-03-01T00:00:00Z' },
    { value: 67, classification: 'Greed', timestamp: '2025-02-28T00:00:00Z' },
    { value: 63, classification: 'Greed', timestamp: '2025-02-27T00:00:00Z' },
    { value: 58, classification: 'Greed', timestamp: '2025-02-26T00:00:00Z' },
    { value: 54, classification: 'Greed', timestamp: '2025-02-25T00:00:00Z' },
    { value: 49, classification: 'Neutral', timestamp: '2025-02-24T00:00:00Z' },
  ],
}

const fallbackNewsItems: NewsFallbackEntry[] = [
  {
    id: 'fallback-nyse-rebound',
    title: '뉴욕증시, 기술주 반등에 상승 마감',
    summary:
      '미 연준의 완화적 발언과 반도체 섹터 강세에 힘입어 나스닥과 다우가 동반 상승했습니다.',
    url: 'https://www.cnbc.com/markets/',
    source: 'CNBC',
    publishedAt: '2025-03-02T21:10:00Z',
  },
  {
    id: 'fallback-treasury-yield',
    title: '미 국채 수익률 하락, 성장주 투자심리 개선',
    summary:
      '10년물 국채 수익률이 4.1%대까지 밀리며 성장주 투자심리가 개선됐다는 평가가 나옵니다.',
    url: 'https://www.bloomberg.com/markets',
    source: 'Bloomberg',
    publishedAt: '2025-03-02T19:45:00Z',
  },
  {
    id: 'fallback-bitcoin-range',
    title: '비트코인, 6만7천 달러선에서 박스권 유지',
    summary:
      'ETF 자금 유입이 둔화됐지만 기관 수요는 유지되며 비트코인이 좁은 범위에서 거래되고 있습니다.',
    url: 'https://www.coindesk.com/markets/2025/03/02/',
    source: 'CoinDesk',
    publishedAt: '2025-03-02T17:30:00Z',
  },
  {
    id: 'fallback-eth-upgrade',
    title: '이더리움, 네트워크 업그레이드 기대감에 강세',
    summary:
      '다음 분기 예정된 이더리움 네트워크 업그레이드 기대감이 투자심리를 지지하고 있습니다.',
    url: 'https://www.theblock.co/latest',
    source: 'The Block',
    publishedAt: '2025-03-02T15:20:00Z',
  },
]

const getFallbackFearGreedHistory = (variant: FearGreedVariant) =>
  fallbackFearGreedHistory[variant].map((entry) => ({
    value: entry.value,
    classification: entry.classification,
    timestamp: new Date(entry.timestamp),
  }))

const getFallbackNews = () =>
  fallbackNewsItems.map((item) => ({
    ...item,
    publishedAt: new Date(item.publishedAt),
  }))

export {
  fallbackExchangeNotice,
  fallbackFearGreedNotice,
  fallbackMarketNotice,
  fallbackMarketPartialNotice,
  fallbackMarketPrices,
  fallbackNewsNotice,
  fallbackUsdKrw,
  fallbackWti,
  getFallbackFearGreedHistory,
  getFallbackNews,
}
export type { FearGreedVariant, NewsFallbackEntry }
