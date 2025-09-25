import { useMemo, useState } from 'react'

type CalendarRange = 'daily' | 'weekly'

const INVESTING_WIDGET_SRC =
  'https://sslecal2.investing.com?columns=exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous&importance=3&countries=5&timeZone=9'

const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false">
    <path
      d="M7 2a1 1 0 0 0-1 1v1H5a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3h-1V3a1 1 0 1 0-2 0v1H8V3a1 1 0 0 0-1-1zm12 6H5v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1zm-9.75 3.5a.75.75 0 0 1 .743.648L10 12.25v1.5a.75.75 0 0 1-1.493.102L8.5 13.75v-1.5a.75.75 0 0 1 .75-.75zm5 0a.75.75 0 0 1 .743.648L15 12.25v1.5a.75.75 0 0 1-1.493.102L13.5 13.75v-1.5a.75.75 0 0 1 .75-.75z"
      fill="currentColor"
    />
  </svg>
)

const EconomicCalendar = () => {
  const [range, setRange] = useState<CalendarRange>('weekly')
  const investingCalType = range === 'daily' ? 'day' : 'week'
  const investingWidgetSrc = useMemo(
    () => `${INVESTING_WIDGET_SRC}&calType=${investingCalType}`,
    [investingCalType],
  )

  return (
    <section className="section economic-calendar" aria-labelledby="economic-calendar-heading">
      <div className="section-header">
        <div className="section-title">
          <span className="section-title-icon">
            <CalendarIcon />
          </span>
          <div className="section-title-text">
            <h2 id="economic-calendar-heading">미국 경제지표 캘린더</h2>
          </div>
        </div>
        <div className="calendar-controls" role="group" aria-label="캘린더 조회 기간 선택">
          <span className="calendar-filter-label">조회 범위</span>
          <div className="segmented-control">
            <button
              type="button"
              className={range === 'daily' ? 'active' : ''}
              onClick={() => setRange('daily')}
            >
              일간
            </button>
            <button
              type="button"
              className={range === 'weekly' ? 'active' : ''}
              onClick={() => setRange('weekly')}
            >
              주간
            </button>
          </div>
        </div>
      </div>

      <p className="calendar-helper">
        Investing.com 위젯을 통해 미국 경제지표 일정을 바로 확인해 보세요.
      </p>

      <div className="calendar-widget-panel">
        <h3 className="calendar-widget-title">Investing.com 미국 경제지표</h3>
        <p className="calendar-widget-description">
          전체 일정과 색상/언어 설정이 반영된 Investing.com 공식 위젯도 함께 확인해 보세요.
        </p>
        <div className="calendar-widget-frame" role="region" aria-label="Investing.com 미국 경제지표 위젯">
          <iframe
            key={investingCalType}
            title="Investing.com 미국 경제지표"
            src={investingWidgetSrc}
            loading="lazy"
            width="100%"
            height="600"
            frameBorder={0}
          />
        </div>
      </div>

      <footer className="calendar-footer">
        <small>데이터 출처: Investing.com · 국가: United States · 시간대: 한국 표준시 (KST, UTC+9)</small>
      </footer>
    </section>
  )
}

export default EconomicCalendar
