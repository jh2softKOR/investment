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

const parsePublishedAt = (value?: string): Date | null => {
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
        const apiKey = import.meta.env.VITE_ALPHA_VANTAGE_KEY || 'demo'
        const url = new URL('https://www.alphavantage.co/query')
        url.searchParams.set('function', 'NEWS_SENTIMENT')
        url.searchParams.set('topics', 'financial_markets')
        url.searchParams.set('sort', 'LATEST')
        url.searchParams.set('limit', '12')
        url.searchParams.set('apikey', apiKey)

        const response = await fetch(url)
        if (!response.ok) {
          throw new Error('뉴스 응답 오류')
        }

        const payload = await response.json()
        const feed = (payload?.feed ?? []) as AlphaVantageNewsItem[]
        const normalized = feed
          .map((item) => {
            const publishedAt = parsePublishedAt(item.time_published)
            if (!item.title || !item.url || !publishedAt) {
              return null
            }
            return {
              id: item.uuid ?? `${item.title}-${item.url}`,
              title: item.title,
              summary: item.summary ?? '',
              url: item.url,
              source: item.source ?? '출처 미확인',
              publishedAt,
            }
          })
          .filter((item): item is NewsItem => Boolean(item))
          .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())

        if (!active) {
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

export default NewsFeed
