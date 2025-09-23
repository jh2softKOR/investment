const disabledProxyValues = new Set(['0', 'false', 'off', 'none', 'no', 'direct'])

type StrategyInit = RequestInit | ((url: URL) => RequestInit | null | undefined)

type ProxyStrategy = {
  id: string
  build: (url: URL) => string
  init?: StrategyInit
}

const directStrategy: ProxyStrategy = {
  id: 'direct',
  build: (url) => url.toString(),
}

const createStrategyFromTemplate = (
  template: string,
  id?: string,
  init?: StrategyInit
): ProxyStrategy => {
  const trimmed = template.trim()
  const identifier = id ?? `proxy:${trimmed}`

  if (!trimmed) {
    return directStrategy
  }

  if (trimmed.includes('{{encodedUrl}}')) {
    return {
      id: identifier,
      build: (url) => trimmed.replace(/{{encodedUrl}}/g, encodeURIComponent(url.toString())),
      init,
    }
  }

  if (trimmed.includes('{{url}}')) {
    return {
      id: identifier,
      build: (url) => trimmed.replace(/{{url}}/g, url.toString()),
      init,
    }
  }

  if (trimmed.includes('%s')) {
    return {
      id: identifier,
      build: (url) => trimmed.replace(/%s/g, url.toString()),
      init,
    }
  }

  if (/(?:\?|=|&)$/.test(trimmed)) {
    return {
      id: identifier,
      build: (url) => `${trimmed}${encodeURIComponent(url.toString())}`,
      init,
    }
  }

  const normalized = trimmed.endsWith('/') ? trimmed : `${trimmed}/`
  return {
    id: identifier,
    build: (url) => `${normalized}${url.toString()}`,
    init,
  }
}

const parseCustomTemplates = (raw: string) =>
  raw
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)

const defaultProxyStrategies: ProxyStrategy[] = [
  createStrategyFromTemplate('https://cors.isomorphic-git.org/', 'cors-isomorphic'),
  createStrategyFromTemplate('https://proxy.cors.workers.dev/?', 'cors-workers'),
  createStrategyFromTemplate('https://thingproxy.freeboard.workers.dev/fetch/', 'thingproxy-workers'),
  createStrategyFromTemplate('https://yacdn.org/proxy/', 'yacdn'),
  createStrategyFromTemplate('https://api.allorigins.win/raw?url=', 'allorigins'),
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
  [403, 429, 500, 502, 503, 504, 521, 522, 523, 524].includes(response.status)

const resolveStrategyInit = (strategy: ProxyStrategy, url: URL): RequestInit | undefined => {
  if (!strategy.init) {
    return undefined
  }

  if (typeof strategy.init === 'function') {
    return strategy.init(url) ?? undefined
  }

  return strategy.init
}

const mergeRequestInit = (base: RequestInit, override?: RequestInit): RequestInit => {
  if (!override) {
    return { ...base, headers: new Headers(base.headers ?? {}) }
  }

  const merged: RequestInit = { ...base, ...override }
  const baseHeaders = new Headers(base.headers ?? {})
  const overrideHeaders = new Headers(override.headers ?? {})

  overrideHeaders.forEach((value, key) => {
    baseHeaders.set(key, value)
  })

  merged.headers = baseHeaders
  return merged
}

export const fetchWithProxies = async (url: URL, init?: RequestInit) => {
  const baseInit: RequestInit = { ...init }
  const headers = new Headers(init?.headers ?? {})

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json, text/plain, */*')
  }

  baseInit.headers = headers
  if (!baseInit.credentials) {
    baseInit.credentials = 'omit'
  }

  let lastError: unknown = null

  for (let index = 0; index < proxyStrategies.length; index += 1) {
    const strategy = proxyStrategies[index]
    const targetUrl = strategy.build(url)
    const isLast = index === proxyStrategies.length - 1
    const strategyInit = resolveStrategyInit(strategy, url)
    const requestInit = mergeRequestInit(baseInit, strategyInit)

    try {
      const response = await fetch(targetUrl, requestInit)

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
