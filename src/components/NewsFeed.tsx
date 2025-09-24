import { useEffect, useState } from 'react'
import { fetchWithProxies } from '../utils/proxyFetch'
import { fallbackNewsNotice, getFallbackNews } from '../utils/fallbackData'
import { shouldUseLiveNewsData } from '../utils/liveDataFlags'

type NewsItem = {
  id: string
  title: string
  summary: string
  url: string
  source: string
  publishedAt: Date
}

type AlphaVantageNewsItem = {
  title?: string
  url?: string
  summary?: string
  source?: string
  time_published?: string
  uuid?: string
}

type FmpNewsItem = {
  title?: string
  url?: string
  text?: string
  site?: string
  publishedDate?: string
  symbol?: string
  symbols?: string[]
  news_id?: string
  id?: string | number
}

const relevantKeywordPatterns: RegExp[] = [
  /미국\s*증시/i,
  /미\s*증시/i,
  /뉴욕\s*증시/i,
  /미국\s*주식/i,
  /월가/i,
  /wall street/i,
  /dow jones/i,
  /nasdaq/i,
  /nyse/i,
  /s&p\s*500/i,
  /s&p500/i,
  /u\.?s\.?\s+(?:stock|stocks|market|markets)/i,
  /us\s+(?:stock|stocks|market|markets)/i,
  /비트코인/i,
  /bitcoin/i,
  /\bbtc\b/i,
  /이더리움/i,
  /ethereum/i,
  /\beth\b/i,
  /리플/i,
  /\bxrp\b/i,
  /암호화폐/i,
  /crypto/i,
  /cryptocurrency/i,
  /코인/i,
  /digital asset/i,
  /blockchain/i,
  /binance/i,
  /coinbase/i,
  /coindesk/i,
  /cointelegraph/i,
  /stablecoin/i,
  /altcoin/i,
]

