import { Router } from 'express'
import { appendConsultation, getRecentConsultations } from './consultationStorage'

const MAX_NAME_LENGTH = 40
const MAX_CONTACT_LENGTH = 120
const MAX_MESSAGE_LENGTH = 1000

const sanitizeInput = (value: unknown) => {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

const parseLimit = (raw: unknown) => {
  if (typeof raw !== 'string') {
    return 20
  }
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 20
  }
  return Math.min(parsed, 100)
}

const consultationRouter = Router()

consultationRouter.get('/', async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit)
    const consultations = await getRecentConsultations(limit)
    res.json({
      items: consultations,
    })
  } catch (error) {
    console.error('상담창구 데이터를 조회하는 데 실패했습니다.', error)
    res.status(500).json({
      error: '상담 요청 내역을 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    })
  }
})

consultationRouter.post('/', async (req, res) => {
  try {
    const name = sanitizeInput(req.body?.name)
    const contact = sanitizeInput(req.body?.contact)
    const message = sanitizeInput(req.body?.message)

    if (!name) {
      return res.status(400).json({ error: '이름을 입력해 주세요.' })
    }
    if (!message) {
      return res.status(400).json({ error: '상담 내용을 입력해 주세요.' })
    }

    if (name.length > MAX_NAME_LENGTH) {
      return res.status(400).json({ error: `이름은 최대 ${MAX_NAME_LENGTH}자까지 입력할 수 있습니다.` })
    }

    if (contact && contact.length > MAX_CONTACT_LENGTH) {
      return res
        .status(400)
        .json({ error: `연락 수단은 최대 ${MAX_CONTACT_LENGTH}자까지 입력할 수 있습니다.` })
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return res
        .status(400)
        .json({ error: `상담 내용은 최대 ${MAX_MESSAGE_LENGTH}자까지 입력할 수 있습니다.` })
    }

    const record = await appendConsultation({
      name,
      contact: contact || null,
      message,
    })

    res.status(201).json({
      item: record,
    })
  } catch (error) {
    console.error('상담 요청을 저장하는 데 실패했습니다.', error)
    res.status(500).json({
      error: '상담 요청을 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    })
  }
})

export default consultationRouter
