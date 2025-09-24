import cors from 'cors'
import express from 'express'
import calendarRouter from './calendarRouter'

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

const port = Number.parseInt(process.env.PORT ?? process.env.SERVER_PORT ?? '4174', 10)

if (!Number.isFinite(port) || port <= 0) {
  throw new Error('유효한 서버 포트를 확인할 수 없습니다. PORT 환경 변수를 설정하세요.')
}

app.listen(port, () => {
  console.log(`Trading Economics 캘린더 프록시 서버가 ${port} 포트에서 실행 중입니다.`)
})

export default app