const decodeBasicHtmlEntities = (value: string) =>
  value
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const stripHtml = (value: string) =>
  decodeBasicHtmlEntities(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()

const isRelevantNewsItem = (item: NewsItem) => {
  const haystack = [item.title, item.summary, item.source].filter(Boolean).join(' ')
  return relevantKeywordPatterns.some((pattern) => pattern.test(haystack))
}

const parseAlphaVantagePublishedAt = (value?: string): Date | null => {
  if (!value) {
    return null
  }

  const pattern = /^([0-9]{4})([0-9]{2})([0-9]{2})T([0-9]{2})([0-9]{2})([0-9]{2})$/
  const match = value.match(pattern)
  if (!match) {
    const fallback = new Date(value)
    return Number.isNaN(fallback.getTime()) ? null : fallback
  }

  const [, year, month, day, hour, minute, second] = match
  const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`
  const parsed = new Date(isoString)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const parseFmpPublishedAt = (value?: string): Date | null => {
  if (!value) {
    return null
  }

  const normalized = value.replace(' ', 'T')
  const hasTimezone = /[zZ]|[+-][0-9]{2}:?[0-9]{2}$/.test(normalized)
  const isoString = hasTimezone ? normalized : `${normalized}Z`
  const parsed = new Date(isoString)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const parseRssPublishedAt = (value?: string): Date | null => {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const formatRelativeTime = (date: Date) => {
  const formatter = new Intl.RelativeTimeFormat('ko-KR', { numeric: 'auto' })
  const now = new Date()
  const diffInSeconds = (date.getTime() - now.getTime()) / 1000
  const absDiff = Math.abs(diffInSeconds)

  if (absDiff < 60) {
    return formatter.format(Math.round(diffInSeconds), 'second')
  }
  if (absDiff < 3600) {
    return formatter.format(Math.round(diffInSeconds / 60), 'minute')
  }
  if (absDiff < 86_400) {
    return formatter.format(Math.round(diffInSeconds / 3600), 'hour')
  }
  return formatter.format(Math.round(diffInSeconds / 86_400), 'day')
}

const formatDateLabel = (date: Date) => {
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const NewsFeed = () => {
  const [news, setNews] = useState<NewsItem[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading')
  const [notice, setNotice] = useState<string | null>(null)
  const useLiveNews = shouldUseLiveNewsData()

  useEffect(() => {
    if (!useLiveNews) {
      const fallbackItems = getFallbackNews()
      setNews(fallbackItems)
      setStatus('idle')
      setNotice(fallbackNewsNotice)
      return
    }

    let active = true

    const loadNews = async () => {
      setStatus('loading')
      setNotice(null)

      const fmpKey = import.meta.env.VITE_FMP_KEY?.trim()
      const alphaVantageKey = import.meta.env.VITE_ALPHA_VANTAGE_KEY?.trim()
      const shouldUseAlpha = Boolean(alphaVantageKey && alphaVantageKey.toLowerCase() !== 'demo')

      const candidates: Array<{
        label: string
        notice: string | null
        loader: () => Promise<NewsItem[]>
      }> = []

      if (fmpKey) {
        candidates.push({
          label: 'Financial Modeling Prep',
          notice: 'Financial Modeling Prep 실시간 속보 API에서 미국 증시와 코인 뉴스를 선별했습니다.',
          loader: () => fetchFmpNews(fmpKey),
        })
      }

      candidates.push({
        label: 'Google 뉴스',
        notice: 'Google 뉴스 Business RSS에서 미국 증시와 코인 관련 기사를 선별했습니다.',
        loader: fetchGoogleNewsRss,
      })

      if (shouldUseAlpha && alphaVantageKey) {
        candidates.push({
          label: 'Alpha Vantage',
          notice: 'Alpha Vantage 뉴스 API에서 미국 증시 및 코인 이슈를 선별해 제공합니다.',
          loader: () => fetchAlphaVantageNews(alphaVantageKey),
        })
      }

      const errors: unknown[] = []
      let loadedNews: NewsItem[] = []
      let selectedNotice: string | null = null

      for (const candidate of candidates) {
        try {
          const result = await candidate.loader()
          if (result.length > 0) {
            loadedNews = result
            selectedNotice = candidate.notice
            break
          }
        } catch (error) {
          console.error(`${candidate.label} 뉴스 로딩 실패`, error)
          errors.push(error)
        }
      }

      if (!active) {
        return
      }

      if (loadedNews.length > 0) {
        setNews(loadedNews)
        setStatus('idle')
        setNotice(selectedNotice)
        return
      }

      const fallbackNews = getFallbackNews()
      if (fallbackNews.length > 0) {
        setNews(fallbackNews)
        setStatus('idle')
        setNotice(fallbackNewsNotice)
        return
      }

      setNews([])
      if (errors.length > 0) {
        setStatus('error')
        setNotice('실시간 뉴스 공급자에 연결할 수 없습니다. 네트워크 상태를 확인한 후 다시 시도해 주세요.')
      } else {
        setStatus('idle')
        setNotice('현재 표시할 실시간 뉴스가 없습니다. 잠시 후 다시 확인해 주세요.')
      }
    }

    loadNews().catch((error) => {
      if (!active) {
        return
      }
      console.error('뉴스 데이터를 불러오는 중 예기치 못한 오류가 발생했습니다.', error)
      setStatus('error')
      setNotice('뉴스 데이터를 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.')
    })
    const interval = window.setInterval(loadNews, 5 * 60_000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [useLiveNews])

  return (
    <section className="section" aria-labelledby="news-feed-heading">
      <div className="section-header">
        <div>
          <h2 id="news-feed-heading" className="section-title">
            <span className="section-title-icon news" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false" role="img">
                <path
                  d="M5 4a2 2 0 0 0-2 2v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H5Zm0 2h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6Zm2 2v3h6V8H7Zm0 5v3h6v-3H7Zm8-5h2v8h-2V8Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <span className="section-title-text">실시간 미국 증시 · 코인 속보</span>
          </h2>
          <span>미국 증시와 주요 코인 관련 뉴스를 선별해 빠르게 전해드립니다.</span>
        </div>
      </div>

      {status === 'error' && (
        <div className="status-banner" role="alert">
          최신 뉴스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </div>
      )}

      {status !== 'loading' && notice && (
        <div className="status-banner" role="status">
          {notice}
        </div>
      )}

      {status === 'loading' && news.length === 0 ? (
        <div className="status-banner" role="status">
          경제 뉴스를 불러오는 중입니다...
        </div>
      ) : news.length > 0 ? (
        <div className="news-grid">
          {news.slice(0, 8).map((item) => (
            <article className="news-card" key={item.id}>
              <h3>{item.title}</h3>
              {item.summary && <p>{item.summary}</p>}
              <div className="news-meta">
                <span>{item.source}</span>
                <span>
                  {formatDateLabel(item.publishedAt)} · {formatRelativeTime(item.publishedAt)}
                </span>
              </div>
              <a href={item.url} target="_blank" rel="noreferrer">
                전문 보기
              </a>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}

const fetchFmpNews = async (apiKey: string): Promise<NewsItem[]> => {
  if (!apiKey) {
    return []
  }

  const url = new URL('https://financialmodelingprep.com/api/v3/stock_news')
  url.searchParams.set('limit', '50')
  url.searchParams.set('apikey', apiKey)

  const response = await fetchWithProxies(url)
  if (!response.ok) {
    throw new Error('Financial Modeling Prep 뉴스 응답 오류')
  }

  const payload = (await response.json()) as FmpNewsItem[] | { error?: string }
  if (!Array.isArray(payload)) {
    throw new Error('Financial Modeling Prep 뉴스 데이터 형식 오류')
  }

  return payload
    .map((item) => {
      const publishedAt = parseFmpPublishedAt(item.publishedDate)
      if (!item.title || !item.url || !publishedAt) {
        return null
      }

      const id = item.news_id ?? item.id ?? `${item.title}-${item.publishedDate ?? item.url}`
      const source = item.site || (item.symbols && item.symbols.length > 0 ? item.symbols.join(', ') : '출처 미확인')

      const summary = item.text ? stripHtml(item.text) : ''

      return {
        id: typeof id === 'string' ? id : `${id}`,
        title: item.title,
        summary,
        url: item.url,
        source,
        publishedAt,
      }
    })
    .filter((item): item is NewsItem => Boolean(item))
    .filter(isRelevantNewsItem)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
}

const fetchAlphaVantageNews = async (apiKey: string): Promise<NewsItem[]> => {
  if (!apiKey) {
    return []
  }

  const url = new URL('https://www.alphavantage.co/query')
  url.searchParams.set('function', 'NEWS_SENTIMENT')
  url.searchParams.set('topics', 'financial_markets')
  url.searchParams.set('sort', 'LATEST')
  url.searchParams.set('limit', '12')
  url.searchParams.set('apikey', apiKey)

  const response = await fetchWithProxies(url)
  if (!response.ok) {
    throw new Error('Alpha Vantage 뉴스 응답 오류')
  }

  const payload = await response.json()
  const feed = Array.isArray(payload?.feed) ? (payload.feed as AlphaVantageNewsItem[]) : []

  return feed
    .map((item) => {
      const publishedAt = parseAlphaVantagePublishedAt(item.time_published)
      if (!item.title || !item.url || !publishedAt) {
        return null
      }
      return {
        id: item.uuid ?? `${item.title}-${item.url}`,
        title: item.title,
        summary: item.summary ? stripHtml(item.summary) : '',
        url: item.url,
        source: item.source ?? '출처 미확인',
        publishedAt,
      }
    })
    .filter((item): item is NewsItem => Boolean(item))
    .filter(isRelevantNewsItem)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
}

const fetchGoogleNewsRss = async (): Promise<NewsItem[]> => {
  const baseUrl = new URL('https://news.google.com/rss/headlines/section/topic/BUSINESS')
  baseUrl.searchParams.set('hl', 'ko')
  baseUrl.searchParams.set('gl', 'KR')
  baseUrl.searchParams.set('ceid', 'KR:ko')

  const buildRssHeaders = () => ({
    Accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
  })

  const loaders: Array<() => Promise<Response>> = [
    () => fetchWithProxies(baseUrl, { headers: buildRssHeaders() }),
    () =>
      fetch(`https://r.jina.ai/${baseUrl.toString()}`, {
        headers: buildRssHeaders(),
      }),
  ]

  const errors: unknown[] = []

  for (const loader of loaders) {
    try {
      const response = await loader()
      if (!response.ok) {
        const error = new Error(`Google 뉴스 RSS 응답 오류 (status: ${response.status})`)
        console.error(error)
        errors.push(error)
        continue
      }

      const raw = await response.text()
      const parsed = parseGoogleNewsRss(raw)

      if (parsed.length > 0) {
        return parsed
      }
    } catch (error) {
      console.error('Google 뉴스 RSS 소스 로딩 실패', error)
      errors.push(error)
    }
  }

  if (errors.length > 0) {
    throw errors[0] instanceof Error
      ? errors[0]
      : new Error('Google 뉴스 RSS 데이터를 불러오는 중 알 수 없는 오류가 발생했습니다.')
  }

  return []
}

