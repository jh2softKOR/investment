# JH 투자 촉진위원회 인사이트 허브

개인 투자자에게 필요한 USD 경제 지표, 미국 주식 및 주요 코인 시세, 최신 경제 뉴스를 한 화면에서 제공합니다.

## 주요 기능

- **USD 경제 캘린더**: Trading Economics API를 통해 미국 달러에 영향을 주는 핵심 지표를 일간/주간으로 확인
- **실시간 차트**: 나스닥, 다우지수, 비트코인, 이더리움, 리플, BGSC 선물 차트를 15분 봉 기준으로 제공
- **가격 티커**: 주요 지수와 코인의 현재가 및 등락률을 실시간으로 갱신
- **경제 뉴스**: 글로벌 경제 관련 속보를 빠르게 모아 제공

## 데이터 출처

| 데이터 | 출처 |
| --- | --- |
| 경제 캘린더 | [Trading Economics Economic Calendar API](https://tradingeconomics.com/api/) |
| 지수 가격 | [Financial Modeling Prep Quote API](https://financialmodelingprep.com/developer/docs/stock-market/real-time-stock-prices/) |
| 코인 가격 | [Binance 24hr Ticker API](https://binance-docs.github.io/apidocs/spot/en/#24hr-ticker-price-change-statistics) |
| 경제 뉴스 | [Alpha Vantage News Sentiment API](https://www.alphavantage.co/documentation/) |
| 차트 위젯 | [TradingView Advanced Chart](https://www.tradingview.com/widget/advanced-chart/) |

## 환경 변수 설정

무료 데모 키도 동작하지만, 안정적인 사용을 위해 개인 API 키를 `.env` 파일에 설정하는 것을 권장합니다.

```bash
# frontend/.env
VITE_FMP_KEY=your_financial_modeling_prep_key
VITE_ALPHA_VANTAGE_KEY=your_alpha_vantage_key
# 백엔드 프록시 서버 주소를 직접 지정하고 싶다면 설정하세요 (예: http://localhost:4174)
# VITE_CALENDAR_API_BASE_URL=
# 상담창구 API 서버 기본 주소 (예: https://api.example.com 또는 https://api.example.com/api)
# VITE_CONSULTATION_API_BASE_URL=
# 상담 요청을 이메일로도 수신하려면 주소를 지정하세요 (예: consult@example.com)
# VITE_CONSULTATION_MAILTO=
# 모든 실시간 호출을 비활성화하려면 0으로 설정 (기본값은 활성화)
# VITE_DEFAULT_LIVE_DATA=0
# 특정 위젯만 비활성화하려면 아래 플래그 중 하나를 0 또는 off 등으로 설정합니다.
# VITE_ENABLE_LIVE_CALENDAR_DATA=1
# VITE_ENABLE_LIVE_MARKET_DATA=1
# VITE_ENABLE_LIVE_TICKER_DATA=1
# VITE_ENABLE_LIVE_NEWS_DATA=1
# VITE_ENABLE_LIVE_SENTIMENT_DATA=1
# 사용자 지정 시세 JSON을 활용하려면 경로를 지정합니다. (기본값: /data/custom-ticker.json)
# VITE_CUSTOM_TICKER_URL=/data/custom-ticker.json
# 네이버 국제 시세 Cloudflare Worker 주소를 지정하면 해당 데이터를 최우선으로 사용합니다.
# VITE_NAVER_WORKER_URL=https://your-worker-name.your-subdomain.workers.dev/api/quotes

# backend/.env (예시)
TRADING_ECONOMICS_API_KEY=guest:guest
# 요청 캐시 TTL (초). 미설정 시 60초
# TRADING_ECONOMICS_CACHE_TTL_SECONDS=90
# 서버 포트와 허용 오리진을 커스터마이즈할 수 있습니다.
# PORT=4174
# ALLOWED_ORIGINS=http://localhost:5173
```

> ℹ️ 개발 서버에서도 실시간 경제 캘린더와 시세 데이터를 바로 확인할 수 있도록 기본값을 "활성화"로 유지하고 있습니다.
> 외부 API 호출을 제한하고 싶다면 `VITE_DEFAULT_LIVE_DATA=0` 또는 각 영역별 `VITE_ENABLE_LIVE_*` 플래그를 `.env`에 추가하세요.
> Trading Economics API는 `guest:guest` 공개 키로도 조회가 가능하지만, 무료 개인 키를 발급받아 `TRADING_ECONOMICS_API_KEY`에 설정하면 호출 한도를 보다 안정적으로 확보할 수 있습니다.

## 개발 및 빌드

```bash
npm install
npm run dev          # 프론트엔드 개발 서버 (기본 5173 포트)
npm run dev:server   # Trading Economics 프록시 서버 (기본 4174 포트)
npm run build        # 프로덕션 빌드 생성
npm run preview      # 빌드 검증
```

## 서버리스 투자 상담 창구 샘플

프론트엔드 프로젝트와 별개로, 온디바이스 LLM(WebLLM)과 FormSubmit을 이용해 **추가 서버 없이 동작하는 상담 창구 HTML 샘플**을 제공합니다.

- 위치: [`public/consultation.html`](public/consultation.html)
- 구성: 주간 미국 경제지표 위젯, 온디바이스 투자 Q&A, FormSubmit 기반 문의 메일 폼
- 사용 방법: 파일을 그대로 배포하거나 브라우저에서 열면 됩니다. 메일 전송 주소만 본인 주소로 교체하세요.

## 사용자 지정 시세 데이터 연동

- `public/data/custom-ticker.json` 파일을 수정하거나 `VITE_CUSTOM_TICKER_URL` 환경 변수로 직접 만든 API/JSON 주소를 지정하면
  원/달러 환율, WTI, 금, 은 가격을 우선적으로 불러옵니다.
- JSON 구조 예시는 다음과 같습니다.

```json
{
  "usdKrw": { "price": 1332.45, "changePercent": -0.28 },
  "wti": { "price": 78.92, "changePercent": 0.73 },
  "gold": { "price": 2368.45, "changePercent": 0.58 },
  "silver": { "price": 28.42, "changePercent": -0.21 }
}
```

- `changePercent`가 없다면 `change`와 `previousClose` 값으로 등락률을 계산하며, 데이터가 비어 있는 항목은 자동으로 다음 공급자로
  넘어갑니다.

## 네이버 국제 시세 Cloudflare Worker 연동

- [`workers/naver/worker.js`](workers/naver/worker.js)에 포함된 Cloudflare Worker 샘플은 네이버 금융 실시간 API를 호출해 원/달러 환율,
  국제 금, 은, 유가 시세를 JSON 배열로 반환합니다.
- Cloudflare Dashboard → **Workers & Pages** → **Create Worker**에서 새 워커를 만든 뒤, 샘플 코드를 그대로 붙여 넣고 저장/배포합니다.
- 배포 URL 예시: `https://your-worker-name.your-subdomain.workers.dev/api/quotes`
- 프론트엔드 `.env` 파일에 `VITE_NAVER_WORKER_URL`을 위 URL로 지정하면, 시세 티커는 네이버 워커 데이터를 최우선으로 사용하고,
  실패 시 기존 Yahoo Finance·Financial Modeling Prep·Metals.live 데이터로 자동 폴백합니다.

## 주의 사항

- 외부 API의 CORS 정책이나 호출 제한에 따라 데이터 로드가 지연되거나 실패할 수 있습니다.
- TradingView 위젯은 외부 스크립트를 로드하므로 네트워크 차단 환경에서는 표시되지 않을 수 있습니다.
- BGSC 선물 시세는 차트 중심으로 제공되며, 별도 가격 API가 필요하면 `MarketOverview` 구성에서 쉽게 확장할 수 있습니다.
- 상담창구 백엔드 연결이 불안정할 경우 입력 내용은 기기에 임시 저장되고, `VITE_CONSULTATION_MAILTO`를 지정하면 이메일 앱을 통해 직접 전송할 수 있습니다.
