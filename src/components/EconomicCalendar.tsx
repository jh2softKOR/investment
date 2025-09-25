const INVESTING_ECONOMIC_CALENDAR_IFRAME = `<!-- Investing.com Economic Calendar Widget -->
<iframe 
  src="https://sslecal2.investing.com?columns=exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous&importance=3&country=5&calType=day&timeZone=8" 
  width="100%" 
  height="600" 
  frameborder="0" 
  allowtransparency="true" 
  marginwidth="0" 
  marginheight="0">
</iframe>
<!-- End Widget -->`

const EconomicCalendar = () => {
  return (
    <section className="calendar-widget-card" aria-labelledby="economic-calendar-heading">
      <div>
        <h2 id="economic-calendar-heading" className="calendar-widget-title">
          미국 주요 경제 지표 (Investing.com 위젯)
        </h2>
        <p className="calendar-widget-description">
          Investing.com에서 제공하는 미국(USD) 핵심 이벤트 달력을 직접 불러옵니다. 위젯이 보이지 않으면 Investing.com 공식 페이지에서
          일정을 확인해 주세요.
        </p>
      </div>
      <div
        className="calendar-widget-frame calendar-widget-frame--ready"
        dangerouslySetInnerHTML={{ __html: INVESTING_ECONOMIC_CALENDAR_IFRAME }}
      />
      <p className="calendar-widget-footnote">
        데이터 제공:{' '}
        <a href="https://www.investing.com/economic-calendar/" target="_blank" rel="noreferrer">
          Investing.com 경제 캘린더
        </a>
      </p>
    </section>
  )
}

export default EconomicCalendar
