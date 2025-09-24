import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages 하위 경로(https://jh2softkor.github.io/investment/)에 맞춤
  base: '/investment/',
  server: {
    proxy: {
      '/api/trading-economics': {
        target: 'http://localhost:4174',
        changeOrigin: true,
        secure: false,
      },
      '/api/consultations': {
        target: 'http://localhost:4174',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
