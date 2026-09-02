import type { CandleBar } from "@liq/core";
import type { CandlestickData, UTCTimestamp } from "lightweight-charts";
import { formatUnits } from "viem";

/**
 * Map a candle bar (bigint 18-dec OHLC, unix-seconds timestamp) to a
 * lightweight-charts bar. `time` stays in SECONDS — do NOT ×1000 (that's a
 * klinecharts-only quirk; LWC expects UTCTimestamp = seconds).
 */
export function toLwcBar(c: CandleBar): CandlestickData<UTCTimestamp> {
  return {
    time: c.timestamp as UTCTimestamp,
    open: Number(formatUnits(c.open, 18)),
    high: Number(formatUnits(c.high, 18)),
    low: Number(formatUnits(c.low, 18)),
    close: Number(formatUnits(c.close, 18)),
  };
}
