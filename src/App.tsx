import './App.css'
import EconomicCalendar from './components/EconomicCalendar'
import ExchangeRateTicker from './components/ExchangeRateTicker'
import MarketOverview from './components/MarketOverview'
import NewsFeed from './components/NewsFeed'
import ConsultationMailForm from './components/ConsultationMailForm'

const HeroIcon = () => (
  <svg viewBox="0 0 96 96" role="img" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="jigsawBg" cx="48" cy="48" r="46" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#111827" />
        <stop offset="0.65" stopColor="#020617" />
        <stop offset="1" stopColor="#000" />
      </radialGradient>
      <radialGradient id="jigsawFace" cx="48" cy="42" r="22" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#fdf8f7" />
        <stop offset="1" stopColor="#e4d6cf" />
      </radialGradient>
      <linearGradient id="jigsawSuit" x1="32" y1="74" x2="64" y2="92" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#0f172a" />
        <stop offset="1" stopColor="#1f2937" />
      </linearGradient>
      <filter id="jigsawGlow" x="-35%" y="-35%" width="170%" height="170%" colorInterpolationFilters="sRGB">
        <feDropShadow dx="0" dy="0" stdDeviation="3.2" floodColor="#f87171" floodOpacity="0.55" />
      </filter>
    </defs>
    <rect x="10" y="10" width="76" height="76" rx="22" fill="url(#jigsawBg)" stroke="#1f2937" strokeWidth="1.5" />
    <g filter="url(#jigsawGlow)">
      <path
        d="M48 21c-11.5 0-21 9.02-21 20.22 0 7.03 3.62 12.84 9.36 16.09C35.02 60.76 32 65.86 32 71.86c0 1.86 .28 3.12 .82 3.97 .64 .99 1.69 1.55 3.03 1.55 2.46 0 5.35 -1.77 7.36 -4.36 1.89 1.01 3.73 1.52 5.79 1.52 2.05 0 3.88 -.5 5.75 -1.5 2.02 2.56 4.9 4.34 7.36 4.34 1.34 0 2.39 -.56 3.03 -1.55 .54 -.85 .82 -2.11 .82 -3.97 0 -6.02 -3.05 -11.14 -4.37 -14.64 5.65 -3.27 9.41 -9.09 9.41 -16.09C69 30.02 59.5 21 48 21z"
        fill="url(#jigsawFace)"
        stroke="#d6bfb3"
        strokeWidth="1.4"
      />
    </g>
    <path
      d="M32 72.5c4.2-2.65 8.63-3.95 16-3.95s11.8 1.3 16 3.95c-4.56 4.22-10.28 6.38-16 6.38s-11.44-2.16-16-6.38z"
      fill="url(#jigsawSuit)"
    />
    <path
      d="M37 33c4.2-3.8 7.96-5.8 11-5.8 3.05 0 6.79 2 11 5.8"
      stroke="#1f2937"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M39 50c3.2 2.3 6.48 3.4 9 3.4s5.8-1.1 9-3.4" stroke="#991b1b" strokeWidth="2" strokeLinecap="round" />
    <path
      d="M45.5 57.8c1.56 1.2 3.01 1.8 4.5 1.8s2.96-.6 4.5-1.8"
      stroke="#111827"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <g fill="#ef4444" stroke="#7f1d1d" strokeWidth="1.4">
      <circle cx="38.8" cy="45.4" r="4.2" />
      <circle cx="57.2" cy="45.4" r="4.2" />
    </g>
    <g fill="#0f172a">
      <circle cx="38.8" cy="45.4" r="2" />
      <circle cx="57.2" cy="45.4" r="2" />
    </g>
    <g stroke="#b91c1c" strokeWidth="1.4" strokeLinecap="round">
      <path d="M33.4 52.5c2.15 1.2 3.8 2.4 4.8 3.7" fill="none" />
      <path d="M62.6 52.5c-2.15 1.2-3.8 2.4-4.8 3.7" fill="none" />
    </g>
    <g stroke="#b91c1c" strokeLinecap="round" strokeWidth="1.1" fill="none">
      <path d="M34.6 49.6c2.4.2 3.8 1 4.8 2.2" />
      <path d="M61.4 49.6c-2.4.2-3.8 1-4.8 2.2" />
    </g>
    <path
      d="M48 62.8c-3.8 0-6.9 1.35-6.9 3.02 0 1.08 1.24 2.05 3.34 2.6 1.1.28 2.35.42 3.56.42s2.46-.14 3.56-.42c2.1-.55 3.34-1.52 3.34-2.6 0-1.67-3.1-3.02-6.9-3.02z"
      fill="#f8fafc"
      stroke="#cbd5f5"
      strokeWidth="1"
    />
    <circle cx="48" cy="71.2" r="2.1" fill="#f87171" stroke="#b91c1c" strokeWidth="1" />
    <path d="M45 68l-3.6 6.4" stroke="#e11d48" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M51 68l3.6 6.4" stroke="#e11d48" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
)

function App() {
  return (
    <div className="app">
      <div className="app-inner">
        <header className="hero">
          <div className="hero-main">
            <div className="hero-title">
              <h1>JH Investment Lab</h1>
              <span className="hero-title-icon" aria-hidden="true">
                <HeroIcon />
              </span>
            </div>
            <p>
              개인 투자자의 성공 투자를 위한 맞춤형 포탈 입니다. JH 컨설턴트와 상의하세요.(하단 링크)
            </p>
            <div className="badge-row">
              <span className="badge">USD 경제 캘린더</span>
              <span className="badge">나스닥 · 다우 실시간</span>
              <span className="badge">비트코인 · 이더리움 · 리플</span>
              <span className="badge">BGSC 선물 15분봉</span>
            </div>
          </div>
          <ExchangeRateTicker />
        </header>

        <main className="content" aria-label="투자 인사이트">
          <EconomicCalendar />
          <MarketOverview />
          <NewsFeed />
          <ConsultationMailForm />
        </main>

        <footer className="footer">
          © {new Date().getFullYear()} JH Investment Lab · 데이터 출처: Investing.com, Binance, Financial Modeling
          Prep, AlphaVantage
        </footer>
      </div>
    </div>
  )
}

export default App
