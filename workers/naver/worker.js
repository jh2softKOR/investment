export default {
  async fetch(request, env, ctx) {
    const urls = {
      USDKRW: "https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:USD_KRW",
      GOLD: "https://polling.finance.naver.com/api/realtime?query=COMMODITY:CMDT_GC",
      SILVER: "https://polling.finance.naver.com/api/realtime?query=COMMODITY:CMDT_SI",
      OIL: "https://polling.finance.naver.com/api/realtime?query=COMMODITY:CMDT_CL"
    };

    async function getQuote(name, url) {
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`네이버 ${name} 응답 오류 (status: ${res.status})`)
      }
      const json = await res.json()
      const d = json.result.areas[0].datas[0]
      return {
        symbol: name,
        price: d.nv,
        change: d.cv,
        changePct: d.cr
      }
    }

    try {
      const results = await Promise.all([
        getQuote("USDKRW", urls.USDKRW),
        getQuote("GOLD", urls.GOLD),
        getQuote("SILVER", urls.SILVER),
        getQuote("OIL", urls.OIL)
      ])
      return new Response(JSON.stringify(results), {
        headers: { "Content-Type": "application/json" }
      })
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 })
    }
  }
}
