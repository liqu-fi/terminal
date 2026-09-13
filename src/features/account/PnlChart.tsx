import {
  BaselineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

import { cssVar } from "@/lib/cssVar";

import type { PnlPoint } from "./accountPage";

/**
 * Кривая накопленного PnL: выше нуля — цвет long, ниже — short. Родитель
 * задаёт высоту (`autoSize` меряет контейнер). Заливки прозрачные: линии
 * достаточно, а альфа-суффикс к hex-токену сломал бы форк с не-hex палитрой.
 */
export function PnlChart({
  series,
  testid,
}: {
  series: PnlPoint[];
  testid: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Baseline"> | null>(null);

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
      rightPriceScale: { borderVisible: false },
    });
    const baseline = chart.addSeries(BaselineSeries, {
      baseValue: { type: "price", price: 0 },
      topLineColor: long,
      topFillColor1: "transparent",
      topFillColor2: "transparent",
      bottomLineColor: short,
      bottomFillColor1: "transparent",
      bottomFillColor2: "transparent",
      lineWidth: 2,
      priceLineVisible: false,
    });
    chartRef.current = chart;
    seriesRef.current = baseline;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const baseline = seriesRef.current;
    const chart = chartRef.current;
    if (!baseline || !chart) return;
    baseline.setData(series);
    chart.timeScale().fitContent();
  }, [series]);

  return (
    <div className="relative h-full w-full" data-testid={testid}>
      <div ref={containerRef} className="h-full w-full" />
      {series.length === 0 && (
        <p
          className="absolute inset-0 flex items-center justify-center text-xs text-muted"
          data-testid={`${testid}-empty`}
        >
          No data for this period
        </p>
      )}
    </div>
  );
}
