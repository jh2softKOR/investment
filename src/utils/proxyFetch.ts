const disabledProxyValues = new Set(['0', 'false', 'off', 'none', 'no', 'direct'])

type ProxyStrategy = {
  id: string
  build: (url: URL) => string
}

const directStrategy: ProxyStrategy = {
  id: 'direct',
  build: (url) => url.toString(),
}

const createStrategyFromTemplate = (template: string, id?: string): ProxyStrategy => {
  const trimmed = template.trim()
  const identifier = id ?? `proxy:${trimmed}`

  if (!trimmed) {
    return directStrategy
  }

  if (trimmed.includes('{{encodedUrl}}')) {
    return {
      id: identifier,
      build: (url) => trimmed.replace(/{{encodedUrl}}/g, encodeURIComponent(url.toString())),
    }
  }

  if (trimmed.includes('{{url}}')) {
    return {
      id: identifier,
      build: (url) => trimmed.replace(/{{url}}/g, url.toString()),
    }
  }

  if (trimmed.includes('%s')) {
    return {
      id: identifier,
      build: (url) => trimmed.replace(/%s/g, url.toString()),
    }
  }

  if (/(?:\?|=|&)$/.test(trimmed)) {
    return {
      id: identifier,
      build: (url) => `${trimmed}${encodeURIComponent(url.toString())}`,
    }
  }

  const normalized = trimmed.endsWith('/') ? trimmed : `${trimmed}/`
  return {
    id: identifier,
    build: (url) => `${normalized}${url.toString()}`,
  }
}

const parseCustomTemplates = (raw: string) =>
  raw
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)

const defaultProxyStrategies: ProxyStrategy[] = [
  createStrategyFromTemplate('https://cors.isomorphic-git.org/', 'cors-isomorphic'),
  createStrategyFromTemplate('https://thingproxy.freeboard.io/fetch/', 'thingproxy'),
  createStrategyFromTemplate('https://corsproxy.io/?', 'corsproxy-io'),
  createStrategyFromTemplate('https://api.allorigins.win/raw?url=', 'allorigins'),
  createStrategyFromTemplate('https://r.jina.ai/', 'r-jina'),
]

const appendDirectIfMissing = (strategies: ProxyStrategy[]) => {
  if (strategies.some((strategy) => strategy.id === directStrategy.id)) {
    return strategies
  }

  return [...strategies, directStrategy]
}

const resolveProxyStrategies = (): ProxyStrategy[] => {
  const raw = import.meta.env.VITE_MARKET_DATA_PROXY
  const trimmed = typeof raw === 'string' ? raw.trim() : ''

  if (trimmed) {
    const lowered = trimmed.toLowerCase()
    if (disabledProxyValues.has(lowered)) {
      return [directStrategy]
    }

    const entries = parseCustomTemplates(trimmed)
    if (entries.length > 0) {
      const customStrategies = entries
        .map((entry, index) => {
          if (disabledProxyValues.has(entry.toLowerCase())) {
            return null
          }
          return createStrategyFromTemplate(entry, `custom-${index}`)
        })
        .filter((strategy): strategy is ProxyStrategy => Boolean(strategy))

      if (customStrategies.length > 0) {
        return appendDirectIfMissing(customStrategies)
      }
    }
  }

  return appendDirectIfMissing(defaultProxyStrategies)
}

const proxyStrategies = resolveProxyStrategies()

const shouldRetryWithNextProxy = (response: Response) =>
  [403, 429, 500, 502, 503, 504].includes(response.status)

export const fetchWithProxies = async (url: URL, init?: RequestInit) => {
  const finalInit: RequestInit = { ...init }
  const headers = new Headers(init?.headers ?? {})

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json, text/plain, */*')
  }

  finalInit.headers = headers
  if (!finalInit.credentials) {
    finalInit.credentials = 'omit'
  }

  let lastError: unknown = null

  for (let index = 0; index < proxyStrategies.length; index += 1) {
    const strategy = proxyStrategies[index]
    const targetUrl = strategy.build(url)
    const isLast = index === proxyStrategies.length - 1

    try {
      const response = await fetch(targetUrl, finalInit)

      if (!response.ok && !isLast && shouldRetryWithNextProxy(response)) {
        lastError = new Error(`Proxy ${strategy.id} responded with status ${response.status}`)
        if (response.body) {
          try {
            await response.body.cancel()
          } catch {
            // ignore cancellation errors
          }
        }
        continue
      }

      return response
    } catch (error) {
      lastError = error
    }
  }

  if (lastError instanceof Error) {
    throw lastError
  }

  throw new Error('모든 프록시 요청이 실패했습니다.')
}

export { disabledProxyValues }
