import { useEffect, useRef } from 'react'

type TradingViewChartProps = {
  symbol: string
  interval?: '1' | '3' | '5' | '15' | '30' | '60' | '120' | '240' | 'D'
  theme?: 'light' | 'dark'
}

const TradingViewChart = ({ symbol, interval = '15', theme = 'dark' }: TradingViewChartProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const container = containerRef.current
    container.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: 'Asia/Seoul',
      theme,
      style: '1',
      locale: 'kr',
      enable_publishing: false,
      allow_symbol_change: false,
      hide_side_toolbar: false,
      hide_top_toolbar: false,
      withdateranges: true,
      save_image: false,
      studies: [],
      support_host: 'https://www.tradingview.com',
    })

    container.appendChild(script)

    return () => {
      container.innerHTML = ''
    }
  }, [symbol, interval, theme])

  return (
    <div className="tradingview-widget-container chart-container">
      <div className="tradingview-widget-container__widget" ref={containerRef} />
    </div>
  )
}

export default TradingViewChart
