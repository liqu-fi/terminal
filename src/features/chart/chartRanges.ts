import {
  intervalSeconds,
  maxBarsPerRequest,
  ORACLE_INTERVALS,
  type OracleCandleInterval,
} from "@liq/core";

import type { ChartRangeKey } from "@/stores/useTerminalUiStore";

const DAY = 86_400;

/** Ширина окна в секундах — нижний ряд рамки макета. */
export const CHART_RANGES: Record<ChartRangeKey, number> = {
  "1D": DAY,
  "5D": 5 * DAY,
  "1M": 30 * DAY,
  "3M": 90 * DAY,
  "6M": 180 * DAY,
  "1Y": 365 * DAY,
};

/**
 * Чарт всегда читает оракульный ряд.
 *
 * @remarks
 * У торгового маршрута окно ограничено тридцатью сутками независимо от
 * интервала, а на рынке, где час никто не торговал, бара просто нет. Оба
 * свойства ломают именно длинные окна, ради которых нижний ряд и существует.
 */
export const CHART_ROUTE = "oracle" as const;

export function barsForRange(
  range: ChartRangeKey,
  interval: OracleCandleInterval,
): number {
  return Math.ceil(CHART_RANGES[range] / intervalSeconds(interval));
}

/**
 * Самый мелкий интервал не грубее запрошенного, которым окно ещё влезает.
 *
 * @remarks
 * Окно, не влезающее в потолок маршрута, отдаётся хвостом — и подписывается
 * ярлыком всего окна. Поднять интервал честнее, чем показать сутки под
 * подписью «1Y».
 */
export function fitInterval(
  range: ChartRangeKey,
  interval: OracleCandleInterval,
): OracleCandleInterval {
  const from = ORACLE_INTERVALS.indexOf(interval);
  const start = from === -1 ? 0 : from;
  for (const candidate of ORACLE_INTERVALS.slice(start)) {
    if (
      barsForRange(range, candidate) <= maxBarsPerRequest(candidate, CHART_ROUTE)
    )
      return candidate;
  }
  return ORACLE_INTERVALS[ORACLE_INTERVALS.length - 1];
}
