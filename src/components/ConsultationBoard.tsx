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

const LOCAL_STORAGE_KEY = 'jh-consultation-board:records'
const LOCAL_ONLY_ID_PREFIX = 'local-'
const MAX_LOCAL_RECORDS = 50
const MAX_DEBUG_SNIPPET_LENGTH = 240
const CONSULTATION_MAIL_SUBJECT_PREFIX = 'JH 투자 상담 요청'

const sanitizeMailtoAddress = (raw: string | undefined | null) => {
  if (!raw) {
    return null
  }

  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }

  return trimmed.replace(/^mailto:/i, '') || null
}

const buildMailtoQuery = (params: Record<string, string | null | undefined>) => {
  const search = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (!value) {
      return
    }
    const normalized = value.trim()
    if (!normalized) {
      return
    }
    search.set(key, normalized)
  })

  return search.toString().replace(/\+/g, '%20')
}

const createConsultationMailtoHref = (
  address: string,
  payload: { name: string; contact?: string | null; message: string },
) => {
  const subject = payload.name ? `${CONSULTATION_MAIL_SUBJECT_PREFIX} - ${payload.name}` : CONSULTATION_MAIL_SUBJECT_PREFIX

  const lines = [
    `이름: ${payload.name || '미입력'}`,
    payload.contact ? `연락처: ${payload.contact}` : null,
    '',
    '상담 내용:',
    payload.message || '(내용이 비어 있습니다.)',
  ].filter((line): line is string => line !== null)

  const body = lines.join('\n')
  const query = buildMailtoQuery({ subject, body })

  return `mailto:${address}${query ? `?${query}` : ''}`
}

const openMailClient = (address: string, payload: { name: string; contact?: string | null; message: string }) => {
  if (typeof window === 'undefined') {
    return false
  }

  const href = createConsultationMailtoHref(address, payload)

  try {
    window.location.href = href
    return true
  } catch (error) {
    console.error('이메일 클라이언트를 여는 중 문제가 발생했습니다.', error)
    return false
  }
}

const buildConsultationApiBase = () => {
  const raw = import.meta.env.VITE_CONSULTATION_API_BASE_URL?.trim()
  if (!raw) {
    return ''
  }
  return raw.replace(/\/+$/, '')
}

const resolveConsultationEndpoint = (base: string) => {
  if (!base) {
    return '/api/consultations'
  }

  if (/\/consultations$/i.test(base)) {
    return base
  }

  if (/\/api$/i.test(base)) {
    return `${base}/consultations`
  }

  return `${base}/api/consultations`
}

const appendQuery = (endpoint: string, params: Record<string, string>) => {
  const search = new URLSearchParams(params)
  if (!search.toString()) {
    return endpoint
  }
  const separator = endpoint.includes('?') ? '&' : '?'
  return `${endpoint}${separator}${search.toString()}`
}

const safeParseConsultationJson = async (response: Response) => {
  const clone = response.clone()
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''

  if (!contentType.includes('application/json')) {
    const snippet = await clone
      .text()
      .then((text) => text.slice(0, MAX_DEBUG_SNIPPET_LENGTH))
      .catch(() => '')
    console.error('상담창구 응답이 JSON 형식이 아닙니다.', {
      contentType: contentType || 'unknown',
      preview: snippet,
    })
    throw new Error('상담창구 응답 형식이 올바르지 않습니다.')
  }

  try {
    return (await response.json()) as unknown
  } catch (parseError) {
    const snippet = await clone
      .text()
      .then((text) => text.slice(0, MAX_DEBUG_SNIPPET_LENGTH))
      .catch(() => '')
    console.error('상담창구 JSON 응답 파싱 실패', parseError, {
      preview: snippet,
    })
    throw new Error('상담창구 응답을 해석하는 중 문제가 발생했습니다.')
  }
}

const extractConsultationList = (payload: unknown): ConsultationItem[] => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('상담 내역 응답 형식이 올바르지 않습니다.')
  }

  const rawItems = (payload as { items?: unknown }).items
  if (!Array.isArray(rawItems)) {
    throw new Error('상담 내역 응답 형식이 올바르지 않습니다.')
  }

  const sanitized = prepareConsultations(rawItems)
  if (rawItems.length > 0 && sanitized.length === 0) {
    throw new Error('상담 내역 응답을 정리할 수 없습니다.')
  }

  return sanitized
}

