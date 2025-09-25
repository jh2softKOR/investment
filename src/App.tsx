import './App.css'
import EconomicCalendar from './components/EconomicCalendar'
import ExchangeRateTicker from './components/ExchangeRateTicker'
import MarketOverview from './components/MarketOverview'
import NewsFeed from './components/NewsFeed'
import ConsultationMailForm from './components/ConsultationMailForm'

const HeroIcon = () => (
  <svg viewBox="0 0 96 96" role="img" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="heroNeonBase" x1="18" y1="12" x2="78" y2="84" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#052e16" />
        <stop offset="1" stopColor="#04130f" />
      </linearGradient>
      <radialGradient id="heroNeonGlow" cx="48" cy="48" r="42" gradientUnits="userSpaceOnUse">
        <stop offset="0.1" stopColor="#82ffb5" stopOpacity="0.25" />
        <stop offset="0.55" stopColor="#2af598" stopOpacity="0.1" />
        <stop offset="1" stopColor="#0f172a" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="heroNeonLine" x1="24" y1="64" x2="74" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#7dff7a" />
        <stop offset="0.45" stopColor="#72ffa8" />
        <stop offset="1" stopColor="#4cffd0" />
      </linearGradient>
      <linearGradient id="heroNeonBars" x1="28" y1="34" x2="68" y2="70" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#16f08b" stopOpacity="0.35" />
        <stop offset="1" stopColor="#6dffb5" stopOpacity="0.7" />
      </linearGradient>
    </defs>
    <rect x="10" y="10" width="76" height="76" rx="20" fill="#030712" />
    <rect x="14" y="14" width="68" height="68" rx="18" fill="url(#heroNeonBase)" />
    <rect x="14" y="14" width="68" height="68" rx="18" fill="url(#heroNeonGlow)" />
    <rect
      x="20"
      y="20"
      width="56"
      height="56"
      rx="14"
      fill="none"
      stroke="rgba(148, 255, 193, 0.25)"
      strokeWidth="1.4"
    />
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M26 58 36 48l10 8 12-16 12 6"
        stroke="url(#heroNeonLine)"
        strokeWidth="3"
      />
      <path d="M30 60v8" stroke="url(#heroNeonBars)" strokeWidth="3.2" />
      <path d="M42 54v14" stroke="url(#heroNeonBars)" strokeWidth="3.2" />
      <path d="M54 44v24" stroke="url(#heroNeonBars)" strokeWidth="3.2" />
      <path d="M66 40v28" stroke="url(#heroNeonBars)" strokeWidth="3.2" />
    </g>
    <circle cx="68" cy="36" r="5" fill="#b5ff8a" opacity="0.85" />
    <circle cx="30" cy="68" r="3" fill="#6bff95" opacity="0.8" />
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
