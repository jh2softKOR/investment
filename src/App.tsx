import './App.css'
import EconomicCalendar from './components/EconomicCalendar'
import MarketOverview from './components/MarketOverview'
import NewsFeed from './components/NewsFeed'

function App() {
  return (
    <div className="app">
      <div className="app-inner">
        <header className="hero">
          <h1>JH Investment Lab</h1>
          <p>
            개인 투자자에게 꼭 필요한 달러 경제 지표, 글로벌 증시 및 코인 시세, 그리고 실시간 경제 뉴스를 한눈에
            확인하세요.
          </p>
          <div className="badge-row">
            <span className="badge">USD 경제 캘린더</span>
            <span className="badge">나스닥 · 다우 실시간</span>
            <span className="badge">비트코인 · 이더리움 · 리플</span>
            <span className="badge">BGSC 선물 15분봉</span>
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
