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
          <h1>JH Investment Lab</h1>
          <p>
            개인 투자자의 성공 투자를 위한 맞춤형 포탈 입니다. 전문가 상의가 필요하면 엔서니와 상의하세요.
          </p>
          <div className="hero-bottom-row">
            <div className="badge-row">
              <span className="badge">USD 경제 캘린더</span>
              <span className="badge">나스닥 · 다우 실시간</span>
              <span className="badge">비트코인 · 이더리움 · 리플</span>
              <span className="badge">BGSC 선물 15분봉</span>
            </div>
            <ExchangeRateTicker />
          </div>
        </header>

        <main className="content" aria-label="투자 인사이트">
          <EconomicCalendar />
          <MarketOverview />
          <NewsFeed />
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
