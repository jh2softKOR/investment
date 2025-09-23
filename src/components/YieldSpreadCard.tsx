import TradingViewChart from './TradingViewChart'

const YieldSpreadCard = () => (
  <div className="yield-spread-card" role="complementary" aria-labelledby="yield-spread-title">
    <div className="yield-spread-header">
      <span id="yield-spread-title" className="yield-spread-title">
        미국 채권 2년-10년 스프레드
      </span>
      <span className="yield-spread-subtitle">US02Y - US10Y · 2년물 수익률 - 10년물 수익률</span>
    </div>
    <TradingViewChart symbol="TVC:US02Y-TVC:US10Y" interval="120" />
    <p className="yield-spread-meta">
      금리 스프레드가 마이너스로 내려갈수록 경기 침체 가능성이 커지는 경향이 있습니다.
    </p>
  </div>
)

export default YieldSpreadCard
