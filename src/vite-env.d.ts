/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ALPHA_VANTAGE_KEY?: string
  readonly VITE_DEFAULT_LIVE_DATA?: string
  readonly VITE_ENABLE_LIVE_CALENDAR_DATA?: string
  readonly VITE_ENABLE_LIVE_MARKET_DATA?: string
  readonly VITE_ENABLE_LIVE_NEWS_DATA?: string
  readonly VITE_ENABLE_LIVE_SENTIMENT_DATA?: string
  readonly VITE_ENABLE_LIVE_TICKER_DATA?: string
  readonly VITE_FMP_KEY?: string
  readonly VITE_MARKET_DATA_PROXY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
