import { useEffect, useState } from 'react'

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

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

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

  useEffect(() => {
    let active = true

    const loadNews = async () => {
      setStatus('loading')
      try {
        const fmpKey = import.meta.env.VITE_FMP_KEY || 'demo'
        const alphaVantageKey = import.meta.env.VITE_ALPHA_VANTAGE_KEY || 'demo'

        let normalized: NewsItem[] = []
        const errors: unknown[] = []

        try {
          normalized = await fetchFmpNews(fmpKey)
        } catch (error) {
          errors.push(error)
        }

        if (!normalized.length) {
          try {
            normalized = await fetchAlphaVantageNews(alphaVantageKey)
          } catch (error) {
            errors.push(error)
          }
        }

        if (!normalized.length) {
          try {
            normalized = await fetchGoogleNewsRss()
          } catch (error) {
            errors.push(error)
          }
        }

        if (!active) {
          return
        }

        if (!normalized.length) {
          if (errors.length > 0) {
            throw errors[0] instanceof Error
              ? errors[0]
              : new Error('뉴스 데이터를 불러오는 데 실패했습니다.')
          }

          setNews([])
          setStatus('idle')
          return
        }

        setNews(normalized)
        setStatus('idle')
      } catch (error) {
        console.error(error)
        if (active) {
          setStatus('error')
        }
      }
    }

    loadNews()
    const interval = window.setInterval(loadNews, 5 * 60_000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  return (
    <section className="section" aria-labelledby="news-feed-heading">
      <div className="section-header">
        <div>
          <h2 id="news-feed-heading">실시간 경제 속보</h2>
          <span>중요도 높은 글로벌 경제 뉴스를 빠르게 확인하세요.</span>
        </div>
      </div>

      {status === 'error' && (
        <div className="status-banner" role="alert">
          최신 뉴스를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </div>
      )}

      {status === 'loading' && news.length === 0 ? (
        <div className="status-banner" role="status">
          경제 뉴스를 불러오는 중입니다...
        </div>
      ) : (
        <div className="news-grid">
          {news.slice(0, 9).map((item) => (
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
      )}
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

  const response = await fetch(url.toString())
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

  const response = await fetch(url.toString())
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
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
}

const fetchGoogleNewsRss = async (): Promise<NewsItem[]> => {
  const rssUrl =
    'https://r.jina.ai/https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ko&gl=KR&ceid=KR:ko'
  const response = await fetch(rssUrl)
  if (!response.ok) {
    throw new Error('Google 뉴스 응답 오류')
  }

  const raw = await response.text()
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
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
}

export default NewsFeed
