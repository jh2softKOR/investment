import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

type ConsultationItem = {
  id: string
  name: string
  contact?: string | null
  message: string
  createdAt: string
}

type SubmissionState = 'idle' | 'submitting' | 'success' | 'error'

const MAX_MESSAGE_LENGTH = 1000
const MAX_NAME_LENGTH = 40
const MAX_CONTACT_LENGTH = 120

const formatRelativeTime = (input: string) => {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const formatter = new Intl.RelativeTimeFormat('ko-KR', { numeric: 'auto' })
  const now = new Date()
  const diff = (date.getTime() - now.getTime()) / 1000
  const abs = Math.abs(diff)

  if (abs < 60) {
    return formatter.format(Math.round(diff), 'second')
  }
  if (abs < 3600) {
    return formatter.format(Math.round(diff / 60), 'minute')
  }
  if (abs < 86_400) {
    return formatter.format(Math.round(diff / 3600), 'hour')
  }
  return formatter.format(Math.round(diff / 86_400), 'day')
}

const formatDateTime = (input: string) => {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const splitMessage = (message: string) =>
  message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

const ConsultationBoard = () => {
  const [items, setItems] = useState<ConsultationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', contact: '', message: '' })
  const [submitState, setSubmitState] = useState<SubmissionState>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const loadItems = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted) {
      return
    }
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/consultations?limit=20', { signal })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        const message = payload && typeof payload.error === 'string' ? payload.error : null
        throw new Error(message ?? '상담 내역을 불러오지 못했습니다.')
      }

      const entries = Array.isArray(payload?.items) ? (payload.items as ConsultationItem[]) : []
      setItems(entries)
    } catch (fetchError) {
      if (signal?.aborted) {
        return
      }
      console.error('상담 내역을 불러오는 중 문제가 발생했습니다.', fetchError)
      setError('상담 내역을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    loadItems(controller.signal).catch((error) => {
      if (!controller.signal.aborted) {
        console.error(error)
      }
    })

    return () => {
      controller.abort()
    }
  }, [loadItems])

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = event.target
      setForm((current) => ({ ...current, [name]: value }))
      setSubmitError(null)
      if (submitState === 'error') {
        setSubmitState('idle')
      }
    },
    [submitState]
  )

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (submitState === 'submitting') {
        return
      }

      const name = form.name.trim()
      const contact = form.contact.trim()
      const message = form.message.trim()

      if (!name || !message) {
        setSubmitError('이름과 상담 내용을 모두 입력해 주세요.')
        setSubmitState('error')
        return
      }

      setSubmitState('submitting')
      setSubmitError(null)

      try {
        const response = await fetch('/api/consultations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            contact: contact || undefined,
            message,
          }),
        })

        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          const messageFromServer = payload && typeof payload.error === 'string' ? payload.error : null
          throw new Error(messageFromServer ?? '상담 요청을 접수하지 못했습니다.')
        }

        const savedItem = payload?.item as ConsultationItem | undefined
        if (savedItem) {
          setItems((current) => {
            const deduped = current.filter((entry) => entry.id !== savedItem.id)
            return [savedItem, ...deduped].slice(0, 20)
          })
        }

        setForm({ name: '', contact: '', message: '' })
        setSubmitState('success')
      } catch (submissionError) {
        console.error('상담 요청 전송 실패', submissionError)
        const fallbackMessage =
          submissionError instanceof Error
            ? submissionError.message
            : '상담 요청을 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.'
        setSubmitError(fallbackMessage)
        setSubmitState('error')
      }
    },
    [form.contact, form.message, form.name, submitState]
  )

  useEffect(() => {
    if (submitState !== 'success') {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setSubmitState('idle')
    }, 4000)

    return () => {
      window.clearTimeout(timer)
    }
  }, [submitState])

  const submitHelperText = useMemo(() => {
    if (submitState === 'success') {
      return '상담 요청이 정상적으로 접수되었습니다. 빠른 시간 내에 답변드릴게요.'
    }
    if (submitState === 'error' && submitError) {
      return submitError
    }
    return '연락 가능한 이메일 또는 전화번호를 남겨주시면 빠르게 회신드리겠습니다.'
  }, [submitError, submitState])

  return (
    <section className="section consultation-board" aria-label="JH 컨설턴트 상담창구">
      <div className="consultation-header">
        <div>
          <h2>투자 상담창구</h2>
          <p>
            투자 전략부터 시장 전망까지 궁금한 점을 남겨주세요. JH 컨설턴트가 순차적으로 확인 후 직접
            연락드립니다.
          </p>
        </div>
        <button
          type="button"
          className="consultation-refresh"
          onClick={() => loadItems()}
          disabled={loading}
        >
          새로고침
        </button>
      </div>

      <div className="consultation-layout">
        <form className="consultation-form" onSubmit={handleSubmit} noValidate>
          <div className="consultation-field-group">
            <label htmlFor="consultation-name">이름 *</label>
            <input
              id="consultation-name"
              name="name"
              maxLength={MAX_NAME_LENGTH}
              value={form.name}
              onChange={handleInputChange}
              placeholder="예: 김JH"
              required
            />
          </div>
          <div className="consultation-field-group">
            <label htmlFor="consultation-contact">연락 수단</label>
            <input
              id="consultation-contact"
              name="contact"
              maxLength={MAX_CONTACT_LENGTH}
              value={form.contact}
              onChange={handleInputChange}
              placeholder="이메일 또는 전화번호"
            />
          </div>
          <div className="consultation-field-group">
            <label htmlFor="consultation-message">상담 내용 *</label>
            <textarea
              id="consultation-message"
              name="message"
              rows={6}
              maxLength={MAX_MESSAGE_LENGTH}
              value={form.message}
              onChange={handleInputChange}
              placeholder="궁금하신 투자 전략, 리스크 관리 등 무엇이든 남겨주세요."
              required
            />
            <div className="consultation-char-counter">
              {form.message.length} / {MAX_MESSAGE_LENGTH}
            </div>
          </div>
          <button type="submit" disabled={submitState === 'submitting'}>
            {submitState === 'submitting' ? '접수 중...' : '상담 요청 보내기'}
          </button>
          <p
            className={`consultation-helper consultation-helper-${
              submitState === 'error' ? 'error' : submitState === 'success' ? 'success' : 'neutral'
            }`}
          >
            {submitHelperText}
          </p>
        </form>

        <div className="consultation-messages" aria-live="polite">
          {loading ? (
            <div className="consultation-status">최근 상담 내역을 불러오는 중입니다...</div>
          ) : error ? (
            <div className="consultation-status consultation-status-error">{error}</div>
          ) : items.length === 0 ? (
            <div className="consultation-status">아직 등록된 상담 내역이 없습니다. 첫 번째 상담을 남겨보세요!</div>
          ) : (
            <ul>
              {items.map((item) => {
                const lines = splitMessage(item.message)
                const relativeTime = formatRelativeTime(item.createdAt)
                const exactTime = formatDateTime(item.createdAt)

                return (
                  <li key={item.id} className="consultation-message">
                    <div className="consultation-message-header">
                      <span className="consultation-message-name">{item.name}</span>
                      {item.contact && <span className="consultation-message-contact">{item.contact}</span>}
                    </div>
                    <div className="consultation-message-body">
                      {lines.map((line, index) => (
                        <p key={`${item.id}-line-${index}`}>{line}</p>
                      ))}
                    </div>
                    <div className="consultation-message-meta">
                      <time dateTime={item.createdAt}>{exactTime}</time>
                      {relativeTime && <span aria-hidden="true">· {relativeTime}</span>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
      <p className="consultation-note">빠른 질의 응답이 가능한 1:1 맞춤형 상담 서비스입니다.</p>
    </section>
  )
}

export default ConsultationBoard
