/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MARKET_DATA_PROXY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
