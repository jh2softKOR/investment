import { useMemo, useState } from 'react'

type CalendarRange = 'daily' | 'weekly'

const INVESTING_WIDGET_SRC =
  'https://sslecal2.investing.com?columns=exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous&importance=3&countries=5&timeZone=9'

const CalendarIcon = () => (
  <svg viewBox="0 0 32 32" role="img" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="calendarNeonFrame" x1="4" y1="6" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#a7f3d0" />
        <stop offset="0.45" stopColor="#6ee7b7" />
        <stop offset="1" stopColor="#34d399" />
      </linearGradient>
      <radialGradient id="calendarNeonGlow" cx="16" cy="16" r="14" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#34d399" stopOpacity="0.6" />
        <stop offset="0.6" stopColor="#0f172a" stopOpacity="0.1" />
        <stop offset="1" stopColor="#020617" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="calendarAccent" x1="10" y1="15" x2="22" y2="21" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#bef264" />
        <stop offset="0.5" stopColor="#4ade80" />
        <stop offset="1" stopColor="#22d3ee" />
      </linearGradient>
      <filter id="calendarGlow" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
        <feDropShadow dx="0" dy="0" stdDeviation="1.6" floodColor="#34d399" floodOpacity="0.85" />
      </filter>
    </defs>
    <rect x="3.5" y="6" width="25" height="22" rx="4" fill="#020617" stroke="#0ea5e9" strokeOpacity="0.15" />
    <rect x="5" y="7.5" width="22" height="19" rx="3" fill="#020617" />
    <rect x="5" y="7.5" width="22" height="19" rx="3" fill="url(#calendarNeonGlow)" />
    <rect
      x="5"
      y="10"
      width="22"
      height="17"
      rx="3"
      fill="#030712"
      stroke="url(#calendarNeonFrame)"
      strokeWidth="1.2"
      filter="url(#calendarGlow)"
    />
    <g strokeLinecap="round" strokeLinejoin="round">
      <line x1="9" y1="6" x2="9" y2="4" stroke="#a7f3d0" strokeWidth="2" />
      <line x1="23" y1="6" x2="23" y2="4" stroke="#a7f3d0" strokeWidth="2" />
    </g>
    <g fill="#0f172a" stroke="url(#calendarAccent)" strokeWidth="1.1">
      <rect x="9" y="14" width="4.5" height="4.5" rx="1.2" />
      <rect x="15" y="14" width="4.5" height="4.5" rx="1.2" />
      <rect x="21" y="14" width="4.5" height="4.5" rx="1.2" />
      <rect x="9" y="20" width="4.5" height="4.5" rx="1.2" />
      <rect x="15" y="20" width="4.5" height="4.5" rx="1.2" />
      <rect x="21" y="20" width="4.5" height="4.5" rx="1.2" />
    </g>
    <path
      d="M11 11h10.5"
      stroke="url(#calendarAccent)"
      strokeWidth="1.8"
      strokeLinecap="round"
      opacity="0.85"
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
        <div className="calendar-widget-frame" role="region" aria-label="미국 경제지표 위젯">
          <iframe
            key={investingCalType}
            title="미국 경제지표"
            src={investingWidgetSrc}
            loading="lazy"
            width="100%"
            height="300"
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
