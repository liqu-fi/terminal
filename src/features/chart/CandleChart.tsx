import type { OracleCandleInterval } from "@liq/core";
import { useCandles } from "@liq/react";
import {
  CandlestickSeries,
  createChart,
  PriceScaleMode,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useMemo, useRef } from "react";

import type { ChartScaleMode } from "@/stores/useTerminalUiStore";

import { toLwcBar } from "./candleMapping";
import { CHART_ROUTE } from "./chartRanges";

/**
 * `lightweight-charts` wants concrete color strings, but the palette is
 * declared once in `src/styles/tokens.css` and that file is its one owner —
 * hardcoding hexes here would silently drift from a repaint of the tokens.
 */
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

export function CandleChart({
  marketId,
  interval,
  bars: barCount,
  scaleMode,
  autoScale,
}: {
  marketId: bigint | undefined;
  interval: OracleCandleInterval;
  /** Глубина истории; считается рамкой из выбранного окна. */
  bars: number;
  scaleMode: ChartScaleMode;
  autoScale: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const { bars: candles } = useCandles(marketId, interval, {
    bars: barCount,
    route: CHART_ROUTE,
  });
  const bars = useMemo<CandlestickData<UTCTimestamp>[]>(
    () => candles.map(toLwcBar),
    [candles],
  );

  // Mount once: create chart + series. autoSize needs a sized parent.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const muted = cssVar("--muted");
    const border = cssVar("--border");
    const long = cssVar("--long");
    const short = cssVar("--short");
    const chart = createChart(node, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: muted },
      grid: {
        vertLines: { color: border },
        horzLines: { color: border },
      },
      timeScale: { timeVisible: true, secondsVisible: false },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: long,
      downColor: short,
      borderVisible: false,
      wickUpColor: long,
      wickDownColor: short,
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

  // Режим шкалы — отдельным эффектом: он не зависит от данных, а применение
  // его вместе с ними перерисовывало бы шкалу на каждом баре.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.priceScale("right").applyOptions({
      mode:
        scaleMode === "percent"
          ? PriceScaleMode.Percentage
          : scaleMode === "log"
            ? PriceScaleMode.Logarithmic
            : PriceScaleMode.Normal,
      autoScale,
    });
  }, [scaleMode, autoScale]);

  return <div ref={containerRef} className="h-full w-full" />;
}
