const WIDGET_SRC =
  'https://sslecal2.investing.com?columns=exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous&importance=3&country=5&calType=week&timeZone=9'

const EconomicCalendar = () => {
  return (
    <section className="calendar-widget-card" aria-labelledby="economic-calendar-heading">
      <div className="ecal" id="usd-calendar">
        <header className="ecal__header">
          <div className="ecal__heading">
            <h2 id="economic-calendar-heading">미국 경제지표 캘린더</h2>
            <p className="ecal__widget-note">
              Investing.com 제공 미국 경제지표 위젯입니다. 위젯 내부 색상과 구성은 제공사 정책상 변경할 수 없으며,
              한국 시간(KST) 기준으로 표시됩니다.
            </p>
          </div>
        </header>

        <div className="ecal__tablewrap ecal__tablewrap--iframe">
          <iframe src={WIDGET_SRC} title="Investing.com Economic Calendar (United States)" height="600" loading="lazy" />
        </div>

        <footer className="ecal__footer">
          <small>Source: Investing.com Economic Calendar · Region: United States · Time zone: KST (UTC+9)</small>
        </footer>
      </div>
    </section>
  )
}

export default EconomicCalendar
