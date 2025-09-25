import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { WebLLM, WebLLMEngine } from '../types/webllm'

const WEB_LLM_SCRIPT_URL = 'https://unpkg.com/@mlc-ai/web-llm@0.2.61/dist/index.js'
const MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC'
const SYSTEM_PROMPT =
  "당신은 투자상담 도우미입니다. 최신 데이터가 필요할 경우 '실시간 데이터가 필요합니다'라고 명확히 고지하고, " +
  '일반적 원리/개념/리스크 경고와 함께 보수적으로 답하세요. 개인 맞춤 투자 조언은 피하고 정보 제공만 하세요.'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type ProgressState = {
  text?: string
  progress?: number
}

let webLlmLoader: Promise<WebLLM | undefined> | null = null

const loadWebLLM = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('브라우저 환경에서만 사용할 수 있습니다.'))
  }

  if (window.webllm) {
    return Promise.resolve(window.webllm)
  }

  if (webLlmLoader) {
    return webLlmLoader
  }

  webLlmLoader = new Promise<WebLLM | undefined>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${WEB_LLM_SCRIPT_URL}"]`)

    const handleResolve = () => {
      if (window.webllm) {
        resolve(window.webllm)
      } else {
        reject(new Error('WebLLM 라이브러리를 초기화하지 못했습니다.'))
      }
    }

    const handleError = () => {
      webLlmLoader = null
      reject(new Error('WebLLM 스크립트를 불러오지 못했습니다.'))
    }

    if (existingScript) {
      existingScript.addEventListener('load', handleResolve, { once: true })
      existingScript.addEventListener('error', handleError, { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = WEB_LLM_SCRIPT_URL
    script.async = true
    script.addEventListener('load', handleResolve, { once: true })
    script.addEventListener('error', handleError, { once: true })
    document.head.appendChild(script)
  })

  return webLlmLoader
}

