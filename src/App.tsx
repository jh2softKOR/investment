import './App.css'
import EconomicCalendar from './components/EconomicCalendar'
import ExchangeRateTicker from './components/ExchangeRateTicker'
import MarketOverview from './components/MarketOverview'
import NewsFeed from './components/NewsFeed'

function App() {
  return (
    <div className="app">
      <div className="app-inner">
        <header className="hero">
          <div className="hero-main">
            <h1>JH Investment Lab</h1>
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
        </main>

        <section className="section consultation-section" aria-label="JH 컨설턴트 상담창구">
          <div className="consultation-content">
            <div className="consultation-text">
              <h2>투자 상담창구</h2>
              <p>
                투자 전략부터 시장 전망까지 궁금한 점이 있으신가요? 실시간 Q&amp;A 상담창구에서 JH 컨설턴트와
                직접 소통해 보세요.
              </p>
            </div>
            <a
              className="consultation-link"
              href="https://jhconsulting.kr/consultation"
              target="_blank"
              rel="noopener noreferrer"
            >
              상담 시작하기
            </a>
          </div>
          <p className="consultation-note">빠른 질의 응답이 가능한 1:1 맞춤형 상담 서비스입니다.</p>
        </section>

        <footer className="footer">
          © {new Date().getFullYear()} JH Investment Lab · 데이터 출처: Investing.com, Binance, Financial Modeling
          Prep, AlphaVantage
        </footer>
      </div>
    </div>
  )
}

export default App