const extractConsultationItem = (payload: unknown): ConsultationItem => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('상담 요청 응답 형식이 올바르지 않습니다.')
  }

  const rawItem = (payload as { item?: unknown }).item
  const sanitized = sanitizeStoredConsultation(rawItem)

  if (!sanitized) {
    throw new Error('상담 요청 응답을 확인할 수 없습니다.')
  }

  return sanitized
}

const sanitizeStoredConsultation = (entry: unknown): ConsultationItem | null => {
  if (!entry || typeof entry !== 'object') {
    return null
  }

  const record = entry as Partial<ConsultationItem>
  const id = typeof record.id === 'string' ? record.id.trim() : ''
  const name = typeof record.name === 'string' ? record.name.trim() : ''
  const message = typeof record.message === 'string' ? record.message : ''
  const createdAtRaw = typeof record.createdAt === 'string' ? record.createdAt.trim() : ''

  if (!id || !name || message.trim().length === 0 || !createdAtRaw) {
    return null
  }

  const timestamp = Date.parse(createdAtRaw)
  if (Number.isNaN(timestamp)) {
    return null
  }

  const contact =
    typeof record.contact === 'string' && record.contact.trim().length > 0
      ? record.contact.trim()
      : null

  return {
    id,
    name,
    contact,
    message,
    createdAt: new Date(timestamp).toISOString(),
  }
}

const prepareConsultations = (entries: unknown[]): ConsultationItem[] => {
  const deduped = new Map<string, ConsultationItem>()

  entries.forEach((entry) => {
    const sanitized = sanitizeStoredConsultation(entry)
    if (!sanitized) {
      return
    }

    const existing = deduped.get(sanitized.id)
    if (!existing) {
      deduped.set(sanitized.id, sanitized)
      return
    }

    if (Date.parse(sanitized.createdAt) > Date.parse(existing.createdAt)) {
      deduped.set(sanitized.id, sanitized)
    }
  })

  return Array.from(deduped.values())
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, MAX_LOCAL_RECORDS)
}

const readStoredConsultations = (): ConsultationItem[] => {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return prepareConsultations(parsed)
  } catch (error) {
    console.error('상담 내역 로컬 저장소를 불러오는 중 문제가 발생했습니다.', error)
    return []
  }
}

const storeConsultations = (records: ConsultationItem[]) => {
  const prepared = prepareConsultations(records)

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(prepared))
    } catch (error) {
      console.error('상담 내역 로컬 저장소를 갱신하는 중 문제가 발생했습니다.', error)
    }
  }

  return prepared
}

