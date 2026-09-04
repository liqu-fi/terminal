import { ORACLE_INTERVALS } from "@liq/core";

import { useTerminalUiStore } from "@/stores/useTerminalUiStore";

import { CandleChart } from "./CandleChart";
import { barsForRange, CHART_RANGES, fitInterval } from "./chartRanges";

const RANGES = Object.keys(CHART_RANGES) as (keyof typeof CHART_RANGES)[];

function Control({
  testid,
  active,
  onClick,
  children,
}: {
  testid: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      data-active={active ? "true" : "false"}
      onClick={onClick}
      className={`rounded px-1.5 py-0.5 text-[11px] ${
        active ? "bg-surface-2 text-text" : "text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Рамка чарта: интервал бара сверху, окно и шкала снизу.
 *
 * @remarks
 * Кнопки `1s` нет — минимальный интервал обоих маршрутов минута, и кнопка,
 * которая не может показать секунды, обещала бы их.
 */
export function ChartFrame({
  marketId,
  actions,
}: {
  marketId: bigint | undefined;
  /** Управление рамкой от владельца — сейчас кнопка свёртки колонки. */
  actions?: React.ReactNode;
}) {
  const interval = useTerminalUiStore((s) => s.chartInterval);
  const range = useTerminalUiStore((s) => s.chartRange);
  const scaleMode = useTerminalUiStore((s) => s.chartScaleMode);
  const autoScale = useTerminalUiStore((s) => s.chartAutoScale);
  const setChartInterval = useTerminalUiStore((s) => s.setChartInterval);
  const setChartRange = useTerminalUiStore((s) => s.setChartRange);
  const setChartScaleMode = useTerminalUiStore((s) => s.setChartScaleMode);
  const toggleAutoScale = useTerminalUiStore((s) => s.toggleAutoScale);

  // Интервал, которым окно действительно рисуется. Подсветка остаётся на
  // выбранном: расхождение между «что я нажал» и «чем нарисовано» видно, и
  // это честнее молчаливой подмены.
  const effective = fitInterval(range, interval);

  return (
    <div className="flex h-full min-h-0 flex-col gap-1" data-testid="chart-frame">
      <div className="flex items-center gap-1">
        {ORACLE_INTERVALS.map((iv) => (
          <Control
            key={iv}
            testid={`chart-interval-${iv}`}
            active={iv === interval}
            onClick={() => setChartInterval(iv)}
          >
            {iv}
          </Control>
        ))}
        {actions ? <div className="ml-auto flex items-center">{actions}</div> : null}
      </div>
      <div className="min-h-0 flex-1">
        <CandleChart
          marketId={marketId}
          interval={effective}
          bars={barsForRange(range, effective)}
          scaleMode={scaleMode}
          autoScale={autoScale}
        />
      </div>
      <div className="flex items-center gap-1">
        {RANGES.map((key) => (
          <Control
            key={key}
            testid={`chart-range-${key}`}
            active={key === range}
            onClick={() => setChartRange(key)}
          >
            {key}
          </Control>
        ))}
        <div className="flex-1" />
        <Control
          testid="chart-scale-percent"
          active={scaleMode === "percent"}
          onClick={() => setChartScaleMode("percent")}
        >
          %
        </Control>
        <Control
          testid="chart-scale-log"
          active={scaleMode === "log"}
          onClick={() => setChartScaleMode("log")}
        >
          log
        </Control>
        <Control
          testid="chart-scale-auto"
          active={autoScale}
          onClick={toggleAutoScale}
        >
          auto
        </Control>
      </div>
    </div>
  );
}
