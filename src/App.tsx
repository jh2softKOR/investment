import './App.css'
import EconomicCalendar from './components/EconomicCalendar'
import ExchangeRateTicker from './components/ExchangeRateTicker'
import MarketOverview from './components/MarketOverview'
import NewsFeed from './components/NewsFeed'
import ConsultationMailForm from './components/ConsultationMailForm'

const HeroIcon = () => (
  <svg viewBox="0 0 96 96" role="img" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="heroCyberGlow" x1="12" y1="8" x2="84" y2="88" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#38bdf8" stopOpacity="0.95" />
        <stop offset="0.5" stopColor="#3b82f6" stopOpacity="0.85" />
        <stop offset="1" stopColor="#6366f1" stopOpacity="0.9" />
      </linearGradient>
      <linearGradient id="heroLine" x1="16" y1="20" x2="78" y2="76" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#a5f3fc" />
        <stop offset="1" stopColor="#c4b5fd" />
      </linearGradient>
    </defs>
    <rect x="8" y="8" width="80" height="80" rx="22" fill="url(#heroCyberGlow)" opacity="0.92" />
    <rect
      x="14"
      y="14"
      width="68"
      height="68"
      rx="18"
      fill="none"
      stroke="rgba(148, 163, 184, 0.35)"
      strokeWidth="1.6"
      strokeDasharray="6 6"
    />
    <g stroke="url(#heroLine)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M26 60 40 46l11 8 19-20" />
      <path d="M52 34h6v6" />
    </g>
    <g fill="#0f172a">
      <rect x="26" y="52" width="6" height="14" rx="2" opacity="0.35" />
      <rect x="38" y="42" width="6" height="24" rx="2" opacity="0.55" />
      <rect x="50" y="48" width="6" height="18" rx="2" opacity="0.4" />
      <rect x="62" y="34" width="6" height="32" rx="2" opacity="0.5" />
    </g>
    <circle cx="70" cy="28" r="6" fill="#22d3ee" opacity="0.85" />
    <circle cx="26" cy="68" r="3" fill="#38bdf8" opacity="0.75" />
    <circle cx="74" cy="64" r="3" fill="#818cf8" opacity="0.7" />
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
