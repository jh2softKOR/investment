import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'

const DEFAULT_ACTION = 'https://formsubmit.co/jh2soft@naver.com'
const MIN_MESSAGE_LENGTH = 20

const resolveAction = () => {
  const configured = import.meta.env.VITE_CONSULTATION_FORM_ACTION?.trim()
  return configured && /^https?:\/\//i.test(configured) ? configured : DEFAULT_ACTION
}

const ConsultationMailForm = () => {
  const action = useMemo(resolveAction, [])
  const [submitting, setSubmitting] = useState(false)
  const [helper, setHelper] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget
    const formData = new FormData(form)
    const message = (formData.get('message') as string | null) ?? ''

    if (message.trim().length < MIN_MESSAGE_LENGTH) {
      event.preventDefault()
      setHelper(`문의 내용을 ${MIN_MESSAGE_LENGTH}자 이상 작성해주세요.`)
      return
    }

    setHelper('메일을 전송 중입니다. 첫 제출 시 FormSubmit 인증 메일이 발송될 수 있어요.')
    setSubmitting(true)

    window.setTimeout(() => {
      setSubmitting(false)
      setHelper(null)
    }, 5000)
  }

  return (
    <section className="section consultation-mail" aria-labelledby="consultation-mail-heading">
      <div className="consultation-mail-header">
        <h2 id="consultation-mail-heading">문의 메일 보내기 (서버리스)</h2>
        <p>FormSubmit을 활용해 별도 서버 없이도 상담 메일을 수신할 수 있습니다.</p>
      </div>

      <form
        className="consultation-mail-form"
        action={action}
        method="POST"
        onSubmit={handleSubmit}
      >
        <input type="hidden" name="_subject" value="[투자상담] 웹 문의" />
        <input type="hidden" name="_captcha" value="false" />
        <input type="hidden" name="_template" value="table" />
        <input type="hidden" name="_next" value="" />

        <div className="consultation-mail-row">
          <label className="visually-hidden" htmlFor="consultation-mail-name">
            이름
          </label>
          <input id="consultation-mail-name" name="name" placeholder="이름" required autoComplete="name" />
          <label className="visually-hidden" htmlFor="consultation-mail-email">
            이메일
          </label>
          <input
            id="consultation-mail-email"
            name="email"
            type="email"
            placeholder="이메일"
            required
            autoComplete="email"
          />
        </div>

        <label className="visually-hidden" htmlFor="consultation-mail-subject">
          제목
        </label>
        <input id="consultation-mail-subject" name="subject" placeholder="제목" required />

        <label className="visually-hidden" htmlFor="consultation-mail-message">
          문의 내용
        </label>
        <textarea
          id="consultation-mail-message"
          name="message"
          placeholder="문의 내용을 자세히 작성해주세요 (20자 이상)"
          required
          minLength={MIN_MESSAGE_LENGTH}
        />

        <div className="consultation-mail-actions">
          <button type="submit" className="consultation-mail-submit" disabled={submitting}>
            {submitting ? '전송 중…' : '메일 보내기'}
          </button>
        </div>

        <p className="consultation-mail-note">* 첫 제출 시 FormSubmit에서 본인 메일 인증 요청이 갈 수 있어요(스팸 방지).</p>
        {helper && <p className="consultation-mail-helper">{helper}</p>}
      </form>
    </section>
  )
}

export default ConsultationMailForm
