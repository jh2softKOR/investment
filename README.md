# JH 투자 촉진위원회 인사이트 허브

개인 투자자에게 필요한 USD 경제 지표, 미국 주식 및 주요 코인 시세, 최신 경제 뉴스를 한 화면에서 제공합니다.

## 주요 기능

- **USD 경제 캘린더**: Investing.com 달력을 참고하여 미국 달러에 영향을 주는 핵심 지표를 일간/주간으로 확인
- **실시간 차트**: 나스닥, 다우지수, 비트코인, 이더리움, 리플, BGSC 선물 차트를 15분 봉 기준으로 제공
- **가격 티커**: 주요 지수와 코인의 현재가 및 등락률을 실시간으로 갱신
- **경제 뉴스**: 글로벌 경제 관련 속보를 빠르게 모아 제공

## 데이터 출처

| 데이터 | 출처 |
| --- | --- |
| 경제 캘린더 | [Financial Modeling Prep](https://financialmodelingprep.com/developer/docs/economic-calendar-api) (Investing.com 캘린더 참고) |
| 지수 가격 | [Financial Modeling Prep Quote API](https://financialmodelingprep.com/developer/docs/stock-market/real-time-stock-prices/) |
| 코인 가격 | [Binance 24hr Ticker API](https://binance-docs.github.io/apidocs/spot/en/#24hr-ticker-price-change-statistics) |
| 경제 뉴스 | [Alpha Vantage News Sentiment API](https://www.alphavantage.co/documentation/) |
| 차트 위젯 | [TradingView Advanced Chart](https://www.tradingview.com/widget/advanced-chart/) |

## 환경 변수 설정

무료 데모 키도 동작하지만, 안정적인 사용을 위해 개인 API 키를 `.env` 파일에 설정하는 것을 권장합니다.

```bash
# .env
VITE_FMP_KEY=your_financial_modeling_prep_key
VITE_ALPHA_VANTAGE_KEY=your_alpha_vantage_key
# 모든 실시간 호출을 비활성화하려면 0으로 설정 (기본값은 활성화)
# VITE_DEFAULT_LIVE_DATA=0
# 특정 위젯만 비활성화하려면 아래 플래그 중 하나를 0 또는 off 등으로 설정합니다.
# VITE_ENABLE_LIVE_CALENDAR_DATA=1
# VITE_ENABLE_LIVE_MARKET_DATA=1
# VITE_ENABLE_LIVE_TICKER_DATA=1
# VITE_ENABLE_LIVE_NEWS_DATA=1
# VITE_ENABLE_LIVE_SENTIMENT_DATA=1
```

> ℹ️ 개발 서버에서도 실시간 경제 캘린더와 시세 데이터를 바로 확인할 수 있도록 기본값을 "활성화"로 변경했습니다.
> 외부 API 호출을 제한하고 싶다면 `VITE_DEFAULT_LIVE_DATA=0` 또는 각 영역별 `VITE_ENABLE_LIVE_*` 플래그를 `.env`에 추가하세요.

## 개발 및 빌드

```bash
npm install
npm run dev     # 개발 서버 (기본 5173 포트)
npm run build   # 프로덕션 빌드 생성
npm run preview # 빌드 검증
```

## 주의 사항

- 외부 API의 CORS 정책이나 호출 제한에 따라 데이터 로드가 지연되거나 실패할 수 있습니다.
- TradingView 위젯은 외부 스크립트를 로드하므로 네트워크 차단 환경에서는 표시되지 않을 수 있습니다.
- BGSC 선물 시세는 차트 중심으로 제공되며, 별도 가격 API가 필요하면 `MarketOverview` 구성에서 쉽게 확장할 수 있습니다.