const createMessageId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const ConsultationChat = () => {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const engineRef = useRef<WebLLMEngine | null>(null)
  const streamingRef = useRef(false)
  const [streamingContent, setStreamingContent] = useState<string | null>(null)
  const [status, setStatus] = useState('모델 로딩 중… 처음 1~2분 정도 걸릴 수 있어요(한번 로딩되면 이후엔 빠릅니다).')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)

  useEffect(() => {
    let isCancelled = false
    let localEngine: WebLLMEngine | null = null

    const initialize = async () => {
      try {
        const webllm = await loadWebLLM()
        if (isCancelled) {
          return
        }

        if (!webllm) {
          throw new Error('WebLLM 엔진을 찾을 수 없습니다.')
        }

        const engine = await webllm.CreateMLCEngine(
          { model_id: MODEL_ID },
          {
            initProgressCallback: (report: ProgressState) => {
              if (isCancelled) {
                return
              }
              const percent = typeof report.progress === 'number' ? `${Math.round(report.progress * 100)}%` : ''
              setStatus(`모델 준비 중: ${report.text ?? ''}${percent ? ` (${percent})` : ''}`.trim())
            },
          },
        )

        if (isCancelled) {
          engine.dispose?.()
          return
        }

        engineRef.current = engine
        localEngine = engine
        setStatus('모델 준비 완료. 질문을 입력해 보세요!')
        setLoading(false)
        setError(null)
      } catch (initError) {
        console.error('WebLLM 초기화 실패', initError)
        if (isCancelled) {
          return
        }
        setError('모델 로딩에 실패했습니다. 네트워크 연결을 확인한 뒤 새로고침해 주세요.')
        setStatus('모델을 불러오지 못했습니다.')
        setLoading(false)
      }
    }

    initialize().catch((initError) => {
      console.error(initError)
    })

    return () => {
      isCancelled = true
      streamingRef.current = false
      if (localEngine) {
        try {
          localEngine.interruptGenerate?.()
          localEngine.dispose?.()
        } catch (disposeError) {
          console.error('WebLLM 엔진 정리 실패', disposeError)
        }
      }
    }
  }, [])

  const conversation = useMemo(
    () => messages.map(({ role, content }) => ({ role, content })),
    [messages],
  )

  const handleAsk = useCallback(async () => {
    const trimmed = question.trim()
    if (!trimmed) {
      return
    }

    if (!engineRef.current) {
      setStatus('모델이 아직 준비되지 않았어요. 잠시만 기다려 주세요!')
      return
    }

    setQuestion('')
    setAsking(true)
    setError(null)

    const userMessage: ChatMessage = { id: createMessageId('user'), role: 'user', content: trimmed }
    setMessages((prev) => [...prev, userMessage])
    setStatus('답변 생성 중…')

    const payload = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversation,
      { role: 'user', content: trimmed },
    ]

    try {
      streamingRef.current = true
      setStreamingContent('')
      const reply = await engineRef.current.chat.completions.create({
        messages: payload,
        temperature: 0.7,
        max_tokens: 512,
        stream: true,
      })

      let buffer = ''
      for await (const chunk of reply) {
        if (!streamingRef.current) {
          break
        }
        const delta = chunk?.choices?.[0]?.delta?.content ?? ''
        if (!delta) {
          continue
        }
        buffer += delta
        setStreamingContent(buffer)
      }

      streamingRef.current = false
      setStreamingContent(null)

      const cleaned = buffer.trim()
      if (cleaned) {
        const assistantMessage: ChatMessage = {
          id: createMessageId('assistant'),
          role: 'assistant',
          content: cleaned,
        }
        setMessages((prev) => [...prev, assistantMessage])
        setStatus('완료')
      } else {
        setStatus('답변을 생성하지 못했습니다. 질문을 조금 더 구체적으로 적어볼까요?')
      }
    } catch (askError) {
      console.error('WebLLM 응답 실패', askError)
      streamingRef.current = false
      setStreamingContent(null)
      setStatus('생성 실패: 다시 시도해 주세요.')
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId('assistant-error'),
          role: 'assistant',
          content: '죄송해요, 답변 생성에 실패했습니다. 질문을 조금 더 구체적으로 적어볼까요?',
        },
      ])
    } finally {
      setAsking(false)
    }
  }, [conversation, question])

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (asking) {
        return
      }
      void handleAsk()
    },
    [asking, handleAsk],
  )

  return (
    <section className="section consultation-ai" aria-labelledby="consultation-ai-heading">
      <div className="consultation-ai-header">
        <h2 id="consultation-ai-heading">투자상담 창구</h2>
        <p>
          브라우저에서 직접 실행되는 온디바이스 LLM으로 간단한 투자 Q&amp;A를 도와드립니다. 실시간 시세 등 최신 데이터가 필요한
          경우에는 별도로 안내해 드려요.
        </p>
      </div>

      <form className="consultation-ai-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="질문을 입력하세요 (예: 이번 주 CPI 발표가 시장에 미칠 영향은?)"
          disabled={loading || asking || Boolean(error)}
          aria-label="투자 관련 질문 입력"
        />
        <button type="submit" disabled={loading || asking || Boolean(error)}>
          {asking ? '생성 중…' : '보내기'}
        </button>
      </form>

      <p className="consultation-ai-status" role="status">
        {error ?? status}
      </p>

      <div className="consultation-ai-chat" aria-live="polite">
        {messages.map((message) => (
          <div key={message.id} className={`consultation-ai-message consultation-ai-message-${message.role}`}>
            <span className="consultation-ai-message-role">{message.role === 'user' ? '나' : '도우미'}</span>
            <p>{message.content}</p>
          </div>
        ))}
        {streamingContent !== null && (
          <div className="consultation-ai-message consultation-ai-message-assistant consultation-ai-message-streaming">
            <span className="consultation-ai-message-role">도우미</span>
            <p>{streamingContent}</p>
          </div>
        )}
      </div>

      <div className="consultation-ai-meta">
        <span className="consultation-pill">온디바이스 LLM</span>
        <span className="consultation-pill">Llama 3.2 1B-Instruct (Q4)</span>
      </div>
    </section>
  )
}

export default ConsultationChat