const stripCdata = (value: string) => value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')

const parseGoogleNewsRssWithDomParser = (raw: string): NewsItem[] => {
  if (typeof DOMParser === 'undefined') {
    throw new Error('RSS 파서를 초기화할 수 없습니다.')
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(raw, 'application/xml')
  if (doc.querySelector('parsererror')) {
    throw new Error('Google 뉴스 RSS 파싱 오류')
  }
  const itemNodes = Array.from(doc.querySelectorAll('item'))

  return itemNodes
    .map((node, index) => {
      const title = node.querySelector('title')?.textContent?.trim() ?? ''
      const link = node.querySelector('link')?.textContent?.trim() ?? ''
      const description = node.querySelector('description')?.textContent ?? ''
      const sourceLabel = node.querySelector('source')?.textContent?.trim() ?? ''
      const guid = node.querySelector('guid')?.textContent?.trim() ?? ''
      const publishedAt = parseRssPublishedAt(node.querySelector('pubDate')?.textContent ?? undefined)

      if (!title || !link || !publishedAt) {
        return null
      }

      let source = sourceLabel
      if (!source) {
        try {
          const derived = new URL(link)
          source = derived.hostname.replace(/^www\./, '')
        } catch (error) {
          console.warn('뉴스 출처 정보를 파싱하지 못했습니다.', error)
          source = '출처 미확인'
        }
      }

      const id = guid || `${link}-${index}`

      return {
        id,
        title,
        summary: stripHtml(description),
        url: link,
        source,
        publishedAt,
      }
    })
    .filter((item): item is NewsItem => Boolean(item))
    .filter(isRelevantNewsItem)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
}

const extractRssTagContent = (block: string, tag: string) => {
  const regex = new RegExp(String.raw`<${tag}[^>]*>([\s\S]*?)</${tag}>`, 'i')
  const match = block.match(regex)
  if (!match) {
    return ''
  }

  return stripCdata(match[1]).trim()
}

const parseGoogleNewsRssFallback = (raw: string): NewsItem[] => {
  try {
    const matches = raw.match(/<item\b[\s\S]*?<\/item>/gi)
    if (!matches) {
      return []
    }

    const items: NewsItem[] = []

    matches.forEach((block, index) => {
      const title = extractRssTagContent(block, 'title')
      const linkRaw = extractRssTagContent(block, 'link')
      const description = extractRssTagContent(block, 'description')
      const sourceLabel = extractRssTagContent(block, 'source')
      const guid = extractRssTagContent(block, 'guid')
      const publishedAt = parseRssPublishedAt(extractRssTagContent(block, 'pubDate') || undefined)

      const normalizedTitle = decodeBasicHtmlEntities(title)
      const normalizedLink = decodeBasicHtmlEntities(linkRaw)
      let source = decodeBasicHtmlEntities(sourceLabel)

      if (!normalizedTitle || !normalizedLink || !publishedAt) {
        return
      }

      if (!source) {
        try {
          const derived = new URL(normalizedLink)
          source = derived.hostname.replace(/^www\./, '')
        } catch (error) {
          console.warn('뉴스 출처 정보를 파싱하지 못했습니다.', error)
          source = '출처 미확인'
        }
      }

      const id = guid || `${normalizedLink}-${index}`

      items.push({
        id,
        title: normalizedTitle,
        summary: stripHtml(description),
        url: normalizedLink,
        source,
        publishedAt,
      })
    })

    return items.filter(isRelevantNewsItem).sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
  } catch (error) {
    console.error('Google 뉴스 RSS 대체 파싱에 실패했습니다.', error)
    return []
  }
}

const parseGoogleNewsRss = (raw: string): NewsItem[] => {
  try {
    return parseGoogleNewsRssWithDomParser(raw)
  } catch (error) {
    console.warn('DOMParser를 사용할 수 없어 RSS를 대체 파서로 처리합니다.', error)
    return parseGoogleNewsRssFallback(raw)
  }
}

export default NewsFeed