const createLocalConsultation = (input: {
  name: string
  contact?: string | null
  message: string
}): ConsultationItem => ({
  id: `${LOCAL_ONLY_ID_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  name: input.name,
  contact: input.contact ?? null,
  message: input.message,
  createdAt: new Date().toISOString(),
})

const hasLocalOnlyConsultations = (records: ConsultationItem[]) =>
  records.some((entry) => entry.id.startsWith(LOCAL_ONLY_ID_PREFIX))

const ConsultationBoard = () => {
  const [items, setItems] = useState<ConsultationItem[]>(() => readStoredConsultations())
  const [loading, setLoading] = useState(items.length === 0)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', contact: '', message: '' })
  const [submitState, setSubmitState] = useState<SubmissionState>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [localNotice, setLocalNotice] = useState<string | null>(
    hasLocalOnlyConsultations(items)
      ? '이전에 전송되지 않은 상담 요청이 목록 상단에 임시 저장되어 있습니다.'
      : null,
  )
  const [lastSubmissionOffline, setLastSubmissionOffline] = useState(false)
  const [mailFallbackUsed, setMailFallbackUsed] = useState(false)
  const mailtoAddress = useMemo(
    () => sanitizeMailtoAddress(import.meta.env.VITE_CONSULTATION_MAILTO),
    [],
  )
  const consultationApiEndpoint = useMemo(
    () => resolveConsultationEndpoint(buildConsultationApiBase()),
    [],
  )

  const updateConsultations = useCallback(
    (updater: (current: ConsultationItem[]) => ConsultationItem[]) =>
      setItems((current) => storeConsultations(updater(current))),
    [],
  )

  const loadItems = useCallback(
    async (signal?: AbortSignal) => {
      if (signal?.aborted) {
        return
      }
      setLoading(true)
      setError(null)

      try {
        const requestUrl = appendQuery(consultationApiEndpoint, { limit: '20' })
        const response = await fetch(requestUrl, { signal })
        const payload = await safeParseConsultationJson(response)

        if (!response.ok) {
          const message =
            payload && typeof (payload as { error?: unknown }).error === 'string'
              ? ((payload as { error: string }).error)
              : null
          throw new Error(message ?? '상담 내역을 불러오지 못했습니다.')
        }

        const entries = extractConsultationList(payload)
        const stored = readStoredConsultations()
        const localOnly = stored.filter((entry) => entry.id.startsWith(LOCAL_ONLY_ID_PREFIX))
        updateConsultations(() => [...localOnly, ...entries])
        setLocalNotice(
          localOnly.length > 0
            ? '이전에 전송되지 않은 상담 요청이 목록 상단에 임시 저장되어 있습니다.'
            : null,
        )
      } catch (fetchError) {
        if (signal?.aborted) {
          return
        }
        console.error('상담 내역을 불러오는 중 문제가 발생했습니다.', fetchError)
        const stored = readStoredConsultations()
        if (stored.length > 0) {
          updateConsultations(() => stored)
          setLocalNotice('서버 연결이 원활하지 않아 이 기기에 저장된 상담 내역을 표시합니다.')
          setError(null)
        } else {
          setError('상담 내역을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false)
        }
      }
    },
    [consultationApiEndpoint, updateConsultations],
  )

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

  const handleManualMailto = useCallback(() => {
    if (!mailtoAddress) {
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

    const offlineRecord = createLocalConsultation({
      name,
      contact: contact || null,
      message,
    })
    updateConsultations((current) => [offlineRecord, ...current])
    setForm({ name: '', contact: '', message: '' })
    setSubmitState('success')
    setSubmitError(null)
    setLastSubmissionOffline(true)
    setError(null)
    const opened = openMailClient(mailtoAddress, { name, contact: contact || null, message })
    setMailFallbackUsed(Boolean(opened))
    setLocalNotice(
      opened
        ? '이메일 앱으로 상담 요청을 전송하도록 안내했습니다. 임시 저장된 상담은 목록 상단에서 확인할 수 있습니다.'
        : '이메일 앱을 자동으로 열지 못했습니다. 임시 저장된 상담 요청을 목록 상단에서 확인할 수 있습니다.'
    )
  }, [
    form.contact,
    form.message,
    form.name,
    mailtoAddress,
    updateConsultations,
  ])

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
      setLastSubmissionOffline(false)
      setMailFallbackUsed(false)

      try {
        const response = await fetch(consultationApiEndpoint, {
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

        let payload: unknown = null
        try {
          payload = await safeParseConsultationJson(response)
        } catch (parseError) {
          if (!response.ok) {
            const error = new Error('상담 요청을 접수하지 못했습니다.') as Error & { status?: number }
            error.status = response.status
            throw error
          }
          throw parseError
        }

        if (!response.ok) {
          const messageFromServer =
            payload && typeof (payload as { error?: unknown }).error === 'string'
              ? ((payload as { error: string }).error)
              : null
          const error = new Error(messageFromServer ?? '상담 요청을 접수하지 못했습니다.') as Error & {
            status?: number
          }
          error.status = response.status
          throw error
        }

        const savedItem = extractConsultationItem(payload)
        updateConsultations((current) => {
          const deduped = current.filter((entry) => entry.id !== savedItem.id)
          return [savedItem, ...deduped]
        })

        setForm({ name: '', contact: '', message: '' })
        setSubmitState('success')
        setLastSubmissionOffline(false)
        setMailFallbackUsed(false)
        const updated = readStoredConsultations()
        setLocalNotice(
          hasLocalOnlyConsultations(updated)
            ? '이전에 전송되지 않은 상담 요청이 목록 상단에 임시 저장되어 있습니다.'
            : null,
        )
      } catch (submissionError) {
        console.error('상담 요청 전송 실패', submissionError)
        const status =
          typeof (submissionError as { status?: unknown })?.status === 'number'
            ? ((submissionError as { status?: number }).status as number)
            : null

        if (status && status >= 400 && status < 500) {
          const fallbackMessage =
            submissionError instanceof Error
              ? submissionError.message
              : '상담 요청을 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.'
          setSubmitError(fallbackMessage)
          setSubmitState('error')
          setLastSubmissionOffline(false)
          setMailFallbackUsed(false)
          return
        }

        const offlineRecord = createLocalConsultation({
          name,
          contact: contact || null,
          message,
        })
        updateConsultations((current) => [offlineRecord, ...current])
        setForm({ name: '', contact: '', message: '' })
        setSubmitState('success')
        setSubmitError(null)
        setLastSubmissionOffline(true)
        setError(null)
        const openedMailClient = mailtoAddress
          ? openMailClient(mailtoAddress, { name, contact: contact || null, message })
          : false
        setMailFallbackUsed(Boolean(openedMailClient))
        setLocalNotice(
          openedMailClient
            ? '네트워크 연결이 불안정해 이메일 앱으로 상담 내용을 전송하도록 안내했습니다. 임시 저장된 상담은 목록 상단에서 확인할 수 있습니다.'
            : '네트워크 연결이 원활하지 않아 상담 내용을 이 기기에 임시 저장했습니다.'
        )
      }
    },
    [
      consultationApiEndpoint,
      mailtoAddress,
      form.contact,
      form.message,
      form.name,
      submitState,
      updateConsultations,
    ]
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
      if (lastSubmissionOffline) {
        return mailFallbackUsed
          ? '네트워크가 불안정해 이메일 앱으로 상담 내용을 보내도록 안내했습니다. 메일 발송함을 확인해 주세요.'
          : '네트워크가 불안정해 상담 내용을 이 기기에 임시 저장했습니다. 연결이 복구되면 새로고침 후 다시 전송해 주세요.'
      }
      return '상담 요청이 정상적으로 접수되었습니다. 빠른 시간 내에 답변드릴게요.'
    }
    if (submitState === 'error' && submitError) {
      return submitError
    }
    return mailtoAddress
      ? '연락 가능한 이메일 또는 전화번호를 남겨주시거나, 아래 이메일 버튼으로 직접 상담을 전송하실 수 있습니다.'
      : '연락 가능한 이메일 또는 전화번호를 남겨주시면 빠르게 회신드리겠습니다.'
  }, [lastSubmissionOffline, mailFallbackUsed, mailtoAddress, submitError, submitState])

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
          {mailtoAddress && (
            <button
              type="button"
              className="consultation-mailto-button"
              onClick={handleManualMailto}
              title="이메일 앱을 열어 상담 내용을 직접 보낼 수 있습니다."
            >
              이메일 앱으로 직접 보내기 ({mailtoAddress})
            </button>
          )}
          <p
            className={`consultation-helper consultation-helper-${
              submitState === 'error' ? 'error' : submitState === 'success' ? 'success' : 'neutral'
            }`}
          >
            {submitHelperText}
          </p>
        </form>

        <div className="consultation-messages" aria-live="polite">
          {localNotice && (
            <div className="consultation-status consultation-status-notice">{localNotice}</div>
          )}
          {loading && (
            <div className="consultation-status">최근 상담 내역을 불러오는 중입니다...</div>
          )}
          {error ? (
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
                      {item.id.startsWith(LOCAL_ONLY_ID_PREFIX) && (
                        <span className="consultation-message-badge">임시 저장</span>
                      )}
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
      <p className="consultation-note">
        빠른 질의 응답이 가능한 1:1 맞춤형 상담 서비스입니다.
        {mailtoAddress && (
          <>
            {' '}
            이메일 상담: <a href={`mailto:${mailtoAddress}`}>{mailtoAddress}</a>
          </>
        )}
      </p>
    </section>
  )
}

export default ConsultationBoard
