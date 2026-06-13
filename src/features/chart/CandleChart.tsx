import {
  CandlestickSeries,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useMemo, useRef } from "react";

import { useCandles } from "./useCandles";
import { toLwcBar } from "./candleMapping";

export function CandleChart({ marketId }: { marketId: bigint | undefined }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const candles = useCandles(marketId, "1m");
  const bars = useMemo<CandlestickData<UTCTimestamp>[]>(
    () => candles.map(toLwcBar),
    [candles],
  );

  // Mount once: create chart + series. autoSize needs a sized parent.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const chart = createChart(node, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: "#8b90a0" },
      grid: {
        vertLines: { color: "#1c1f28" },
        horzLines: { color: "#1c1f28" },
      },
      timeScale: { timeVisible: true, secondsVisible: false },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#2ebd85",
      downColor: "#f6465d",
      borderVisible: false,
      wickUpColor: "#2ebd85",
      wickDownColor: "#f6465d",
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Push data; LWC requires ascending unique time (the gateway returns sorted).
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart || bars.length === 0) return;
    series.setData(bars);
    chart.timeScale().fitContent();
  }, [bars]);

  return <div ref={containerRef} className="h-full w-full" />;
}
